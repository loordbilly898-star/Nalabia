import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ImageIcon, Loader2, Sparkles, X } from 'lucide-react';
import { getMistralAI } from '../services/mistral';
import { SYSTEM_PROMPT, AppSettings, Profile, ProcessingState, Message } from '../types';
import { sendNotification } from '../services/notificationService';
import { checkDeviceUsage, incrementDeviceUsage } from '../services/antiFraud';
import { useAuth } from '../contexts/AuthContext';

interface ChatbotViewProps {
  settings: AppSettings;
  activeProfile: Profile;
  userAIProfile?: any;
  updateActiveProfileMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
}

const ChatbotView: React.FC<ChatbotViewProps> = ({ settings, activeProfile, userAIProfile, updateActiveProfileMessages }) => {
  const { user, userData, incrementUsage } = useAuth();
  const needsSubscription = user && userData && userData.status === 'pendente' && !userData.nalabiaPrimeAcess;
  
  const messages = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).filter(m => m.mode === 'CHATBOT');
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setSelectedImage(dataUrl);
          } else {
            setSelectedImage(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const isDeveloper = userData?.plano === 'Desenvolvedor';

    if (needsSubscription) {
      const userFreeMessages = userData?.freeMessagesUsed || 0;
      const deviceAllowed = await checkDeviceUsage();
      
      if (userFreeMessages >= 2 || !deviceAllowed) {
        const errMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Seu limite de 2 mensagens gratuitas foi atingido. Assine um plano para continuar usando o NaLábia.",
          timestamp: Date.now(),
          mode: 'CHATBOT'
        };
        updateActiveProfileMessages(prev => [...prev, errMessage]);
        return;
      }
    } else if (!isDeveloper) {
      const today = new Date().toISOString().split('T')[0];
      if (userData?.lastRequestDate === today && (userData?.dailyRequests || 0) >= 50) {
        const errMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Você atingiu o limite diário de 50 requisições. Volte amanhã para continuar usando a IA!",
          timestamp: Date.now(),
          mode: 'CHATBOT'
        };
        updateActiveProfileMessages(prev => [...prev, errMessage]);
        return;
      }
    }

    if ((!input.trim() && !selectedImage) || status !== ProcessingState.IDLE) return;

    const userMsg = input;
    const userImg = selectedImage;
    setInput('');
    setSelectedImage(null);
    
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
      image: userImg || undefined,
      timestamp: Date.now(),
      mode: 'CHATBOT'
    };
    
    updateActiveProfileMessages(prev => [...prev, newMessage]);
    setStatus(ProcessingState.ANALYZING);

    const stateTimer1 = setTimeout(() => setStatus(ProcessingState.PROCESSING), 1000);
    const stateTimer2 = setTimeout(() => setStatus(ProcessingState.GENERATING_RESPONSE), 2000);

    try {
      const client = getMistralAI(settings);
      
      const currentModeMessages = [...messages, newMessage];
      const mistralMessages: any[] = [];

      let profileInstruction = "";
      if (activeProfile && activeProfile.id !== "general") {
        profileInstruction = `
        👤 PERFIL ATIVO: ${activeProfile.name} (${activeProfile.description})
        HISTÓRICO: O usuário já trocou ${(Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).length} mensagens.
        PADRÃO DELA: ${activeProfile.behavioralPattern || "Ainda em análise"}
        RISCO ANTERIOR: ${activeProfile.metrics.risk}
        `;
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

      let settingsInstruction = "";
      if (settings) {
        settingsInstruction = `
        ⚙️ CONFIGURAÇÕES ATIVAS (OBRIGATÓRIO SEGUIR):
        ${settings.ai?.avoidCompliments ? "- EVITAR ELOGIOS: Não use palavras como 'linda', 'gata', 'maravilhosa'. Seja mais frio e desafiador." : ""}
        ${settings.ai?.shortResponses ? "- RESPOSTAS CURTAS: Seja extremamente conciso. Responda com no máximo 1 ou 2 frases curtas." : ""}
        ${settings.ai?.avoidQuestions ? "- EVITAR PERGUNTAS: Não faça perguntas diretas. Faça afirmações que induzam ela a responder." : ""}
        ${settings.ai?.autoAdjustFlirt ? "- AUTO-AJUSTE DE FLERTE: Se a conversa estiver fria, diminua a intensidade do flerte. Se estiver quente, pode ousar mais." : ""}
        ${settings.safety?.antiNeedy ? "- ANTI-CARÊNCIA: NUNCA demonstre necessidade, desespero ou validação excessiva." : ""}
        ${settings.safety?.antiLongText ? "- ANTI-TEXTÃO: Nunca envie mensagens longas ou blocos de texto." : ""}
        ${settings.safety?.antiRobot ? "- ANTI-ROBÔ: Fale como um humano natural, use gírias leves se apropriado, evite linguagem formal demais." : ""}
        ${settings.safety?.antiOverflirt ? "- ANTI-OVERFLIRT: Não seja agressivo sexualmente fora de contexto. Mantenha a classe." : ""}
        `;
      }

      const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nCONTEXTO ATUAL:\n${profileInstruction}\n${userAIProfileInstruction}\n${settingsInstruction}`;

      mistralMessages.push({ role: "system", content: fullSystemPrompt });

      let hasImage = false;

      currentModeMessages.forEach(msg => {
        if (msg.image) {
          hasImage = true;
          mistralMessages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: [
              { type: "text", text: msg.content || "Image" },
              { type: "image_url", imageUrl: msg.image }
            ]
          });
        } else {
          mistralMessages.push({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content || ""
          });
        }
      });

      console.log("Prompt enviado:", mistralMessages);

      const modelToUse = hasImage ? "pixtral-12b-2409" : "mistral-large-latest";

      const responseStream = await client.chat.stream({
        model: modelToUse,
        messages: mistralMessages,
        temperature: 0.7,
      });

      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);

      const assistantMessageId = (Date.now() + 1).toString();
      let currentAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        mode: 'CHATBOT'
      };
      
      updateActiveProfileMessages(prev => [...prev, currentAssistantMessage]);

      let fullText = '';
      for await (const chunk of responseStream) {
        if (chunk.data.choices[0]?.delta?.content) {
          fullText += chunk.data.choices[0].delta.content;
          currentAssistantMessage = { ...currentAssistantMessage, content: fullText };
          
          updateActiveProfileMessages(prev => {
            const withoutLast = prev.filter(m => m.id !== currentAssistantMessage.id);
            return [...withoutLast, currentAssistantMessage];
          });
        }
      }

      setStatus(ProcessingState.IDLE);

      if (settings.notifications?.push) {
        sendNotification('Assistente IA', {
          body: 'O assistente respondeu à sua mensagem.',
        });
      }

      await incrementUsage();
      if (needsSubscription) {
        await incrementDeviceUsage();
      }

    } catch (error: any) {
      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);
      console.error("Chatbot Error:", error);
      
      let errorMessage = "Erro ao conectar com a IA. Tente novamente.";
      if (typeof error?.message === 'string') {
        errorMessage = `Erro: ${error.message}`;
      }

      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
        mode: 'CHATBOT'
      };
      updateActiveProfileMessages(prev => [...prev, errMessage]);
      setStatus(ProcessingState.IDLE);
    }
  };

  const getThemeHeaderBg = () => {
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-obsidian';
      case 'light': return 'bg-[#ffffff]';
      case 'midnight': return 'bg-[#1e293b]';
      case 'dracula': return 'bg-[#44475a]';
      case 'hacker': return 'bg-[#000000]';
      case 'cyberpunk': return 'bg-[#000000]';
      case 'dark':
      default: return 'bg-obsidian';
    }
  };

  const getThemeInputBg = () => {
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-obsidian text-gray-200';
      case 'light': return 'bg-[#ffffff] text-gray-900 border-gray-300';
      case 'midnight': return 'bg-[#1e293b] text-gray-200';
      case 'dracula': return 'bg-[#44475a] text-[#f8f8f2]';
      case 'hacker': return 'bg-[#000000] text-[#00ff00] border-green-900';
      case 'cyberpunk': return 'bg-[#000000] text-[#fcee0a] border-yellow-900';
      case 'dark':
      default: return 'bg-obsidian text-gray-200';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 border-b border-gold-dim/10 ${getThemeHeaderBg()}`}>
        <h2 className="text-sm font-mono text-gold-glow uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={14} />
          Assistente IA
        </h2>
        <p className="text-xs text-gray-500 mt-1">Faça perguntas ou envie imagens para análise.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-obsidian-light border border-gold-dim/10 flex items-center justify-center">
              <Bot size={24} className="text-gold-glow" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-300">Como posso ajudar?</h3>
              <p className="text-xs text-gray-500 mt-2 max-w-xs mx-auto">
                Faça uma pergunta sobre relacionamentos, envie um print para análise ou peça dicas.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 ${
                msg.role === 'user' 
                  ? `${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 text-gray-300 rounded-tr-sm` 
                  : 'bg-obsidian-light border border-gold-dim/10 text-gray-300 rounded-tl-sm'
              }`}>
                {msg.image && (
                  <img src={msg.image} alt="Upload" className="max-w-full rounded-lg mb-2 border border-gray-800" />
                )}
                <p className="text-sm whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
              </div>
            </div>
          ))
        )}
        {status !== ProcessingState.IDLE && (
          <div className="flex justify-start">
            <div className="bg-obsidian-light border border-gold-dim/10 rounded-2xl rounded-tl-sm p-3 flex items-center space-x-2">
              <Loader2 size={14} className="animate-spin text-gold-glow" />
              <span className="text-xs text-gray-400">
                {status === ProcessingState.ANALYZING && 'Analisando...'}
                {status === ProcessingState.PROCESSING && 'Processando...'}
                {status === ProcessingState.GENERATING_RESPONSE && 'Gerando resposta...'}
                {status === ProcessingState.CALCULATING && 'Simulando...'}
                {status === ProcessingState.REGENERATING && 'Regerando...'}
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className={`p-4 ${getThemeHeaderBg()} border-t border-gold-dim/10`}>
        {selectedImage && (
          <div className="mb-3 relative inline-block">
            <img src={selectedImage} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-gold-dim/10" />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-end space-x-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-3 rounded-xl ${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 text-gray-400 hover:text-gold-glow transition-colors`}
          >
            <ImageIcon size={20} />
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo ao assistente..."
              className={`w-full ${getThemeInputBg()} border border-gold-dim/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold-glow transition-colors`}
            />
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && !selectedImage) || status !== ProcessingState.IDLE}
            className="p-3 rounded-xl bg-gold-glow text-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gold-glow/80 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatbotView;
