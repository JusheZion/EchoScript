import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    fs.writeFileSync('test.txt', 'hello world');
    const uploadResult = await ai.files.upload({ file: 'test.txt', config: { mimeType: 'text/plain' } });
    console.log("Upload Name:", uploadResult.name, "State:", uploadResult.state);
    const fileInfo = await ai.files.get({ name: uploadResult.name });
    console.log("Get State:", fileInfo.state);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
