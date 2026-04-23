import React from 'react';
import { X } from 'lucide-react';

export const TutorialModal: React.FC<{ onComplete: () => void, settings?: any }> = ({ onComplete, settings }) => {
  const getThemeInputBg = () => {
    if (!settings) return 'bg-[#0a0a0a]';
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-[#0a0a0a]';
      case 'light': return 'bg-[#ffffff]';
      case 'midnight': return 'bg-[#1e293b]';
      case 'dracula': return 'bg-[#44475a]';
      case 'hacker': return 'bg-[#000000]';
      case 'cyberpunk': return 'bg-[#000000]';
      case 'dark':
      default: return 'bg-[#0a0a0a]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className={`${getThemeInputBg().split(' ')[0]} border border-nalabia-800 rounded-2xl p-6 max-w-md w-full shadow-2xl`}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-white">Bem-vindo à NaLábia</h3>
          <button onClick={onComplete} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p className="text-gray-300 mb-6">
          Este é o seu arsenal completo de atração. Escolha a ferramenta ideal para o seu momento atual na conversa.
        </p>
        <button 
          onClick={onComplete}
          className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
        >
          Começar
        </button>
      </div>
    </div>
  );
};
