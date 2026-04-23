import { Mistral } from '@mistralai/mistralai';
import { SYSTEM_PROMPT, CHAT_RESPONSE_STRUCTURE, JSON_FORMAT_INSTRUCTION, LAB_PROMPT, NalabiaResponse, AnalysisMode, ConversationSpeed, AppSettings, Profile, Message, LaboratorySimulation, Memory } from "../types";
import { logEvent } from "./logger";

// Proxy implementation to call AI via the server
const aiProxy = {
  chat: {
    complete: async (body: any) => {
      const response = await fetch('/api/ai/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro na API: ${response.status}`);
      }
      return response.json();
    },
    stream: async function* (body: any) {
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        let errorMsg = `Erro no streaming: ${response.status}`;
        try {
          const rawText = await response.text();
          try {
            const errorData = JSON.parse(rawText);
            if (errorData.error) errorMsg = errorData.error;
          } catch (jsonErr) {
            // It's HTML or text (like Vercel 500 pages)
            console.error("[Vercel/Server Error HTML]:", rawText.substring(0, 500));
            if (rawText.toLowerCase().includes('timeout')) {
              errorMsg = 'O Provedor (Vercel) encerrou a conexão por tempo limite (Timeout).';
            } else if (rawText.includes('FUNCTION_INVOCATION_TIMEOUT')) {
              errorMsg = 'O servidor Vercel limitou o tempo em 10s (Limite Habitual).';
            } else {
              errorMsg = `Erro no servidor (Vercel 500). Verifique os logs do Vercel. Detalhe: ${rawText.substring(0, 50)}`;
            }
          }
        } catch (e) {
          // Fallback if completely unreadable
        }
        throw new Error(errorMsg);
      }
      
      if (!response.body) throw new Error("Sem corpo na resposta de streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          
          let eventBoundaryIndex;
          while ((eventBoundaryIndex = buffer.indexOf('\n\n')) >= 0) {
            const eventString = buffer.slice(0, eventBoundaryIndex);
            buffer = buffer.slice(eventBoundaryIndex + 2);
            
            const lines = eventString.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataStr = line.slice(5).trim();
                if (dataStr === '[DONE]') return;
                if (!dataStr) continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  const chunk = parsed.data || parsed;
                  if (chunk) yield chunk;
                } catch (e) {
                  console.error("Erro no parse do stream data:", dataStr.substring(0, 50), "Error:", e);
                }
              }
            }
          }
        }

        if (done) {
          // Process what's left if it looks like an event
          if (buffer.trim()) {
             const lines = buffer.split('\n');
             for (const line of lines) {
               if (line.startsWith('data:')) {
                 const dataStr = line.slice(5).trim();
                 if (dataStr && dataStr !== '[DONE]') {
                   try {
                     const parsed = JSON.parse(dataStr);
                     const chunk = parsed.data || parsed;
                     if (chunk) yield chunk;
                   } catch (e) {}
                 }
               }
             }
          }
          break;
        }
      }
    }
  }
};

export const getMistralAI = (settings?: AppSettings) => {
  // If the user provided a custom key, we still use the client-side SDK for their key
  // BUT for the system key, we ALWAYS use the proxy to ensure reliability.
  const customKey = settings?.customApiKey;
  if (customKey && customKey.trim() !== '' && !customKey.startsWith('AIza')) {
    return new Mistral({ apiKey: customKey.trim() });
  }

  // Use the server proxy for the default system key
  return aiProxy as unknown as Mistral;
};

const MAX_RETRIES = 1;
const GLOBAL_TIMEOUT = 120000; // 120 seconds to prevent frontend from artificially cutting off the 5 minutes backend.

// Helper to normalize Mistral content (which can be string or ContentChunk[])
const normalizeMistralContent = (content: any): string => {
  if (!content) return "";
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(item => {
      if (!item) return "";
      if (typeof item === 'string') return item;
      return item.text || item.content || "";
    }).join("");
  }
  return String(content);
};

