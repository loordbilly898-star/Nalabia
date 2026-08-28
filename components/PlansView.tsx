import React, { useState } from "react";
import { Crown, Zap, Star, Check, Loader2, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { StripeCheckoutModal } from "./StripeCheckoutModal";
import { safeFetchJson } from "../utils/apiHelper";

const PLANS = [
  {
    id: "monthly",
    name: "Mensal",
    price: "R$ 19,90",
    period: "/mês",
    description: "Acesso completo para testar o poder da NaLábia.",
    features: [
      "Acesso ilimitado à IA NaLábia",
      "Análise avançada de imagens e perfis",
      "Simulador de conversas realista",
      "Histórico de conversas salvo",
      "Acesso à Comunidade VIP no WhatsApp",
    ],
    popular: false,
    icon: Zap,
    color: "from-blue-500 to-cyan-400",
  },
  {
    id: "trimestral",
    name: "Trimestral",
    price: "R$ 58,90",
    period: "/trimestre",
    description: "A escolha ideal para dominar a inteligência social.",
    features: [
      "Todos os benefícios do plano Mensal",
      "Prioridade máxima na fila de respostas",
      "Múltiplos perfis de IA personalizados",
      "Dicas exclusivas de inteligência social",
      "Suporte prioritário via WhatsApp",
    ],
    popular: true,
    badge: "Mais Popular",
    icon: Crown,
    color: "from-gold to-gold-glow",
  },
  {
    id: "anual",
    name: "Anual",
    price: "R$ 149,90",
    period: "/ano",
    description: "Maestria absoluta. Economize mais de 35%.",
    features: [
      "Todos os benefícios do plano Trimestral",
      "Economia de mais de 35% no valor total",
      "Acesso antecipado a novas funcionalidades",
      "Consultoria de perfil (1x por semestre)",
      "Selo de Membro VIP no perfil",
    ],
    popular: false,
    badge: "Melhor Custo-Benefício",
    icon: Star,
    color: "from-purple-500 to-pink-500",
  },
];

interface PlansViewProps {
  onClose?: () => void;
}

const PlansView: React.FC<PlansViewProps> = ({ onClose }) => {
  const { user, userData, logout, unlockFreeTrial } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "trial">("plans");
  const [inviteCode, setInviteCode] = useState("");
  const [trialLoading, setTrialLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [loadingPortal, setLoadingPortal] = useState(false);
  const [checkoutModal, setCheckoutModal] = useState<{
    isOpen: boolean;
    planId: string;
    planTitle: string;
    planPrice: string;
    planDescription: string;
  }>({
    isOpen: false,
    planId: "mensal",
    planTitle: "",
    planPrice: "",
    planDescription: "",
  });

  React.useEffect(() => {
    // Check if we just returned from Stripe or Cakto
    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get("stripe_status");
    const status = params.get("status");
    const paymentId = params.get("payment_id") || params.get("transaction_id") || params.get("session_id");

    if (stripeStatus === "success" || status === "approved" || status === "authorized" || paymentId) {
      setVerifyingPayment(true);
      // Wait a bit for the webhook to process, then redirect
      const timer = setTimeout(() => {
        if (!user) {
           window.location.href = "/?signup=true&from=payment_approved";
        } else {
           window.location.href = "/dashboard";
        }
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleSubscribe = (planId: string, planName: string) => {
    const selectedPlan = PLANS.find((p) => p.id === planId || (p.id === "monthly" && planId === "mensal"));
    const priceStr = selectedPlan ? `${selectedPlan.price} ${selectedPlan.period}` : "R$ 19,90/mês";

    setCheckoutModal({
      isOpen: true,
      planId: planId === "monthly" ? "mensal" : planId,
      planTitle: `NaLábia Prime - Plano ${planName}`,
      planPrice: priceStr,
      planDescription: selectedPlan?.description || "Acesso completo à plataforma NaLábia Prime",
    });
  };

  const handleOpenStripePortal = async () => {
    if (!user) return;
    setLoadingPortal(true);
    setError(null);
    try {
      const res = await safeFetchJson("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          returnUrl: `${window.location.origin}/dashboard`,
        }),
      });
      if (res.ok && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setError(res.error || res.data?.error || "Não foi possível abrir o portal de gerenciamento Stripe.");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com o portal Stripe.");
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialLoading(true);
    setError(null);
    try {
      await unlockFreeTrial(inviteCode);
    } catch (err: any) {
      setError(err.message || "Erro ao validar código.");
    } finally {
      setTrialLoading(false);
    }
  };

  const verifyPayment = async () => {
    if (!user) return;
    setVerifyingPayment(true);
    setError(null);
    try {
      const response = await safeFetchJson("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (response.ok && response.data?.success) {
        // Reload page to get new user data
        window.location.href = "/dashboard";
      } else {
        setError(
          response.error ||
          response.data?.message ||
            "Nenhum pagamento aprovado encontrado ainda. Tente novamente em alguns instantes.",
        );
        setVerifyingPayment(false);
      }
    } catch (err: any) {
      console.error("Error verifying payment:", err);
      setError("Erro ao verificar pagamento. Tente novamente.");
      setVerifyingPayment(false);
    }
  };

  if (verifyingPayment) {
    return (
      <div className="min-h-screen bg-[#050505] text-gray-100 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-gold animate-spin mb-6" />
        <h1 className="text-2xl font-bold mb-2">
          Verificando seu pagamento...
        </h1>
        <p className="text-gray-400 max-w-md">
          Estamos processando sua assinatura com a Cakto. Isso pode levar alguns
          segundos. Você será redirecionado automaticamente para o painel em
          instantes.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gold/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="z-10 w-full max-w-5xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-2 text-gray-400 hover:text-white bg-[#121212] rounded-full border border-white/10 transition-colors z-20"
            title="Fechar"
          >
            <X size={20} />
          </button>
        )}
        <div className="text-center mb-12 space-y-4 mt-8 md:mt-0">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500">
            Desbloqueie a NaLábia
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Escolha o plano ideal para você e tenha acesso completo à
            inteligência social mais avançada do mercado.
          </p>

          {userData?.trialAbuseDetected && (
            <div className="inline-block mt-4 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-sm font-medium">
              🔒 O teste grátis de 24 horas deste dispositivo já foi utilizado. Escolha um plano abaixo para continuar com acesso ilimitado.
            </div>
          )}

          {!userData?.trialAbuseDetected && userData?.status === "expirado" && (
            <div className="inline-block mt-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-sm font-medium">
              ⏳ Seu teste grátis de 24 horas encerrou. Escolha um plano abaixo para manter acesso ilimitado a todas as ferramentas.
            </div>
          )}

          {userData?.status === "pendente" && !userData?.trialAbuseDetected && (
            <div className="inline-block mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm font-medium">
              Sua assinatura está pendente ou expirou. Escolha um plano para
              continuar.
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm max-w-md mx-auto">
              {error}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm max-w-md mx-auto">
            <p className="font-medium">
              ⚠️ <span className="font-bold">IMPORTANTE:</span> Você deve utilizar o <span className="font-bold underline">exato mesmo email</span> ({user?.email || "da sua conta"}) na hora do pagamento para liberar o acesso automaticamente.
            </p>
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <div className="bg-[#121212] p-1 rounded-full border border-white/10 flex space-x-1">
            <button
              onClick={() => {
                setActiveTab("plans");
                setError(null);
              }}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors bg-white/10 text-white`}
            >
              Assinar
            </button>
          </div>
        </div>

        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative bg-[#121212] border ${plan.popular ? "border-gold/50 shadow-lg shadow-gold/10 scale-105 z-10" : "border-white/10"} rounded-2xl p-8 flex flex-col h-full transition-all duration-300 hover:border-white/30`}
                >
                  {plan.badge && (
                    <div
                      className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r ${plan.color} text-black text-xs font-bold uppercase tracking-wider rounded-full shadow-lg`}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {plan.description}
                      </p>
                    </div>
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-br ${plan.color} bg-opacity-10`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  <div className="mb-8">
                    <span className="text-4xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-400 ml-2">{plan.period}</span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-start text-sm text-gray-300"
                      >
                        <Check className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.id, plan.name)}
                    disabled={loadingPlan !== null}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center
                      ${
                        plan.popular
                          ? "bg-gradient-to-r from-gold to-gold-glow text-black hover:shadow-lg hover:shadow-gold/20 hover:scale-[1.02]"
                          : "bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:border-white/20"
                      }
                      ${loadingPlan === plan.id ? "opacity-70 cursor-not-allowed" : ""}
                    `}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      "Escolher Plano"
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <button
              onClick={verifyPayment}
              className="text-sm text-gray-400 hover:text-white underline transition-colors"
            >
              Já paguei, verificar acesso
            </button>
            {userData?.status === "ativo" && (
              <>
                <span className="text-gray-600 hidden sm:inline">•</span>
                <button
                  onClick={handleOpenStripePortal}
                  disabled={loadingPortal}
                  className="text-sm text-gold hover:text-gold-glow underline transition-colors flex items-center gap-1.5"
                >
                  {loadingPortal ? <Loader2 size={14} className="animate-spin" /> : null}
                  Gerenciar assinatura (Stripe Portal)
                </button>
              </>
            )}
          </div>
        </>

        <div className="mt-12 text-center">
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors flex items-center justify-center mx-auto"
          >
            Sair da conta
          </button>
        </div>
      </div>

      <StripeCheckoutModal
        isOpen={checkoutModal.isOpen}
        onClose={() => setCheckoutModal((prev) => ({ ...prev, isOpen: false }))}
        planId={checkoutModal.planId}
        planTitle={checkoutModal.planTitle}
        planPrice={checkoutModal.planPrice}
        planDescription={checkoutModal.planDescription}
        onSuccess={() => {
          setCheckoutModal((prev) => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
};

export default PlansView;
