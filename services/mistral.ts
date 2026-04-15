import { Mistral } from '@mistralai/mistralai';
import { SYSTEM_PROMPT, LAB_PROMPT, REGENERATE_PROMPT, CrystalResponse, AnalysisMode, ConversationSpeed, AppSettings, LaboratorySimulation, Profile, Message } from "../types";

// Note: Mistral doesn't support structured output schemas in the same way as Gemini.
// We will need to prompt for JSON and parse it.

export const getMistralAI = (settings?: AppSettings) => {
  // Try to get the key from settings, then Vite env vars, then process.env (for server-side)
  const apiKey = settings?.customApiKey || 
                 (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_MISTRAL_API_KEY : undefined) || 
                 (typeof process !== 'undefined' && process.env ? process.env.MISTRAL_API_KEY : undefined);
                 
  if (!apiKey || apiKey.trim() === '') {
    throw new Error("A chave da API do Mistral está ausente. Verifique se VITE_MISTRAL_API_KEY está configurada na Vercel.");
  }
  return new Mistral({ apiKey });
};

export const generateAIResponse = async (userMessage: string, settings?: AppSettings): Promise<string> => {
  try {
    const client = getMistralAI(settings);
    const response = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
    });

    return response.choices?.[0]?.message?.content?.toString() || "";
  } catch (error) {
    console.error("Mistral Error:", error);
    throw error;
  }
};

export const analyzeContent = async (
  text: string, 
  imageBase64: string | undefined,
  mode: AnalysisMode,
  flirtLevel: number,
  wittyLevel: number,
  dominanceLevel: number,
  mysteryLevel: number,
  speed: ConversationSpeed,
  settings: AppSettings,
  profileContext?: Profile,
  userAIProfile?: any,
  messageHistory?: Message[]
): Promise<CrystalResponse> => {
  const client = getMistralAI(settings);
  
  // Construct prompt for JSON output
  const prompt = `
  ${SYSTEM_PROMPT}
  
  Analyze the following input and return ONLY a single JSON object. Do not repeat phrases. Do not loop.
  
  Structure:
  {
    "momentReading": "string",
    "interestLevel": "string",
    "interestScore": number,
    "investmentScore": number,
    "riskScore": number,
    "meetingChance": number,
    "emotion": "string",
    "dynamic": "string",
    "risk": "string",
    "detectedMode": "string",
    "behavioralPattern": "string",
    "responses": [{"type": "string", "text": "string", "explanation": "string"}],
    "rhythm": "string"
  }
  
  [ignoring loop detection]
  
  Input: ${text}
  `;

  try {
    const response = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
      temperature: 0.7,
      maxTokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content?.toString() || "{}";
    return JSON.parse(content) as CrystalResponse;
  } catch (error) {
    console.error("Mistral Analysis Error:", error);
    throw error;
  }
};