// Robust JSON extraction from AI response
const extractJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.trim();
  
  // Remove markdown code blocks if present (e.g. ```json ... ```)
  // Handles multiline blocks and case-insensitive 'json' tag
  cleaned = cleaned.replace(/```(?:json|JSON)?\s*([\s\S]*?)```/g, '$1').trim();
  
  // If it still has backticks (sometimes they aren't closed properly)
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```[a-z]*\n?/gi, '').replace(/\n?```/gi, '').trim();
  }
  
  // Find first '{' and last '}' to handle chatter around the JSON
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  
  if (start !== -1 && end !== -1 && end > start) {
    let jsonContent = cleaned.substring(start, end + 1);
    
    // Attempt to fix common LLM JSON errors
    // 1. Remove trailing commas before closing braces/brackets
    jsonContent = jsonContent.replace(/,\s*([}\]])/g, '$1');
    
    return jsonContent;
  }
  
  return cleaned;
};

// Simplified fallbacks for critical scenarios
const SOCIAL_FALLBACKS = [
  "Senti uma oscilação aqui na leitura, mas a visão é clara: ela está te testando. Mantenha o mistério e não entregue o jogo agora. O valor está no que você deixa no ar.",
  "Estou recalibrando meus sensores sociais, mas por enquanto: foque em gerar curiosidade. Mande algo curto, despretensioso e saia de cena.",
  "Houve um ruído técnico, mas a tática bruta é esta: não reaja à frieza dela. Espelhe o investimento e mostre que sua vida é interessante demais para você se preocupar com isso."
];

const validateResponse = (text: string | null | undefined, isJson: boolean = false): boolean => {
  if (!text || text.trim().length < 3) return false; // Lowered from 5 to 3
  
  const trimmed = text.trim();
  
  if (isJson) {
    try {
      const jsonStr = extractJson(trimmed);
      const parsed = JSON.parse(jsonStr);
      // Garantir que não é um objeto ou array vazio
      if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed)) return parsed.length > 0;
        return Object.keys(parsed).length > 0;
      }
      return true;
    } catch {
      return false;
    }
  }
  
  // For non-JSON responses, we are more lenient.
  // We allow punctuation, alphanumeric characters, and emojis.
  // This prevents rejecting short/informal but complete messages like "Ok 🔥" or "Tudo certo"
  // We only reject if it ends in a very suspicious way like a stray comma or if it's extremely short.
  const suspiciousEnd = /[,:;]\s*$/.test(trimmed);
  if (suspiciousEnd && trimmed.length < 50) return false;

  // Use a broad check: if it ends with punctuation, alphanumeric, or emoji, it's likely fine.
  // If it's over 100 chars, we almost always trust it unless it looks like a crash.
  const endsCorrectly = /[.!?}"\]\s\w\W]$/.test(trimmed) || trimmed.length > 50; 
  // Actually, \W includes emojis and symbols. So regex above basically matches anything.
  // Let's refine: reject if empty after trim, but otherwise trust it more.
  return trimmed.length > 0;
};

