import React, { useState } from "react";
import { Infinity as InfinityIcon, AlertCircle } from "lucide-react";
import { useAuth, UserAIProfile } from "../contexts/AuthContext";

export interface LoginViewProps {
  onboardingData?: Omit<UserAIProfile, "userID">;
}

export const LoginView: React.FC<LoginViewProps> = ({ onboardingData }) => {
  const { loginWithEmail, registerWithEmail } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

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
          "Conta criada com sucesso! Enviamos um e-mail de verificação para o seu endereço. Por favor, acesse sua caixa de entrada e clique no link enviado para confirmar e ativar sua conta.",
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-gray-200 font-sans p-4">
      <div className="w-full max-w-md p-8 bg-[#0a0a0a] rounded-2xl border border-nalabia-800 shadow-2xl flex flex-col items-center">
        <InfinityIcon className="text-gold mb-6" size={48} />
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-[0.2em] font-mono text-white">
            NALÁBIA
          </h1>
          <p className="text-xs font-mono tracking-widest mt-2 text-gold opacity-70">
            OS ∞
          </p>
          {isRegistering && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400 font-medium">
                Assine e ganhe acesso imediato à comunidade VIP no WhatsApp:{" "}
                <br />
                <span className="font-bold">NaLábia CLUB</span>
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="w-full mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex flex-col items-start space-y-2 text-red-500 text-sm">
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
          <div className="w-full mb-6 p-3 bg-green-500/10 border border-green-500/50 rounded-lg flex items-start space-x-2 text-green-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form
          onSubmit={handleEmailAuth}
          className="w-full flex flex-col space-y-4"
        >
          {isRegistering && (
            <input
              type="text"
              placeholder="Nome de usuário"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gold text-black rounded-xl font-bold tracking-wider hover:bg-gold-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "PROCESSANDO..."
              : isRegistering
                ? "CRIAR CONTA"
                : "ENTRAR"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-gold hover:underline"
          >
            {isRegistering
              ? "Já tem uma conta? Entrar"
              : "Não tem uma conta? Criar agora"}
          </button>
        </div>
      </div>
    </div>
  );
};
