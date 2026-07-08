import express from 'express';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config({ override: true });

const app = express();
const PORT = 3000;

const tempStorage = path.join(os.tmpdir(), 'uploads');
if (!fs.existsSync(tempStorage)) {
  fs.mkdirSync(tempStorage, { recursive: true });
}

// Set up multer for handling file uploads in chunks (up to 50MB per chunk)
const uploadDir = path.join(os.tmpdir(), 'multer_temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ 
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 } 
});

let ai: GoogleGenAI | null = null;
const getAi = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY; 
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const parseJson = (text: string) => {
    try {
        const cleanText = text.replace(/```json\n|\n```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        return [];
    }
};

const jobs = new Map<string, { status: string, result?: any, error?: string }>();

app.post('/api/upload-chunk', express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { fileId, chunkIndex, chunkData } = req.body;
    
    if (!chunkData) return res.status(400).json({ error: "No chunk data uploaded" });
    if (!fileId || chunkIndex === undefined) return res.status(400).json({ error: "Missing chunk metadata" });
    
    const chunkDir = path.join(tempStorage, fileId);
    if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });
    
    const chunkPath = path.join(chunkDir, chunkIndex.toString());
    const buffer = Buffer.from(chunkData, 'base64');
    fs.writeFileSync(chunkPath, buffer);
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transcribe', express.json({ limit: '10mb' }), async (req, res) => {
  const { fileId, fileName, mimeType } = req.body || {};
  
  if (!fileId || !fileName || !mimeType) {
    return res.status(400).json({ error: 'Missing required file metadata.' });
  }

  const chunkDir = path.join(tempStorage, fileId);
  const finalFilePath = path.join(tempStorage, `${fileId}_${fileName}`);

  if (!fs.existsSync(chunkDir)) {
    return res.status(400).json({ error: "File chunks not found." });
  }

  const jobId = fileId;
  jobs.set(jobId, { status: 'processing' });
  res.json({ jobId });

  (async () => {
    try {
      // Reassemble the file
      const chunks = fs.readdirSync(chunkDir).sort((a, b) => parseInt(a) - parseInt(b));
      const writeStream = fs.createWriteStream(finalFilePath);
      
      // Create a promise to wait for the stream to finish writing
      const writePromise = new Promise<void>((resolve, reject) => {
          writeStream.on('finish', () => resolve());
          writeStream.on('error', reject);
      });

      for (const chunk of chunks) {
        const chunkPath = path.join(chunkDir, chunk);
        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);
        fs.unlinkSync(chunkPath);
      }
      writeStream.end();
      fs.rmdirSync(chunkDir);
      
      await writePromise;

    const aiClient = getAi();

    // Upload the file to Gemini using the File API
     const uploadResult = await aiClient.files.upload({ 
      file: finalFilePath, 
      config: {
        mimeType: mimeType 
      }
    });

    let fileState = uploadResult.state;
    while (fileState === 'PROCESSING') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const fileInfo = await aiClient.files.get({ name: uploadResult.name });
        fileState = fileInfo.state;
        if (fileState === 'FAILED') {
            throw new Error("Gemini API failed to process the uploaded file.");
        }
    }

    const prompt = `
      You are an expert audio transcription assistant.
      Process the provided audio file and generate a detailed transcription.
      
      CRITICAL REQUIREMENT for Speaker Diarization:
      - You MUST create a new segment EVERY SINGLE TIME the speaker changes.
      - Even if a speaker interjects with a single word (e.g., "Yeah", "Uh-huh"), you must break the current segment, create a new segment for the interjection, and then create another new segment when the original speaker resumes.
      - NEVER include words from two different speakers in the same segment. Be extremely precise with diarization.
      
      Requirements:
      1. Identify distinct speakers (e.g., Speaker 1, Speaker 2, or names if context allows).
      2. Provide accurate timestamps for each segment (Format: MM:SS - MM:SS).
      3. Detect the primary language of each segment.
      4. If the segment is in a language different than English, also provide the English translation.
      5. Identify the primary emotion of the speaker in this segment. You MUST choose exactly one of the following: Happy, Sad, Angry, Neutral.
      6. Provide a brief summary of the entire audio at the beginning.
      
      Output Format: JSON object with the following structure:
      {
        "summary": "A brief summary of the conversation...",
        "segments": [
          {
            "speaker": "Speaker 1",
            "timestamp": "00:00 - 00:15",
            "content": "Hello, how are you doing today?",
            "language": "English",
            "language_code": "en",
            "translation": "",
            "emotion": "Happy"
          }
        ]
      }
    `;

    const modelId = "gemini-3.5-flash";

     const response = await aiClient.models.generateContent({
      model: modelId,
      contents: [
        {
            fileData: {
                fileUri: uploadResult.uri,
                mimeType: uploadResult.mimeType,
            }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "A concise summary of the audio content.",
            },
            segments: {
              type: Type.ARRAY,
              description: "List of transcribed segments with speaker and timestamp.",
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                  content: { type: Type.STRING },
                  language: { type: Type.STRING },
                  language_code: { type: Type.STRING },
                  translation:  { type: Type.STRING },
                  emotion: { 
                    type: Type.STRING, 
                    description: "The emotion of the speaker.",
                    enum: ['Happy', 'Sad', 'Angry', 'Neutral']
                  },
                },
                required: ["speaker", "timestamp", "content", "language", "language_code", "emotion"],
              },
            },
          },
          required: ["summary", "segments"],
        },
      },
    });
    
    // Clean up local final file
    if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);

    const text = response.text;
    if (!text) throw new Error("No response text received from Gemini.");

    const data = parseJson(text);
    jobs.set(jobId, { status: 'done', result: data });

  } catch (error: any) {
    console.error("Gemini Transcription Error:", error);
    // Clean up local final file if it exists
    if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
    jobs.set(jobId, { status: 'error', error: error.message || 'An error occurred during transcription' });
  }
  })();
});

app.get('/api/transcribe/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer();
