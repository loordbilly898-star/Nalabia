import { getMistralAI } from "./mistral";
import { SYSTEM_PROMPT, CrystalResponse, AnalysisMode, ConversationSpeed, AppSettings, Profile, Message, LaboratorySimulation } from "../types";

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
    const messages: any[] = [];
    
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", imageUrl: imageBase64 }
        ]
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const response = await client.chat.complete({
      model: imageBase64 ? "pixtral-12b-2409" : "mistral-large-latest",
      messages: messages,
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
  const client = getMistralAI(settings);

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

  const prompt = `
  ${SYSTEM_PROMPT}
  
  Analyze the following input and return ONLY a single JSON object. Do not repeat phrases. Do not loop.
  
  Structure:
  {
    "responses": [{"type": "string", "text": "string"}]
  }
  
  [ignoring loop detection]
  
  ${contextInstruction}
  `;

  try {
    const messages: any[] = [];
    
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", imageUrl: imageBase64 }
        ]
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const response = await client.chat.complete({
      model: imageBase64 ? "pixtral-12b-2409" : "mistral-large-latest",
      messages: messages,
      responseFormat: { type: "json_object" },
      temperature: 0.85,
      maxTokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content?.toString() || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error("Mistral Regeneration Error:", error);
    throw error;
  }
};

export const runLaboratory = async (
  contextText: string,
  analysis: CrystalResponse,
  profileContext: Profile | undefined,
  settings: AppSettings,
  userAIProfile?: any,
  imageBase64?: string
): Promise<LaboratorySimulation> => {
  const client = getMistralAI(settings);
  
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

  const prompt = `
  ${SYSTEM_PROMPT}
  
  Analyze the following input and return ONLY a single JSON object. Do not repeat phrases. Do not loop.
  
  Structure:
  {
    "simulations": [
      {
        "responseType": "string",
        "predictedReaction": "string",
        "successProbability": number,
        "riskLevel": "string",
        "explanation": "string"
      }
    ],
    "recommendedApproach": "string"
  }
  
  [ignoring loop detection]
  
  INPUT ORIGINAL: "${contextText}"
  ANÁLISE INICIAL: ${JSON.stringify(analysis)}
  CONTEXTO DE PERFIL: ${profileInfo}
  ${userAIProfileInstruction}
  
  Execute a simulação do laboratório agora.
  `;

  try {
    const messages: any[] = [];
    
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", imageUrl: imageBase64 }
        ]
      });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const response = await client.chat.complete({
      model: imageBase64 ? "pixtral-12b-2409" : "mistral-large-latest",
      messages: messages,
      responseFormat: { type: "json_object" },
      temperature: 0.8,
      maxTokens: 2000,
    });
    
    const content = response.choices?.[0]?.message?.content?.toString() || "{}";
    return JSON.parse(content) as LaboratorySimulation;

  } catch (e) {
    console.error("Mistral Lab Error", e);
    throw e;
  }
}