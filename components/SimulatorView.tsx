import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles } from 'lucide-react';
import { generateCustomChatResponse } from '../services/aiService';
import { ProcessingState, Profile, Message, AppSettings } from '../types';
import { checkDeviceUsage, incrementDeviceUsage } from '../services/antiFraud';
import { useAuth } from '../contexts/AuthContext';

interface SimulatorViewProps {
  activeProfile: Profile;
  updateActiveProfileMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  settings: AppSettings;
  userAIProfile?: any;
}

const SCENARIOS = [
  { id: 'interested', label: 'Interessada', desc: 'Responde rápido, investe na conversa.' },
  { id: 'cold', label: 'Fria', desc: 'Respostas curtas, demora para responder.' },
  { id: 'tease', label: 'Provocadora', desc: 'Testa você, faz joguinhos.' },
  { id: 'confused', label: 'Confusa', desc: 'Não sabe o que quer, dá sinais mistos.' },
];

const SimulatorView: React.FC<SimulatorViewProps> = ({ activeProfile, updateActiveProfileMessages, settings, userAIProfile }) => {
  const { user, userData, incrementUsage } = useAuth();
  const needsSubscription = user && userData && userData.status === 'pendente' && !userData.nalabiaPrimeAcess;

  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const messages = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).filter(m => m.mode === 'SIMULATOR');
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = () => {
    const startMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Simulação iniciada. Você mandou a primeira mensagem. O que você disse?',
      timestamp: Date.now(),
      mode: 'SIMULATOR'
    };
    updateActiveProfileMessages(prev => {
      const filtered = prev.filter(m => m.mode !== 'SIMULATOR');
      return [...filtered, startMessage];
    });
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
          mode: 'SIMULATOR'
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
          mode: 'SIMULATOR'
        };
        updateActiveProfileMessages(prev => [...prev, errMessage]);
        return;
      }
    }

    if (!input.trim() || status !== ProcessingState.IDLE) return;

    const userMsg = input;
    setInput('');
    
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMsg,
      timestamp: Date.now(),
      mode: 'SIMULATOR'
    };
    
    updateActiveProfileMessages(prev => [...prev, newMessage]);
    setStatus(ProcessingState.ANALYZING);

    const stateTimer1 = setTimeout(() => setStatus(ProcessingState.PROCESSING), 1500);
    const stateTimer2 = setTimeout(() => setStatus(ProcessingState.GENERATING_RESPONSE), 3500);

    try {
      const scenarioObj = SCENARIOS.find(s => s.id === scenario);
      const currentModeMessages = [...messages, newMessage];
      
      let userAIProfileInstruction = "";
      if (userAIProfile) {
        userAIProfileInstruction = `
        O usuário que está interagindo com você tem o seguinte perfil:
        - Nível de Experiência: ${userAIProfile.experienceLevel}
        - Estilo de Comunicação: ${userAIProfile.communicationStyle}
        - Objetivo: ${userAIProfile.goal}
        `;
      }

      const systemPrompt = `Você é uma mulher simulando uma conversa no Instagram.
Seu perfil atual é: ${scenarioObj?.label} - ${scenarioObj?.desc}.
Responda de forma natural, curta e realista, como uma garota no Instagram.
Não seja uma IA prestativa, seja a personagem.
${userAIProfileInstruction}
Histórico da conversa:
${currentModeMessages.map(m => `${m.role === 'user' ? 'Ele' : 'Você'}: ${m.content}`).join('\n')}
Responda apenas com a sua próxima mensagem.`;

      const responseText = await generateCustomChatResponse([], systemPrompt, settings);

      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText || '...',
        timestamp: Date.now(),
        mode: 'SIMULATOR'
      };
      updateActiveProfileMessages(prev => [...prev, assistantMessage]);

      await incrementUsage();
      if (needsSubscription) {
        await incrementDeviceUsage();
      }
    } catch (error: any) {
      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);
      console.error("Simulator Error:", error);
      
      let errorMessage = "Erro na IA. Tente novamente em alguns segundos.";
      if (typeof error?.message === 'string') {
        if (error.message.includes("429") || error.message.includes("Rate limit") || error.message.includes("capacity exceeded") || error.message.includes("quota")) {
          errorMessage = "A IA está sobrecarregada ou atingiu o limite de uso. Aguarde um momento.";
        } else {
          errorMessage = `Erro: ${error.message.substring(0, 100)}`;
        }
      }

      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
        mode: 'SIMULATOR'
      };
      updateActiveProfileMessages(prev => [...prev, errMessage]);
    } finally {
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

  return (
    <div className="flex flex-col h-full">
      <div className={`p-4 border-b border-gold-dim/10 ${getThemeHeaderBg()}`}>
        <h2 className="text-sm font-mono text-gold-glow uppercase tracking-widest flex items-center gap-2 mb-4">
          <Sparkles size={14} />
          Simulador de Conversa
        </h2>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => { 
                setScenario(s.id); 
                const filtered = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).filter(m => m.mode !== 'SIMULATOR');
                updateActiveProfileMessages(filtered);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-mono transition-colors ${
                scenario === s.id 
                  ? 'bg-gold-glow text-black' 
                  : 'bg-obsidian-light text-gray-400 hover:text-gold-glow border border-gold-dim/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-obsidian-light border border-gold-dim/10 flex items-center justify-center">
              <Bot size={24} className="text-gold-glow" />
            </div>
            <div>
              <p className="text-gray-400 font-mono text-sm">Pronto para treinar?</p>
              <p className="text-xs text-gray-600 mt-1">Selecione um cenário e inicie a simulação.</p>
            </div>
            <button 
              onClick={handleStart}
              className="px-6 py-2 bg-gold-glow text-black rounded-full font-medium hover:bg-gold-glow/80 transition-colors"
            >
              Iniciar Simulação
            </button>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === 'user' 
                  ? 'bg-gold-glow text-black rounded-tr-sm' 
                  : 'bg-obsidian-light border border-gold-dim/10 text-gray-200 rounded-tl-sm'
              }`}>
                <p className="text-sm">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
              </div>
            </div>
          ))
        )}
        {status !== ProcessingState.IDLE && (
          <div className="flex justify-start">
            <div className="bg-obsidian-light border border-gold-dim/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center space-x-2">
              <Loader2 size={16} className="animate-spin text-gold-glow" />
              <span className="text-xs text-gray-400">
                {status === ProcessingState.ANALYZING && 'Analisando...'}
                {status === ProcessingState.PROCESSING && 'Processando...'}
                {status === ProcessingState.GENERATING_RESPONSE && 'Gerando resposta...'}
              </span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {messages.length > 0 && (
        <div className={`p-4 border-t border-gold-dim/10 ${getThemeHeaderBg()}`}>
          <form onSubmit={handleSend} className="flex gap-2 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Sua mensagem..."
              className="flex-1 bg-obsidian-light border border-gold-dim/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gold-glow/50 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || status !== ProcessingState.IDLE}
              className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-gold-glow text-black rounded-lg hover:bg-gold-glow/80 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SimulatorView;
