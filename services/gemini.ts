import { GoogleGenAI, Type, Schema, Modality, HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import { SYSTEM_PROMPT, LAB_PROMPT, REGENERATE_PROMPT, CrystalResponse, AnalysisMode, ConversationSpeed, AppSettings, LaboratorySimulation, Profile, Message } from "../types";

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    momentReading: { type: Type.STRING, description: "Leitura do momento atual" },
    interestLevel: { type: Type.STRING, description: "Nível de interesse: Baixo, Médio, Alto ou Oscilante" },
    interestScore: { type: Type.INTEGER },
    investmentScore: { type: Type.INTEGER },
    riskScore: { type: Type.INTEGER },
    meetingChance: { type: Type.INTEGER },
    emotion: { type: Type.STRING },
    dynamic: { type: Type.STRING },
    risk: { type: Type.STRING },
    detectedMode: { type: Type.STRING },
    behavioralPattern: { type: Type.STRING, description: "Resumo do padrão de comportamento e personalidade da garota baseado na conversa até agora." },
    responses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          text: { type: Type.STRING },
          explanation: { type: Type.STRING, description: "Explicação psicológica do porquê esta resposta funciona e o que ela ensina." }
        },
        required: ["type", "text", "explanation"]
      }
    },
    rhythm: { type: Type.STRING, description: "Ritmo recomendado: Agora, Esperar, Mudar assunto, Sumir ou Encerrar" }
  },
  required: ["momentReading", "interestLevel", "interestScore", "investmentScore", "riskScore", "meetingChance", "emotion", "dynamic", "risk", "detectedMode", "responses", "rhythm", "behavioralPattern"]
};

const labSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    variations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          style: { type: Type.STRING, description: "Estilo: Confiante, Provocante ou Misteriosa" },
          text: { type: Type.STRING },
          impact: {
            type: Type.OBJECT,
            properties: {
              attraction: { type: Type.STRING, description: "Atração: Baixa, Média ou Alta" },
              curiosity: { type: Type.STRING, description: "Curiosidade: Baixa, Média ou Alta" },
              risk: { type: Type.STRING, description: "Risco: Baixo, Médio ou Alto" }
            },
            required: ["attraction", "curiosity", "risk"]
          },
          bestScenario: { type: Type.STRING }
        },
        required: ["style", "text", "impact", "bestScenario"]
      }
    },
    prediction: {
      type: Type.OBJECT,
      properties: {
        likelyResponse: { type: Type.STRING },
        alternativeResponse: { type: Type.STRING },
        adviceIfSilence: { type: Type.STRING },
        adviceIfResponse: { type: Type.STRING }
      },
      required: ["likelyResponse", "alternativeResponse", "adviceIfSilence", "adviceIfResponse"]
    }
  },
  required: ["variations", "prediction"]
};

const regenerateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    responses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          text: { type: Type.STRING },
          explanation: { type: Type.STRING, description: "Explicação psicológica do porquê esta resposta funciona e o que ela ensina." }
        },
        required: ["type", "text", "explanation"]
      }
    }
  },
  required: ["responses"]
};

export const getGeminiAI = (settings?: AppSettings) => {
  let platformApiKey;
  let defaultApiKey;
  try {
    if (typeof process !== 'undefined' && process.env) {
      platformApiKey = process.env['API_KEY'];
      defaultApiKey = process.env['GEMINI_API_KEY'];
    }
  } catch (e) {}

  const apiKey = platformApiKey || settings?.customApiKey || defaultApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key não configurada. Por favor, insira sua chave nas configurações.");
  }
  return new GoogleGenAI({ apiKey });
};

