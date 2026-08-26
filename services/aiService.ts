import { Mistral } from "@mistralai/mistralai";
import {
  SYSTEM_PROMPT,
  COACH_SYSTEM_PROMPT,
  CHAT_RESPONSE_STRUCTURE,
  JSON_FORMAT_INSTRUCTION,
  REGENERATE_PROMPT,
  LAB_PROMPT,
  NalabiaResponse,
  AnalysisMode,
  ConversationSpeed,
  AppSettings,
  Profile,
  Message,
  LaboratorySimulation,
  Memory,
} from "../types";
import { logEvent } from "./logger";

// Proxy implementation to call AI via the server
const createAiProxy = (apiKey?: string) => ({
  chat: {
    complete: async (body: any) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["x-custom-api-key"] = apiKey;

      const response = await fetch("/api/ai/complete", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro na API: ${response.status}`);
      }
      return response.json();
    },
    stream: async function* (body: any) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) headers["x-custom-api-key"] = apiKey;

      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
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
            console.error(
              "[Vercel/Server Error HTML]:",
              rawText.substring(0, 500),
            );
            if (rawText.toLowerCase().includes("timeout")) {
              errorMsg =
                "O Provedor (Vercel) encerrou a conexão por tempo limite (Timeout).";
            } else if (rawText.includes("FUNCTION_INVOCATION_TIMEOUT")) {
              errorMsg =
                "O servidor Vercel limitou o tempo em 10s (Limite Habitual).";
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
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });

          let eventBoundaryIndex;
          while ((eventBoundaryIndex = buffer.indexOf("\n\n")) >= 0) {
            const eventString = buffer.slice(0, eventBoundaryIndex);
            buffer = buffer.slice(eventBoundaryIndex + 2);

            const lines = eventString.split("\n");
            for (const line of lines) {
              if (line.startsWith("data:")) {
                const dataStr = line.slice(5).trim();
                if (dataStr === "[DONE]") return;
                if (!dataStr) continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  const chunk = parsed.data || parsed;
                  if (chunk) yield chunk;
                } catch (e) {
                  console.error(
                    "Erro no parse do stream data:",
                    dataStr.substring(0, 50),
                    "Error:",
                    e,
                  );
                }
              }
            }
          }
        }

        if (done) {
          // Process what's left if it looks like an event
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (line.startsWith("data:")) {
                const dataStr = line.slice(5).trim();
                if (dataStr && dataStr !== "[DONE]") {
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
    },
  },
});

export const getMistralAI = (settings?: AppSettings) => {
  // Always use the server proxy to avoid CORS errors.
  // If the user provides a custom key, pass it via the x-custom-api-key header.
  const customKey = settings?.customApiKey;
  let customKeyToPass: string | undefined = undefined;

  if (customKey && customKey.trim() !== "") {
    customKeyToPass = customKey.trim();
  }

  // Use the server proxy
  return createAiProxy(customKeyToPass) as unknown as Mistral;
};

const MAX_RETRIES = 1;
const GLOBAL_TIMEOUT = 120000; // 120 seconds to prevent frontend from artificially cutting off the 5 minutes backend.

// Helper to normalize Mistral content (which can be string or ContentChunk[])
const normalizeMistralContent = (content: any): string => {
  let result = "";
  if (!content) return "";
  if (typeof content === "string") {
    result = content;
  } else if (Array.isArray(content)) {
    result = content
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item;
        return item.text || item.content || "";
      })
      .join("");
  } else {
    result = String(content);
  }
  return result;
};

const getQuizProfilePrompt = () => {
  try {
    const pStr = localStorage.getItem("nalabia_profile");
    if (!pStr) return "";
    const p = JSON.parse(pStr);
    
    return `
    ============================================================
    🎯 PERFIL DE LÁBIA DO USUÁRIO (Obrigatório seguir):
    - Nível de Experiência: ${p.nivel}
    - Tom de Voz Preferido: ${p.tom}
    - Nível de Ousadia Base Predisposta: ${p.ousadia}/10
    - Estilo de Vocabulário: ${p.vocabulario}
    - Foco Estratégico Atual: ${p.foco_estrategico}
    ============================================================
    `;
  } catch (e) {
    return "";
  }
};

// Robust JSON extraction and repair from AI response
const repairIncompleteJson = (jsonStr: string): string => {
  let text = jsonStr.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) return text;

  // Track open brackets and quotes
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
    } else {
      if (char === '"') {
        inString = true;
      } else if (char === "{" || char === "[") {
        stack.push(char);
      } else if (char === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "{") {
          stack.pop();
        }
      } else if (char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "[") {
          stack.pop();
        }
      }
    }
  }

  // If we ended while inside an unclosed string, close the string
  if (inString) {
    text += '"';
  }

  // Remove any trailing commas or partial property keys at the end
  text = text.replace(/,\s*$/, "");
  text = text.replace(/,\s*([}\]])/g, "$1");

  // Close remaining unclosed brackets in reverse order
  while (stack.length > 0) {
    const unclosed = stack.pop();
    if (unclosed === "{") {
      text += "}";
    } else if (unclosed === "[") {
      text += "]";
    }
  }

  // Final cleanup of trailing commas before closing braces
  text = text.replace(/,\s*([}\]])/g, "$1");
  return text;
};

// Robust JSON extraction from AI response
const extractJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.trim();

  // Remove markdown code blocks if present (e.g. ```json ... ```)
  cleaned = cleaned.replace(/```(?:json|JSON)?\s*([\s\S]*?)```/g, "$1").trim();

  // If it still has backticks (sometimes they aren't closed properly)
  if (cleaned.includes("```")) {
    cleaned = cleaned
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/\n?```/gi, "")
      .trim();
  }

  // Find first '{'
  const start = cleaned.indexOf("{");
  if (start !== -1) {
    let jsonCandidate = cleaned.substring(start);
    const end = jsonCandidate.lastIndexOf("}");
    if (end !== -1) {
      jsonCandidate = jsonCandidate.substring(0, end + 1);
    }
    
    // Quick test if already valid
    try {
      JSON.parse(jsonCandidate);
      return jsonCandidate;
    } catch {
      // Try repair
      const repaired = repairIncompleteJson(jsonCandidate);
      try {
        JSON.parse(repaired);
        return repaired;
      } catch {
        return jsonCandidate;
      }
    }
  }

  return cleaned;
};

// Simplified fallbacks for critical scenarios
const SOCIAL_FALLBACKS = [
  "Senti uma oscilação aqui na leitura, mas a visão é clara: ela está te testando. Mantenha o mistério e não entregue o jogo agora. O valor está no que você deixa no ar.",
  "Estou recalibrando meus sensores sociais, mas por enquanto: foque em gerar curiosidade. Mande algo curto, despretensioso e saia de cena.",
  "Houve um ruído técnico, mas a tática bruta é esta: não reaja à frieza dela. Espelhe o investimento e mostre que sua vida é interessante demais para você se preocupar com isso.",
];

const validateResponse = (
  text: string | null | undefined,
  isJson: boolean = false,
): boolean => {
  if (!text || text.trim().length < 3) return false; // Lowered from 5 to 3

  const trimmed = text.trim();

  if (isJson) {
    try {
      const jsonStr = extractJson(trimmed);
      const parsed = JSON.parse(jsonStr);
      // Garantir que não é um objeto ou array vazio
      if (typeof parsed === "object" && parsed !== null) {
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

const withRetry = async <T>(
  fn: () => Promise<T>,
  name: string,
  fallback?: T,
  isJson: boolean = false,
): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < MAX_RETRIES + 1; i++) {
    try {
      const startTime = Date.now();

      // Wrap the function in a timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Timeout de ${GLOBAL_TIMEOUT}ms atingido (${name}).`),
              ),
            GLOBAL_TIMEOUT,
          ),
        ),
      ]);

      // Validation
      if (typeof result === "string") {
        if (!validateResponse(result as string, isJson)) {
          throw new Error("Resposta incompleta ou mal-formatada detectada.");
        }
      }

      logEvent("api", `${name} successful`, {
        responseTime: Date.now() - startTime,
        attempt: i + 1,
      });
      return result;
    } catch (error: any) {
      lastError = error;
      const isRetryable =
        error?.message?.includes("fetch failed") ||
        error?.message?.includes("Timeout") ||
        error?.message?.includes("incompleta") ||
        error?.message?.includes("mal-formatada") ||
        error?.name === "AbortError" ||
        error?.status === 429 ||
        error?.status >= 500;

      if (!isRetryable || i === MAX_RETRIES) break;

      const delay = 500;
      logEvent("api", `${name} failed, retrying...`, {
        attempt: i + 1,
        error: error.message,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  logEvent("api", `${name} final failure`, {
    errorCode: lastError?.status?.toString() || "API_ERROR",
    errorDetail: lastError?.message,
  });
  console.error(
    `[AI SERVICE ERROR - ${name}]:`,
    lastError?.message || lastError,
  );

  if (fallback !== undefined) {
    console.warn(`[AI SERVICE] Reverting to fallback for ${name}`);
    return fallback;
  }
  throw lastError;
};

export const generateAIResponse = async (
  userMessage: string,
  settings?: AppSettings,
): Promise<string> => {
  const fallback =
    SOCIAL_FALLBACKS[Math.floor(Math.random() * SOCIAL_FALLBACKS.length)];

  return withRetry(
    async () => {
      const client = getMistralAI(settings);
      const response = await client.chat.complete({
        model: "mistral-large-latest",
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPT}\n${getQuizProfilePrompt()}\nIMPORTANTE: Gere sempre uma resposta COMPLETA. Nunca pare no meio de uma frase.`,
          },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        maxTokens: 1000,
      });

      return normalizeMistralContent(response.choices?.[0]?.message?.content);
    },
    "generateAIResponse",
    fallback,
  );
};

export const generateCustomChatResponse = async (
  messages: any[],
  systemPrompt: string,
  settings?: AppSettings,
): Promise<string> => {
  const fallback =
    "Perdão, tive um breve lapso de conexão. Mas me diga, como posso te ajudar a elevar o nível dessa conversa agora?";

  return withRetry(
    async () => {
      const client = getMistralAI(settings);
      const modelToUse = messages.some(
        (m) =>
          m.image ||
          (m.content &&
            Array.isArray(m.content) &&
            m.content.some((c: any) => c.type === "image_url")),
      )
        ? settings?.customApiKey
          ? "pixtral-latest"
          : "pixtral-12b-2409"
        : "mistral-large-latest";

      // Filtering and cleaning messages for Mistral
      const finalMessages: any[] = [];
      messages.forEach((m) => {
        // 1. Determine safe content
        let safeContent = "";
        if (typeof m.content === "string") {
          safeContent = m.content.trim();
        } else if (Array.isArray(m.content)) {
          safeContent = m.content
            .map((c) => (typeof c === "string" ? c : c.text || ""))
            .join(" ")
            .trim();
        }

        const hasImg = !!m.image;
        const hasText = safeContent.length > 0;

        // 2. Skip illegal empty messages
        if (m.role === "assistant" && !hasText) return;
        if (m.role === "user" && !hasText && !hasImg) return;

        // 3. Prevent consecutive same roles
        const lastMsg = finalMessages[finalMessages.length - 1];
        if (
          lastMsg &&
          lastMsg.role === (m.role === "assistant" ? "assistant" : "user")
        ) {
          if (hasImg) {
            if (typeof lastMsg.content === "string") {
              lastMsg.content = [{ type: "text", text: lastMsg.content }];
            }
            if (safeContent)
              lastMsg.content.push({ type: "text", text: safeContent });
            lastMsg.content.push({
              type: "image_url",
              imageUrl: { url: m.image },
            });
          } else {
            if (typeof lastMsg.content === "string") {
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
              { type: "image_url", imageUrl: { url: m.image } },
            ],
          });
        } else {
          finalMessages.push({
            role: m.role,
            content: safeContent,
          });
        }
      });

      const response = await client.chat.complete({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\nIMPORTANTE: Responda de forma completa e nunca pare no meio.`,
          },
          ...finalMessages,
        ],
        temperature: 0.7,
        maxTokens: 1000,
      });

      return normalizeMistralContent(response.choices?.[0]?.message?.content);
    },
    "generateCustomChatResponse",
    fallback,
  );
};