const withRetry = async <T>(fn: () => Promise<T>, name: string, fallback?: T, isJson: boolean = false): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < MAX_RETRIES + 1; i++) {
    try {
      const startTime = Date.now();
      
      // Wrap the function in a timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout de ${GLOBAL_TIMEOUT}ms atingido (${name}).`)), GLOBAL_TIMEOUT)
        )
      ]);

      // Validation
      if (typeof result === 'string') {
        if (!validateResponse(result as string, isJson)) {
          throw new Error("Resposta incompleta ou mal-formatada detectada.");
        }
      }

      logEvent('api', `${name} successful`, { responseTime: Date.now() - startTime, attempt: i + 1 });
      return result;
    } catch (error: any) {
      lastError = error;
      const isRetryable = error?.message?.includes("fetch failed") || 
                          error?.message?.includes("Timeout") ||
                          error?.message?.includes("incompleta") ||
                          error?.message?.includes("mal-formatada") ||
                          error?.name === "AbortError" || 
                          error?.status === 429 || 
                          error?.status >= 500;
                          
      if (!isRetryable || i === MAX_RETRIES) break;
      
      const delay = 500;
      logEvent('api', `${name} failed, retrying...`, { attempt: i + 1, error: error.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logEvent('api', `${name} final failure`, { errorCode: lastError?.status?.toString() || 'API_ERROR', errorDetail: lastError?.message });
  console.error(`[AI SERVICE ERROR - ${name}]:`, lastError?.message || lastError);
  
  if (fallback !== undefined) {
    console.warn(`[AI SERVICE] Reverting to fallback for ${name}`);
    return fallback;
  }
  throw lastError;
};

export const generateAIResponse = async (userMessage: string, settings?: AppSettings): Promise<string> => {
  const fallback = SOCIAL_FALLBACKS[Math.floor(Math.random() * SOCIAL_FALLBACKS.length)];
  
  return withRetry(async () => {
    const client = getMistralAI(settings);
    const response = await client.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\nIMPORTANTE: Gere sempre uma resposta COMPLETA. Nunca pare no meio de uma frase.` },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      maxTokens: 1000,
    });

    return normalizeMistralContent(response.choices?.[0]?.message?.content);
  }, 'generateAIResponse', fallback);
};

export const generateCustomChatResponse = async (
  messages: any[],
  systemPrompt: string,
  settings?: AppSettings
): Promise<string> => {
  const fallback = "Perdão, tive um breve lapso de conexão. Mas me diga, como posso te ajudar a elevar o nível dessa conversa agora?";
  
  return withRetry(async () => {
    const client = getMistralAI(settings);
    const modelToUse = messages.some(m => m.image || (m.content && Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url'))) 
      ? (settings?.customApiKey ? "pixtral-latest" : "pixtral-12b-2409") 
      : "mistral-large-latest";

    // Filtering and cleaning messages for Mistral
    const finalMessages: any[] = [];
    messages.forEach(m => {
      // 1. Determine safe content
      let safeContent = '';
      if (typeof m.content === 'string') {
        safeContent = m.content.trim();
      } else if (Array.isArray(m.content)) {
        safeContent = m.content.map(c => (typeof c === 'string' ? c : (c.text || ''))).join(' ').trim();
      }

      const hasImg = !!m.image;
      const hasText = safeContent.length > 0;

      // 2. Skip illegal empty messages
      if (m.role === 'assistant' && !hasText) return;
      if (m.role === 'user' && !hasText && !hasImg) return;

      // 3. Prevent consecutive same roles
      const lastMsg = finalMessages[finalMessages.length - 1];
      if (lastMsg && lastMsg.role === (m.role === 'assistant' ? 'assistant' : 'user')) {
        if (hasImg) {
          if (typeof lastMsg.content === 'string') {
            lastMsg.content = [{ type: "text", text: lastMsg.content }];
          }
          if (safeContent) lastMsg.content.push({ type: "text", text: safeContent });
          lastMsg.content.push({ type: "image_url", imageUrl: { url: m.image } });
        } else {
          if (typeof lastMsg.content === 'string') {
            lastMsg.content += "\n\n" + safeContent;
          } else {
            lastMsg.content.push({ type: "text", text: safeContent });
          }
        }
        return;
      }

      // 4. Push message
      if (hasImg) {
        finalMessages.push({
          role: m.role,
          content: [
            { type: "text", text: safeContent || "Analise esta imagem." },
            { type: "image_url", imageUrl: { url: m.image } }
          ]
        });
      } else {
        finalMessages.push({
          role: m.role,
          content: safeContent
        });
      }
    });

    const response = await client.chat.complete({
      model: modelToUse,
      messages: [
        { role: "system", content: `${systemPrompt}\nIMPORTANTE: Responda de forma completa e nunca pare no meio.` },
        ...finalMessages
      ],
      temperature: 0.7,
      maxTokens: 1000,
    });

    return normalizeMistralContent(response.choices?.[0]?.message?.content);
  }, 'generateCustomChatResponse', fallback);
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
  messageHistory?: Message[],
  memories?: any[]
): Promise<NalabiaResponse> => {
  const fallback: NalabiaResponse = {
    momentReading: "A leitura oscilou por um segundo, mas o subtexto é de teste de frame. Ela quer ver se você perde o equilíbrio. Não perca.",
    interestLevel: "Médio",
    interestScore: 50,
    investmentScore: 40,
    riskScore: 20,
    meetingChance: 30,
    emotion: "Neutra",
    dynamic: "Aguardando movimento",
    risk: "Instabilidade técnica momentânea no radar",
    responses: [
      { type: "Curiosidade", text: "Você sempre é assim tão direta ou hoje é um dia especial?", explanation: "Gera um quebra de padrão leve." },
      { type: "Desafio", text: "Achei interessante, mas ainda estou decidindo se sua vibe combina com a minha.", explanation: "Inverte o frame." }
    ],
    rhythm: "Esperar",
    detectedMode: "Observação"
  };

  return withRetry(async () => {
    const client = getMistralAI(settings);

    let userAIProfileInstruction = "";
    if (userAIProfile) {
      userAIProfileInstruction = `
      🧠 USER PROFILE (CONTEXTO PERMANENTE):
      Objetivo: ${userAIProfile.goal}
      Nível de Experiência: ${userAIProfile.experienceLevel}
      Estilo de Comunicação: ${userAIProfile.communicationStyle}
      Nível de Flerte: ${userAIProfile.flirtLevel}
      Tamanho de Resposta: ${userAIProfile.responseLength}
      Personalidade: ${userAIProfile.personalityType}
      `;
    }

    let memoryInstruction = "";
    if (memories && memories.length > 0 && profileContext) {
      const profileMemory = memories.find(m => m.id === profileContext.id);
      if (profileMemory && profileMemory.observations && profileMemory.observations.length > 0) {
        memoryInstruction = `
        📁 MEMÓRIA ESTRATÉGICA ATIVA:
        ${profileMemory.observations.map((obs: string) => `- ${obs}`).join('\n')}
        `;
      }
    }

    let historyInstruction = "";
    if (messageHistory && messageHistory.length > 0) {
      const formattedHistory = messageHistory.slice(-6).map(m => `[${m.role.toUpperCase()}]: ${m.content || '(imagem)'}`).join('\n');
      historyInstruction = `
      📜 HISTÓRICO RECENTE:
      ${formattedHistory}
      (NOTA: Evite repetir as respostas ou abordagens visíveis acima. Evolua a conversa.)
      `;
    }
    
    let profileInstruction = "";
    if (profileContext && profileContext.name !== 'Geral') {
      profileInstruction = `
      👤 ALVO (PERFIL ATUAL): ${profileContext.name} (${profileContext.description})
      - Interesse: ${profileContext.metrics.interest}
      - Risco: ${profileContext.metrics.risk}
      - Padrão: ${profileContext.behavioralPattern || "Em análise"}
      `;
    }

    const prompt = `
    ${SYSTEM_PROMPT}

    ⚙️ PARÂMETROS ATUAIS DE GERAÇÃO:
    - MODO ATIVO: ${mode}
    - FLERTE: ${flirtLevel}/10
    - LÁBIA (Witty): ${wittyLevel}/10
    - DOMINÂNCIA: ${dominanceLevel}/10
    - MISTÉRIO: ${mysteryLevel}/10
    - RITMO/VELOCIDADE: ${speed}

    ${userAIProfileInstruction}
    ${profileInstruction}
    ${memoryInstruction}
    ${historyInstruction}
    
    ${JSON_FORMAT_INSTRUCTION}
    
    Input (Mensagem ou Situação atual fornecida pelo usuário):
    "${text}"
    `;

    const messages: any[] = [];
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", imageUrl: { url: imageBase64 } }
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
      maxTokens: 2000,
    });

    const rawContent = normalizeMistralContent(response.choices?.[0]?.message?.content) || "{}";
    const content = extractJson(rawContent);
    
    if (!validateResponse(content, true)) {
      console.error("[AI SERVICE] Validation failed for analyzeContent. Content preview:", content.substring(0, 100));
      throw new Error("JSON Inválido na análise.");
    }
    return JSON.parse(content) as NalabiaResponse;
  }, 'analyzeContent', fallback, true);
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
  const fallback = {
    responses: [
      { type: "Segurança", text: "Tive um soluço na conexão, mas a resposta é: seja autêntico e não demonstre pressa. O segredo é o equilíbrio." }
    ]
  };

  return withRetry(async () => {
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

    const messages: any[] = [];
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", imageUrl: { url: imageBase64 } }
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

    const rawContent = normalizeMistralContent(response.choices?.[0]?.message?.content) || "{}";
    const content = extractJson(rawContent);
    
    if (!validateResponse(content, true)) {
      console.error("[AI SERVICE] Validation failed for regenerateContent.");
      throw new Error("JSON Inválido na regeneração.");
    }
    return JSON.parse(content);
  }, 'regenerateContent', fallback, true);
};

export const runLaboratory = async (
  contextText: string,
  analysis: NalabiaResponse,
  profileContext: Profile | undefined,
  settings: AppSettings,
  userAIProfile?: any,
  imageBase64?: string
): Promise<LaboratorySimulation> => {
  const fallback: LaboratorySimulation = {
    variations: [
      {
        style: "Misteriosa",
        text: "Talvez eu te conte... se você for um bom ouvinte.",
        impact: {
          attraction: "Média",
          curiosity: "Alta",
          risk: "Baixo"
        },
        bestScenario: "Ideal para manter o frame de mistério."
      }
    ],
    prediction: {
      likelyResponse: "Ela vai perguntar o que você tem a contar.",
      alternativeResponse: "Ela pode rir e te desafiar de volta.",
      adviceIfSilence: "Não mande nada por 24h.",
      adviceIfResponse: "Continue no jogo de gato e rato."
    }
  };

  return withRetry(async () => {
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
    
    ${LAB_PROMPT}

    [ALTA PRIORIDADE]: Gere respostas que fujam do óbvio. O usuário quer o 'caminho das pedras' que ninguém conta. 
    
    INPUT ORIGINAL: "${contextText}"
    ANÁLISE DO MOMENTO: ${JSON.stringify(analysis)}
    CONTEXTO DE PERFIL: ${profileInfo}
    ${userAIProfileInstruction}
    
    Execute a simulação do laboratório com impacto máximo agora.
    `;

    const messages: any[] = [];
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", imageUrl: { url: imageBase64 } }
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
      maxTokens: 2500,
    });
    
    const rawContent = normalizeMistralContent(response.choices?.[0]?.message?.content) || "{}";
    const content = extractJson(rawContent);
    
    if (!validateResponse(content, true)) {
      console.error("[AI SERVICE] Validation failed for runLaboratory.");
      throw new Error("JSON Inválido no laboratório.");
    }
    return JSON.parse(content) as LaboratorySimulation;
  }, 'runLaboratory', fallback, true);
};

