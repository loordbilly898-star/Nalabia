import React, { useState } from "react";
import {
  ShieldCheck,
  FileText,
  Cookie,
  Lock,
  CheckCircle2,
  X,
  Scale,
  Sparkles,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type LegalTab = "terms" | "privacy" | "cookies";

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: LegalTab;
}

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = "terms",
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(defaultTab);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-3xl bg-[#0d0d0d] border border-gold/30 rounded-3xl p-5 sm:p-8 shadow-[0_0_50px_rgba(212,175,55,0.15)] text-gray-200 my-auto max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-none">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gold/10 border border-gold/30 text-gold">
                <Scale size={22} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-mono tracking-wide text-white">
                  TERMOS LEGAIS & PRIVACIDADE
                </h2>
                <p className="text-xs text-gray-400 font-mono">
                  NaLábia Intelligence • Transparência e Segurança
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 pb-2 border-b border-white/5 flex-none overflow-x-auto">
            <button
              onClick={() => setActiveTab("terms")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "terms"
                  ? "bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-bold"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <FileText size={16} />
              <span>Termos de Uso</span>
            </button>

            <button
              onClick={() => setActiveTab("privacy")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "privacy"
                  ? "bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-bold"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <ShieldCheck size={16} />
              <span>Política de Privacidade</span>
            </button>

            <button
              onClick={() => setActiveTab("cookies")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "cookies"
                  ? "bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-bold"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Cookie size={16} />
              <span>Política de Cookies</span>
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-6 text-sm text-gray-300 leading-relaxed font-sans custom-scrollbar">
            {activeTab === "terms" && (
              <div className="space-y-4">
                <div className="p-4 bg-gold/5 border border-gold/20 rounded-2xl">
                  <h3 className="text-sm font-bold text-gold flex items-center gap-2 mb-1">
                    <Sparkles size={16} />
                    Resumo dos Termos de Uso
                  </h3>
                  <p className="text-xs text-gray-300">
                    O NaLábia é uma plataforma avançada de assistência em dinâmica social e comunicação interpessoal assistida por Inteligência Artificial. Ao criar uma conta ou utilizar a aplicação, você concorda expressamente com os termos estabelecidos abaixo.
                  </p>
                </div>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">1. Elegibilidade e Cadastro</h4>
                  <p>
                    Para utilizar o NaLábia, o usuário deve ter no mínimo 18 anos ou a idade legal de maioridade em sua jurisdição. Todas as informações fornecidas no momento do cadastro devem ser verdadeiras, precisas e atualizadas.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">2. Período de Teste Grátis de 24 Horas</h4>
                  <p>
                    O NaLábia concede a novos usuários e novos dispositivos o benefício de <strong>1 (um) teste gratuito de 24 (vinte e quatro) horas corridas</strong> com acesso às funcionalidades de inteligência artificial.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 pl-2">
                    <li>O teste grátis é limitado a 1 (uma) concessão por dispositivo físico/hardware.</li>
                    <li>Tentativas de redefinição de identificadores, criação abusiva de contas múltiplas ou fraude para estender indevidamente o período gratuito são estritamente proibidas e passíveis de bloqueio permanente.</li>
                    <li>Após a expiração do período de 24 horas, o usuário mantém sua conta salva e configurada, devendo assinar um dos planos para continuar gerando análises e respostas por IA.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">3. Uso Aceitável e Responsabilidade</h4>
                  <p>
                    A plataforma destina-se ao aprimoramento da comunicação, inteligência social, flerte e superação de bloqueios conversacionais. É expressamente proibido:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 pl-2">
                    <li>Utilizar as respostas geradas para assédio, coerção, ameaças ou qualquer conduta ilícita;</li>
                    <li>Fazer engenharia reversa, extração massiva automatizada (scraping) ou revenda de acesso à plataforma sem autorização formal;</li>
                    <li>Compartilhar credenciais de conta pessoal com terceiros não autorizados.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">4. Planos, Cobrança e Cancelamento</h4>
                  <p>
                    As assinaturas (Mensal, Anual ou Vitalício) concedem acesso contínuo aos recursos correspondentes ao plano contratado. O cancelamento de assinaturas recorrentes pode ser solicitado a qualquer momento pelo usuário através das configurações ou canal oficial de suporte.
                  </p>
                </section>
              </div>
            )}

            {activeTab === "privacy" && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                  <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-1">
                    <Lock size={16} />
                    Compromisso com a Privacidade (LGPD & GDPR)
                  </h3>
                  <p className="text-xs text-gray-300">
                    Sua privacidade é prioridade absoluta. Tratamos todos os dados, mensagens e análises com sigilo rigoroso e criptografia.
                  </p>
                </div>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">1. Dados Coletados</h4>
                  <p>Coletamos exclusivamente os dados necessários para o funcionamento seguro da aplicação:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-gray-400 pl-2">
                    <li><strong>Dados cadastrais:</strong> Nome e endereço de e-mail para autenticação e gestão da conta;</li>
                    <li><strong>Prints e Mensagens:</strong> Processados em tempo real pela IA para extração de contexto e sugestão de respostas;</li>
                    <li><strong>Dados de Integridade:</strong> Identificador de dispositivo (HWID anônimo e hash criptográfico) para validação do teste grátis e combate a fraudes.</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">2. Sigilo das Conversas e Imagens</h4>
                  <p>
                    As imagens de conversas e textos submetidos são utilizados apenas para o processamento imediato da inteligência social. Não comercializamos, não compartilhamos e não divulgamos dados pessoais ou prints a terceiros.
                  </p>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">3. Seus Direitos como Titular</h4>
                  <p>
                    Em conformidade com a LGPD (Lei nº 13.709/2018), você pode a qualquer momento solicitar a exportação ou exclusão definitiva de sua conta e de todos os dados associados através das configurações do aplicativo.
                  </p>
                </section>
              </div>
            )}

            {activeTab === "cookies" && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-1">
                    <Cookie size={16} />
                    Uso de Cookies e Armazenamento Local
                  </h3>
                  <p className="text-xs text-gray-300">
                    Utilizamos cookies e tecnologias similares estritamente necessárias para manter sua sessão ativa, salvar suas preferências visuais e garantir a segurança do seu teste grátis.
                  </p>
                </div>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">1. Tipos de Armazenamento Utilizados</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl">
                      <div className="font-bold text-xs text-gold mb-1">Cookies Essenciais de Sessão</div>
                      <p className="text-[11px] text-gray-400">
                        Permitem autenticação segura, persistência do token de login e navegação sem desconexões involuntárias.
                      </p>
                    </div>

                    <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl">
                      <div className="font-bold text-xs text-amber-300 mb-1">LocalStorage & Preferências</div>
                      <p className="text-[11px] text-gray-400">
                        Armazena tema escolhido, configurações de IA, perfis de conversa e histórico do usuário no seu próprio navegador.
                      </p>
                    </div>

                    <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl sm:col-span-2">
                      <div className="font-bold text-xs text-emerald-400 mb-1">Validação de Integridade do Teste Grátis</div>
                      <p className="text-[11px] text-gray-400">
                        Armazena um identificador criptográfico anônimo para controlar a contagem regressiva de 24 horas de teste sem expor dados pessoais.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <h4 className="font-bold text-white text-base">2. Gerenciamento de Cookies</h4>
                  <p className="text-xs text-gray-400">
                    Você pode limpar os cookies e o armazenamento local pelo navegador a qualquer momento. Note que a exclusão de cookies essenciais resultará no encerramento da sessão atual no dispositivo.
                  </p>
                </section>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 flex-none mt-4">
            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>Atualizado em 2026 • NaLábia Systems</span>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-gold to-amber-400 hover:brightness-110 text-black text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] cursor-pointer"
            >
              Entendido e Aceito
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
