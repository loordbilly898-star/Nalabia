import React, { useState } from 'react';
import { Crown, Zap, Star, Check, Loader2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const PLANS = [
  {
    id: 'monthly',
    name: 'Mensal',
    price: 'R$ 19,90',
    period: '/mês',
    description: 'Acesso completo para testar o poder da Nalábia.',
    features: [
      'Acesso ilimitado à IA Nalábia',
      'Análise avançada de imagens e perfis',
      'Simulador de conversas realista',
      'Histórico de conversas salvo'
    ],
    popular: false,
    icon: Zap,
    color: 'from-blue-500 to-cyan-400'
  },
  {
    id: 'trimestral',
    name: 'Trimestral',
    price: 'R$ 58,90',
    period: '/trimestre',
    description: 'A escolha ideal para dominar a inteligência social.',
    features: [
      'Todos os benefícios do plano Mensal',
      'Prioridade máxima na fila de respostas',
      'Múltiplos perfis de IA personalizados',
      'Dicas exclusivas de inteligência social'
    ],
    popular: true,
    badge: 'Mais Popular',
    icon: Crown,
    color: 'from-nalabia-gold to-nalabia-gold-glow'
  },
  {
    id: 'anual',
    name: 'Anual',
    price: 'R$ 149,90',
    period: '/ano',
    description: 'Maestria absoluta. Economize mais de 35%.',
    features: [
      'Todos os benefícios do plano Trimestral',
      'Economia de mais de 35% no valor total',
      'Acesso antecipado a novas funcionalidades',
      'Consultoria de perfil (1x por semestre)',
      'Selo de Membro VIP no perfil'
    ],
    popular: false,
    badge: 'Melhor Custo-Benefício',
    icon: Star,
    color: 'from-purple-500 to-pink-500'
  }
];

interface PlansViewProps {
  onClose?: () => void;
}

const PlansView: React.FC<PlansViewProps> = ({ onClose }) => {
  const { user, userData, logout, unlockFreeTrial } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'trial'>('plans');
  const [inviteCode, setInviteCode] = useState('');
  const [trialLoading, setTrialLoading] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  React.useEffect(() => {
    // Check if we just returned from Mercado Pago
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const paymentId = params.get('payment_id') || params.get('preapproval_id');

    if (status === 'approved' || status === 'authorized' || paymentId) {
      setVerifyingPayment(true);
      // Wait a bit for the webhook to process, then check status again
      const timer = setTimeout(() => {
        window.location.href = '/dashboard';
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubscribe = async (planId: string, planName: string) => {
    if (!user) return;
    setLoadingPlan(planId);
    setError(null);

    // Open a blank window immediately to bypass iOS popup blockers
    const newWindow = window.open('', '_blank');

    try {
      // Create subscription via our backend using Cakto
      const response = await fetch('/api/cakto/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          userId: user.uid,
          userEmail: user.email,
          userName: userData?.name || user.displayName
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cakto API Error:', errorText);
        throw new Error(`Falha ao criar sessão de pagamento: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      if (data.checkout_url) {
        if (newWindow) {
          newWindow.location.href = data.checkout_url;
        } else {
          // Fallback if popup was blocked
          window.location.href = data.checkout_url;
        }
      } else {
        if (newWindow) newWindow.close();
        throw new Error('Link de pagamento não recebido.');
      }
      
      // Reset loading state after a short delay
      setTimeout(() => {
        setLoadingPlan(null);
      }, 2000);
    } catch (err: any) {
      if (newWindow) newWindow.close();
      console.error('Subscription error:', err);
      setError(err.message || 'Ocorreu um erro ao redirecionar para o pagamento.');
      setLoadingPlan(null);
    }
  };

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialLoading(true);
    setError(null);
    try {
      await unlockFreeTrial(inviteCode);
    } catch (err: any) {
      setError(err.message || 'Erro ao validar código.');
    } finally {
      setTrialLoading(false);
    }
  };

  const verifyPayment = async () => {
    if (!user) return;
    setVerifyingPayment(true);
    setError(null);
    try {
      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await response.json();
      if (data.success) {
        // Reload page to get new user data
        window.location.href = '/dashboard';
      } else {
        setError(data.message || 'Nenhum pagamento aprovado encontrado ainda. Tente novamente em alguns instantes.');
        setVerifyingPayment(false);
      }
    } catch (err: any) {
      console.error('Error verifying payment:', err);
      setError('Erro ao verificar pagamento. Tente novamente.');
      setVerifyingPayment(false);
    }
  };

  if (verifyingPayment) {
    return (
      <div className="min-h-screen bg-[#050505] text-gray-100 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-nalabia-gold animate-spin mb-6" />
        <h1 className="text-2xl font-bold mb-2">Verificando seu pagamento...</h1>
        <p className="text-gray-400 max-w-md">
          Estamos processando sua assinatura com o Mercado Pago. Isso pode levar alguns segundos.
          Você será redirecionado automaticamente para o painel em instantes.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-nalabia-gold/10 blur-[120px] rounded-full pointer-events-none"></div>
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
            Desbloqueie a Nalábia
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Escolha o plano ideal para você e tenha acesso completo à inteligência social mais avançada do mercado.
          </p>
          
          {userData?.status === 'pendente' && (
            <div className="inline-block mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm font-medium">
              Sua assinatura está pendente ou expirou. Escolha um plano para continuar.
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm max-w-md mx-auto">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-center mb-8">
          <div className="bg-[#121212] p-1 rounded-full border border-white/10 flex space-x-1">
            <button 
              onClick={() => { setActiveTab('plans'); setError(null); }}
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
                  className={`relative bg-[#121212] border ${plan.popular ? 'border-nalabia-gold/50 shadow-lg shadow-nalabia-gold/10 scale-105 z-10' : 'border-white/10'} rounded-2xl p-8 flex flex-col h-full transition-all duration-300 hover:border-white/30`}
                >
                  {plan.badge && (
                    <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r ${plan.color} text-black text-xs font-bold uppercase tracking-wider rounded-full shadow-lg`}>
                      {plan.badge}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${plan.color} bg-opacity-10`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  <div className="mb-8">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-gray-400 ml-2">{plan.period}</span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm text-gray-300">
                        <Check className="w-5 h-5 text-emerald-400 mr-3 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.id, plan.name)}
                    disabled={loadingPlan !== null}
                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center
                      ${plan.popular 
                        ? 'bg-gradient-to-r from-nalabia-gold to-nalabia-gold-glow text-black hover:shadow-lg hover:shadow-nalabia-gold/20 hover:scale-[1.02]' 
                        : 'bg-white/5 text-white hover:bg-white/10 border border-white/10 hover:border-white/20'
                      }
                      ${loadingPlan === plan.id ? 'opacity-70 cursor-not-allowed' : ''}
                    `}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Escolher Plano'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 text-center">
            <button
              onClick={verifyPayment}
              className="text-sm text-gray-400 hover:text-white underline transition-colors"
            >
              Já paguei, verificar acesso
            </button>
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
    </div>
  );
};

export default PlansView;
