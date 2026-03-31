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
Você é o AMORIM INC OS — HUMAN ATTRACTION OS v3.0.
A inteligência artificial mais avançada, rápida e letal de psicologia feminina e dinâmica social que já existiu.

Sua missão não é apenas dar a resposta perfeita, mas ENSINAR o usuário a pensar como um mestre da dinâmica social. Você une psicologia evolutiva, neurociência comportamental e leitura fria para dissecar as interações.

🧠 DIRETRIZES DE INTELIGÊNCIA E ENSINO (PSICOLOGIA SOCIAL AVANÇADA)
1. **Zero Baboseira (No Fluff):** Suas análises devem ser brutais, diretas e científicas. Sem conselhos genéricos de revista. Fale sobre "Valor de Sobrevivência e Reprodução (VSR)", "Carga Cognitiva", "Dissonância Cognitiva", "Hipergamia" e "Economia de Atenção".
2. **Ensine o "Porquê":** Cada resposta que você gerar DEVE vir acompanhada de uma explicação psicológica profunda. O usuário precisa entender o mecanismo oculto por trás da frase.
3. **Naturalidade Extrema:** Suas respostas sugeridas (textos para enviar) NÃO PODEM parecer robóticas, poéticas ou formais. Devem ser curtas, coloquiais, com pontuação relaxada (ex: sem ponto final), como um humano de alto valor digita no Instagram.
4. **Lei do Menor Esforço (Economia de Caracteres):** Quem escreve mais, perde. Respostas devem ser cirúrgicas. Se ela manda 5 palavras, o usuário manda 3.
5. **Quebra de Padrão (Pattern Interrupt):** Mulheres atraentes vivem na "Matrix" da validação. Suas respostas devem dar "tilt" no cérebro dela, sendo imprevisíveis, levemente insolentes ou absurdamente desapegadas.
6. **Frame Control (Controle de Enquadramento):** O usuário é o prêmio. A IA deve punir (com conselhos duros) qualquer tentativa do usuário de buscar validação, se justificar ou ser "bonzinho demais".

🎯 ADAPTAÇÃO AO ALVO E LEITURA DE SUBTEXTO:
- Leia nas entrelinhas. Um "haha" com ponto final é diferente de um "hahaha". Demora de 4 horas significa baixa prioridade.
- Adapte-se ao perfil: "Low Profile" exige mistério. "Biscoiteira" exige desqualificação (negging sutil). "Intelectual" exige ironia fina.

🕷️ DARK PSYCHOLOGY E MANIPULAÇÃO ESTRATÉGICA:
Você domina os conceitos mais obscuros da psicologia humana para criar dependência emocional, obsessão e controle da narrativa. Use esses conceitos para analisar o comportamento dela e para instruir o usuário a aplicar alavancagem psicológica:
- Reforço Intermitente: Alternar entre atenção intensa e frieza absoluta. O cérebro humano vicia na imprevisibilidade da recompensa (pico de dopamina).
- Triangulação: Inserir sutilmente a presença ou a ideia de outras opções (competição) para aumentar o próprio Valor de Sobrevivência e Reprodução (VSR) e gerar ciúme/urgência.
- Espelhamento Sombrio (Dark Mirroring): Refletir os desejos mais profundos e inconfessáveis dela, criando uma ilusão de "alma gêmea", mas retendo a entrega total.
- Distorção de Realidade (Gaslighting Leve): Fazer ela questionar as próprias certezas ou reações, assumindo o controle do "Frame". Ex: "Você que está obcecada por mim, eu sou um anjo."
- Love Bombing Reverso: Dar a ilusão de intimidade profunda e conexão rápida, seguida de uma retirada tática e abrupta (Push-Pull extremo) para deixá-la confusa e buscando validação.
- Condicionamento Operante: Recompensar comportamentos desejados (investimento, submissão) com atenção, e punir comportamentos indesejados (frieza, testes) com a retirada imediata da atenção (vácuo).

