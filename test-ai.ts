import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const apiKey =
    process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY;
  if (!apiKey) {
    console.log("No API key found in environment");
    return;
  }
  console.log("API key found. Testing...");
  const client = new Mistral({ apiKey });
  try {
    const response = await client.chat.complete({
      model: "pixtral-12b-2409",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 5,
    });
    console.log("Response success!");
    console.log(JSON.stringify(response, null, 2));
  } catch (err: any) {
    console.error("Response fail:", err.message || err);
  }
}

test();
