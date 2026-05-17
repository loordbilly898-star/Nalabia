import React, { useState, useEffect } from "react";
import {
  X,
  Flame,
  Brain,
  Loader2,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface DarkPackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DarkPackModal: React.FC<DarkPackModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, userData } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Watch for userData changes to auto-close if payment is detected via webhook
  useEffect(() => {
    if (isOpen && userData?.darkPackAccess) {
      onSuccess();
    }
  }, [userData?.darkPackAccess, isOpen, onSuccess]);

  if (!isOpen) return null;

  const handlePayClick = async () => {
    if (!user) return;
    setIsProcessing(true);
    setError(null);

    const checkoutUrl = "https://pay.cakto.com.br/mnh4hcg_826434?affiliate=NAwEEUbX";
    
    try {
      const separator = checkoutUrl.includes("?") ? "&" : "?";
      const finalUrl = `${checkoutUrl}${separator}src=${user.id}`;
      window.location.href = finalUrl;
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
        body: JSON.stringify({ userId: user.id, type: "darkpack" }),
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
      <div className="bg-[#0a0a0a] border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] relative">
        {/* Header */}
        <div className="p-6 border-b border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-[50px] pointer-events-none"></div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>

          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Flame className="text-red-500" size={24} />
            DARK PACK
          </h2>
          <p className="text-gray-400 text-sm mt-2">
            Desbloqueie o arsenal psicológico mais avançado e letal da NaLábia.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Features */}
          <div className="space-y-4">
            <div className="flex gap-4 items-start p-4 bg-orange-500/5 border border-orange-500/10 rounded-xl">
              <Flame className="text-orange-500 shrink-0 mt-1" size={20} />
              <div>
                <h3 className="text-white font-bold text-sm">
                  Modo +18 (NSFW)
                </h3>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Flerte agressivo, tensão sexual extrema e escalação íntima. A
                  IA quebra os filtros para criar conversas viciantes.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
              <Brain className="text-purple-500 shrink-0 mt-1" size={20} />
              <div>
                <h3 className="text-white font-bold text-sm">
                  Modo Manipulação
                </h3>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                  Controle psicológico absoluto. Reforço intermitente,
                  gaslighting leve, triangulação e dependência emocional.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="text-center py-4 border-y border-white/5">
            <div className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-1">
              Acesso Vitalício (Pagamento Único)
            </div>
            <div className="text-4xl font-black text-white flex items-center justify-center gap-1">
              <span className="text-lg text-gray-500">R$</span> 15
              <span className="text-lg text-gray-500">,00</span>
            </div>
            <div className="flex items-center justify-center gap-1 text-green-400 text-xs mt-2 font-medium">
              <ShieldCheck size={14} /> Liberação Automática Imediata
            </div>
          </div>

          {/* Payment Section */}
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl text-xs text-blue-400 text-center">
              ⚠️ <b>IMPORTANTE:</b> Use <span className="underline">o mesmo email</span> ({user?.email}) na compra para liberar na hora.
            </div>

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
              className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]"
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  Pagar com Cakto <ExternalLink size={20} />
                </>
              )}
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
  );
};
