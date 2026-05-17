import React, { useEffect } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Star } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function UpsellView() {
  const { user } = useAuth();
  
  useEffect(() => {
    // Inject the Cakto script dynamically
    const script = document.createElement("script");
    script.src = "https://caktoscripts.nyc3.cdn.digitaloceanspaces.com/upsell.js";
    script.async = true;
    script.type = "text/javascript";
    
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-gold/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 relative z-10 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-gold/10 text-gold rounded-full flex items-center justify-center animate-pulse">
            <Sparkles size={32} />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-4 leading-tight">
          Espera! Não feche essa página ainda...
        </h1>
        
        <p className="text-gray-400 text-center mb-8 text-lg">
          Seu pedido principal foi aprovado, mas você acaba de desbloquear uma <strong className="text-gold">oferta única e secreta</strong>.
        </p>

        <div className="bg-black/50 border border-gold/30 rounded-2xl p-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-gold text-black text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
            ESPECIAL
          </div>
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Star className="text-gold" size={20} fill="currentColor" />
            Adicione o Dark Pack!
          </h2>
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">
            Tenha acesso instantâneo às mensagens exclusivas de "sedução sombria", respostas infalíveis de encerramento rápido e psicologia sombria para triplicar a obsessão dela por você.
          </p>
          <ul className="text-sm text-gray-400 space-y-2 mb-6">
            <li className="flex items-start gap-2">
              <ShieldCheck className="text-green-500 shrink-0" size={16} />
              <span>Liberação imediata na sua conta.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="text-green-500 shrink-0" size={16} />
              <span>Acesso vitalício ao material extra.</span>
            </li>
          </ul>

          <div
            className="w-full space-y-4"
            dangerouslySetInnerHTML={{
              __html: `
              <style>
                cakto-upsell-accept::part(button) {
                    background-image: linear-gradient(to right, #fbbf24, #f59e0b);
                    color: black;
                    width: 100%;
                    padding: 16px;
                    border-radius: 12px;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: none;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                cakto-upsell-accept::part(button):hover {
                    transform: scale(1.02);
                    box-shadow: 0 0 15px rgba(251, 191, 36, 0.4);
                }
                cakto-upsell-reject::part(button) {
                    background-color: transparent;
                    color: #9ca3af;
                    width: 100%;
                    padding: 12px;
                    border-radius: 12px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: none;
                    text-decoration: underline;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                cakto-upsell-reject::part(button):hover {
                    color: #ffffff;
                }
              </style>

              <cakto-upsell-buttons>
                <cakto-upsell-accept
                  bg-color="#fbbf24"
                  text-color="#000000"
                  upsell-accept-url="https://pay.cakto.com.br/mnh4hcg_826434?affiliate=NAwEEUbX&src=${user?.id || ''}"
                  offer-id="obgpnz3"
                  app-base-url="https://app.cakto.com.br"
                  offer-type="upsell"
                  upsell-reject-url="https://pay.cakto.com.br/exfk6pm_826428?affiliate=NAwEEUbX&src=${user?.id || ''}"   
                >
                  SIM, ADICIONAR OFERTA AGORA
                </cakto-upsell-accept>
                <cakto-upsell-reject
                  upsell-reject-url="https://pay.cakto.com.br/exfk6pm_826428?affiliate=NAwEEUbX&src=${user?.id || ''}"       
                >
                  Não, eu passo e vou perder essa oportunidade
                </cakto-upsell-reject>
              </cakto-upsell-buttons>
            `,
            }}
          />
        </div>
      </div>
    </div>
  );
}
