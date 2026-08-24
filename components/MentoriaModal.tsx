import React, { useState, useEffect } from "react";
import {
  X,
  Bot,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { StripeCheckoutModal } from "./StripeCheckoutModal";
import { safeFetchJson } from "../utils/apiHelper";

interface MentoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MentoriaModal: React.FC<MentoriaModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, userData } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);

  useEffect(() => {
    const hasAccess = userData?.mentoriaAccess || userData?.settings?.mentoriaAccess;
    if (isOpen && hasAccess) {
      onSuccess();
    }
  }, [userData?.mentoriaAccess, userData?.settings?.mentoriaAccess, isOpen, onSuccess]);

  if (!isOpen) return null;

  const handlePayClick = () => {
    setShowStripeModal(true);
  };

  const handleVerifyPayment = async () => {
    if (!user) return;
    setIsProcessing(true);
    setError(null);
    setIsSuccess(false);
    try {
      const response = await safeFetchJson("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, type: "mentoria" }),
      });

      if (response.ok && response.data?.success) {
        setError(null);
        setIsSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(
          response.error ||
          response.data?.message ||
            "Pagamento ainda não aprovado. Tente novamente em instantes.",
        );
      }
    } catch (err: any) {
      setError("Erro ao verificar pagamento. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-[#0a0a0a] border border-blue-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.15)] relative">
          {/* Header */}
          <div className="p-6 border-b border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none"></div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Bot className="text-blue-500" size={24} />
              MENTORIA NALÁBIA VIP
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              Seu mentor pessoal 24h para analisar conversas, perfis e estratégias em tempo real.
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Features */}
            <div className="space-y-3">
              {[
                "Análise detalhada de prints e conversas",
                "Sugestões de respostas magnéticas em tempo real",
                "Estratégia sob medida para o seu perfil",
                "Acesso vitalício e ilimitado ao Mentor VIP",
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm text-gray-300"
                >
                  <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Price */}
            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl p-4 border border-blue-500/20 text-center">
              <p className="text-gray-400 text-sm font-medium mb-1">
                Acesso Vitalício
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-lg text-gray-400 font-bold">R$</span>
                <span className="text-4xl font-black text-white tracking-tighter">
                  19,90
                </span>
              </div>
              <p className="text-blue-400 text-xs font-bold mt-2 uppercase tracking-wider">
                Pagamento Único • Não é assinatura
              </p>
            </div>

            {/* Payment Section */}
            <div className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl text-sm flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <span>Pagamento aprovado! Liberando acesso...</span>
                </div>
              )}

              <button
                onClick={handlePayClick}
                disabled={isProcessing}
                className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:scale-[1.02]"
              >
                <Lock size={18} />
                Desbloquear Mentoria (R$ 19,90)
              </button>

              <button
                onClick={handleVerifyPayment}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Verificando...
                  </>
                ) : (
                  "Já paguei, verificar agora"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <StripeCheckoutModal
        isOpen={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        planId="mentoria"
        planTitle="Mentoria NaLábia VIP"
        planPrice="R$ 19,90 (Pagamento Único)"
        planDescription="Acesso vitalício ao mentor pessoal de conversas"
        onSuccess={() => {
          setShowStripeModal(false);
          onSuccess();
          onClose();
        }}
      />
    </>
  );
};
