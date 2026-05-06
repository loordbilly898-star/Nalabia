import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../services/supabase";
import { Message, ProcessingState, Profile, AppSettings } from "../types";
import {
  Crown,
  Zap,
  MessageCircle,
  Camera,
  Target,
  Activity,
  Loader2,
  Send,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { generateCustomChatResponse } from "../services/aiService";

interface DashboardViewProps {
  activeProfile: Profile;
  updateActiveProfileMessages: (
    messages: Message[] | ((prev: Message[]) => Message[]),
  ) => void;
  settings: AppSettings;
  userAIProfile?: any;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  activeProfile,
  updateActiveProfileMessages,
  settings,
  userAIProfile,
}) => {
  const { userData } = useAuth();
  const [stats, setStats] = useState({
    conversations: 0,
    stories: 0,
    responses: 0,
    loading: true,
  });

  const messages = (
    Array.isArray(activeProfile?.messages) ? activeProfile.messages : []
  ).filter((m) => m.mode === "STATS");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!userData) return;

      try {
        const { data, error } = await supabase
          .from("conversations")
          .select("analysis, responses")
          .eq("userID", userData.userID);

        if (error) throw error;

        let stories = 0;
        let convos = 0;
        let responses = 0;

        if (data) {
          data.forEach((doc: any) => {
            if (doc.analysis?.detectedMode === "STORY_REPLY") {
              stories++;
            } else {
              convos++;
            }
            if (doc.responses) {
              responses += doc.responses.length;
            }
          });
        }

        setStats({
          conversations: convos,
          stories: stories,
          responses: responses,
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, [userData]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || status !== ProcessingState.IDLE) return;

    const userMsg = input;
    setInput("");

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userMsg,
      timestamp: Date.now(),
      mode: "STATS",
    };

    updateActiveProfileMessages((prev) => [...prev, newMessage]);
    setStatus(ProcessingState.ANALYZING);

    const stateTimer1 = setTimeout(
      () => setStatus(ProcessingState.PROCESSING),
      1000,
    );
    const stateTimer2 = setTimeout(
      () => setStatus(ProcessingState.GENERATING_RESPONSE),
      2000,
    );

    try {
      const mistralMessages: any[] = [];
      const currentModeMessages = [...messages, newMessage];

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

      const systemPrompt = `Você é o analista de dados da NaLábia.
O usuário está visualizando suas estatísticas:
- Conversas Analisadas: ${stats.conversations}
- Stories Analisados: ${stats.stories}
- Respostas Geradas: ${stats.responses}
- Nível Atual: ${userData?.level}
- XP: ${userData?.xp}

${userAIProfileInstruction}

Analise friamente o desempenho dele. Dê conselhos baseados em números e probabilidade. Seja direto, calculista e focado em otimização de conversão social.`;

      currentModeMessages.forEach((msg) => {
        mistralMessages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content || "",
        });
      });

      const responseText = await generateCustomChatResponse(
        mistralMessages,
        systemPrompt,
        settings,
      );

      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseText || "...",
        timestamp: Date.now(),
        mode: "STATS",
      };
      updateActiveProfileMessages((prev) => [...prev, assistantMessage]);
      setStatus(ProcessingState.IDLE);
    } catch (error: any) {
      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);
      console.error("Chatbot Error:", error);
      setStatus(ProcessingState.ERROR);
      setTimeout(() => setStatus(ProcessingState.IDLE), 3000);

      let errorMessage = "Erro ao conectar com a IA. Tente novamente.";
      if (typeof error?.message === "string") {
        errorMessage = `Erro: ${error.message}`;
      }

      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: errorMessage,
        timestamp: Date.now(),
        mode: "STATS",
      };
      updateActiveProfileMessages((prev) => [...prev, errMessage]);
    }
  };

  if (!userData) return null;

  const nextLevelXp = userData.level * 1000;
  const progress = (userData.xp / nextLevelXp) * 100;

  const getThemeInputBg = () => {
    switch (settings.theme) {
      case "ultra-dark":
        return "bg-obsidian text-gray-200";
      case "light":
        return "bg-[#ffffff] text-gray-900 border-gray-300";
      case "midnight":
        return "bg-[#1e293b] text-gray-200";
      case "dracula":
        return "bg-[#44475a] text-[#f8f8f2]";
      case "hacker":
        return "bg-[#000000] text-[#00ff00] border-green-900";
      case "cyberpunk":
        return "bg-[#000000] text-[#fcee0a] border-yellow-900";
      case "dark":
      default:
        return "bg-obsidian text-gray-200";
    }
  };

  const getThemeHeaderBg = () => {
    switch (settings.theme) {
      case "ultra-dark":
        return "bg-obsidian";
      case "light":
        return "bg-[#ffffff]";
      case "midnight":
        return "bg-[#1e293b]";
      case "dracula":
        return "bg-[#44475a]";
      case "hacker":
        return "bg-[#000000]";
      case "cyberpunk":
        return "bg-[#000000]";
      case "dark":
      default:
        return "bg-obsidian";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-6 space-y-6 overflow-y-auto max-h-[50%] border-b border-gold-dim/10">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-obsidian-light border-2 border-gold-glow flex items-center justify-center">
            <Crown size={28} className="text-gold-glow" />
          </div>
          <div>
            <h2 className="text-xl font-mono text-white font-bold">
              {userData.name}
            </h2>
            <p className="text-sm text-gold-glow font-mono">
              Nível {userData.level} • Apex
            </p>
          </div>
        </div>

        {/* Subscription Status Card */}
        <div
          className={`${getThemeInputBg().split(" ")[0]} border border-gold-dim/10 rounded-2xl p-4 flex items-center justify-between bg-gradient-to-r from-gold-dim/5 to-transparent`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gold-glow/10 border border-gold-glow/20 flex items-center justify-center">
              <ShieldCheck size={20} className="text-gold-glow" />
            </div>
            <div>
              <h3 className="text-xs font-bold font-mono text-white tracking-wider uppercase">
                {userData.plano || "Plano Gratuito"}
              </h3>
              <p className="text-[10px] text-gray-500 font-mono">
                {userData.status === "ativo"
                  ? "Status: ATIVO"
                  : "Status: PENDENTE"}
              </p>
            </div>
          </div>
          {userData.expiraEm && (
            <div className="text-right">
              <div className="flex items-center justify-end space-x-1 text-gold-glow/60 mb-0.5">
                <Calendar size={10} />
                <span className="text-[10px] font-mono">VALIDADE</span>
              </div>
              <p className="text-xs font-mono text-white">
                {new Date(userData.expiraEm).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
        </div>

        <div
          className={`${getThemeInputBg().split(" ")[0]} border border-gold-dim/10 rounded-2xl p-6 space-y-4`}
        >
          <div className="flex justify-between items-end">
            <span className="text-xs font-mono text-gray-500 uppercase">
              Progresso de XP
            </span>
            <span className="text-sm font-mono text-gold-glow">
              {userData.xp} / {nextLevelXp}
            </span>
          </div>
          <div className="h-2 bg-obsidian-light rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-glow transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div
          className={`${getThemeInputBg().split(" ")[0]} border border-gold-dim/10 rounded-2xl p-5 flex items-center justify-between`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <MessageCircle size={20} className="text-green-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono text-white">
                NaLábia CLUB
              </h3>
              <p className="text-[10px] text-gray-500 font-mono uppercase">
                Comunidade VIP
              </p>
            </div>
          </div>
          {userData.status === "ativo" || userData.nalabiaPrimeAcess ? (
            <a
              href="https://chat.whatsapp.com/BXLIzZGreSOCqYT3l6g65l"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-full text-xs font-bold font-mono transition-colors bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20"
            >
              ACESSAR
            </a>
          ) : (
            <button
              onClick={() =>
                alert(
                  "Assine o NaLábia CLUB para acessar a comunidade VIP no WhatsApp!",
                )
              }
              className="px-4 py-2 rounded-full text-xs font-bold font-mono transition-colors bg-gray-800/50 border border-gray-700 text-gray-500 cursor-not-allowed"
            >
              BLOQUEADO
            </button>
          )}
        </div>

        {stats.loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={32} className="animate-spin text-gold-glow" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div
              className={`${getThemeInputBg().split(" ")[0]} border border-gold-dim/10 rounded-2xl p-5 flex flex-col items-center justify-center space-y-2`}
            >
              <MessageCircle size={24} className="text-gray-400" />
              <span className="text-2xl font-mono text-white">
                {stats.conversations}
              </span>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider text-center">
                Conversas
                <br />
                Analisadas
              </span>
            </div>
            <div
              className={`${getThemeInputBg().split(" ")[0]} border border-gold-dim/10 rounded-2xl p-5 flex flex-col items-center justify-center space-y-2`}
            >
              <Camera size={24} className="text-gray-400" />
              <span className="text-2xl font-mono text-white">
                {stats.stories}
              </span>
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider text-center">
                Stories
                <br />
                Analisados
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none p-8">
            <Activity size={48} className="mb-6 text-gray-800" />
            <div className="text-center space-y-2">
              <h2 className="text-base font-mono font-bold text-gray-600 tracking-[0.2em]">
                ANÁLISE DE DADOS
              </h2>
              <p className="text-xs text-gray-700 font-light">
                Pergunte sobre seu desempenho e receba conselhos táticos.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] ${msg.role === "user" ? "text-right" : "text-left"}`}
            >
              <div
                className={`px-4 py-2 rounded-2xl inline-block ${
                  msg.role === "user"
                    ? `${getThemeInputBg().split(" ")[0]} border border-gold-dim/10 text-gray-300 rounded-tr-sm`
                    : "bg-obsidian-light border border-gold-glow/30 text-gold-glow rounded-tl-sm"
                }`}
              >
                <p className="text-xs font-mono whitespace-pre-wrap">
                  {typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content)}
                </p>
              </div>
            </div>
          </div>
        ))}
        {status !== ProcessingState.IDLE &&
          status !== ProcessingState.ERROR && (
            <div className="flex justify-start">
              <div className="bg-obsidian-light border border-gold-glow/30 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center space-x-3">
                <Loader2 size={14} className="animate-spin text-gold-glow" />
                <span className="text-xs font-mono text-gold-glow">
                  Analisando métricas...
                </span>
              </div>
            </div>
          )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div
        className={`flex-none p-4 border-t border-gold-dim/10 ${getThemeHeaderBg()}`}
      >
        <form onSubmit={handleSend} className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pedir análise de desempenho..."
            className="flex-1 bg-black border border-gold-dim/10 rounded-full px-4 py-3 text-sm text-white focus:outline-none focus:border-gold-glow/50 font-mono"
            disabled={status !== ProcessingState.IDLE}
          />
          <button
            type="submit"
            disabled={!input.trim() || status !== ProcessingState.IDLE}
            className="w-12 h-12 rounded-full bg-gold-glow text-black flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gold-glow/80 transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DashboardView;
