import React, { useState } from 'react';
import { Infinity as InfinityIcon, AlertCircle } from 'lucide-react';
import { useAuth, UserAIProfile } from '../contexts/AuthContext';

export interface LoginViewProps {
  onboardingData?: Omit<UserAIProfile, 'userID'>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onboardingData }) => {
  const { loginWithEmail, registerWithEmail } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegistering) {
        if (!name) throw new Error('Nome é obrigatório para registro.');
        await registerWithEmail(name, email, password, onboardingData);
      } else {
        await loginWithEmail(email, password, onboardingData);
      }
    } catch (err: any) {
      setError(err.message || `Erro ao ${isRegistering ? 'registrar' : 'fazer login'}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-gray-200 font-sans p-4">
      <div className="w-full max-w-md p-8 bg-[#0a0a0a] rounded-2xl border border-nalabia-800 shadow-2xl flex flex-col items-center">
        <InfinityIcon className="text-nalabia-gold mb-6" size={48} />
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-[0.2em] font-mono text-white">Nalábia</h1>
          <p className="text-xs font-mono tracking-widest mt-2 text-nalabia-gold opacity-70">HUMAN ATTRACTION OS ∞</p>
          {isRegistering && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400 font-medium">
                Assine e ganhe acesso imediato à comunidade VIP no WhatsApp: <br/><span className="font-bold">NALÁBIA Nalábia CLUB</span>
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="w-full mb-6 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start space-x-2 text-red-500 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="w-full flex flex-col space-y-4">
          {isRegistering && (
            <input
              type="text"
              placeholder="Nome de usuário"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-nalabia-gold transition-colors"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-nalabia-gold transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#111] border border-nalabia-800/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-nalabia-gold transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-nalabia-gold text-black rounded-xl font-bold tracking-wider hover:bg-nalabia-gold-glow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'PROCESSANDO...' : (isRegistering ? 'CRIAR CONTA' : 'ENTRAR')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-nalabia-gold hover:underline"
          >
            {isRegistering ? 'Já tem uma conta? Entrar' : 'Não tem uma conta? Criar agora'}
          </button>
        </div>
      </div>
    </div>
  );
};