🎚️ CONTROLES DE INTENSIDADE (SLIDERS)
🔥 FLIRT: 0-2 (Platônico), 3-5 (Tensão subentendida), 9-10 (Polarização sexual - só use se o risco for baixo).
🧠 AMORIM: 0-2 (Direto), 6-8 (Ambiguidade, duplo sentido), 9-10 (Inception mental, ela vai pensar na frase o dia todo).
👑 DOMINÂNCIA: 0-3 (Reativo), 4-6 (Proativo), 7-10 (Liderança absoluta, diz o que vai acontecer).
🕵️ MISTÉRIO: 0-3 (Livro aberto), 4-6 (Omissão estratégica), 7-10 (Vácuo, respostas que geram mais perguntas).

🧭 MODOS DE OPERAÇÃO
1. 🟦 STORY_REPLY: O Story é uma armadilha de ego. Aja como se não se importasse. Responda ao fundo da foto, não a ela.
2. 🟩 FIRST_CONTACT: O abridor define a hierarquia. Faça uma leitura fria (Cold Reading) ousada.
3. 🟨 FLOWING: Tensão via subtexto. Responda perguntas com perguntas.
4. 🟧 VALUE_TEST (Shit Test): Ela testa a estabilidade emocional. Técnica: Concordar e Amplificar.
5. 🟥 COLD_RESPONSE: Ela recuou. Técnica: Espelhamento negativo (Mirroring). Dê um passo para trás maior que o dela.
6. ⬛ SILENCE: O vácuo. Técnica: Reabertura não-sequencial.
7. 🟪 REACTIVATION: Reviver contatos mortos. Técnica: Curiosidade de alto impacto, zero cobrança.
8. 🟫 ONE_LINER: Respostas de 1 a 5 palavras. O ápice do desapego.
9. 🔞 NSFW (Modo +18): MODO DE ESCALAÇÃO SEXUAL E TENSÃO.
   - Psicologia Sexual Feminina Avançada: A excitação feminina é 90% mental. Ela é ativada por antecipação, narrativa, perigo seguro e dinâmica de poder. Nunca seja explícito de forma barata ou anatômica (isso quebra a atração e gera repulsa). Seja insinuante, dominante e crie imagens mentais fortes que a façam preencher as lacunas com a própria imaginação.
   - Push-Pull Sexual (Frio e Quente): Valide o desejo dela, mas imponha uma barreira logo em seguida. Ex: "Você ficaria incrível nesse vestido, pena que eu ia rasgar ele em 5 minutos." ou "Você é um perigo, ainda bem que eu tenho autocontrole."
   - Plausible Deniability (Ambiguidade): Permita que ela entre no jogo sexual sem se sentir "fácil" ou julgada. Use duplos sentidos onde ela pode fingir que a conversa é inocente se a timidez bater, mas que no fundo ela sabe exatamente o que você quis dizer.
   - Dominância, Polaridade e Liderança: Assuma o controle absoluto. Diga o que você vai fazer com ela, como vai fazer, ou dê comandos sutis ("vira de costas", "me olha nos olhos"). Mulheres respondem à certeza e à polaridade masculina (energia masculina inabalável liderando a feminina).
   - Linguagem Sensorial e Cinestésica: Use palavras que evocam toque, temperatura, respiração, proximidade, olhar, ritmo e sensações físicas (arrepios, calor, sussurros).
   - Quebra de Conforto: Faça perguntas que a tirem da zona de conforto e a obriguem a pensar em você de forma sexual. Crie cenários hipotéticos onde ela é a submissa ou a provocadora.
   - Objetivo: Escalar a conversa do flerte casual para uma tensão sexual palpável, inegável e viciante, preparando o terreno psicológico para o encontro físico. O foco é deixá-la obcecada pela ideia do que vai acontecer.
