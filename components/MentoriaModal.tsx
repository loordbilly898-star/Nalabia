import React, { useState, useEffect } from "react";
import {
  X,
  Bot,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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

  useEffect(() => {
    if (isOpen && userData?.mentoriaAccess) {
      onSuccess();
    }
  }, [userData?.mentoriaAccess, isOpen, onSuccess]);

  if (!isOpen) return null;

  const handlePayClick = async () => {
    if (!user) return;
    setIsProcessing(true);
    setError(null);

    const checkoutUrl = "https://pay.cakto.com.br/obgpnz3_874157?affiliate=43LRhHmd";
    
    try {
      const url = new URL(checkoutUrl);
      url.searchParams.set("src", user.id);
      window.location.href = url.toString();
    } catch (err: any) {
      setError(err.message || "Erro ao redirecionar para o pagamento.");
      setIsProcessing(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!user) return;
    setIsProcessing(true);
    setError(null);
    setIsSuccess(false);
    try {
      const response = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, type: "mentoria" }),
      });
      const data = await response.json();

      if (data.success) {
        setError(null);
        setIsSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(
          data.message ||
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-cyan-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.15)] relative">
        {/* Header */}
        <div className="p-6 border-b border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[50px] pointer-events-none"></div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Bot className="text-cyan-500" size={24} />
            CONSELHEIRO SÊNIOR
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Acesso ilimitado ao bot de mentoria e conselhos sobre dinâmica
            social e relacionamentos.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Features */}
          <div className="space-y-3">
            {[
              "Aconselhamento personalizado",
              "Visão imparcial das suas interações",
              "Táticas de Frame Dominante",
              "Leitura fria de comportamento",
              "Estratégias para sair da Friendzone",
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm text-gray-300"
              >
                <CheckCircle2 size={16} className="text-cyan-500 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20 text-center">
            <p className="text-gray-400 text-sm font-medium mb-1">
              Pagamento Único
            </p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-lg text-gray-400 font-bold">R$</span>
              <span className="text-4xl font-black text-white tracking-tighter">
                47,90
              </span>
            </div>
            <p className="text-cyan-400 text-xs font-bold mt-2 uppercase tracking-wider">
              Acesso Vitalício
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
              className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                isProcessing
                  ? "bg-cyan-500/50 cursor-not-allowed"
                  : "bg-cyan-600 hover:bg-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  AGUARDE...
                </>
              ) : (
                <>
                  DESBLOQUEAR AGORA
                  <ExternalLink size={18} />
                </>
              )}
            </button>

            <button
              onClick={handleVerifyPayment}
              disabled={isProcessing}
              className="w-full py-3 rounded-xl font-medium text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Já paguei, verificar acesso
            </button>
            <p className="text-center text-xs text-gray-500 mt-2">
              Você será redirecionado para a página de pagamento segura da
              Cakto.
              <br />
              Volte aqui e clique em "Já paguei" após finalizar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
