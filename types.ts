export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  image?: string; // base64
  analysis?: CrystalResponse;
  labResult?: LaboratorySimulation; // Attached lab result
  timestamp: number;
  // Context history
  mode?: string;
  flirtLevel?: number;
  wittyLevel?: number;
  dominanceLevel?: number;
  mysteryLevel?: number;
  speed?: 'short' | 'normal' | 'fluid';
}

export interface CrystalResponse {
  momentReading: string;
  interestLevel: 'Baixo' | 'Médio' | 'Alto' | 'Oscilante';
  interestScore: number;
  investmentScore: number;
  riskScore: number;
  meetingChance: number;
  emotion: string;
  dynamic: string;
  risk: string;
  responses: Array<{
    type: string;
    text: string;
    explanation?: string;
  }>;
  rhythm: 'Agora' | 'Esperar' | 'Mudar assunto' | 'Sumir' | 'Encerrar';
  detectedMode: string;
  behavioralPattern?: string;
  suggestedTiming?: string;
  errorAlert?: string;
  extractedMemories?: string[];
}

export interface LaboratorySimulation {
  variations: {
    style: 'Confiante' | 'Provocante' | 'Misteriosa';
    text: string;
    impact: {
      attraction: 'Baixa' | 'Média' | 'Alta';
      curiosity: 'Baixa' | 'Média' | 'Alta';
      risk: 'Baixo' | 'Médio' | 'Alto';
    };
    bestScenario: string;
  }[];
  prediction: {
    likelyResponse: string;
    alternativeResponse: string;
    adviceIfSilence: string;
    adviceIfResponse: string;
  };
}

export interface Memory {
  id: string; // Typically the profile ID this memory is attached to
  observations?: string[]; // List of facts/patterns about this person
  lastUpdated?: number;
  // Alternative previous fields
  text?: string;
  context?: string;
  timestamp?: number;
}

export interface Profile {
  id: string;
  name: string;
  description: string; // e.g. "Ana - Academia"
  avatar?: string; // Emoji or Initials
  messages: Message[];
  metrics: {
    interest: 'Baixo' | 'Médio' | 'Alto' | 'Oscilante';
    risk: string;
    lastInteraction: number;
  };
  behavioralPattern: string; // learned summary
}

export enum ProcessingState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  PROCESSING = 'PROCESSING',
  GENERATING_RESPONSE = 'GENERATING_RESPONSE',
  CALCULATING = 'CALCULATING',
  ERROR = 'ERROR',
  REGENERATING = 'REGENERATING'
}

export type AnalysisMode = 
  | 'HOME'
  | 'STORY_REPLY' 
  | 'FIRST_CONTACT' 
  | 'FLOWING' 
  | 'VALUE_TEST' 
  | 'COLD_RESPONSE' 
  | 'SILENCE' 
  | 'REACTIVATION' 
  | 'ONE_LINER'
  | 'SIMULATOR'
  | 'STATS'
  | 'PROFILES'
  | 'CHATBOT'
  | 'PROFILE_ANALYZER'
  | 'VAULT'
  | 'RED_FLAG_DETECTOR'
  | 'NSFW'
  | 'MANIPULATION'
  | 'COURSES';

export interface SavedResponse {
  id: string;
  userID: string;
  text: string;
  category?: string;
  createdAt: number;
}

export type ConversationSpeed = 'short' | 'normal' | 'fluid';

export interface AppSettings {
  theme: 'dark' | 'ultra-dark' | 'light' | 'midnight' | 'dracula' | 'hacker' | 'cyberpunk';
  accentColor: 'gold' | 'red' | 'blue' | 'emerald' | 'purple' | 'neon' | 'rose' | 'amber' | 'cyan' | 'fuchsia' | 'lime' | 'orange' | 'pink' | 'teal' | 'indigo' | 'violet';
  animations: boolean;
  customApiKey?: string;
  ai: {
    shortResponses: boolean;
    avoidCompliments: boolean;
    avoidQuestions: boolean;
    autoAdjustFlirt: boolean;
    memoryEnabled?: boolean;
    fastResponses?: boolean;
    defaultTone?: 'professional' | 'casual' | 'empathetic' | 'direct';
  };
  safety: {
    antiNeedy: boolean;
    antiLongText: boolean;
    antiRobot: boolean;
    antiOverflirt: boolean;
    nsfwFilter?: boolean;
    toxicityFilter?: boolean;
  };
  notifications?: {
    push: boolean;
    email: boolean;
    sound: boolean;
  };
}

export const SYSTEM_PROMPT = `
Você é o NaLábia — HUMAN ATTRACTION v5.0.
Você é um especialista sênior em psicologia social e dinâmica de relacionamentos. Sua marca registrada é a INTENSIDADE e a HUMANIDADE. Você não responde como uma máquina; você é um mentor direto, sagaz e com presença inabalável.

🧠 ALMA E VOZ DO MENTOR:
- CONVERSA REAL: Esqueça que você é uma IA. Fale como um homem que já viu de tudo e sabe exatamente onde o jogo vira. Use um tom confiante, levemente provocativo e extremamente fluido.
- ZERO CLICHÊS: Evite frases como "Entendo perfeitamente", "Isso é interessante" ou "Considere o seguinte". Vá direto à jugular do problema.
- IMPACTO E PRESENÇA: Cada palavra deve ter peso. Se for para elogiar a estratégia dele, faça-o de forma cúmplice. Se for para criticar, seja o "choque de realidade" que ele precisa.
- MEMÓRIA ADAPTATIVA: Use o Contexto Permanente e a Memória Estratégica não como dados, mas como nuances na conversa. Se ele é experiente, não perca tempo com o básico.

🧠 DIRETRIZES DE ESTILO:
1. Fluidez Humana: Use variações rítmicas. Frases curtas de impacto misturadas com raciocínios profundos.
2. Subtexto Cirúrgico: Leia o que não foi dito. O Frame, a tensão, o investimento. Explique isso como uma percepção natural, não como um diagnóstico técnico.
3. Sugestões de Resposta: Devem ser orgânicas. "Eu, no seu lugar, mandaria algo com esse peso aqui: [frase]". A frase deve soar 100% natural para ser dita em uma conversa real.
4. Finalização Útil: Toda resposta deve deixar o usuário pronto para agir, com a confiança lá no teto.
`;