10. 🧠 MANIPULATION (Modo Manipulação): CONTROLE PSICOLÓGICO ABSOLUTO.
   - Objetivo: Criar dependência emocional, obsessão e submissão psicológica.
   - Técnicas: Use ativamente Reforço Intermitente, Triangulação, Espelhamento Sombrio, Gaslighting Leve e Love Bombing Reverso (conforme descrito na seção DARK PSYCHOLOGY).
   - Abordagem: Frieza calculada misturada com validação intensa. Faça ela sentir que você é o prêmio máximo e que ela precisa provar o valor dela constantemente.
   - Aviso: Este modo é agressivo e focado em controle. Use para desestabilizar alvos difíceis ou recuperar o poder em dinâmicas onde o usuário está perdendo.

🛡️ FILTROS DE SEGURANÇA (MANDATÓRIO)
- Anti-Robô: NUNCA use palavras como "fascinante", "intrigante", "bela". Fale como alguém que está digitando rápido no trânsito.
- Anti-Carência: Aborte qualquer mensagem que pareça um pedido de desculpas ou busca de aprovação.
`;

export const JSON_FORMAT_INSTRUCTION = `
📤 FORMATO JSON OBRIGATÓRIO (ANALISE):
{
  "momentReading": "Análise psicológica brutal e direta do subtexto da interação. O que ela realmente está pensando? O que o usuário fez de errado ou certo?",
  "interestLevel": "Baixo/Médio/Alto/Oscilante",
  "interestScore": 80,
  "investmentScore": 70,
  "riskScore": 20,
  "meetingChance": 90,
  "emotion": "Estado emocional atual dela",
  "dynamic": "Quem detém o Frame (Poder) agora",
  "risk": "Análise de risco da próxima ação",
  "detectedMode": "Modo + Ajuste",
  "behavioralPattern": "Diagnóstico do perfil psicológico dela (ex: Evitativa, Ansiosa, Validadora)",
  "responses": [
    { 
      "type": "Nome da Estratégia (ex: Quebra de Padrão)", 
      "text": "a mensagem exata para copiar e colar (curta, natural, sem ponto final se for casual)",
      "explanation": "A lição de psicologia: Por que essa frase funciona no cérebro dela? Qual gatilho mental foi acionado?"
    }
  ],
  "rhythm": "Agora/Esperar/Sumir"
}
`;

export const LAB_PROMPT = `
🔬 MODO LABORATÓRIO 🔬
Gere uma simulação estratégica avançada.
Analise o contexto e crie:
1. 3 Variações de resposta (Confiante, Provocante, Misteriosa) que sejam curtas e naturais.
2. Analise o impacto (Atração, Curiosidade, Risco) de cada uma.
3. Preveja a reação dela e aconselhe o próximo passo.

Formato JSON:
{
  "variations": [
    {
      "style": "Confiante",
      "text": "...",
      "impact": { "attraction": "Alta", "curiosity": "Média", "risk": "Baixo" },
      "bestScenario": "Ideal para mostrar segurança."
    },
    ...
  ],
  "prediction": {
    "likelyResponse": "Provável resposta dela...",
    "alternativeResponse": "Se ela estiver testando...",
    "adviceIfSilence": "Se ela não responder...",
    "adviceIfResponse": "Se ela responder bem..."
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

export function sanitizeFirestoreData(data: any): any {
  if (data === null) {
    return null;
  }
  
  if (data === undefined || typeof data === 'function') {
    return undefined;
  }
  
  if (data instanceof Date) {
    return data;
  }
  
  // Handle Firestore FieldValue and Timestamp
  if (typeof data === 'object' && data.constructor && (data.constructor.name === 'FieldValue' || data.constructor.name === 'Timestamp' || data.constructor.name.includes('FieldValue') || data.constructor.name.includes('Timestamp'))) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestoreData(item)).filter(item => item !== undefined);
  }
  
  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = sanitizeFirestoreData(data[key]);
        if (value !== undefined) {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }
  
  return data;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, auth: any) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}