const sanitizeJSON = (str: string) => {
  let inString = false;
  let escaped = false;
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
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

export const generateAIResponse = async (userMessage: string, settings?: AppSettings): Promise<string> => {
  try {
    const ai = getGeminiAI(settings);
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: userMessage,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    });

    return response.text || "";
  } catch (error) {
    return handleGeminiError(error);
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
  const ai = getGeminiAI(settings);
  const model = "gemini-3.1-pro-preview"; 

  const parts: any[] = [];
  
  let profileInstruction = "";
  if (profileContext && profileContext.id !== "general") {
    profileInstruction = `
    👤 PERFIL ATIVO (ALVO): ${profileContext.name}
    DESCRIÇÃO DO ALVO: ${profileContext.description}
    PADRÃO DELA: ${profileContext.behavioralPattern || "Ainda em análise"}
    RISCO ANTERIOR: ${profileContext.metrics.risk}
    
    ⚠️ ADAPTE SUA ESTRATÉGIA À DESCRIÇÃO DO ALVO!
    `;
  }

  let userAIProfileInstruction = "";
  if (userAIProfile) {
    userAIProfileInstruction = `
    🧠 USER PROFILE (O USUÁRIO):
    Objetivo: ${userAIProfile.goal}
    Nível de Experiência: ${userAIProfile.experienceLevel}
    Estilo de Comunicação: ${userAIProfile.communicationStyle}
    Nível de Flerte Preferido: ${userAIProfile.flirtLevel}
    Tamanho de Resposta Preferido: ${userAIProfile.responseLength}
    Plataforma Principal: ${userAIProfile.mainPlatform}
    Objetivo da Conversa: ${userAIProfile.conversationGoal}
    Tipo de Personalidade: ${userAIProfile.personalityType}
    
    A IA DEVE ADAPTAR AS RESPOSTAS COM BASE NESTE PERFIL DO USUÁRIO.
    `;
  }

  let historyInstruction = "";
  if (messageHistory && messageHistory.length > 0) {
    const formattedHistory = messageHistory.map(m => {
      if (m.role === 'user') return `Usuário (Alvo): ${m.content || '[Imagem enviada]'}`;
      if (m.role === 'assistant' && m.analysis) {
        return `NaLábia (Sua sugestão anterior): ${m.analysis.responses[0]?.text || 'Análise gerada'}`;
      }
      return `${m.role}: ${m.content}`;
    }).join('\n');
    
    historyInstruction = `
    📜 HISTÓRICO DESTA INTERAÇÃO (MODO: ${mode}):
    ${formattedHistory}
    
    LEMBRE-SE: Continue a partir deste histórico. Não repita o que já foi dito. Evolua a conversa.
    `;
  }

  const contextInstruction = `
  ⚡ NaLábia - PARÂMETROS DE OPERAÇÃO:
  
  MODO: ${mode}
  ${profileInstruction}
  ${userAIProfileInstruction}
  ${historyInstruction}
  
  🎚️ SLIDERS (Intenção do Usuário):
  - Flirt: ${flirtLevel}/10
  - NaLábia: ${wittyLevel}/10
  - Dominância: ${dominanceLevel}/10
  - Mistério: ${mysteryLevel}/10
  
  ⚡ VELOCIDADE: ${speed.toUpperCase()}

  ⚙️ CONFIGURAÇÕES GLOBAIS (RESPEITE RIGOROSAMENTE):
  - Respostas Curtas: ${settings?.ai?.shortResponses ? 'ATIVADO (Seja breve)' : 'OFF'}
  - Zero Elogios Físicos: ${settings?.ai?.avoidCompliments ? 'ATIVADO (Proibido chamar de linda/gata)' : 'OFF'}
  - Evitar Perguntas: ${settings?.ai?.avoidQuestions ? 'ATIVADO (Prefira afirmações)' : 'OFF'}
  - Auto-Ajuste de Risco: ${settings?.ai?.autoAdjustFlirt ? 'ATIVADO (Reduza flirt se houver risco)' : 'OFF'}
  - Anti-Carência: ${settings?.safety?.antiNeedy ? 'ATIVADO' : 'OFF'}
  
  ⚠️ ATENÇÃO: Se a leitura de risco for alta, ignore os sliders altos e proteja o valor do usuário (Auto-Correção).
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

  if (text) {
    parts.push({ text });
  }

  if (parts.length === 1) {
    throw new Error("No content to analyze.");
  }

  console.log("Prompt enviado:", parts);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        temperature: 0.75, 
        maxOutputTokens: 8192,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    });

    console.log("Resposta da IA:", response);

    let responseText = response.text;
    if (!responseText) throw new Error("Empty response from NaLábia.");

    // Remove potential markdown formatting
    responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    responseText = sanitizeJSON(responseText);

    try {
      const analysis = JSON.parse(responseText) as CrystalResponse;
      return analysis;
    } catch (e) {
      console.error("Failed to parse JSON. Response text:", responseText);
      throw new Error("A IA retornou um formato inválido.");
    }

  } catch (error) {
    console.error("NaLábia Error:", error);
    return handleGeminiError(error);
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
  const model = "gemini-3.1-pro-preview";

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
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
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
    responseText = sanitizeJSON(responseText);

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Regeneration Error:", error);
    return handleGeminiError(error);
  }
};

export const generateAudio = async (text: string, settings?: AppSettings): Promise<string> => {
  const ai = getGeminiAI(settings);
  
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
  const model = "gemini-3.1-pro-preview"; 

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
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
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
    responseText = sanitizeJSON(responseText);

    return JSON.parse(responseText) as LaboratorySimulation;

  } catch (e) {
    console.error("Lab Error", e);
    return handleGeminiError(e);
  }
}