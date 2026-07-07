/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptionSegment, Emotion } from "../types";

const parseJson = (text: string) => {
    try {
        const cleanText = text.replace(/```json\n|\n```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse JSON response:", e);
        return [];
    }
};

export const transcribeAudio = async (
  audioBlob: Blob,
  mimeType: string
): Promise<{ segments: TranscriptionSegment[]; summary: string }> => {
  try {
    let filename = 'upload.webm';
    if (audioBlob instanceof File && audioBlob.name) {
      filename = audioBlob.name;
    } else {
      // Guess extension from mimeType
      const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm';
      filename = `upload.${ext}`;
    }

    const CHUNK_SIZE = 512 * 1024; // 512KB chunks
    const totalChunks = Math.max(1, Math.ceil(audioBlob.size / CHUNK_SIZE));
    const fileId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, audioBlob.size);
      
      const chunk = audioBlob.size === 0 ? new Blob([]) : audioBlob.slice(start, end, mimeType);

      // Convert chunk to base64
      const base64Chunk = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.split(',')[1] || '';
              resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(chunk);
      });

      let res;
      let retries = 5; // Increased retries
      while (retries > 0) {
        try {
          res = await fetch('/api/upload-chunk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fileId,
              chunkIndex: i,
              totalChunks,
              chunkData: base64Chunk
            }),
          });
          if (!res.ok && res.status >= 500) {
            // Throw so we can retry on 500+ errors
            throw new Error(`Server returned ${res.status}`);
          }
          break; // success
        } catch (e: any) {
          retries--;
          if (retries === 0) {
            throw new Error(`Upload chunk ${i} network error: ${e.message}`);
          }
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * (5 - retries)));
        }
      }

      if (!res || !res.ok) {
        let errorMessage = `Failed to upload chunk ${i + 1}/${totalChunks}`;
        if (res) {
          try {
              const errorData = await res.json();
              errorMessage = errorData.error || errorMessage;
          } catch (e) {
              const text = await res.text();
              errorMessage = text ? text.replace(/<[^>]*>?/gm, '').substring(0, 100) : errorMessage;
          }
        }
        throw new Error(errorMessage);
      }
    }

    // After all chunks uploaded, request transcription
    let response;
    let retries = 3;
    while (retries > 0) {
      try {
        response = await fetch('/api/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fileId, fileName: filename, mimeType }),
        });
        break;
      } catch (e: any) {
        retries--;
        if (retries === 0) {
          throw new Error(`Transcribe start network error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!response || !response.ok) {
      let errorMessage = 'Transcription request failed';
      if (response) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const text = await response.text();
          errorMessage = text ? text.replace(/<[^>]*>?/gm, '').substring(0, 100) : errorMessage;
        }
      }
      throw new Error(errorMessage);
    }

    const { jobId } = await response.json();
    if (!jobId) throw new Error("No jobId returned from server.");

    // Poll for status
    while (true) {
      let pollRes;
      let pollRetries = 3;
      while (pollRetries > 0) {
        try {
          pollRes = await fetch(`/api/transcribe/${jobId}`);
          break;
        } catch (e: any) {
          pollRetries--;
          if (pollRetries === 0) {
            throw new Error(`Polling network error: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      if (!pollRes || !pollRes.ok) {
        throw new Error(`Polling failed with status ${pollRes?.status}`);
      }
      const job = await pollRes.json();
      
      if (job.status === 'done') {
        return job.result;
      } else if (job.status === 'error') {
        throw new Error(job.error);
      }
      
      // Wait 3 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

  } catch (error) {
    console.error("Gemini Transcription Error:", error);
    throw error;
  }
};