import React, { useState, useEffect } from "react";
import { Cookie, ShieldCheck, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CookieConsentBannerProps {
  onOpenTerms: (tab?: "terms" | "privacy" | "cookies") => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onOpenTerms,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("nalabia_cookie_consent_v1");
      if (!consent) {
        // Small delay for clean entrance
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("nalabia_cookie_consent_v1", "accepted");
    } catch (e) {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-[#101010]/95 backdrop-blur-md border border-gold/30 rounded-2xl p-4 sm:p-5 shadow-[0_0_40px_rgba(0,0,0,0.8)] text-white"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-gold/10 text-gold border border-gold/20 flex-shrink-0 mt-0.5">
            <Cookie size={20} />
          </div>

          <div className="flex-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 mb-1">
              <span>Privacidade & Cookies</span>
            </h4>
            <p className="text-[12px] text-gray-300 leading-snug">
              Utilizamos cookies e armazenamento local para autenticação, salvar suas preferências e assegurar o seu período de{" "}
              <strong className="text-gold font-bold">24 horas de teste grátis</strong>.
            </p>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
              <button
                onClick={handleAccept}
                className="flex-1 py-2 px-3 bg-gradient-to-r from-gold to-amber-400 hover:brightness-110 text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)] cursor-pointer"
              >
                Aceitar e Continuar
              </button>

              <button
                onClick={() => onOpenTerms("cookies")}
                className="py-2 px-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Ver Detalhes
              </button>
            </div>
          </div>

          <button
            onClick={handleAccept}
            className="text-gray-400 hover:text-white p-1 -mr-1 -mt-1 rounded-full hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
