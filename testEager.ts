import { GoogleGenAI } from '@google/genai';
try {
  new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log("Success");
} catch (e) {
  console.log("Error:", e);
}