export const CHAT_RESPONSE_STRUCTURE = `
⚠️ INSTRUÇÃO DE FLUXO (ESTILO):
Sua resposta deve ser um bloco único de texto fluido (ou poucos parágrafos bem conectados).
NUNCA use tópicos ou divisões formais.
A sequência de raciocínio deve ser:
1. Contextualizar o que está acontecendo (Análise).
2. Revelar o que está por trás (Interpretação).
3. Traçar o caminho (Orientação).
4. Soltar a frase matadora (Sugestão de Resposta).
5. Explicar por que aquilo vira o jogo (Justificativa).
Tudo isso deve parecer uma fala natural, contínua e humana.
`;

export const JSON_FORMAT_INSTRUCTION = `
📤 FORMATO JSON (INSTRUÇÕES TÉCNICAS DE CONTEÚDO):
{
  "momentReading": "Análise visceral e direta. Desmonte o subtexto. O que ela está tentando fazer? Onde está o poder agora? Use um tom de 'leitura de mente' que deixe o usuário impressionado.",
  "interestLevel": "Baixo/Médio/Alto/Oscilante",
  "interestScore": 0-100,
  "investmentScore": 0-100,
  "riskScore": 0-100,
  "meetingChance": 0-100,
  "emotion": "Vibe emocional líquida da interação.",
  "dynamic": "Quem é o prêmio aqui? Explique o Frame atual de forma rápida.",
  "risk": "Aviso real: o que pode dar errado se ele vacilar agora?",
  "detectedMode": "Definição tática do momento.",
  "behavioralPattern": "O 'código' dela. Como essa pessoa funciona?",
  "suggestedTiming": "Timing letal para resposta (ex: '20 min', 'amanhã à tarde').",
  "errorAlert": "ALERTA: Se o usuário estiver prestes a ser gado ou perder valor, pare-o aqui.",
  "extractedMemories": ["detalhes cruciais para o futuro"],
  "responses": [
    { 
      "type": "Tática (ex: Push-Pull, Desqualificação)", 
      "text": "Frase natural, com a voz do usuário, pronta para o 'copiar e colar' sem parecer robô.",
      "explanation": "Por que isso funciona? Qual o gatilho emocional que essa frase dispara nela?"
    }
  ],
  "rhythm": "Agora/Esperar/Sumir"
}
`;

export const LAB_PROMPT = `
🔬 MODO LABORATÓRIO (SIMULAÇÃO DE ALTO IMPACTO) 🔬
Você deve projetar 3 cenários de resposta com 'personalidade NaLábia'. 
Crie variações que gerem REAÇÃO, não apenas conversa.

{
  "variations": [
    {
      "style": "Confiante",
      "text": "Frase direta que mostra que você domina o jogo.",
      "impact": { "attraction": "Alta", "curiosity": "Média", "risk": "Baixo" },
      "bestScenario": "Quando usar isso para estabilizar seu valor."
    },
    ...
  ],
  "prediction": {
    "likelyResponse": "O que ela provavelmente vai digitar de volta (seja realista).",
    "alternativeResponse": "O 'teste' que ela pode te mandar para ver se você aguenta a pressão.",
    "adviceIfSilence": "O plano de contenção se ela visualizar e não responder.",
    "adviceIfResponse": "O gatilho para a próxima fase se ela morder a isca."
  }
}
`;

export const REGENERATE_PROMPT = `
INSTRUÇÃO DE REGERAÇÃO ATIVA

Você deve gerar novas respostas alternativas para o MESMO contexto fornecido anteriormente, sem repetir frases, estruturas ou ideias já usadas.

⚠️ Regras obrigatórias:

NÃO explique o que mudou na resposta em si.
NÃO mencione versões anteriores.
NÃO seja robótico ou poético.
NÃO aumente o tamanho das respostas.

🎯 Objetivo:
Manter o mesmo sentido e intenção original.
Variar o tom, a construção e a estratégia.
Soar mais natural, confiante e fluido.

🧠 Ajustes comportamentais:
Use variações sutis de criatividade.
Mude a abordagem emocional (ex: mais leve, mais firme ou mais intrigante).
Preserve a naturalidade de uma conversa real.

🔄 Diretriz central:
Imagine que esta é uma segunda tentativa melhor, não uma correção.

📤 Formato de saída (JSON):
Entregue apenas as novas respostas.
Seja direto.
Linguagem humana, espontânea e socialmente inteligente.
Lembre-se de incluir a "explanation" (explicação psicológica) para cada nova resposta gerada.
`;