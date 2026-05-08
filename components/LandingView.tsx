import React, { useState, useEffect } from "react";
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
  Ghost,
  Repeat2,
  Bolt,
  Feather,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingViewProps {
  onGetStarted: () => void;
}

const SLIDES = [
  {
    id: "hero",
    title: "Domine a Arte da Atração com IA",
    subtitle:
      "O primeiro sistema operacional projetado exclusivamente para otimizar suas interações sociais, decifrar intenções e gerar respostas magnéticas.",
    icon: InfinityIcon,
    cta: "INICIAR APRESENTAÇÃO",
  },
  {
    id: "problem",
    title: "O Fim do Vácuo e da Incerteza",
    subtitle:
      "Você já ficou olhando para a tela sem saber o que responder? O NaLábia analisa as entrelinhas, identifica o nível de interesse e te dá a resposta exata para manter o controle da interação.",
    icon: Brain,
    features: [
      "Análise de Risco de Vácuo",
      "Leitura de Temperatura Emocional",
      "Identificação de Testes (Shit Tests)",
    ],
  },
  {
    id: "arsenal",
    title: "Seu Arsenal de Comunicação",
    subtitle:
      "Mais do que um chat. Um ecossistema completo para qualquer situação.",
    icon: Target,
    grid: [
      {
        icon: Camera,
        title: "Story Reply",
        desc: "Aberturas infalíveis baseadas em imagens.",
      },
      {
        icon: Zap,
        title: "Flowing",
        desc: "Mantenha a conversa fluindo infinitamente.",
      },
      {
        icon: ShieldAlert,
        title: "Teste de Valor",
        desc: "Inverta o jogo quando for testado.",
      },
      {
        icon: ThermometerSnowflake,
        title: "Resposta Fria",
        desc: "Recupere seu poder e postura.",
      },
    ],
  },
  {
    id: "personas",
    title: "Escolha Sua Persona",
    subtitle:
      "Adapte a IA ao seu estilo. Respostas perfeitamente calibradas para a imagem que você quer passar.",
    icon: Crown,
    grid: [
      {
        icon: Feather,
        title: "Calmo",
        desc: "Misterioso, contido e seguro de si.",
      },
      {
        icon: Zap,
        title: "Irônico",
        desc: "Divertido, provocador e imprevisível.",
      },
      { icon: Crown, title: "Dominante", desc: "Direto, líder e inabalável." },
      {
        icon: Bolt,
        title: "Ousado",
        desc: "Arriscado, polarizador e magnético.",
      },
    ],
  },
  {
    id: "community",
    title: "Comunidade Exclusiva",
    subtitle:
      "Ao assinar o NaLábia Prime, você ganha acesso imediato à comunidade VIP no WhatsApp: NaLábia CLUB. Troque experiências, receba dicas avançadas e evolua junto com outros membros.",
    icon: MessageCircle,
    features: [
      "Networking de Alto Nível",
      "Análises de Casos Reais",
      "Suporte e Dicas Exclusivas",
    ],
  },
  {
    id: "cta",
    title: "A Vantagem Injusta",
    subtitle:
      "O acesso ao NaLábia Prime é a diferença entre ser ignorado e ser inesquecível. Junte-se ao seleto grupo de homens que dominam a dinâmica social.",
    icon: Star,
    cta: "CRIAR MINHA CONTA AGORA",
  },
];

export const LandingView: React.FC<LandingViewProps> = ({ onGetStarted }) => {
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
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <InfinityIcon className="text-gold-glow" size={24} />
            <span className="font-mono font-bold tracking-[0.2em] text-white text-sm uppercase">
              NaLábia
            </span>
          </div>
          <button
            onClick={onGetStarted}
            className="text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full border border-gold-glow/50 text-gold-glow hover:bg-gold-glow hover:text-black transition-all"
          >
            Pular Apresentação
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative flex items-center justify-center w-full max-w-6xl mx-auto px-6">
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
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-20 h-20 bg-gold-glow/10 text-gold-glow rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(212,175,55,0.1)]"
            >
              <Icon size={40} strokeWidth={1.5} />
            </motion.div>

            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.1] mb-6 max-w-4xl"
            >
              {slide.title}
            </motion.h1>

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12"
            >
              {slide.subtitle}
            </motion.p>

            {/* Slide Specific Content */}
            {slide.features && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col space-y-4 mb-12 text-left w-full max-w-md"
              >
                {slide.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-3 bg-obsidian-light p-4 rounded-xl border border-gold-dim/10"
                  >
                    <div className="w-2 h-2 rounded-full bg-gold-glow"></div>
                    <span className="text-white font-medium">{feat}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {slide.grid && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12 w-full max-w-3xl"
              >
                {slide.grid.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-4 bg-obsidian-light p-6 rounded-xl border border-gold-dim/10 text-left"
                  >
                    <div className="p-2 bg-gold-glow/10 text-gold-glow rounded-lg">
                      <item.icon size={24} />
                    </div>
                    <div>
                      <h3 className="text-white font-bold mb-1">
                        {item.title}
                      </h3>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* CTA Button for specific slides */}
            {slide.cta && (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={nextSlide}
                className="px-8 py-4 bg-gold-glow text-black rounded-xl font-bold tracking-wider hover:bg-gold-glow/90 transition-all flex items-center justify-center space-x-2 group shadow-[0_0_40px_rgba(212,175,55,0.2)]"
              >
                <span>{slide.cta}</span>
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation Controls */}
      <footer className="w-full z-50 bg-obsidian border-t border-gold-dim/10 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className={`p-3 rounded-full flex items-center space-x-2 transition-all ${currentSlide === 0 ? "opacity-0 pointer-events-none" : "text-gray-400 hover:text-white hover:bg-obsidian-light"}`}
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-bold tracking-widest uppercase hidden sm:block">
              Voltar
            </span>
          </button>

          {/* Progress Indicators */}
          <div className="flex items-center space-x-2">
            {SLIDES.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentSlide ? "w-8 bg-gold-glow" : "w-2 bg-obsidian-lighter"}`}
              />
            ))}
          </div>

          <button
            onClick={nextSlide}
            className="p-3 rounded-full flex items-center space-x-2 text-gold-glow hover:text-gold-glow/80 hover:bg-gold-glow/10 transition-all"
          >
            <span className="text-sm font-bold tracking-widest uppercase hidden sm:block">
              {currentSlide === SLIDES.length - 1 ? "Finalizar" : "Avançar"}
            </span>
            <ChevronRight size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
};
