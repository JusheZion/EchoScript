import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const uploadResult = await ai.files.upload({ file: 'dummy.webm', config: { mimeType: 'audio/webm' } });
    console.log("Upload Name:", uploadResult.name, "State:", uploadResult.state);
    let state = uploadResult.state;
    while(state === 'PROCESSING') {
      console.log('Sleeping...');
      await new Promise(r => setTimeout(r, 2000));
      const fileInfo = await ai.files.get({ name: uploadResult.name });
      state = fileInfo.state;
      console.log("State:", state);
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
