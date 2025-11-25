import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Please provide GEMINI_API_KEY in .env');
  process.exit(1);
}

console.log("Testing with API Key starting with:", apiKey.substring(0, 10) + "...");

const genAI = new GoogleGenerativeAI(apiKey);

async function testGemini() {
  try {
    console.log("\nTesting Generation with gemini-2.0-flash (v1)...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: 'v1' });
    const result = await model.generateContent("Say hello");
    console.log(`SUCCESS:`, result.response.text());

    console.log("\nTesting Embeddings with text-embedding-004 (v1)...");
    const embedModel = genAI.getGenerativeModel({ model: "text-embedding-004" }, { apiVersion: 'v1' });
    const embedResult = await embedModel.embedContent("Hello world");
    console.log(`SUCCESS: Embedding generated (length ${embedResult.embedding.values.length})`);

  } catch (e) {
    console.error("Unexpected error:", e);
  }
}

testGemini();
