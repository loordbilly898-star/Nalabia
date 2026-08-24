import React, { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { StripeCheckoutModal } from "./StripeCheckoutModal";
import { safeFetchJson } from "../utils/apiHelper";

interface CoursesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CoursesModal: React.FC<CoursesModalProps> = ({
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
    if (isOpen && userData?.coursesAccess) {
      onSuccess();
    }
  }, [userData?.coursesAccess, isOpen, onSuccess]);

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
        body: JSON.stringify({ userId: user.id, type: "courses" }),
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
              <BookOpen className="text-blue-500" size={24} />
              ACADEMIA NALÁBIA
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              Acesso completo a todos os cursos de psicologia sombria, sedução e
              manipulação.
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Features */}
            <div className="space-y-3">
              {[
                "O Mapa da Sedução",
                "Psicologia Sombria (3000 Técnicas)",
                "O Manual Proibido",
                "Segredos da Sedução Feminina",
                "O Teste Infinito 2",
                "A Teoria da Manipulação Feminina",
                "Linguagem Corporal e Psicopatia",
                "Como Manipular uma Mulher Linda",
                "O Rei da Cama: Mestre dos Orgasmos",
                "16 Frases para Esquentar o Papo",
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
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/20 text-center">
              <p className="text-gray-400 text-sm font-medium mb-1">
                Acesso Completo
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-lg text-gray-400 font-bold">R$</span>
                <span className="text-4xl font-black text-white tracking-tighter">
                  39,90
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
                Desbloquear Academia (R$ 39,90)
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
        planId="curso"
        planTitle="Academia NaLábia - Cursos"
        planPrice="R$ 39,90 (Pagamento Único)"
        planDescription="Acesso vitalício aos cursos e táticas proibidas"
        onSuccess={() => {
          setShowStripeModal(false);
          onSuccess();
          onClose();
        }}
      />
    </>
  );
};
