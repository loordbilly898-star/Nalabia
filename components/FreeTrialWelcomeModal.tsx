import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Clock,
  Zap,
  ShieldCheck,
  Crown,
  ChevronRight,
  Flame,
  CheckCircle2,
  Lock,
  ArrowRight,
  Target,
  Brain,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { formatTrialRemainingTime } from "../services/antiFraud";

interface FreeTrialWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
  trialExpiresAt?: number;
  userName?: string;
}

export const FreeTrialWelcomeModal: React.FC<FreeTrialWelcomeModalProps> = ({
  isOpen,
  onClose,
  onViewPlans,
  trialExpiresAt,
  userName,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!trialExpiresAt) return 24 * 60 * 60 * 1000;
    return Math.max(0, trialExpiresAt - Date.now());
  });

  useEffect(() => {
    if (!trialExpiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, trialExpiresAt - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [trialExpiresAt]);

  const totalSeconds = Math.floor(timeLeft / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative w-full max-w-xl bg-gradient-to-b from-[#141414] via-[#0d0d0d] to-[#080808] border border-gold/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(212,175,55,0.25)] text-white my-auto overflow-hidden"
        >
          {/* Subtle Golden Glow Effect in Background */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-gold/15 blur-3xl pointer-events-none -z-10 rounded-full" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>

          {/* Header Badge */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-widest shadow-inner">
              <Sparkles size={14} className="text-yellow-400 animate-pulse" />
              <span>PRESENTE DE BOAS-VINDAS • 24 HORAS LIBERADAS</span>
            </div>
          </div>

          {/* Main Headline */}
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gold bg-clip-text text-transparent mb-2">
              Você ganhou um dia de teste grátis para utilizar o NaLábia!
            </h2>
            <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
              Olá{userName ? `, ${userName}` : ""}! Aproveite acesso VIP completo
              durante as próximas 24 horas para dominar qualquer conversa.
            </p>
          </div>

          {/* Live Countdown Timer Card */}
          <div className="bg-black/60 border border-gold/30 rounded-2xl p-4 sm:p-5 mb-6 text-center shadow-lg relative">
            <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
              <Clock size={14} className="text-gold" />
              <span>Tempo Restante do seu Teste Grátis</span>
            </div>
            
            <div className="flex items-center justify-center gap-2 sm:gap-3 text-white font-mono">
              <div className="flex flex-col items-center bg-[#181818] border border-white/10 rounded-xl px-3 sm:px-4 py-2 min-w-[64px]">
                <span className="text-2xl sm:text-3xl font-black text-gold">
                  {hours.toString().padStart(2, "0")}
                </span>
                <span className="text-[10px] text-gray-400 font-sans tracking-wide">HORAS</span>
              </div>
              <span className="text-2xl font-bold text-gray-500">:</span>
              <div className="flex flex-col items-center bg-[#181818] border border-white/10 rounded-xl px-3 sm:px-4 py-2 min-w-[64px]">
                <span className="text-2xl sm:text-3xl font-black text-gold">
                  {minutes.toString().padStart(2, "0")}
                </span>
                <span className="text-[10px] text-gray-400 font-sans tracking-wide">MIN</span>
              </div>
              <span className="text-2xl font-bold text-gray-500">:</span>
              <div className="flex flex-col items-center bg-[#181818] border border-white/10 rounded-xl px-3 sm:px-4 py-2 min-w-[64px]">
                <span className="text-2xl sm:text-3xl font-black text-amber-400">
                  {seconds.toString().padStart(2, "0")}
                </span>
                <span className="text-[10px] text-gray-400 font-sans tracking-wide">SEG</span>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-6">
            <div className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-xl hover:border-gold/30 transition-colors">
              <div className="p-2 rounded-lg bg-gold/10 text-gold flex-shrink-0">
                <Target size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Análise de Prints Ilimitada</h4>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                  Suba qualquer print de WhatsApp ou Instagram para decifrar a conversa.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-xl hover:border-gold/30 transition-colors">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 flex-shrink-0">
                <Crown size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Estilos Personalizados</h4>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                  Calmo, Irônico, Líder e Ousado com controle fino de flerte e mistério.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-xl hover:border-gold/30 transition-colors">
              <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 flex-shrink-0">
                <Brain size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Simulador de Conversas</h4>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                  Treine respostas antes de mandar para nunca mais travar ou hesitar.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-xl hover:border-gold/30 transition-colors">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Radar Anti-Vácuo</h4>
                <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                  Detecte testes sociais e inverta o desinteresse instantaneamente.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 px-5 bg-gradient-to-r from-gold via-amber-400 to-gold-glow hover:brightness-110 text-black font-extrabold text-sm rounded-xl tracking-wider uppercase transition-all shadow-[0_0_25px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2 group"
            >
              <span>Começar a Usar Agora</span>
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={onViewPlans}
              className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-xs font-semibold rounded-xl transition-all"
            >
              Ver Planos & Assinatura
            </button>
          </div>

          <div className="text-center mt-3">
            <span className="text-[10px] text-gray-500 font-mono">
              * 1 teste grátis de 24 horas por dispositivo. Não renovável após o término.
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
