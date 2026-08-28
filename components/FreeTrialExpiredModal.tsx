import React from "react";
import {
  Clock,
  ShieldAlert,
  Crown,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface FreeTrialExpiredModalProps {
  isOpen: boolean;
  onSelectPlan: () => void;
  isAbuseDetected?: boolean;
}

export const FreeTrialExpiredModal: React.FC<FreeTrialExpiredModalProps> = ({
  isOpen,
  onSelectPlan,
  isAbuseDetected,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[#0e0e0e] border border-gold/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(212,175,55,0.2)] text-white text-center my-auto overflow-hidden"
        >
          {/* Top Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
              {isAbuseDetected ? <ShieldAlert size={32} /> : <Clock size={32} />}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            {isAbuseDetected
              ? "Período de Teste Grátis Já Utilizado"
              : "Seu Teste Grátis de 24 Horas Encerrou"}
          </h2>

          <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed mb-6">
            {isAbuseDetected
              ? "Este dispositivo já utilizou o período de 24 horas de teste grátis do NaLábia. Para continuar utilizando com todas as ferramentas de IA liberadas, escolha o seu plano."
              : "Esperamos que você tenha aproveitado seu dia gratuito de NaLábia! Para manter acesso ilimitado a todas as análises e respostas magnéticas, assine agora."}
          </p>

          {/* Included in Premium */}
          <div className="bg-black/50 border border-white/10 rounded-2xl p-4 mb-6 text-left space-y-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-gold flex items-center gap-1.5 mb-1">
              <Crown size={14} />
              <span>Desbloqueie o NaLábia Ilimitado:</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              <span>Análises e sugestões de respostas ilimitadas</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              <span>Todos os modos estratégicos (Calmo, Irônico, Líder, Ousado)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
              <span>Simulador de conversas avançado com memória de perfil</span>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onSelectPlan}
            className="w-full py-4 px-6 bg-gradient-to-r from-gold via-amber-400 to-gold-glow hover:brightness-110 text-black font-black text-sm rounded-xl tracking-widest uppercase transition-all shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>ESCOLHER PLANO & ASSINAR</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
