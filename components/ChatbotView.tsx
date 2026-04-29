import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ImageIcon, Loader2, Sparkles, X, ScanFace, Ghost, Crown, AlertTriangle, Zap } from 'lucide-react';
import { generateChatStream } from '../services/aiService';
import { SYSTEM_PROMPT, CHAT_RESPONSE_STRUCTURE, AppSettings, Profile, ProcessingState, Message } from '../types';
import { sendNotification } from '../services/notificationService';
import { checkDeviceUsage, incrementDeviceUsage } from '../services/antiFraud';
import { useAuth } from '../contexts/AuthContext';
import { logEvent } from '../services/logger';

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
          content: "Seu limite de 2 mensagens gratuitas foi atingido. Assine um plano para continuar usando a NaLábia.",
          timestamp: Date.now(),
          mode: 'CHATBOT'
        };
        updateActiveProfileMessages(prev => [...prev, errMessage]);
        return;
      }
    } else if (!isDeveloper) {
      const today = new Date().toISOString().split('T')[0];
      if (userData?.lastRequestDate === today && (userData?.dailyRequests || 0) >= 1000) {
        const errMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Você atingiu o limite de segurança da plataforma (1000 requisições). Volte amanhã para continuar usando a IA!",
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

    let assistantMessageId = '';
    let currentAssistantMessage: any = null;
    try {
      const startTime = Date.now();
      const responseStream = await generateChatStream(
        [...messages, newMessage],
        settings,
        activeProfile || undefined,
        userAIProfile,
        userData?.memories
      );

      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);

      let assistantMessageAdded = false;
      let fullText = '';
      try {
        for await (const chunk of responseStream as any) {
          const content = chunk.choices?.[0]?.delta?.content || "";
          if (content) {
            const cleanContent = content.replace(/\*/g, '');
            if (!assistantMessageAdded) {
               assistantMessageId = (Date.now() + 1).toString();
               currentAssistantMessage = {
                 id: assistantMessageId,
                 role: 'assistant',
                 content: '',
                 timestamp: Date.now(),
                 mode: 'CHATBOT'
               };
               updateActiveProfileMessages(prev => [...prev, currentAssistantMessage]);
               assistantMessageAdded = true;
            }

            fullText += cleanContent;
            currentAssistantMessage = { ...currentAssistantMessage, content: fullText };
            
            updateActiveProfileMessages(prev => {
              return prev.map(m => m.id === assistantMessageId ? { ...m, content: fullText } : m);
            });
          }
        }

        if (!assistantMessageAdded || !fullText.trim()) {
           throw new Error("A IA não retornou conteúdo. Tente novamente.");
        }

        logEvent('api', 'Chatbot stream completed', { responseTime: Date.now() - startTime });
      } catch (streamError: any) {
        logEvent('api', 'Chatbot stream interrupted', { errorDetail: streamError.message });
        if (!fullText.trim()) throw streamError;
      }

      setStatus(ProcessingState.IDLE);

      if (settings.notifications?.push) {
        sendNotification('Assistente IA', {
          body: 'O assistente respondeu à sua mensagem.',
        });
      }

      try {
        await incrementUsage();
        if (needsSubscription) {
          await incrementDeviceUsage();
        }
      } catch (postError) {
        console.error("Error updating usage:", postError);
      }

    } catch (error: any) {
      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);
      console.error("Chatbot Error:", error);
      
      // Remove the empty placeholder if it exists and is empty to avoid polluting history
      updateActiveProfileMessages(prev => prev.filter(m => m.id !== assistantMessageId || (m.content && m.content.trim().length > 0)));
      
      let errorMessage = "Erro na IA. Tente reformular ou enviar novamente em alguns segundos.";
      if (typeof error?.message === 'string') {
         if (error.message.includes("fetch failed") || error.name === "AbortError" || error.message.includes("network") || error.name === "TypeError") {
            errorMessage = "Erro de conexão. Verifique sua internet ou tente novamente.";
         } else if (error.message.includes("429") || error.message.includes("Rate limit") || error.message.includes("capacity exceeded") || error.message.includes("quota")) {
            errorMessage = "A IA está sobrecarregada ou atingiu o limite de uso. Tente novamente em 2 minutos.";
         } else if (error.message.includes("A IA não retornou")) {
            errorMessage = error.message;
         } else {
            errorMessage = `Ops! Algo deu errado: ${error.message.substring(0, 100)}`;
         }
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

  const renderMentorMessage = (content: string) => {
    const sections = [
      { key: '[CONTROLE]', label: 'Análise de Controle', icon: <ScanFace size={12} />, color: 'text-purple-400' },
      { key: '[RESPOSTA]', label: 'Resposta Recomendada', icon: <Zap size={12} />, color: 'text-gold-glow' },
      { key: '[TRANSCRIÇÃO OBRIGATÓRIA]', label: 'Análise Visual Estrita', icon: <ScanFace size={12} />, color: 'text-gray-400' },
      { key: '[LEITURA]', label: 'Leitura do Momento', icon: <Sparkles size={12} />, color: 'text-blue-400' },
      { key: '[VISÃO]', label: 'Visão Estratégica', icon: <ScanFace size={12} />, color: 'text-purple-400' },
      { key: '[AJUSTE]', label: 'Ajuste de Rota', icon: <AlertTriangle size={12} />, color: 'text-red-400' },
      { key: '[VERSÃO MELHOR]', label: 'Sugestão de Resposta', icon: <Zap size={12} />, color: 'text-gold-glow' },
      { key: '[REGRA]', label: 'Regra de Ouro', icon: <Crown size={12} />, color: 'text-emerald-400' },
    ];

    let currentContent = content.replace(/\[OUTPUT\]\n/g, '');
    const parts: { label: string; text: string; icon: any; color: string }[] = [];

    sections.forEach((section, index) => {
      if (currentContent.includes(section.key)) {
        // Encontra a próxima tag que existe no texto para saber onde parar
        let nextIndex = currentContent.length;
        sections.forEach((s) => {
          const sIndex = currentContent.indexOf(s.key);
          const currentSIndex = currentContent.indexOf(section.key);
          if (sIndex > currentSIndex && sIndex < nextIndex) {
            nextIndex = sIndex;
          }
        });

        const start = currentContent.indexOf(section.key) + section.key.length;
        
        parts.push({
          label: section.label,
          text: currentContent.substring(start, nextIndex).trim(),
          icon: section.icon,
          color: section.color
        });
      }
    });

    if (parts.length === 0) {
      return <p className="text-sm whitespace-pre-wrap">{content}</p>;
    }

    return (
      <div className="space-y-4">
        {parts.map((p, i) => (
          <div key={i} className="space-y-1.5">
            <div className={`flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest ${p.color}`}>
              {p.icon}
              {p.label}
            </div>
            <div className={`text-sm leading-relaxed ${(p.label === 'Sugestão de Resposta' || p.label === 'Resposta Recomendada') ? 'bg-gold-glow/5 border border-gold-glow/20 rounded-lg p-3 font-medium text-gold-glow' : 'text-gray-300'}`}>
              {p.text === 'NÃO RESPONDA' ? (
                <div className="flex items-center gap-2 text-blue-400">
                  <Ghost size={14} />
                  <span>Mantenha o silêncio absoluto agora.</span>
                </div>
              ) : p.text}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 border-b border-gold-dim/10 ${getThemeHeaderBg()}`}>
        <h2 className="text-sm font-mono text-gold-glow uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={14} />
          NaLábia Mentoria
        </h2>
        <p className="text-xs text-gray-500 mt-1">Estratégia, leitura fria e domínio social.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-obsidian-light border border-gold-dim/10 flex items-center justify-center">
              <Bot size={24} className="text-gold-glow" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-300">Qual a missão de hoje, parceiro?</h3>
              <p className="text-xs text-gray-500 mt-2 max-w-xs mx-auto">
                Diz aí o que está rolando. Print, dúvida ou estratégia? Estou aqui para garantir que você não erre o frame.
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
                {msg.role === 'assistant' ? (
                  renderMentorMessage(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
                )}
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
              placeholder="Fale com seu parceiro (Dica: Use 'Ela:', 'Eu:')"
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
