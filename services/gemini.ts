import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SYSTEM_PROMPT, CrystalResponse, AnalysisMode, ConversationSpeed, AppSettings, Profile, Message } from "../types";
import { getMistralAI } from "./mistral";

export const getGeminiAI = (settings?: AppSettings) => {
  const apiKey = settings?.customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

export const handleGeminiError = async (error: any) => {
  let errorString = '';
  try {
    errorString = typeof error === 'string' ? error : JSON.stringify(error) + (error.message || '');
  } catch (e) {
    errorString = error?.message || String(error);
  }
  
  const isQuotaError = errorString.includes("429") || errorString.includes("RESOURCE_EXHAUSTED") || errorString.includes("quota");
  const isNotFoundError = errorString.includes("Requested entity was not found.");
  const isAuthError = errorString.includes("API key not valid") || errorString.includes("API_KEY_INVALID");

  if (isQuotaError || isNotFoundError || isAuthError) {
    if (typeof window !== 'undefined' && (window as any).aistudio && (window as any).aistudio.openSelectKey) {
      try {
        await (window as any).aistudio.openSelectKey();
      } catch (e) {
        console.error("Failed to open API key selection dialog:", e);
      }
    }
  }

  if (isQuotaError) {
    throw new Error("A cota da API do Gemini foi excedida. Uma janela foi aberta para você selecionar sua própria chave de API do Google Cloud.");
  }

  if (isNotFoundError) {
    throw new Error("O modelo de IA solicitado não está disponível. Uma janela foi aberta para você verificar sua chave de API.");
  }
  
  if (isAuthError) {
    throw new Error("A chave de API é inválida. Uma janela foi aberta para você selecionar uma chave válida.");
  }

  throw error;
};

import { getMistralAI } from "./mistral";
import { SYSTEM_PROMPT, CrystalResponse, AnalysisMode, ConversationSpeed, AppSettings, Profile, Message } from "../types";

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
  // Use Mistral for analysis as requested
  const client = getMistralAI(settings);
  
  const prompt = `
  ${SYSTEM_PROMPT}
  
  Analyze the following input and return ONLY a JSON object with the following structure:
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
  
  Input: ${text}
  `;

  try {
    const response = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
      temperature: 0.75,
    });

    const content = response.choices?.[0]?.message?.content?.toString() || "{}";
    return JSON.parse(content) as CrystalResponse;
  } catch (error) {
    console.error("Mistral Analysis Error:", error);
    throw error;
  }
};

export const regenerateContent = async (
  originalText: string,
  imageBase64: string | undefined,
  mode: AnalysisMode,
  sliders: { flirt: number, witty: number, dominance: number, mystery: number },
  speed: ConversationSpeed,
  settings: AppSettings,
  profileContext?: Profile,
  userAIProfile?: any
): Promise<{ responses: { type: string, text: string }[] }> => {
  const ai = getGeminiAI(settings);
  const model = "gemini-3-flash-preview";

  const parts: any[] = [];

  let userAIProfileInstruction = "";
  if (userAIProfile) {
    userAIProfileInstruction = `
    🧠 USER PROFILE (CONTEXTO PERMANENTE):
    Objetivo: ${userAIProfile.goal}
    Nível de Experiência: ${userAIProfile.experienceLevel}
    Estilo de Comunicação: ${userAIProfile.communicationStyle}
    Nível de Flerte Preferido: ${userAIProfile.flirtLevel}
    Tamanho de Resposta Preferido: ${userAIProfile.responseLength}
    Plataforma Principal: ${userAIProfile.mainPlatform}
    Objetivo da Conversa: ${userAIProfile.conversationGoal}
    Tipo de Personalidade: ${userAIProfile.personalityType}
    `;
  }

  const contextInstruction = `
  INPUT ORIGINAL:
  "${originalText}"
  
  MODO: ${mode}
  ${userAIProfileInstruction}
  
  ⚙️ SLIDERS:
  - Flerte: ${sliders.flirt}/10
  - Sagacidade: ${sliders.witty}/10
  - Dominância: ${sliders.dominance}/10
  - Mistério: ${sliders.mystery}/10
  - Velocidade: ${speed}

  ⚙️ CONFIGS:
  - Respostas Curtas: ${settings?.ai?.shortResponses ? 'ON' : 'OFF'}
  - Anti-Gado: ${settings?.ai?.avoidCompliments ? 'ON' : 'OFF'}
  `;

  parts.push({ text: contextInstruction });

  if (imageBase64) {
    const mimeType = imageBase64.startsWith('data:') 
      ? imageBase64.split(';')[0].split(':')[1] 
      : "image/jpeg";
    const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: cleanBase64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT + "\n" + REGENERATE_PROMPT,
        responseMimeType: "application/json",
        responseSchema: regenerateSchema,
        temperature: 0.85, // Slightly higher for variation
        maxOutputTokens: 8192,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    });

    let responseText = response.text;
    if (!responseText) throw new Error("Failed to regenerate");

    // Remove potential markdown formatting
    responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Regeneration Error:", error);
    return handleGeminiError(error);
  }
};

export const generateAudio = async (text: string, settings?: AppSettings): Promise<string> => {
  let apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Geração de áudio requer chave da API do Google Gemini configurada no ambiente.");
  }
  
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say naturally and confidently: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Charon' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Failed to generate audio");
    
    return base64Audio;
  } catch (error) {
    console.error("Audio Generation Error:", error);
    return handleGeminiError(error);
  }
};

export const runLaboratory = async (
  contextText: string,
  analysis: CrystalResponse,
  profileContext: Profile | undefined,
  settings: AppSettings,
  userAIProfile?: any
): Promise<LaboratorySimulation> => {
  const ai = getGeminiAI(settings);
  const model = "gemini-3-flash-preview"; 

  const parts: any[] = [];
  
  let profileInfo = "";
  if (profileContext) {
    profileInfo = `Perfil: ${profileContext.name}. Nível de Interesse: ${profileContext.metrics.interest}.`;
  }

  let userAIProfileInstruction = "";
  if (userAIProfile) {
    userAIProfileInstruction = `
    🧠 USER PROFILE (CONTEXTO PERMANENTE):
    Objetivo: ${userAIProfile.goal}
    Nível de Experiência: ${userAIProfile.experienceLevel}
    Estilo de Comunicação: ${userAIProfile.communicationStyle}
    Nível de Flerte Preferido: ${userAIProfile.flirtLevel}
    Tamanho de Resposta Preferido: ${userAIProfile.responseLength}
    Plataforma Principal: ${userAIProfile.mainPlatform}
    Objetivo da Conversa: ${userAIProfile.conversationGoal}
    Tipo de Personalidade: ${userAIProfile.personalityType}
    `;
  }

  parts.push({ 
    text: `INPUT ORIGINAL: "${contextText}"
    ANÁLISE INICIAL: ${JSON.stringify(analysis)}
    CONTEXTO DE PERFIL: ${profileInfo}
    ${userAIProfileInstruction}
    
    Execute a simulação do laboratório agora.` 
  });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT + "\n" + LAB_PROMPT,
        responseMimeType: "application/json",
        responseSchema: labSchema,
        temperature: 0.8,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    });
    
    let responseText = response.text;
    if(!responseText) throw new Error("Failed to generate lab results");

    // Remove potential markdown formatting
    responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    return JSON.parse(responseText) as LaboratorySimulation;

  } catch (e) {
    console.error("Lab Error", e);
    return handleGeminiError(e);
  }
}