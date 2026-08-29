import React, { useState } from "react";
import {
  Infinity as InfinityIcon,
  Zap,
  ShieldAlert,
  Brain,
  Target,
  ArrowRight,
  Star,
  Crown,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  Camera,
  ThermometerSnowflake,
  Clock,
  Sparkles,
  Bolt,
  Feather,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingViewProps {
  onGetStarted: () => void;
  onOpenTerms?: (tab?: "terms" | "privacy" | "cookies") => void;
}

const SLIDES = [
  {
    id: "hero",
    badge: "OFERTA DE BOAS-VINDAS • 24 HORAS GRÁTIS",
    title: "Ganhe 24 Horas Grátis no NaLábia",
    subtitle:
      "Crie sua conta agora e libere acesso VIP total por 24h00: IA de análise de prints, radar anti-vácuo e gerador de respostas magnéticas sem pagar nada.",
    icon: Sparkles,
    cta: "ATIVAR MINHAS 24H GRÁTIS",
    secondaryCta: "Conhecer Recursos",
  },
  {
    id: "problem",
    badge: "INTELIGÊNCIA SOCIAL EM TEMPO REAL",
    title: "O Fim do Vácuo e da Incerteza",
    subtitle:
      "Você já ficou olhando para a tela sem saber o que responder? O NaLábia analisa as entrelinhas, identifica o nível de interesse e te dá a resposta exata para manter o controle da conversa.",
    icon: Brain,
    features: [
      "Análise de Risco de Vácuo Instantânea",
      "Leitura de Temperatura Emocional e Desejo",
      "Identificação Automática de Testes Sociais (Shit Tests)",
      "Sugestões Prontas para Copiar e Enviar",
    ],
  },
  {
    id: "arsenal",
    badge: "FERRAMENTAS COMPLETAS",
    title: "Seu Arsenal de Comunicação",
    subtitle:
      "Mais do que um chat. Um ecossistema completo para qualquer situação no WhatsApp, Tinder ou Instagram.",
    icon: Target,
    grid: [
      {
        icon: Camera,
        title: "Story Reply & Análise de Prints",
        desc: "Aberturas infalíveis baseadas em imagens de stories ou conversas.",
      },
      {
        icon: Zap,
        title: "Flowing Contínuo",
        desc: "Mantenha a conversa fluindo naturalmente sem pausas constrangedoras.",
      },
      {
        icon: ShieldAlert,
        title: "Inversão de Testes",
        desc: "Neutralize joguinhos e inverta o poder quando ela tentar te testar.",
      },
      {
        icon: ThermometerSnowflake,
        title: "Resposta Fria & Recuo Estratégico",
        desc: "Recupere sua postura e desperte curiosidade imediata.",
      },
    ],
  },
  {
    id: "personas",
    badge: "CALIBRAÇÃO DE ESTILO",
    title: "Escolha Sua Persona",
    subtitle:
      "Adapte a IA ao seu estilo autêntico. Respostas calibradas para a imagem que você deseja passar.",
    icon: Crown,
    grid: [
      {
        icon: Feather,
        title: "Calmo",
        desc: "Misterioso, contido, sereno e seguro de si.",
      },
      {
        icon: Zap,
        title: "Irônico",
        desc: "Divertido, sagaz, provocador e imprevisível.",
      },
      { icon: Crown, title: "Líder", desc: "Direto, confiante, decisivo e inabalável." },
      {
        icon: Bolt,
        title: "Ousado",
        desc: "Magnético, de alto impacto, polarizador e flertador.",
      },
    ],
  },
  {
    id: "cta",
    badge: "COMECE AGORA MESMO",
    title: "24 Horas de Vantagem Injusta",
    subtitle:
      "Crie sua conta em 10 segundos e comece seu teste gratuito de 24 horas. Após o período, continue com sua conta e escolha o plano perfeito para você.",
    icon: Clock,
    cta: "CRIAR CONTA & COMEÇAR 24H GRÁTIS",
  },
];

export const LandingView: React.FC<LandingViewProps> = ({ onGetStarted, onOpenTerms }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  const nextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
    } else {
      onGetStarted();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setDirection(-1);
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.9,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  const slide = SLIDES[currentSlide];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-obsidian text-gray-200 font-sans selection:bg-gold-glow/30 overflow-hidden flex flex-col relative">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gold-glow/5 rounded-full blur-[150px] -z-10 pointer-events-none transition-all duration-1000"></div>

      {/* Navbar */}
      <nav className="w-full z-50 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <InfinityIcon className="text-gold-glow" size={26} />
            <span className="font-mono font-bold tracking-[0.2em] text-white text-sm sm:text-base uppercase">
              NaLábia
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onGetStarted}
              className="text-xs font-bold tracking-wider uppercase px-4 py-2 rounded-xl bg-gradient-to-r from-gold to-amber-400 text-black hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] cursor-pointer"
            >
              Criar Conta / Entrar
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative flex items-center justify-center w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full flex flex-col items-center text-center"
          >
            {/* Slide Badge */}
            {slide.badge && (
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/40 text-amber-300 text-xs font-bold uppercase tracking-widest mb-6 shadow-inner"
              >
                <Sparkles size={13} className="text-yellow-400 animate-pulse" />
                <span>{slide.badge}</span>
              </motion.div>
            )}

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="w-16 h-16 sm:w-20 sm:h-20 bg-gold-glow/10 border border-gold/30 text-gold-glow rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(212,175,55,0.15)]"
            >
              <Icon size={36} strokeWidth={1.5} />
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-4 max-w-4xl"
            >
              {slide.title}
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-8"
            >
              {slide.subtitle}
            </motion.p>

            {/* Slide Specific Content */}
            {slide.features && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="flex flex-col space-y-3 mb-8 text-left w-full max-w-md"
              >
                {slide.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-3 bg-obsidian-light/80 p-3.5 rounded-xl border border-gold-dim/20 shadow-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-gold-glow flex-shrink-0 animate-ping"></div>
                    <span className="text-white font-medium text-sm">{feat}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {slide.grid && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8 w-full max-w-3xl"
              >
                {slide.grid.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-3 sm:space-x-4 bg-obsidian-light/90 p-4 sm:p-5 rounded-2xl border border-gold-dim/15 text-left hover:border-gold/30 transition-colors"
                  >
                    <div className="p-2 bg-gold-glow/10 text-gold-glow rounded-xl flex-shrink-0">
                      <item.icon size={20} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm mb-1">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
            >
              {slide.cta ? (
                <button
                  onClick={currentSlide === 0 ? onGetStarted : nextSlide}
                  className="px-8 py-4 bg-gradient-to-r from-gold via-amber-400 to-gold-glow text-black rounded-2xl font-black text-sm tracking-wider uppercase hover:brightness-110 transition-all flex items-center justify-center space-x-2 group shadow-[0_0_35px_rgba(212,175,55,0.35)] cursor-pointer"
                >
                  <span>{slide.cta}</span>
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              ) : (
                <button
                  onClick={onGetStarted}
                  className="px-8 py-4 bg-gradient-to-r from-gold via-amber-400 to-gold-glow text-black rounded-2xl font-black text-sm tracking-wider uppercase hover:brightness-110 transition-all flex items-center justify-center space-x-2 group shadow-[0_0_35px_rgba(212,175,55,0.35)] cursor-pointer"
                >
                  <span>CRIAR CONTA & GANHAR 24H GRÁTIS</span>
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </button>
              )}

              {currentSlide === 0 && (
                <button
                  onClick={nextSlide}
                  className="px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Ver Como Funciona
                </button>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation & Legal Footer */}
      <footer className="w-full z-50 bg-obsidian/90 border-t border-gold-dim/10 py-4 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <button
              onClick={() => onOpenTerms && onOpenTerms("terms")}
              className="hover:text-gold transition-colors underline cursor-pointer"
            >
              Termos de Uso
            </button>
            <span>•</span>
            <button
              onClick={() => onOpenTerms && onOpenTerms("privacy")}
              className="hover:text-gold transition-colors underline cursor-pointer"
            >
              Privacidade
            </button>
            <span>•</span>
            <button
              onClick={() => onOpenTerms && onOpenTerms("cookies")}
              className="hover:text-gold transition-colors underline cursor-pointer"
            >
              Cookies
            </button>
          </div>

          {/* Progress Indicators & Navigation */}
          <div className="flex items-center space-x-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`p-2 rounded-lg flex items-center transition-all ${
                currentSlide === 0
                  ? "opacity-0 pointer-events-none"
                  : "text-gray-400 hover:text-white hover:bg-obsidian-light"
              }`}
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center space-x-1.5">
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentSlide ? 1 : -1);
                    setCurrentSlide(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentSlide ? "w-6 bg-gold-glow" : "w-2 bg-obsidian-lighter hover:bg-gray-600"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextSlide}
              className="p-2 rounded-lg text-gold-glow hover:text-gold-glow/80 hover:bg-gold-glow/10 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

