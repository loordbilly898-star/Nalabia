import React, { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import {
  X,
  ShieldCheck,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CreditCard,
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planTitle?: string;
  planPrice?: string;
  planDescription?: string;
  onSuccess?: () => void;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  isOpen,
  onClose,
  planId,
  planTitle,
  planPrice,
  planDescription,
  onSuccess,
}) => {
  const { user, userData, refreshUser } = useAuth();
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Initialize Stripe and fetch checkout session
  useEffect(() => {
    if (!isOpen || !planId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setIsSuccess(false);
    setClientSecret(null);
    setSessionId(null);
    setFallbackUrl(null);

    const initCheckout = async () => {
      try {
        // 1. Fetch Stripe config
        const configRes = await fetch("/api/stripe/config");
        const configData = await configRes.json();

        if (!configData.enabled || !configData.publishableKey) {
          throw new Error(
            "Stripe ainda não está totalmente habilitado no servidor.",
          );
        }

        const stripeObj = await loadStripe(configData.publishableKey);
        if (isMounted) setStripePromise(stripeObj);

        // 2. Create embedded checkout session
        const origin = window.location.origin;
        const sessionRes = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId,
            userId: user?.id || userData?.userID,
            userEmail: user?.email || userData?.email,
            embedded: true,
            returnUrl: `${origin}/dashboard?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`,
          }),
        });

        const sessionData = await sessionRes.json();
        if (!sessionRes.ok || !sessionData.clientSecret) {
          throw new Error(
            sessionData.error || "Não foi possível iniciar a sessão de pagamento.",
          );
        }

        if (isMounted) {
          setClientSecret(sessionData.clientSecret);
          setSessionId(sessionData.sessionId);
          setFallbackUrl(sessionData.url || null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Stripe init error:", err);
        if (isMounted) {
          setError(err.message || "Erro ao conectar com o checkout Stripe.");
          setLoading(false);
        }
      }
    };

    initCheckout();

    return () => {
      isMounted = false;
    };
  }, [isOpen, planId, user, userData]);

  const handleVerifyAccess = async () => {
    if (!sessionId) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/stripe/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: user?.id || userData?.userID,
          userEmail: user?.email || userData?.email,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
        if (refreshUser) await refreshUser();
        if (onSuccess) onSuccess();
      } else {
        setError(data.message || "Pagamento ainda em processamento.");
      }
    } catch (e: any) {
      setError(e.message || "Erro ao verificar status.");
    } finally {
      setVerifying(false);
    }
  };

  const handleComplete = useCallback(async () => {
    setIsSuccess(true);
    if (sessionId) {
      try {
        await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            userId: user?.id || userData?.userID,
            userEmail: user?.email || userData?.email,
          }),
        });
      } catch (e) {
        console.error("Verify session error:", e);
      }
    }
    if (refreshUser) await refreshUser();
    if (onSuccess) onSuccess();
  }, [sessionId, user, userData, refreshUser, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-gold/30 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <Lock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">
                  {planTitle || "Checkout Seguro NaLábia Prime"}
                </h3>
                <span className="bg-gold/20 text-gold text-xs px-2 py-0.5 rounded-full border border-gold/30 font-medium">
                  Stripe SSL
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {planDescription || "Pagamento 100% criptografado e seguro"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/60 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Plan summary badge */}
        {planPrice && !isSuccess && (
          <div className="px-5 py-2.5 bg-zinc-900/60 border-b border-zinc-800/60 flex items-center justify-between text-xs sm:text-sm">
            <span className="text-zinc-300 flex items-center gap-1.5 font-medium">
              <Zap size={14} className="text-gold" /> Total a pagar:
            </span>
            <span className="text-gold font-bold text-base">{planPrice}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-zinc-950 min-h-[380px]">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="text-xl font-bold text-white">
                Assinatura confirmada com sucesso!
              </h4>
              <p className="text-sm text-zinc-300 max-w-md">
                Seu acesso ao NaLábia Prime já foi liberado. Aproveite todas as
                funcionalidades VIP, análises de IA e conteúdos exclusivos.
              </p>
              <button
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="mt-4 px-6 py-3 bg-gradient-to-r from-gold to-yellow-500 text-black font-bold rounded-xl shadow-lg hover:brightness-110 transition-all text-sm"
              >
                Acessar Plataforma Agora
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-10 h-10 text-gold animate-spin" />
              <p className="text-sm text-zinc-300 font-medium">
                Carregando formulário seguro do Stripe...
              </p>
              <p className="text-xs text-zinc-500">
                Criptografia de ponta a ponta ativa
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle size={28} />
              </div>
              <p className="text-sm text-rose-300 max-w-md">{error}</p>
              {fallbackUrl && (
                <a
                  href={fallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-gold text-black font-semibold rounded-xl text-sm hover:brightness-110 transition-all flex items-center gap-2"
                >
                  <CreditCard size={16} /> Abrir Checkout em Nova Janela
                </a>
              )}
            </div>
          ) : clientSecret && stripePromise ? (
            <div className="w-full embedded-checkout-wrapper">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  clientSecret,
                  onComplete: handleComplete,
                }}
              >
                <EmbeddedCheckout className="w-full rounded-xl overflow-hidden" />
              </EmbeddedCheckoutProvider>
            </div>
          ) : null}
        </div>

        {/* Modal Footer Security Badges */}
        {!isSuccess && (
          <div className="p-3 sm:p-4 bg-zinc-900/80 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] sm:text-xs text-zinc-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Garantia 7 Dias</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock size={14} className="text-gold" />
                <span>Stripe Certified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-yellow-400" />
                <span>Liberação Instantânea</span>
              </div>
            </div>

            {sessionId && !loading && (
              <button
                onClick={handleVerifyAccess}
                disabled={verifying}
                className="text-xs text-gold hover:underline flex items-center gap-1 ml-auto"
              >
                {verifying ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                Já paguei, verificar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
