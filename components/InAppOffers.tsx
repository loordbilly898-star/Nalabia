import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Sparkles, X, ShieldCheck, Zap, BookOpen, Clock, ArrowRight } from "lucide-react";

export function InAppOffers() {
  const { user } = useAuth();
  const [activeOffer, setActiveOffer] = useState<"mentoria" | "dark" | "courses" | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check last time an offer was shown
    const lastShown = localStorage.getItem("last_in_app_offer_shown");
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (lastShown && now - parseInt(lastShown, 10) < TWENTY_FOUR_HOURS) {
      return; // Not enough time has passed
    }

    // Determine what to offer
    const missingOffers = [];
    if (!user.mentoriaAccess && !user.settings?.mentoriaAccess) missingOffers.push("mentoria");
    if (!user.darkPackAccess) missingOffers.push("dark");
    if (!user.coursesAccess) missingOffers.push("courses");

    if (missingOffers.length === 0) return; // User has everything!

    // Pick a random missing offer
    const randomOffer = missingOffers[Math.floor(Math.random() * missingOffers.length)] as any;
    
    // Wait a couple seconds after app loads, then show it
    const timer = setTimeout(() => {
      setActiveOffer(randomOffer);
      setIsVisible(true);
      localStorage.setItem("last_in_app_offer_shown", now.toString());
    }, 3000);

    return () => clearTimeout(timer);
  }, [user]);

  if (!isVisible || !activeOffer) return null;

  const handleClose = () => {
    setIsVisible(false);
  };

  const OFFERS = {
    mentoria: {
      title: "Mentoria VIP",
      desc: "Tenha a mente de um mestre da sedução analisando suas conversas no WhatsApp ao vivo.",
      icon: <Zap className="text-purple-500" size={24} />,
      color: "from-purple-600 to-purple-400",
      bg: "bg-purple-900/20",
      border: "border-purple-500/30",
      cta: "Desbloquear Mentoria",
      link: "https://pay.cakto.com.br/obgpnz3_874157?affiliate=43LRhHmd",
    },
    dark: {
      title: "Dark Pack",
      desc: "Mensagens cruéis, psicologia sombria e padrões de hipnose conversacional para deixá-la obcecada.",
      icon: <Sparkles className="text-red-500" size={24} />,
      color: "from-red-600 to-red-400",
      bg: "bg-red-900/20",
      border: "border-red-500/30",
      cta: "Liberar Dark Pack",
      link: "https://pay.cakto.com.br/mnh4hcg_826434?affiliate=NAwEEUbX",
    },
    courses: {
      title: "Todos os Cursos",
      desc: "Acesso total à Academia de Criação de Homens e todos os e-books exclusivos.",
      icon: <BookOpen className="text-blue-500" size={24} />,
      color: "from-blue-600 to-blue-400",
      bg: "bg-blue-900/20",
      border: "border-blue-500/30",
      cta: "Acessar Cursos",
      link: "https://pay.cakto.com.br/exfk6pm_826428?affiliate=NAwEEUbX",
    }
  };

  const offer = OFFERS[activeOffer];

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] mx-auto w-[calc(100vw-2rem)] sm:max-w-md animate-slide-down">
      <div className={`relative overflow-hidden rounded-2xl border ${offer.border} bg-obsidian-light text-white shadow-2xl`}>
        {/* Decorative background glow */}
        <div className={`absolute -inset-10 opacity-30 blur-2xl rounded-full ${offer.bg} pointer-events-none`} />
        
        <button 
          onClick={handleClose}
          className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black text-gray-400 hover:text-white rounded-full transition-colors z-20"
        >
          <X size={16} />
        </button>

        <div className="relative z-10 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-black border ${offer.border} shrink-0`}>
              {offer.icon}
            </div>
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-wider text-gold-glow font-bold mb-0.5 flex items-center gap-1">
                <Zap size={10} className="text-gold-glow animate-pulse" /> Unlock VIP
              </div>
              <h3 className="font-bold text-sm leading-tight text-gray-100">{offer.title}</h3>
            </div>
          </div>
          
          <a 
            href={offer.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClose}
            className={`shrink-0 py-2 px-3 rounded-lg font-bold text-xs transition-all duration-300 flex items-center gap-1 bg-gradient-to-r ${offer.color} text-white hover:opacity-90 shadow-lg`}
          >
            Acessar <ArrowRight size={12} />
          </a>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-down {
          from { transform: translateY(-150%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down {
           animation: slide-down 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
}