export const generateChatStream = async (
  messages: Message[],
  settings: AppSettings,
  activeProfile?: Profile,
  userAIProfile?: any,
  memories?: Memory[]
) => {
  const client = getMistralAI(settings);
  
  let profileInstruction = "";
  if (activeProfile && activeProfile.id !== "general") {
    profileInstruction = `
    👤 PERFIL ATIVO: ${activeProfile.name} (${activeProfile.description})
    PADRÃO DELA: ${activeProfile.behavioralPattern || "Ainda em análise"}
    `;
  }

  let userAIProfileInstruction = "";
  if (userAIProfile) {
    userAIProfileInstruction = `
    🧠 USER PROFILE:
    Nível: ${userAIProfile.experienceLevel}
    Estilo: ${userAIProfile.communicationStyle}
    Objetivo: ${userAIProfile.goal}
    `;
  }

  let settingsInstruction = "";
  if (settings) {
    settingsInstruction = `
    ⚙️ DIRETRIZES:
    ${settings.ai?.avoidCompliments ? "- EVITAR ELOGIOS." : ""}
    ${settings.ai?.shortResponses ? "- RESPOSTAS CURTAS." : ""}
    ${settings.ai?.avoidQuestions ? "- EVITAR PERGUNTAS." : ""}
    `;
  }

  let memoryInstruction = "";
  if (memories && activeProfile) {
    const profileMemory = memories.find(m => m.id === activeProfile.id);
    if (profileMemory && profileMemory.observations && profileMemory.observations.length > 0) {
      memoryInstruction = `
      📁 MEMÓRIA:
      ${profileMemory.observations.map(obs => `- ${obs}`).join('\n')}
      `;
    }
  }

  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${CHAT_RESPONSE_STRUCTURE}\n\nCONTEXTO:\n${profileInstruction}\n${userAIProfileInstruction}\n${memoryInstruction}\n${settingsInstruction}`;

  const mistralMessages: any[] = [{ role: "system", content: fullSystemPrompt }];
  let hasImage = false;

  const MAX_MESSAGES_CONTEXT = 30;
  
  // Filter out any system/fallback error messages from the app
  const cleanMessages = messages.filter(m => {
    if (m.role === 'assistant' && typeof m.content === 'string') {
      if (m.content.includes("A IA não retornou conteúdo") || 
          m.content.includes("Erro na IA") || 
          m.content.includes("Ops! Algo deu errado") ||
          m.content.includes("A IA está sobrecarregada") ||
          m.content.includes("Muitas requisições")) {
        return false;
      }
    }
    return true;
  });

  const recentMessages = cleanMessages.slice(-MAX_MESSAGES_CONTEXT);
  
  // Count images from new to old, keep only the last 2 images to preserve context limit
  let imagesCount = 0;
  const MAX_IMAGES_ALLOWED = 2;
  
  const optimizedMessages = [...recentMessages].reverse().map(msg => {
    let optimizedMsg = { ...msg };
    if (optimizedMsg.image) {
      if (imagesCount < MAX_IMAGES_ALLOWED) {
        imagesCount++;
      } else {
        optimizedMsg.image = undefined; // Drop older images to save tokens
        optimizedMsg.content = (optimizedMsg.content || "") + "\n[Imagem anterior removida da memória recente para economizar espaço]";
      }
    }
    return optimizedMsg;
  }).reverse();

  optimizedMessages.forEach(msg => {
    const safeContent = typeof msg.content === 'string' ? msg.content.trim() : '';
    const hasImg = !!msg.image;
    
    if (msg.role === 'assistant' && !safeContent) return;
    if (msg.role === 'user' && !safeContent && !hasImg) return;

    if (hasImg) hasImage = true;

    const lastMsg = mistralMessages[mistralMessages.length - 1];
    
    // Merge consecutive messages of the same role
    if (lastMsg && (lastMsg.role === msg.role || (lastMsg.role === 'assistant' && msg.role === 'assistant') || (lastMsg.role === 'user' && msg.role === 'user'))) {
      if (hasImg) {
        if (typeof lastMsg.content === 'string') {
          lastMsg.content = [{ type: "text", text: lastMsg.content }];
        }
        if (safeContent) lastMsg.content.push({ type: "text", text: safeContent });
        lastMsg.content.push({ type: "image_url", imageUrl: { url: msg.image } });
      } else {
        if (typeof lastMsg.content === 'string') {
          lastMsg.content += "\n\n" + safeContent;
        } else {
          lastMsg.content.push({ type: "text", text: safeContent });
        }
      }
      return;
    }

    // New role
    if (hasImg) {
      mistralMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: [
          { type: "text", text: safeContent || "Análise do print:" },
          { type: "image_url", imageUrl: { url: msg.image } }
        ]
      });
    } else {
      mistralMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: safeContent
      });
    }
  });

  // Ensure first message after system is user
  if (mistralMessages.length > 1 && mistralMessages[1].role === 'assistant') {
    mistralMessages.splice(1, 0, { role: 'user', content: 'Olá, vamos continuar.' });
  }

  // Ensure it doesn't end with assistant or system
  if (mistralMessages.length === 1) {
    mistralMessages.push({ role: 'user', content: 'Olá, NaLábia. Preciso da sua ajuda.' });
  } else if (mistralMessages[mistralMessages.length - 1].role !== 'user') {
    mistralMessages.push({ role: 'user', content: 'Analise e me dê sua opinião detalhada agora.' });
  }

  const modelToUse = hasImage ? (settings?.customApiKey ? "pixtral-latest" : "pixtral-12b-2409") : "mistral-large-latest";

  logEvent('api', 'Starting AI Stream', { model: modelToUse, messageCount: mistralMessages.length });

  const stream = await client.chat.stream({
    model: modelToUse,
    messages: mistralMessages,
    temperature: 0.75,
    maxTokens: 2500
  });

  return (async function* () {
    for await (const chunk of stream as any) {
      if (chunk) {
        yield chunk.data || chunk;
      }
    }
  })();
};

export const analyzeProfile = async (
  images: string[],
  settings: AppSettings
): Promise<{ vibe: string, redFlags: string[], greenFlags: string[], icebreakers: string[] }> => {
  const fallback = {
    vibe: "Perfil magnético, mas com um subtexto de busca por validação externa.",
    redFlags: ["Sinais de inconsistência entre bio e fotos"],
    greenFlags: ["Estilo de vida genuíno confirmado"],
    icebreakers: ["Interessante como sua energia muda da primeira para a terceira foto. Qual delas é a versão real?"]
  };

  return withRetry(async () => {
    const client = getMistralAI(settings);
    
    const prompt = `
${SYSTEM_PROMPT}

Você é um mestre em leitura fria e análise de perfis sociais.
Analise a(s) imagem(ns) e a bio abaixo. Sua análise deve ser 'direto na ferida'. 
Não seja genérico. Identifique o subtexto: o que ela quer mostrar? Qual o ponto fraco e o ponto forte do perfil?

Retorne APENAS um JSON válido:
{
  "vibe": "Uma descrição 'NaLábia' (vibrante e precisa) da vibe dele/dela.",
  "redFlags": ["Sinais de alerta reais (manipulação, carência, busca por validação)"],
  "greenFlags": ["Sinais de valor (independência, humor, autenticidade)"],
  "icebreakers": ["Abridores matadores, específicos para o que você viu. Fuja do comum."]
}`;

    const contentParts: any[] = [
      { type: "text", text: prompt }
    ];
    
    images.forEach(img => {
      contentParts.push({ type: "image_url", imageUrl: { url: img } });
    });

    const response = await client.chat.complete({
      model: "pixtral-12b-2409",
      messages: [{ role: "user", content: contentParts }],
      responseFormat: { type: "json_object" },
      temperature: 0.7,
      maxTokens: 1500
    });

    const rawContent = normalizeMistralContent(response.choices?.[0]?.message?.content) || "{}";
    const content = extractJson(rawContent);
    
    if (!validateResponse(content, true)) throw new Error("JSON Inválido no perfil.");
    return JSON.parse(content);
  }, 'analyzeProfile', fallback, true);
};

export const detectRedFlags = async (
  chatHistory: string,
  images: string[],
  settings: AppSettings
): Promise<{ ghostingProbability: number, toxicityLevel: string, redFlags: string[], greenFlags: string[], verdict: string, advice: string }> => {
  const fallback = {
    ghostingProbability: 30,
    toxicityLevel: "Médio",
    redFlags: ["Subtexto de desinteresse passivo"],
    greenFlags: ["Investimento reativo presente"],
    verdict: "O sinal está instável, mas a leitura aponta para necessidade de distanciamento estratégico.",
    advice: "Pare de investir agora. Deixe o silêncio trabalhar a seu favor por pelo menos 48h."
  };

  return withRetry(async () => {
    const client = getMistralAI(settings);
    
    const prompt = `
${SYSTEM_PROMPT}

Você é um psicólogo comportamental especializado em 'dark psychology' e detecção de padrões sociais.
Analise a interação enviada. O usuário quer a verdade nua e crua. 

Identifique se ele está sendo manipulado, se ela está perdendo o interesse ou se há sinais de toxicidade oculta.

${chatHistory.trim() ? `HISTÓRICO DE TEXTO:\n${chatHistory}\n` : ''}
${images.length > 0 ? `ANÁLISE DE IMAGENS (PRINTS):\n` : ''}

Retorne APENAS o JSON:
{
  "ghostingProbability": 0-100,
  "toxicityLevel": "Baixo" | "Médio" | "Alto",
  "redFlags": ["Análise cirúrgica de perigo"],
  "greenFlags": ["Sinais de investimento saudável"],
  "verdict": "Veredito final definitivo. Sem 'talvez'.",
  "advice": "O que o usuário deve fazer AGORA para retomar o Frame ou se proteger."
}`;

    const contentParts: any[] = [{ type: "text", text: prompt }];
    images.forEach(img => {
      contentParts.push({ type: "image_url", imageUrl: { url: img } });
    });

    const response = await client.chat.complete({
      model: images.length > 0 ? "pixtral-12b-2409" : "mistral-large-latest",
      messages: [{ role: "user", content: contentParts }],
      responseFormat: { type: "json_object" },
      temperature: 0.7,
      maxTokens: 2500,
    });

    const rawContent = normalizeMistralContent(response.choices?.[0]?.message?.content) || "{}";
    const content = extractJson(rawContent);
    
    if (!validateResponse(content, true)) {
      console.error("[AI SERVICE] Validation failed for detectRedFlags.");
      throw new Error("JSON Inválido nas Red Flags.");
    }
    return JSON.parse(content);
  }, 'detectRedFlags', fallback, true);
};
