import { GoogleGenerativeAI } from '@google/generative-ai';

export function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}
