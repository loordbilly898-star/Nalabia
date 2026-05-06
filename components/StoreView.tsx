import React, { useState } from "react";
import {
  ShoppingCart,
  Flame,
  Brain,
  BookOpen,
  Bot,
  Check,
  ShieldAlert,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface StoreViewProps {
  onBack: () => void;
  settings?: any;
}

const PRODUCTS = [
  {
    id: "mentoria",
    name: "Mentoria NaLábia VIP",
    icon: Bot,
    color: "from-blue-500 to-indigo-600",
    oldPrice: "R$ 97,90",
    price: "R$ 19,90",
    description:
      "Seu braço direito nas sombras. Conselhos personalizados e leitura fria de cada mensagem.",
    features: [
      "Análise humana das suas conversas",
      "Leitura Fria avançada do Alvo",
      "Gatilhos Secretos de Resposta",
      "Acesso Imediato e Permanente",
    ],
    checkAccess: (userData: any) => userData?.mentoriaAccess,
  },
  {
    id: "dark",
    name: "Modo +18 & DarkPack",
    icon: Flame,
    color: "from-rose-500 to-red-600",
    oldPrice: "R$ 67,90",
    price: "R$ 19,90",
    description:
      "Acesso total aos módulos restritos: NSFW e Manipulação Sutil.",
    features: [
      "Gatilhos de Tensão Sexual",
      "Controle Absoluto do Frame",
      "Táticas de Inversão de Jogo",
      "Desbloqueio Permanente",
    ],
    checkAccess: (userData: any) => userData?.darkPackAccess,
  },
  {
    id: "curso",
    name: "Academia NaLábia",
    icon: BookOpen,
    color: "from-gold to-yellow-600",
    oldPrice: "R$ 147,90",
    price: "R$ 39,90",
    description:
      "A base teórica e prática sobre inteligência social, sedução e dominação de conversas.",
    features: [
      "Aulas Práticas em Vídeo",
      "Desconstrução de Textos",
      "Comunidade Secreta VIP",
      "Desbloqueio Permanente",
    ],
    checkAccess: (userData: any) => userData?.coursesAccess,
  },
];

export default function StoreView({ onBack, settings }: StoreViewProps) {
  const { user, userData } = useAuth();
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);

  const handlePurchase = async (productId: string) => {
    if (!user) return;
    setLoadingProduct(productId);
    
    // Mapping format for fallback so users don't get stuck
    const links: Record<string, string> = {
      "mensal": "https://pay.cakto.com.br/nnbqprt_825346",
      "trimestral": "https://pay.cakto.com.br/379zopu_826386",
      "anual": "https://pay.cakto.com.br/x4pha2o_826385",
      "curso": "https://pay.cakto.com.br/exfk6pm_826428",
      "dark": "https://pay.cakto.com.br/mnh4hcg_826434",
      "mentoria": "https://pay.cakto.com.br/obgpnz3_874157"
    };

    try {
      const response = await fetch("/api/cakto/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          planId: productId,
          email: user.email,
        }),
      });
      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data.error || "Missing checkout url");
      }
    } catch (e) {
      console.error("Checkout error, using fallback:", e);
      if (links[productId]) {
        window.location.href = `${links[productId]}?src=${user.id}`;
      } else {
        alert("Erro ao redirecionar para pagamento. Tente novamente.");
      }
    } finally {
      setLoadingProduct(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] overflow-y-auto">
      {/* HEADER */}
      <div className="relative overflow-hidden bg-gradient-to-b from-purple-900/20 to-[#0a0a0a] border-b border-purple-500/10 pt-16 pb-12 px-6">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-mono uppercase tracking-widest mb-4">
            <Sparkles size={16} /> Arsenal VIP Secreto
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight font-serif">
            Destaque-se{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              Imediatamente.
            </span>
          </h1>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto font-light">
            Evolua sua inteligência social para o nível máximo. Adquira
            ferramentas exclusivas e manipule a realidade a seu favor. <br />
            <span className="text-white font-medium">
              Tudo que você precisa por um investimento irrisório.
            </span>
          </p>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PRODUCTS.map((product) => {
            const hasAccess = product.checkAccess(userData);
            const Icon = product.icon;

            return (
              <div
                key={product.id}
                className="relative group bg-gray-900/30 border border-gray-800 rounded-3xl overflow-hidden hover:border-gray-700 transition-all duration-500 flex flex-col"
              >
                {/* Product Background Glow */}
                <div
                  className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${product.color} opacity-10 group-hover:opacity-20 transition-opacity duration-500`}
                ></div>

                <div className="p-8 flex-1 flex flex-col relative z-10">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${product.color} flex items-center justify-center shadow-lg mb-6 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}
                  >
                    <Icon size={28} className="text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-3">
                    {product.name}
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">
                    {product.description}
                  </p>

                  <div className="space-y-3 mb-8">
                    {product.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-1 bg-white/10 rounded-full p-0.5">
                          <Check size={12} className="text-white" />
                        </div>
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-gray-800 mt-auto">
                    {hasAccess ? (
                      <div className="w-full py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-center flex items-center justify-center gap-2">
                        <ShieldAlert size={18} /> Acesso Liberado
                      </div>
                    ) : (
                      <button
                        onClick={() => handlePurchase(product.id)}
                        disabled={loadingProduct === product.id}
                        className={`w-full py-4 rounded-xl font-bold text-white transition-all duration-300 flex flex-col items-center justify-center gap-1 relative overflow-hidden group/btn bg-gradient-to-r ${product.color} shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-95`}
                      >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 rounded-xl"></div>
                        {loadingProduct === product.id ? (
                          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 relative z-10">
                              <ShoppingCart size={18} />
                              <span className="text-lg tracking-wide uppercase">
                                Desbloquear Agora
                              </span>
                            </div>
                            <div className="relative z-10 flex items-center gap-2 text-white/90 text-sm">
                              <span className="line-through opacity-70 text-xs">
                                {product.oldPrice}
                              </span>
                              <span className="font-black bg-white text-black px-1.5 rounded text-xs">
                                Por Apenas {product.price}
                              </span>
                            </div>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* TRUST BADGES */}
        <div className="mt-16 text-center space-y-4">
          <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">
            Pagamento Seguro & Acesso Imediato
          </p>
          <div className="flex justify-center items-center gap-6 opacity-30 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Some visual elements to build trust */}
            <div className="flex items-center gap-2 font-bold text-white">
              <ShieldAlert size={20} /> Checkout Seguro
            </div>
            <div className="flex items-center gap-2 font-bold text-white">
              <Sparkles size={20} /> Qualidade Garantida
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