export const formatStyleAndSlidersInstruction = (
  styleId: string | undefined,
  flirtLevel: number,
  wittyLevel: number,
  dominanceLevel: number,
  mysteryLevel: number,
  speed: ConversationSpeed,
): string => {
  let styleName = "CALMO (Zen & Não-Reativo)";
  let styleGuidance =
    "Tom sereno, descontraído, sem afobação ou necessidade de validação. Transmita paz e alto valor com naturalidade.";

  if (styleId === "IRONIC") {
    styleName = "IRÔNICO (Sarcástico & Debochado)";
    styleGuidance =
      "Humor afiado, ironia fina, sarcasmo elegante, tirar sarro dela de forma leve (busting chops) e quebra de expectativa cômica.";
  } else if (styleId === "DOMINANT") {
    styleName = "LÍDER (Dominante & Alfa)";
    styleGuidance =
      "Frame inabalável, postura de comando sutil, lidera a conversa sem hesitação, sem pedir desculpas ou permissão, seguro de sua posição.";
  } else if (styleId === "BOLD") {
    styleName = "OUSADO (Audacioso & Tensão Sexual)";
    styleGuidance =
      "Flerte de alto impacto, polarização, duplo sentido inteligente, acelera o clima e quebra a zona de conforto com coragem.";
  }

  const speedGuidance =
    speed === "short"
      ? "CURTA (MÁXIMO 3 a 7 palavras! Mensagens extremamente curtas e cirúrgicas)"
      : speed === "fluid"
        ? "FLUIDA (1 a 2 frases estruturadas com charme)"
        : "NORMAL (1 frase de 8 a 15 palavras no ritmo ideal)";

  return `
🎯 ESTILO DE PERSONALIDADE DA IA: ${styleName}
Diretiva de Tom: ${styleGuidance}

📊 REGULAGEM DOS SLIDERS (INSTRUÇÃO OBRIGATÓRIA):
- NÍVEL DE FLERTE: ${flirtLevel}/10 -> ${flirtLevel >= 7 ? "ALTO (Injete charme marcante, duplo sentido e sedução explícita)" : flirtLevel <= 3 ? "BAIXO (Tom amigável, leve e casual, zero pressão romântica)" : "MÉDIO (Charme sutil e despretensioso)"}
- NÍVEL DE DOMINÂNCIA: ${dominanceLevel}/10 -> ${dominanceLevel >= 7 ? "ALTO (Liderança total do frame, não busque validação)" : dominanceLevel <= 3 ? "BAIXO (Receptivo, calmo e acolhedor)" : "MÉDIO (Equilibrado e seguro)"}
- NÍVEL DE MISTÉRIO: ${mysteryLevel}/10 -> ${mysteryLevel >= 7 ? "ALTO (Gere curiosidade irresistível, deixe perguntas no ar, seja enigmático)" : mysteryLevel <= 3 ? "BAIXO (Direto, transparente e sem rodeios)" : "MÉDIO (Pequenas lacunas de curiosidade)"}
- NÍVEL DE SAGACIDADE (WITTY): ${wittyLevel}/10 -> ${wittyLevel >= 7 ? "ALTO (Sacadas rápidas, ironia perspicaz, punchlines inteligentes)" : "MÉDIO (Natural e bem colocado)"}
- VELOCIDADE / EXTENSÃO: ${speedGuidance}

🚨 REQUISITO DE SAÍDA: AS 3 OPÇÕES DE RESPOSTA NO ARRAY 'responses' DEVEM INCORPORAR COM CLAREZA O ESTILO "${styleName}" E OS NÍVEIS ACIMA!
`;
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
  memories?: any[],
  profileStyle?: string,
): Promise<NalabiaResponse> => {
  const fallback: NalabiaResponse = {
    momentReading:
      "A leitura oscilou por um segundo, mas o subtexto é de teste de frame. Ela quer ver se você perde o equilíbrio. Não perca.",
    interestLevel: "Médio",
    interestScore: 50,
    investmentScore: 40,
    riskScore: 20,
    meetingChance: 30,
    emotion: "Neutra",
    dynamic: "Aguardando movimento",
    risk: "Instabilidade técnica momentânea no radar",
    responses: [
      {
        type: "Curiosidade",
        text: "Você sempre é assim tão direta ou hoje é um dia especial?",
        explanation: "Gera um quebra de padrão leve.",
      },
      {
        type: "Desafio",
        text: "Achei interessante, mas ainda estou decidindo se sua vibe combina com a minha.",
        explanation: "Inverte o frame.",
      },
    ],
    rhythm: "Esperar",
    detectedMode: "Observação",
  };

  return withRetry(
    async () => {
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
        const profileMemory = memories.find((m) => m.id === profileContext.id);
        if (
          profileMemory &&
          profileMemory.observations &&
          profileMemory.observations.length > 0
        ) {
          memoryInstruction = `
        📁 MEMÓRIA ESTRATÉGICA ATIVA:
        ${profileMemory.observations.map((obs: string) => `- ${obs}`).join("\n")}
        `;
        }
      }

      let historyInstruction = "";
      const hasHistory = messageHistory && messageHistory.length > 0;

      if (hasHistory) {
        const formattedHistory = messageHistory!
          .slice(-10)
          .map(
            (m) =>
              `[${m.role.toUpperCase()}]: ${m.content ? (typeof m.content === "string" ? m.content.substring(0, 150) : "[JSON DA ANÁLISE ANTERIOR]") : "(imagem gerada)"}`,
          )
          .join("\n");
        historyInstruction = `
      📜 HISTÓRICO DE MENTORIA RECENTE:
      ${formattedHistory}
      (CONSCIÊNCIA TÁTICA: Se um perfil de mulher estiver selecionado e NÃO for 'Geral', você deve usar este histórico para entender a evolução da conversa. Se for 'Geral', trate cada print como uma nova interação isolada.)
      `;
      } else {
        historyInstruction = `
      📜 HISTÓRICO DE MENTORIA RECENTE: Vazio na plataforma.
      (ATENÇÃO: A base de histórico está vazia, mas você DEVE ler e considerar qualquer mensagem presente na IMAGEM ENVIADA. Não ignore os balões de chat da imagem.)
      ${mode === "FIRST_CONTACT" ? "MENSAGEM: Trate como PRIMEIRO CONTATO ou retomada dependendo do que ver na imagem." : ""}
      `;
      }

      let profileInstruction = "";
      if (profileContext && profileContext.name !== "Geral") {
        profileInstruction = `
      👤 MULHER (PERFIL ATUAL): ${profileContext.name} (${profileContext.description})
      - Interesse: ${profileContext.metrics.interest}
      - Risco: ${profileContext.metrics.risk}
      - Padrão: ${profileContext.behavioralPattern || "Em análise"}
      `;
      }

      const getModeInstructions = (mode: AnalysisMode): string => {
        switch (mode) {
          case "FIRST_CONTACT":
            return "MANDATO (Abertura Fria & Elicitação): Criar impacto instantâneo. Proibido dizer 'Oi' ou bajular. Use Cold Reading (afirmação presumida sobre a vibe dela do FBI/Kahneman) ou quebra de padrão situacional. Gere curiosidade e faça parecer que você a leu em segundos. Máximo 1 a 2 frases, estilo WhatsApp/Instagram.";
          case "FLOWING":
            return "MANDATO (Engajamento & Push-Pull): Manter tensão emocional e atração. Evite interrogatórios (regra Carnegie/FBI). Transforme perguntas em afirmações provocativas e use desqualificação lúdica. Frases curtas e casuais.";
          case "STORY_REPLY":
            return `MANDATO — STORY FLIRT & LÁBIA (Robert Greene / Kahneman):
          O objetivo é gerar curiosidade intensa e quebrar o padrão dos outros 50 caras.
          - Se for foto de corpo/biquíni: NÃO elogie a estética óbvia. Comente algo de fundo ou provoque ("Injusto aparecer no meu feed a essa hora.").
          - OBRIGATÓRIO: Lábia afiada, carisma natural, zero desespero.
          - Use no MÁXIMO 1 linha / frase curta. Respeite fielmente os níveis dos sliders.`;
          case "VALUE_TEST":
            return "MANDATO (Frame Control & Anti-Shit Test): O homem é o prêmio. Se houver teste ou provocação dela, NUNCA se justifique. Use Agree & Amplify (concordar e amplificar com humor absurdo) ou Reframe.";
          case "COLD_RESPONSE":
            return "MANDATO (Assimetria & Escassez - Greene/Skinner): Choque de escassez e retirada de atenção. Resposta ultra-curta, indiferente ou com ironia fina sem cobrança.";
          case "REACTIVATION":
            return "MANDATO (Ressurreição / Ghosting Recovery): Proibido cobrar ('sumiu?'). Use quebra de padrão inusitada, curiosidade inacabada ou comentário de estilo de vida com desapego total.";
          case "NSFW":
            return "MANDATO (Tensão & Escalação Íntima): Duplo sentido sofisticado, condução sensorial do Sistema 1, sem ser vulgar ou desesperado. Máximo 1 a 2 frases.";
          case "MANIPULATION":
            return "MANDATO (Psicologia Social Reversa): Inversão de papéis (fazer parecer que ela está te conquistando), vácuo de informação e desafios de qualificação.";
          case "RED_FLAG_DETECTOR":
            return "MANDATO: Diagnóstico cirúrgico de interesse, manipulação ou desrespeito de limites. Dite a postura de proteção de valor do homem.";
          default:
            return "MANDATO: Estratégia geral NaLábia. Resposta curta, casual, espirituosa, respeitando rigorosamente os sliders ativos.";
        }
      };

      const styleAndSlidersPrompt = formatStyleAndSlidersInstruction(
        profileStyle,
        flirtLevel,
        wittyLevel,
        dominanceLevel,
        mysteryLevel,
        speed,
      );

      const prompt = `
${SYSTEM_PROMPT}

${getQuizProfilePrompt()}

${styleAndSlidersPrompt}

- MODO ATIVO: ${mode}
- INSTRUÇÃO DO MODO: ${getModeInstructions(mode)}

🚨 DOGMA DE ATRIBUIÇÃO DE LADOS (LEITURA VISUAL CRÍTICA):
- LADO DIREITO (Right / Alinhado à margem direita) = HOMEM (O USUÁRIO).
- LADO ESQUERDO (Left / Alinhado à margem esquerda) = MULHER (A INTERLOCUTORA).
- QUEM FALOU POR ÚLTIMO? Se a última mensagem visível está na ESQUERDA, ela falou por último. O HOMEM precisa responder agora.
- REAÇÃO DELA: Se ela mandou risadas ("kkk", "haha", "rs", "😂"), piadas ou respostas no mesmo tom, ELA ESTÁ ENGATADA! O homem deve aproveitar o embalo, liderando a narrativa com humor, situações cômicas e charme.
- DESTINO DAS RESPOSTAS: O array "responses" e "sugestoes_resposta" DEVE CONTER EXCLUSIVAMENTE FRASES PARA O HOMEM ENVIAR À MULHER. NUNCA gere falas femininas.

${userAIProfileInstruction}
${profileInstruction}
${memoryInstruction}
${historyInstruction}

${JSON_FORMAT_INSTRUCTION}

Situação/Texto fornecido pelo usuário:
"${text}"
`;

      const messages: any[] = [];
      if (imageBase64) {
        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise a imagem a seguir identificando rigorosamente os lados:
- Balões na DIREITA = HOMEM (usuário).
- Balões na ESQUERDA = MULHER (interlocutora).
Gere a análise tática e 3 opções de respostas de altíssima lábia, carisma e liderança de narrativa para o HOMEM enviar para a MULHER, calibradas pelos sliders fornecidos.`,
            },
            { type: "image_url", imageUrl: { url: imageBase64 } },
            { type: "text", text: prompt },
          ],
        });
      } else {
        messages.push({ role: "user", content: prompt });
      }

      const response = await client.chat.complete({
        model: imageBase64 ? "pixtral-12b-2409" : "mistral-large-latest",
        messages: messages,
        responseFormat: { type: "json_object" },
        temperature: 0.75,
        maxTokens: 3000,
      });

      const rawContent =
        normalizeMistralContent(response.choices?.[0]?.message?.content) ||
        "{}";
      const content = extractJson(rawContent);

      if (!validateResponse(content, true)) {
        console.error(
          "[AI SERVICE] Validation failed for analyzeContent. Content preview:",
          content.substring(0, 1000),
        );
        throw new Error("JSON Inválido na análise.");
      }

      const parsed = JSON.parse(content) as any;

      // Normalização robusta entre schema estrito e schema do frontend
      const interestScore =
        typeof parsed.scores?.interesse === "number"
          ? parsed.scores.interesse
          : typeof parsed.interestScore === "number"
            ? parsed.interestScore
            : 50;

      const investmentScore =
        typeof parsed.scores?.investimento === "number"
          ? parsed.scores.investimento
          : typeof parsed.investmentScore === "number"
            ? parsed.investmentScore
            : 40;

      const riskScore =
        typeof parsed.scores?.risco === "number"
          ? parsed.scores.risco
          : typeof parsed.riskScore === "number"
            ? parsed.riskScore
            : 20;

      const meetingChance =
        typeof parsed.scores?.chance_encontro === "number"
          ? parsed.scores.chance_encontro
          : typeof parsed.meetingChance === "number"
            ? parsed.meetingChance
            : 30;

      let responsesList = Array.isArray(parsed.responses) ? parsed.responses : [];
      if (
        (!responsesList || responsesList.length === 0) &&
        Array.isArray(parsed.sugestoes_resposta) &&
        parsed.sugestoes_resposta.length > 0
      ) {
        const types = ["Natural", "Provocação", "Magnético"];
        responsesList = parsed.sugestoes_resposta.map((text: string, idx: number) => ({
          type: types[idx] || `Opção ${idx + 1}`,
          text: typeof text === "string" ? text : String(text),
          explanation: "Calibrada com base nos elementos literais da imagem.",
        }));
      }

      const isUnreadable = parsed.status === "imagem_ilegivel";
      const momentReading = isUnreadable
        ? `Não foi possível ler com precisão este print (${parsed.detalhes || "imagem com baixa resolução, cortada ou texto ilegível"}). Por favor, envie um print mais nítido ou informe o contexto.`
        : parsed.momentReading ||
          (parsed.transcricao_resumida
            ? `Leitura da cena: ${parsed.transcricao_resumida}`
            : "Análise concluída com base nos elementos visíveis da imagem.");

      const parsedResponse: NalabiaResponse = {
        status: parsed.status || "ok",
        detalhes: parsed.detalhes || null,
        transcricao_resumida: parsed.transcricao_resumida || undefined,
        momentReading,
        interestLevel:
          parsed.interestLevel ||
          (interestScore > 75
            ? "Alto"
            : interestScore > 40
              ? "Médio"
              : "Baixo"),
        interestScore,
        investmentScore,
        riskScore,
        meetingChance,
        emotion: parsed.emocao || parsed.emotion || "Neutra",
        dynamic: parsed.dinamica || parsed.dynamic || "Em andamento",
        risk: parsed.aviso_risco || parsed.risk || "Baixo risco aparente",
        responses: responsesList.length > 0 ? responsesList : fallback.responses,
        rhythm:
          parsed.timing_resposta === "Agora" || parsed.rhythm === "Agora"
            ? "Agora"
            : parsed.timing_resposta === "Ignorar" || parsed.rhythm === "Sumir"
              ? "Sumir"
              : "Esperar",
        detectedMode: parsed.modo_detectado || parsed.detectedMode || "Observação",
        suggestedTiming: parsed.timing_resposta || parsed.suggestedTiming,
        errorAlert: isUnreadable
          ? `[DETECTOR_DE_FALHA]: ${parsed.detalhes || "Imagem ilegível"}`
          : parsed.errorAlert,
        shouldReply: parsed.shouldReply !== false,
      };

      return parsedResponse;
    },
    "analyzeContent",
    fallback,
    true,
  );
};

export const regenerateContent = async (
  originalText: string,
  imageBase64: string | undefined,
  mode: AnalysisMode,
  sliders: { flirt: number; witty: number; dominance: number; mystery: number },
  speed: ConversationSpeed,
  settings: AppSettings,
  profileContext?: Profile,
  userAIProfile?: any,
  profileStyle?: string,
): Promise<{ responses: { type: string; text: string }[] }> => {
  const fallback = {
    responses: [
      {
        type: "Segurança",
        text: "Tive um soluço na conexão, mas a resposta é: seja autêntico e não demonstre pressa. O segredo é o equilíbrio.",
      },
    ],
  };

  return withRetry(
    async () => {
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

      const styleAndSlidersPrompt = formatStyleAndSlidersInstruction(
        profileStyle,
        sliders.flirt,
        sliders.witty,
        sliders.dominance,
        sliders.mystery,
        speed,
      );

      const contextInstruction = `
    INPUT ORIGINAL:
    "${originalText}"
    
    MODO: ${mode}
    ${userAIProfileInstruction}
    
    ${styleAndSlidersPrompt}

    ⚙️ CONFIGS:
    - Respostas Curtas: ${settings?.ai?.shortResponses ? "ON" : "OFF"}
    - Anti-Gado: ${settings?.ai?.avoidCompliments ? "ON" : "OFF"}

    🚨 DOGMA DE IDENTIDADE VISUAL (A MAIOR PRIORIDADE):
    - O HOMEM (USUÁRIO) escreve na DIREITA. Ele é dono do celular.
    - A MULHER escreve na ESQUERDA.
    - Ignore as cores! Leia o alinhamento geométrico. Leia a imagem ATENTAMENTE ANTES DE GERAR a resposta. Se o homem perguntou na direita, não diga que ela perguntou isso.
    `;

      const prompt = `
    ${SYSTEM_PROMPT}
    
    ${getQuizProfilePrompt()}
    
    ${REGENERATE_PROMPT}
    
    Analyze the following input and return ONLY a single JSON object. Do not repeat phrases. Do not loop.
    
    Structure:
    {
      "responses": [{"type": "string", "text": "string", "explanation": "string"}]
    }
    
    ${contextInstruction}
    `;

      const messages: any[] = [];
      if (imageBase64) {
        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: "CRITICAL INSTRUCTION FOR IMAGE RECOGNITION:\n1. IF THIS IS A CHAT SCREENSHOT:\n- Bubbles aligned to the EXACT RIGHT EDGE (Direita) are sent by the USER (MAN). He DOES NOT have a profile pic next to his bubbles.\n- Bubbles aligned to the EXACT LEFT EDGE (Esquerda) are sent by the OTHER PERSON (WOMAN). She usually HAS a profile pic next to her bubble.\n- YOUR TASK: Read the conversation, identify her last message (left side), and generate what the MAN (right side) should reply back to her.\n2. IF THIS IS A PROFILE OR STORY (No chat bubbles):\n- Read her bio, text, or context.\n- GENERATE the FIRST MESSAGE that the MAN should send to her.\n3. ABSOLUTE RULE: DO NOT CONFUSE WHO IS WHO. YOU ARE DRAFTING THE MALE USER'S RESPONSE.",
            },
            { type: "image_url", imageUrl: { url: imageBase64 } },
            { type: "text", text: prompt },
          ],
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

      const rawContent =
        normalizeMistralContent(response.choices?.[0]?.message?.content) ||
        "{}";
      const content = extractJson(rawContent);

      if (!validateResponse(content, true)) {
        console.error(
          "[AI SERVICE] Validation failed for regenerateContent. Content preview:",
          content.substring(0, 1000),
        );
        throw new Error("JSON Inválido na regeneração.");
      }
      return JSON.parse(content);
    },
    "regenerateContent",
    fallback,
    true,
  );
};

export const runLaboratory = async (
  contextText: string,
  analysis: NalabiaResponse,
  profileContext: Profile | undefined,
  settings: AppSettings,
  userAIProfile?: any,
  imageBase64?: string,
): Promise<LaboratorySimulation> => {
  const fallback: LaboratorySimulation = {
    variations: [
      {
        style: "Misteriosa",
        text: "Talvez eu te conte... se você for um bom ouvinte.",
        impact: {
          attraction: "Média",
          curiosity: "Alta",
          risk: "Baixo",
        },
        bestScenario: "Ideal para manter o frame de mistério.",
      },
    ],
    prediction: {
      likelyResponse: "Ela vai perguntar o que você tem a contar.",
      alternativeResponse: "Ela pode rir e te desafiar de volta.",
      adviceIfSilence: "Não mande nada por 24h.",
      adviceIfResponse: "Continue no jogo de gato e rato.",
    },
  };

  return withRetry(
    async () => {
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
    
    ${getQuizProfilePrompt()}
    
    ${LAB_PROMPT}

    [ALTA PRIORIDADE]: Gere respostas que fujam do óbvio. O usuário quer o 'caminho das pedras' que ninguém conta. 
    
    🚨 DOGMA VISUAL NAS IMAGENS FORNECIDAS:
    - O HOMEM ESTÁ NA DIREITA (Dono do celular).
    - A MULHER ESTÁ NA ESQUERDA (Mensagens recebidas).
    - IGNORE AS CORES! Preste atenção na direção.
    - Se a mensagem estiver na Direita (ex: "Nmrl cê tava linda dms ontem" no print atual do user), ela foi enviada pelo HOMEM. NÃO ATRIBUA ISSO À MULHER.

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
            {
              type: "text",
              text: "CRITICAL INSTRUCTION FOR IMAGE RECOGNITION:\n1. IF THIS IS A CHAT SCREENSHOT:\n- Bubbles aligned to the EXACT RIGHT EDGE (Direita) are sent by the USER (MAN). He DOES NOT have a profile pic next to his bubbles.\n- Bubbles aligned to the EXACT LEFT EDGE (Esquerda) are sent by the OTHER PERSON (WOMAN). She usually HAS a profile pic next to her bubble.\n- YOUR TASK: Read the conversation, identify her last message (left side), and generate what the MAN (right side) should reply back to her.\n2. IF THIS IS A PROFILE OR STORY (No chat bubbles):\n- Read her bio, text, or context.\n- GENERATE the FIRST MESSAGE that the MAN should send to her.\n3. ABSOLUTE RULE: DO NOT CONFUSE WHO IS WHO. YOU ARE DRAFTING THE MALE USER'S RESPONSE.",
            },
            { type: "image_url", imageUrl: { url: imageBase64 } },
            { type: "text", text: prompt },
          ],
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

      const rawContent =
        normalizeMistralContent(response.choices?.[0]?.message?.content) ||
        "{}";
      const content = extractJson(rawContent);

      if (!validateResponse(content, true)) {
        console.error(
          "[AI SERVICE] Validation failed for runLaboratory. Content preview:",
          content.substring(0, 1000),
        );
        throw new Error("JSON Inválido no laboratório.");
      }
      return JSON.parse(content) as LaboratorySimulation;
    },
    "runLaboratory",
    fallback,
    true,
  );
};

export const generateChatStream = async (
  messages: Message[],
  settings: AppSettings,
  activeProfile?: Profile,
  userAIProfile?: any,
  memories?: Memory[],
  styleId?: string,
  sliders?: { flirt: number; witty: number; dominance: number; mystery: number },
  speed?: ConversationSpeed,
) => {
  const client = getMistralAI(settings);

  let styleInstruction = "";
  if (styleId || sliders) {
    styleInstruction = formatStyleAndSlidersInstruction(
      styleId,
      sliders?.flirt ?? 5,
      sliders?.witty ?? 5,
      sliders?.dominance ?? 5,
      sliders?.mystery ?? 5,
      speed ?? "normal",
    );
  }

  let profileInstruction = "";
  if (activeProfile && activeProfile.id !== "general") {
    profileInstruction = `
    DADOS DA PESSOA QUE ESTAMOS ANALISANDO:
    Nome: ${activeProfile.name}
    Descricao: ${activeProfile.description}
    Padrao de comportamento dela: ${activeProfile.behavioralPattern || "Ainda em análise"}
    `;
  }

  let userAIProfileInstruction = "";
  if (userAIProfile) {
    userAIProfileInstruction = `
    SOBRE O MEU DONO (USUÁRIO):
    Nivel de experiencia: ${userAIProfile.experienceLevel}
    Estilo de comunicacao: ${userAIProfile.communicationStyle}
    Objetivo dele: ${userAIProfile.goal}
    `;
  }

  let settingsInstruction = "";
  if (settings) {
    settingsInstruction = `
    ESTILO DE RESPOSTA ATIVO:
    ${settings.ai?.avoidCompliments ? "- PROIBIDO ELOGIAR. Mantenha o Frame de alto valor." : ""}
    ${settings.ai?.shortResponses ? "- RESPOSTAS CURTAS: Seja direto e impactante, use o mínimo de palavras para o máximo de efeito (Lábia Afiada)." : "- RESPOSTAS FLUIDAS: Pode elaborar um pouco mais se a estratégia exigir."}
    ${settings.ai?.avoidQuestions ? "- EVITAR PERGUNTAS: Use afirmações ou provocações frias." : ""}
    `;
  }

  let memoryInstruction = "";
  if (memories && activeProfile) {
    const profileMemory = memories.find((m) => m.id === activeProfile.id);
    if (
      profileMemory &&
      profileMemory.observations &&
      profileMemory.observations.length > 0
    ) {
      memoryInstruction = `
      FATOS IMPORTANTES QUE LEMBRAMOS SOBRE ELA:
      ${profileMemory.observations.map((obs) => obs).join("\n")}
      `;
    }
  }

  const fullSystemPrompt = `
  ${COACH_SYSTEM_PROMPT}

  ${styleInstruction}

  🚨 PROTOCOLO DE DELIBERAÇÃO COGNITIVA & IDENTIDADE VISUAL:
  1. ANCORAGEM VISUAL DE MARGENS:
     - LADO DIREITO (Margem Direita >> / Sem foto de perfil ao lado): SEMPRE O HOMEM (Usuário / Aluno / Dono do celular).
     - LADO ESQUERDO (Margem Esquerda << / Foto de perfil da mulher ao lado): SEMPRE A MULHER (Interlocutora).
     - NUNCA inverta os papéis! Se uma frase está na direita, foi o homem que enviou. Se está na esquerda, foi a mulher.

  2. ANÁLISE DE PSICOLOGIA FEMININA & SUBTEXTO (SISTEMA 1):
     - Pense com cuidado no subtexto real da última mensagem dela antes de ditar a resposta.
     - Decodifique o estado emocional dela: se ela usou risadas ("kkk", "😂", piadas), ela está engajada e receptiva a humor audacioso e liderança de narrativa. Se ela foi monossilábica, ela está testando investimento. Se ela provocou, é teste de congruência.
     - Rejeite qualquer resposta robótica ou genérica de ChatGPT. Use nuance, sagacidade e linguagem real brasileira.

  3. ESTRUTURAÇÃO OBRIGATÓRIA DA RESPOSTA:
     ${CHAT_RESPONSE_STRUCTURE}
  
  CONTEXTO ATIVO:
  ${profileInstruction}
  ${userAIProfileInstruction}
  ${memoryInstruction}
  ${settingsInstruction}
  `;

  const mistralMessages: any[] = [
    { role: "system", content: fullSystemPrompt },
  ];
  let hasImage = false;

  const MAX_MESSAGES_CONTEXT = 8; // Reduced from 30 to 8 to prevent context mixing across different women

  // Filter out any system/fallback error messages from the app
  let cleanMessages = messages.filter((m) => {
    if (m.role === "assistant" && typeof m.content === "string") {
      if (
        m.content.includes("A IA não retornou conteúdo") ||
        m.content.includes("Erro na IA") ||
        m.content.includes("Ops! Algo deu errado") ||
        m.content.includes("A IA está sobrecarregada") ||
        m.content.includes("Muitas requisições")
      ) {
        return false;
      }
    }
    return true;
  });

  const lastMsg =
    cleanMessages.length > 0 ? cleanMessages[cleanMessages.length - 1] : null;
  if (lastMsg && lastMsg.image) {
    // REQUISITO DO CLIENTE: "Sempre só vai ler a mensagem que eu mandar e não as outras."
    // Se enviou print novo, ignora TODO o histórico anterior. Mented limpa.
    cleanMessages = [lastMsg];
  }

  const recentMessages = cleanMessages.slice(-MAX_MESSAGES_CONTEXT);

  // Count images from new to old, keep only the last image to guarantee isolation between different women
  let imagesCount = 0;
  const MAX_IMAGES_ALLOWED = 1;

  const optimizedMessages = [...recentMessages]
    .reverse()
    .map((msg) => {
      let optimizedMsg = { ...msg };
      if (optimizedMsg.image) {
        if (imagesCount < MAX_IMAGES_ALLOWED) {
          imagesCount++;
        } else {
          optimizedMsg.image = undefined; // Drop older images to save tokens and prevent context mixing
          optimizedMsg.content =
            (optimizedMsg.content || "") +
            "\n[Imagem anterior removida do contexto visual para isolamento tático]";
        }
      }
      return optimizedMsg;
    })
    .reverse();

  optimizedMessages.forEach((msg) => {
    const safeContent =
      typeof msg.content === "string" ? msg.content.trim() : "";
    const hasImg = !!msg.image;

    if (msg.role === "assistant" && !safeContent) return;
    if (msg.role === "user" && !safeContent && !hasImg) return;

    if (hasImg) hasImage = true;

    const lastMsg = mistralMessages[mistralMessages.length - 1];

    // Merge consecutive messages of the same role
    if (
      lastMsg &&
      (lastMsg.role === msg.role ||
        (lastMsg.role === "assistant" && msg.role === "assistant") ||
        (lastMsg.role === "user" && msg.role === "user"))
    ) {
      if (hasImg) {
        if (typeof lastMsg.content === "string") {
          lastMsg.content = [{ type: "text", text: lastMsg.content }];
        }
        if (safeContent)
          lastMsg.content.push({ type: "text", text: safeContent });
        lastMsg.content.push({
          type: "image_url",
          imageUrl: { url: msg.image },
        });
      } else {
        if (typeof lastMsg.content === "string") {
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
        role: msg.role === "assistant" ? "assistant" : "user",
        content: [
          {
            type: "text",
            text: safeContent
              ? `${safeContent}\n\nInicie sua resposta EXATAMENTE com a tag [TRANSCRIÇÃO OBRIGATÓRIA] e extraia: O que EU (balão direita) disse e o que ELA (balão esquerda/com foto) disse. ALERTA LETAL: SE A FRASE 'Nmrl cê tava linda', 'apaixonsei' OU QUALQUER OUTRA ESTIVER VISÍVEL NO LADO DIREITO, É O USUÁRIO QUEM ESTÁ FALANDO. VOCÊ DEVE OBRIGATORIAMENTE LISTÁ-LA COMO O HOMEM. NÃO A ATRIBUA À MULHER NUNCA. Somente depois use a tag [CONTROLE] e siga o resto do formato.`
              : "Inicie sua resposta EXATAMENTE com a tag [TRANSCRIÇÃO OBRIGATÓRIA] e extraia: O que EU (balão direita) disse e o que ELA (balão esquerda/com foto) disse. ALERTA LETAL: SE A FRASE 'Nmrl cê tava linda' OU QUALQUER OUTRA ESTIVER VISÍVEL NO LADO DIREITO DA MARGEM, É O USUÁRIO (HOMEM) QUEM ESTÁ FALANDO. VOCÊ DEVE OBRIGATORIAMENTE LISTÁ-LA COMO O HOMEM. NUNCA À MULHER. Somente depois use a tag [CONTROLE] e siga o resto do formato.",
          },
          { type: "image_url", imageUrl: { url: msg.image } },
        ],
      });
    } else {
      mistralMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: safeContent,
      });
    }
  });

  // Ensure first message after system is user
  if (mistralMessages.length > 1 && mistralMessages[1].role === "assistant") {
    mistralMessages.splice(1, 0, {
      role: "user",
      content: "Olá, vamos continuar.",
    });
  }

  // Ensure it doesn't end with assistant or system
  if (mistralMessages.length === 1) {
    mistralMessages.push({
      role: "user",
      content: "Olá, NaLábia. Preciso da sua ajuda.",
    });
  } else if (mistralMessages[mistralMessages.length - 1].role !== "user") {
    mistralMessages.push({
      role: "user",
      content: "Analise e me dê sua opinião detalhada agora.",
    });
  }

  const modelToUse = hasImage
    ? settings?.customApiKey
      ? "pixtral-latest"
      : "pixtral-12b-2409"
    : "mistral-large-latest";

  logEvent("api", "Starting AI Stream", {
    model: modelToUse,
    messageCount: mistralMessages.length,
  });

  const stream = await client.chat.stream({
    model: modelToUse,
    messages: mistralMessages,
    temperature: 0.85,
    maxTokens: 2500,
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
  settings: AppSettings,
  memories?: any[],
  userAIProfile?: any,
): Promise<{
  vibe: string;
  redFlags: string[];
  greenFlags: string[];
  icebreakers: string[];
}> => {
  const fallback = {
    vibe: "Perfil magnético, mas com um subtexto de busca por validação externa.",
    redFlags: ["Sinais de inconsistência entre bio e fotos"],
    greenFlags: ["Estilo de vida genuíno confirmado"],
    icebreakers: [
      "Interessante como sua energia muda da primeira para a terceira foto. Qual delas é a versão real?",
    ],
  };

  return withRetry(
    async () => {
      const client = getMistralAI(settings);

      let userContext = "";
      if (userAIProfile) {
        userContext = `
      CONTEXTO DO USUÁRIO:
      - Estilo: ${userAIProfile.communicationStyle}
      - Objetivo: ${userAIProfile.goal}
      `;
      }

      const prompt = `
${SYSTEM_PROMPT}

${getQuizProfilePrompt()}

Você é um estrategista social de elite focado em DECODIFICAÇÃO DE SUBTEXTO e RESULTADOS PRÁTICOS. 
Analise as imagens e a bio no MODO RAIO-X PSICOLÓGICO. 

${userContext}

DIRETRIZES DO RAIO-X PSICOLÓGICO:
1. DADOS BRUTOS & ELEMENTOS DE CENA: O que aparece nas fotos e no perfil? (Cenário, estilo de vida, contradições entre bio e fotos, detalhes periféricos).
2. ARQUÉTIPO & PSICOLOGIA DO PERFIL: Qual a identidade social que ela projeta e qual a necessidade subjacente de validação/experiência?
3. ESTRATÉGIA DE CAMPO & NUANCE: 
   - O QUE EVITAR: Não elogie a beleza óbvia nem caia em clichês de bajulação.
   - O QUE FUNCIONA: Use o contraste de valor e curiosidade. Se ela aparenta ser inalcançável, use humor despretensioso ou um detalhe engraçado do cenário.
4. ARSENAL DE ABERTURA: 3 opções de abridores curtos, naturais, magnéticos (estilo WhatsApp/Instagram real), que gerem curiosidade imediata e zero impressão de IA.

Retorne APENAS um JSON válido:
{
  "vibe": "Descrição perspicaz e psicológica da personalidade e energia projetada pelo perfil.",
  "redFlags": ["Sinais comportamentais sutis de exigência de validação ou baixa reciprocidade"],
  "greenFlags": ["Gatilhos autênticos de conexão, humor ou afinidade"],
  "icebreakers": ["3 abridores de alto impacto com nuances psicológicas reais."]
}`;

      const contentParts: any[] = [
        {
          type: "text",
          text: "IMPORTANTE DOGMA VISUAL: 1) DIREITA = Homem. ESQUERDA = Mulher. 2) CITAÇÕES: Se aparecer 'respondeu a você', o balão logo abaixo É A CITAÇÃO do que a pessoa de cima falou. A resposta REAL é o balão que vem abaixo da citação.",
        },
      ];

      images.forEach((img) => {
        contentParts.push({ type: "image_url", imageUrl: { url: img } });
      });

      contentParts.push({ type: "text", text: prompt });

      const response = await client.chat.complete({
        model: "pixtral-12b-2409",
        messages: [{ role: "user", content: contentParts }],
        responseFormat: { type: "json_object" },
        temperature: 0.7,
        maxTokens: 1500,
      });

      const rawContent =
        normalizeMistralContent(response.choices?.[0]?.message?.content) ||
        "{}";
      const content = extractJson(rawContent);

      if (!validateResponse(content, true))
        throw new Error("JSON Inválido no perfil.");
      return JSON.parse(content);
    },
    "analyzeProfile",
    fallback,
    true,
  );
};

export const detectRedFlags = async (
  chatHistory: string,
  images: string[],
  settings: AppSettings,
  userAIProfile?: any,
): Promise<{
  ghostingProbability: number;
  toxicityLevel: string;
  redFlags: string[];
  greenFlags: string[];
  verdict: string;
  advice: string;
}> => {
  const fallback = {
    ghostingProbability: 30,
    toxicityLevel: "Médio",
    redFlags: ["Subtexto de desinteresse passivo"],
    greenFlags: ["Investimento reativo presente"],
    verdict:
      "O sinal está instável, mas a leitura aponta para necessidade de distanciamento estratégico.",
    advice:
      "Pare de investir agora. Deixe o silêncio trabalhar a seu favor por pelo menos 48h.",
  };

  return withRetry(
    async () => {
      const client = getMistralAI(settings);

      let userContext = "";
      if (userAIProfile) {
        userContext = `
      CONTEXTO DO USUÁRIO:
      - Objetivo: ${userAIProfile.goal}
      - Estilo: ${userAIProfile.communicationStyle}
      `;
      }

      const prompt = `
${SYSTEM_PROMPT}

${getQuizProfilePrompt()}

🚨 DOGMA VISUAL NAS IMAGENS (SE EXISTIREM):
- O HOMEM (O USUÁRIO) ESTÁ SEMPRE NA DIREITA. ELE É O DONO DO CELULAR.
- A MULHER ESTÁ SEMPRE NA ESQUERDA (Geralmente com foto de perfil e o nome dela em cima).
- IGNORE AS CORES DOS BALÕES. AMBAS PODEM SER ROXAS OU AZUIS SE TIVER TEMA. OLHE O ALINHAMENTO.
- Não invente texto nem confunda os dois.

Você é o Detector de Ameaças Sociais e Red Flags com consciência tática. Sua missão é proteger o tempo e a sanidade do usuário.
Analise a interação enviada. O usuário quer a verdade brutal, sem filtros. 

${userContext}

INSTRUÇÕES DE ANÁLISE DE ELITE:
1. GHOSTING PROBABILITY: Calcule com base no 'delay' de resposta, esforço textual (quem escreve mais) e ganchos ignorados.
2. TOXICITY: Identifique manipulação clássica: Gaslighting, Love Bombing, Validação Barata ou Testes de Humilhação.
3. INVESTIMENTO: Quem está correndo atrás de quem? 
4. VEREDITO BRUTAL: Diga se o usuário deve continuar, dar um gelo (escassez), ou bloquear imediatamente por auto-preservação.

${chatHistory.trim() ? `HISTÓRICO DE TEXTO:\n${chatHistory}\n` : ""}
${images.length > 0 ? `ANÁLISE DE IMAGENS (PRINTS):\n` : ""}

Retorne APENAS o JSON:
{
  "ghostingProbability": 0-100,
  "toxicityLevel": "Baixo/Médio/Nuclear",
  "redFlags": ["Análise cirúrgica de perigo detectado"],
  "greenFlags": ["Sinais que indicam investimento real dela"],
  "verdict": "Veredito final definitivo. Seja curto e grosso.",
  "advice": "O que o usuário deve fazer AGORA para retomar o Frame ou se proteger."
}`;

      const contentParts: any[] = [
        {
          type: "text",
          text: "IMPORTANTE DOGMA VISUAL: 1) DIREITA = Homem. ESQUERDA = Mulher. 2) CITAÇÕES: Se aparecer 'respondeu a você', o balão logo abaixo É A CITAÇÃO do que a pessoa de cima falou. A resposta REAL é o balão que vem abaixo da citação.",
        },
      ];
      images.forEach((img) => {
        contentParts.push({ type: "image_url", imageUrl: { url: img } });
      });
      contentParts.push({ type: "text", text: prompt });

      const response = await client.chat.complete({
        model: images.length > 0 ? "pixtral-12b-2409" : "mistral-large-latest",
        messages: [{ role: "user", content: contentParts }],
        responseFormat: { type: "json_object" },
        temperature: 0.7,
        maxTokens: 2500,
      });

      const rawContent =
        normalizeMistralContent(response.choices?.[0]?.message?.content) ||
        "{}";
      const content = extractJson(rawContent);

      if (!validateResponse(content, true)) {
        console.error(
          "[AI SERVICE] Validation failed for detectRedFlags. Content preview:",
          content.substring(0, 1000),
        );
        throw new Error("JSON Inválido nas Red Flags.");
      }
      return JSON.parse(content);
    },
    "detectRedFlags",
    fallback,
    true,
  );
};
