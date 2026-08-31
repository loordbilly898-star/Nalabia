import React, { useState } from "react";
import { Infinity as InfinityIcon, AlertCircle, Sparkles, Clock, ShieldCheck } from "lucide-react";
import { useAuth, UserAIProfile } from "../contexts/AuthContext";

export interface LoginViewProps {
  onboardingData?: Omit<UserAIProfile, "userID">;
  onOpenTerms?: (tab?: "terms" | "privacy" | "cookies") => void;
  onBackToLanding?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onboardingData, onOpenTerms, onBackToLanding }) => {
  const { loginWithEmail, registerWithEmail } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(() => {
    return new URLSearchParams(window.location.search).get("signup") === "true";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (isRegistering) {
        if (!name) throw new Error("Nome é obrigatório para registro.");
        await registerWithEmail(name, email, password, onboardingData);
        setSuccess(
          "Conta criada com sucesso! Enviamos um e-mail de verificação para o seu endereço. Por favor, acesse sua caixa de entrada e clique no link enviado para confirmar e ativar sua conta com as 24h grátis.",
        );
        setIsRegistering(false); // Switch to login view
      } else {
        await loginWithEmail(email, password, onboardingData);
      }
    } catch (err: any) {
      if (err.message === "Email not confirmed") {
        setError(
          "Email não confirmado. Um email de verificação foi enviado para você. Por favor, verifique sua caixa de entrada (e o lixo eletrônico) e clique no link para confirmar.",
        );
      } else if (err.message === "Invalid login credentials") {
        setError("Credenciais inválidas. Verifique seu email e senha.");
      } else if (err.message === "User already registered") {
        setError("Este email já está registrado. Tente fazer login.");
      } else if (
        err.message === "SLOW_SERVER_SIGNUP" ||
        err.status === 504 ||
        err.name === "AuthRetryableFetchError" ||
        err.name === "TimeoutError" ||
        (err.message && err.message.includes("too long to respond"))
      ) {
        if (isRegistering) {
          setSuccess(
            "Conta criada! O servidor demorou um pouco para responder, mas conseguimos registrar. Verifique seu e-mail para ativar a conta.",
          );
          setIsRegistering(false);
          // Limpa o erro para mostrar apenas sucesso
          setError("");
        } else {
          setError(
            "O servidor demorou muito para responder (Timeout). Por favor, tente novamente.",
          );
        }
      } else {
        setError(
          err.message ||
            `Erro ao ${isRegistering ? "registrar" : "fazer login"}.`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-gray-200 font-sans p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md p-6 sm:p-8 bg-[#0a0a0a] rounded-3xl border border-nalabia-800 shadow-2xl flex flex-col items-center relative z-10">
        <InfinityIcon className="text-gold mb-4" size={44} />
        
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold tracking-[0.2em] font-mono text-white">
            NALÁBIA
          </h1>
          <p className="text-xs font-mono tracking-widest mt-1 text-gold opacity-70">
            OS ∞
          </p>

          {/* 24-Hour Free Trial Offer Banner */}
          <div className="mt-4 p-3 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 border border-amber-400/30 rounded-2xl text-center shadow-inner">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wide mb-1">
              <Sparkles size={14} className="text-yellow-400 animate-pulse" />
              <span>24 Horas de Teste Grátis</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-snug">
              Crie sua conta para testar todas as ferramentas de IA liberadas por 24h00.
            </p>
          </div>
          
          {new URLSearchParams(window.location.search).get("from") === "payment_approved" && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm text-yellow-500 font-medium">
                Pagamento aprovado! 🎉<br/>
                Para acessar sua assinatura, crie a senha da sua conta abaixo. Use <b>exatamente o mesmo e-mail</b> que você usou no Cakto.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="w-full mb-5 p-3 bg-red-500/10 border border-red-500/50 rounded-xl flex flex-col items-start space-y-2 text-red-500 text-sm">
            <div className="flex items-start space-x-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {error.includes("servidor demorou") && (
              <button
                onClick={() => setIsRegistering(false)}
                className="w-full py-2 bg-red-500/20 text-red-200 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Tentar fazer login
              </button>
            )}
          </div>
        )}

        {success && (
          <div className="w-full mb-5 p-3 bg-green-500/10 border border-green-500/50 rounded-xl flex items-start space-x-2 text-green-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form
          onSubmit={handleEmailAuth}
          className="w-full flex flex-col space-y-3.5"
        >
          {isRegistering && (
            <input
              type="text"
              placeholder="Nome de usuário"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold transition-colors"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-gold via-amber-400 to-gold-glow text-black rounded-xl font-black text-sm tracking-wider uppercase hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading
              ? "PROCESSANDO..."
              : isRegistering
                ? "CRIAR CONTA & GANHAR 24H"
                : "ENTRAR NA MINHA CONTA"}
          </button>
        </form>

        <div className="mt-5 text-center flex flex-col items-center gap-2.5">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs text-gold hover:underline font-semibold cursor-pointer"
          >
            {isRegistering
              ? "Já tem uma conta? Entrar"
              : "Não tem uma conta? Criar conta e ganhar 24h grátis"}
          </button>

          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
            >
              ← Voltar para a apresentação
            </button>
          )}
        </div>

        {/* Legal & Cookie notice */}
        <div className="mt-6 pt-4 border-t border-white/5 w-full text-center text-[11px] text-gray-500 leading-tight">
          Ao continuar, você concorda com nossos{" "}
          <button
            onClick={() => onOpenTerms && onOpenTerms("terms")}
            className="text-gray-400 hover:text-gold underline cursor-pointer"
          >
            Termos de Uso
          </button>
          ,{" "}
          <button
            onClick={() => onOpenTerms && onOpenTerms("privacy")}
            className="text-gray-400 hover:text-gold underline cursor-pointer"
          >
            Privacidade
          </button>{" "}
          e{" "}
          <button
            onClick={() => onOpenTerms && onOpenTerms("cookies")}
            className="text-gray-400 hover:text-gold underline cursor-pointer"
          >
            Cookies
          </button>
          .
        </div>
      </div>
    </div>
  );
};

