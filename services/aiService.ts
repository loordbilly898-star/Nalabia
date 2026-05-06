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

  if (customKey && customKey.trim() !== "" && !customKey.startsWith("AIza")) {
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
  // Remove markdown asterisks completely to avoid them bleeding into the UI
  return result.replace(/\*/g, "");
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

// Robust JSON extraction from AI response
const extractJson = (text: string): string => {
  if (!text) return "{}";
  let cleaned = text.trim();

  // Remove markdown code blocks if present (e.g. ```json ... ```)
  // Handles multiline blocks and case-insensitive 'json' tag
  cleaned = cleaned.replace(/```(?:json|JSON)?\s*([\s\S]*?)```/g, "$1").trim();

  // If it still has backticks (sometimes they aren't closed properly)
  if (cleaned.includes("```")) {
    cleaned = cleaned
      .replace(/```[a-z]*\n?/gi, "")
      .replace(/\n?```/gi, "")
      .trim();
  }

  // Find first '{' and last '}' to handle chatter around the JSON
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    let jsonContent = cleaned.substring(start, end + 1);

    // Attempt to fix common LLM JSON errors
    // 1. Remove trailing commas before closing braces/brackets
    jsonContent = jsonContent.replace(/,\s*([}\]])/g, "$1");

    return jsonContent;
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
      📜 HISTÓRICO: Vazio. 
      ${mode === "FIRST_CONTACT" ? "Este é o PRIMEIRO CONTATO. Gere uma linha de abertura impactante." : "Sem mensagens anteriores."}
      `;
      }

      let profileInstruction = "";
      if (profileContext && profileContext.name !== "Geral") {
        profileInstruction = `
      👤 ALVO (PERFIL ATUAL): ${profileContext.name} (${profileContext.description})
      - Interesse: ${profileContext.metrics.interest}
      - Risco: ${profileContext.metrics.risk}
      - Padrão: ${profileContext.behavioralPattern || "Em análise"}
      `;
      }

      const getModeInstructions = (mode: AnalysisMode): string => {
        switch (mode) {
          case "FIRST_CONTACT":
            return "MANDATO: Criar impacto instantâneo. NÃO seja o cara que diz 'Oi'. Use ganchos psicológicos (Cold Reading) ou perguntas de 'Frame' (Parece que você é do tipo que...). O objetivo é fazer ela sentir que você a 'leu' em segundos. Curiosidade é a única métrica aqui.";
          case "FLOWING":
            return "MANDATO: Manter a tensão sexual e intelectual. Evite interrogatórios (onde você mora? o que faz?). Transforme perguntas em afirmações provocativas. Intercale 'Push & Pull' (Afasta com uma brincadeira, aproxima com um elogio sutil e desapegado).";
          case "STORY_REPLY":
            return `MANDATO — STORY VISION LOCK & ENGINE V2:
          1. EYE (VISÃO): Descreva o que você vê (objetivos, ambiente, ação) sem alucinar. Use "VISUAL INCERTO" se necessário.
          2. CATEGORY: SELFIE, CORPO, COMIDA/BEBIDA, VIAGEM, ACADEMIA ou RANDOM.
          3. READ: 1 frase sobre o momento (Ex: "Relaxando no sol").
          4. REPLY: Gere 3 respostas de "Lábia de 2 Segundos". Curtas (máx 1 frase), naturais, fáceis de responder e sem esforço intelectual. Se parecer mensagem pensada, está ERRADA.`;
          case "VALUE_TEST":
            return "MANDATO: Detecção e aniquilação de testes (Shit-tests). Ela está medindo seu valor. Não se defenda, não se explique. Use o 'Excesso de Confiança' (Amplify) ou a 'Indiferença Superior'. Mostre que o julgamento dela não afeta seu estado emocional.";
          case "COLD_RESPONSE":
            return "MANDATO: Choque de escassez. Se ela esfriou, você congelou. Mensagens curtas, demoradas e sem justificativa. O objetivo é fazer ela se perguntar por que você perdeu o interesse. Use a técnica de 'Inversão de Investimento'.";
          case "REACTIVATION":
            return "MANDATO: Ressuscitar sem parecer carente. Use ganchos de estilo de vida (Vi isso e lembrei do seu mau gosto para X). Deve parecer um pensamento aleatório, não uma tentativa de puxar conversa. Desapego absoluto.";
          case "NSFW":
            return "MANDATO: Dominação e escalação. Use linguagem de duplo sentido, audácia e confiança implícita. O objetivo é criar uma 'bolha' de intimidade onde só vocês dois entendem o que está acontecendo. Saia da zona de amizade com força.";
          case "MANIPULATION":
            return "MANDATO: Psicologia reversa e gatilhos de elite. Use escassez, validação intermitente e autoridade social. O objetivo é transformar você no foco de atenção dela, invertendo o papel de quem busca validação.";
          case "RED_FLAG_DETECTOR":
            return "MANDATO: Diagnóstico de toxicidade. Identifique se ela é 'vampira de atenção', narcisista ou apenas desinteressada. Se o veredito for negativo, instrua o usuário a dar o 'Ghosting Tático' para preservar o próprio valor.";
          default:
            return "MANDATO: Estratégia geral NaLábia. Mantenha o Frame alto, a resposta curta e o interesse dela sempre um degrau abaixo do seu investimento aparente.";
        }
      };

      const prompt = `
    ${SYSTEM_PROMPT}

    ${getQuizProfilePrompt()}

    ⚙️ PARÂMETROS ATUAIS DE GERAÇÃO:
    - MODO ATIVO: ${mode}
    - INSTRUÇÃO TÁTICA DO MODO: ${getModeInstructions(mode)}
    - FLERTE: ${flirtLevel}/10
    - LÁBIA (Witty): ${wittyLevel}/10
    - DOMINÂNCIA: ${dominanceLevel}/10
    - MISTÉRIO: ${mysteryLevel}/10
    - RITMO/VELOCIDADE: ${speed}

    🧠 META-APRENDIZADO & CONSCIÊNCIA:
    Sua missão é evoluir. Analise o histórico e as memórias para:
    1. Não repetir erros do usuário (ex: ser carente).
    2. Identificar quais "iscas" de lábia ela morde mais (provocação, mistério, etc).
    3. Ajustar o "Frame" para que o usuário seja sempre o prêmio da conversa.
    4. Se houver falhas anteriores, corrija-as silenciosamente através de novas respostas fatais.

    🚨 DOGMA DE IDENTIDADE VISUAL E CHAT (PRIORIDADE ABSOLUTA - VOCÊ SERÁ PENALIZADO SE ERRAR ISSO):
    - POSIÇÃO DIREITA (RIGHT) ALINHADO À MARGEM DIREITA = É O HOMEM (USUÁRIO / VOCÊ DE QUEM É O CELULAR). MENSAGENS ENVIADAS.
    - POSIÇÃO ESQUERDA (LEFT) ALINHADO À MARGEM ESQUERDA = É A MULHER (ALVO). MENSAGENS RECEBIDAS. DICA VISUAL: Geralmente vêm acompanhadas de uma pequena FOTO DE PERFIL no topo ou ao lado esquerdo do balão.
    - IGNORE TOTALMENTE AS CORES DOS BALÕES. No Instagram/WhatsApp, AMBAS as pessoas podem ter balões roxos/azuis se houver um tema aplicado.
    - O ÚNICO critério verdadeiro é o ALINHAMENTO GEOMÉTRICO (Esquerda/Direita) na imagem.
    - Antes de começar a sua análise JSON, certifique-se de preencher a transcrição passo a passo corretamente e NUNCA inverta quem mandou o que.
    - OBJETIVO CENTRAL: A sua missão nas "responses" geradas é criar a PRÓXIMA mensagem do HOMEM. Você atua como o redator de mensagens para o homem. O HOMEM vai usar sua resposta para enviar para a MULHER. NUNCA gere uma variação para a mulher. Se ela mandou "oi", as respostas geradas DEVEM ser as respostas do homem ao "oi" dela.

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
            {
              type: "text",
              text: "CRITICAL INSTRUCTION FOR IMAGE RECOGNITION:\n1. This is a chat screenshot.\n2. Bubbles aligned to the RIGHT edge of the screen are sent by the USER (MAN). He usually DOES NOT have a profile pic next to his bubbles.\n3. Bubbles aligned to the LEFT edge of the screen are sent by the OTHER PERSON (WOMAN). She usually has a profile pic next to her bubble.\n4. YOUR TASK: You are acting as the MAN. You must read her last message and generate what the MAN should reply back to her.",
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
          "[AI SERVICE] Validation failed for analyzeContent. Content preview:",
          content.substring(0, 1000),
        );
        throw new Error("JSON Inválido na análise.");
      }

      const parsedResponse = JSON.parse(content) as NalabiaResponse;

      // --- HARDENED VALIDATION LAYER (CORE SAFETY SYSTEM) ---
      // 1. Check if we should reply based on identification
      // If the prompt worked, parsedResponse.shouldReply should be accurate.
      // However, we double check here if needed.

      // 2. Handle specific fallback if AI is unsure
      if (
        typeof parsedResponse.momentReading === "string" &&
        parsedResponse.momentReading
          .toLowerCase()
          .includes("imagem está um pouco ruída")
      ) {
        logEvent("system", "ai_uncertainty_fallback", { mode });
      }

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
    - Respostas Curtas: ${settings?.ai?.shortResponses ? "ON" : "OFF"}
    - Anti-Gado: ${settings?.ai?.avoidCompliments ? "ON" : "OFF"}

    🚨 DOGMA DE IDENTIDADE VISUAL (A MAIOR PRIORIDADE):
    - O HOMEM (USUÁRIO) escreve na DIREITA. Ele é dono do celular.
    - A MULHER (ALVO) escreve na ESQUERDA.
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
              text: "CRITICAL INSTRUCTION FOR IMAGE RECOGNITION:\n1. This is a chat screenshot.\n2. Bubbles aligned to the RIGHT edge of the screen are sent by the USER (MAN). He usually DOES NOT have a profile pic next to his bubbles.\n3. Bubbles aligned to the LEFT edge of the screen are sent by the OTHER PERSON (WOMAN). She usually has a profile pic next to her bubble.\n4. YOUR TASK: You are acting as the MAN. You must read her last message and generate what the MAN should reply back to her.",
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
              text: "CRITICAL INSTRUCTION FOR IMAGE RECOGNITION:\n1. This is a chat screenshot.\n2. Bubbles aligned to the RIGHT edge of the screen are sent by the USER (MAN). He usually DOES NOT have a profile pic next to his bubbles.\n3. Bubbles aligned to the LEFT edge of the screen are sent by the OTHER PERSON (WOMAN). She usually has a profile pic next to her bubble.\n4. YOUR TASK: You are acting as the MAN. You must read her last message and generate what the MAN should reply back to her.",
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
) => {
  const client = getMistralAI(settings);

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

  🚨 DOGMA DE IDENTIDADE VISUAL (NÃO INTERPRETE TEXTOS, APENAS OBEDEÇA A POSIÇÃO DOS BALÕES):
  - POSIÇÃO DIREITA (CANTO DIREITO DA TELA >>): SEMPRE O HOMEM (USUÁRIO / ME). É A MENSAGEM QUE ELE DIGITOU E ENVIOU. Pronomes: ELE / DELE.
  - POSIÇÃO ESQUERDA (CANTO ESQUERDO DA TELA <<) / TEM FOTO DE PERFIL AO LADO: SEMPRE A MULHER (ELA / TARGET). É A MENSAGEM QUE ELA MANDOU PARA ELE. Pronomes: ELA / DELA.
  - REGRAS INQUEBRÁVEIS:
    1. IGNORE AS CORES! No Instagram e no WhatsApp, temas mudam as cores dos balões. A cor NÃO DEVE ser usada para identificar ninguém.
    2. CITAÇÕES: Se houver a frase "fulana respondeu a você", o balão de texto logo abaixo dela é O QUE A MULHER HAVIA DITO ANTES, e a resposta que O HOMEM ESCREVEU AGORA é o balão que fica LOGO EM SEGUIDA.
    3. Se a mensagem está na ESQUERDA (Alinhada da Esquerda e Geralmente com Foto), FOI A MULHER QUE ESCREVEU.
    4. NUNCA diga para o homem: "sua resposta 'X' foi...", se 'X' estiver no balão ESQUERDO. O balão ESQUERDO é a resposta DELA.
    5. Se você chamar o da DIREITA de "ela", você falhou criticamente.
  
  [TRANSCRIÇÃO OBRIGATÓRIA]
  Antes de iniciar a análise, TRANSCREVA mentalmente as 4 últimas linhas do print lido, para NÃO ERRAR quem disse o quê.
  Exemplo do raciocínio obrigatório interno: 
  - Mulher (Esquerda): "Oi, tudo bem?"
  - Homem (Direita): "Opa, tranquilo"
  Não invente falas que não estão lá. Use O CONTEXTO CORRETO.

  - SE O ÚLTIMO BALÃO DA IMAGEM ESTIVER NA DIREITA: O homem é o último a ter falado. A ação correta normalmente é aguardar a resposta DELA (no balão Esquerdo).
  
  ⚠️ GERENCIAMENTO DE MEMÓRIA E CONTEXTO:
  - Se o perfil selecionado for 'Geral' ou 'NaLábia', trate cada print como uma pessoa diferente.
  - Se o perfil tiver um nome específico, você deve considerar o histórico e as memórias para evoluir a sua 'lábia' especificamente para esta mulher. Aprenda o que ela gosta e o que a faz investir.
  
  CONTEXTO:
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

Você é um estrategista social focado em RESULTADOS PRÁTICOS. 
Analise as imagens e a bio no MODO RAIO-X (Realista e Útil). 

${userContext}

DIRETRIZES DO RAIO-X:
1. DADOS BRUTOS: O que aparece nas fotos? (Selfies no espelho, viagens ostentação, fotos de academia, bio com regras).
2. TIPO DE PERFIL: Como ela se apresenta ao mundo? (Ex: Visual Padrão, Mais Lifestyle, Focada em Status).
3. ESTRATÉGIA DE CAMPO: 
   - O QUE EVITAR: Não elogie o óbvio. Não seja reativo se a bio for exigente.
   - O QUE FUNCIONA: Use o contraste. Se o perfil é muito luxuoso, seja simples e provocador com algo mundano.
4. ABORDAGENS: 3 exemplos de abridores curtos, naturais e que gerem curiosidade imediata sobre a 'vibe' visual dela.

PROIBIDO: Diagnósticos psicológicos, falar de traumas, inseguranças ou interpretar intenções ocultas.

Retorne APENAS um JSON válido:
{
  "vibe": "Descrição prática e realista do perfil.",
  "redFlags": ["Sinais de que a conversa pode ser difícil ou exigir muito investimento inicial"],
  "greenFlags": ["Sinais de que ela é receptiva a humor ou simplicidade"],
  "icebreakers": ["3 abridores do mundo real que não pareçam scripts de IA."]
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
