import { analyzeContent } from './services/gemini.js';

async function test() {
  try {
    const res = await analyzeContent(
      "Oi, tudo bem?",
      undefined,
      "HOME",
      5, 5, 5, 5,
      "normal",
      {} as any
    );
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
