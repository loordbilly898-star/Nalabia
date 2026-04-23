import React, { useState } from 'react';
import { X, Search, ChevronRight, MessageCircle, AlertTriangle, Ghost, Flame, Heart } from 'lucide-react';
import { AppSettings, AnalysisMode } from '../types';

interface AssistedModeModalProps {
  onClose: () => void;
  onSelectMode: (mode: AnalysisMode) => void;
  settings: AppSettings;
}

const AssistedModeModal: React.FC<AssistedModeModalProps> = ({ onClose, onSelectMode, settings }) => {
  const [step, setStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const getThemeInputBg = () => {
    switch (settings.theme) {
      case 'light': return 'bg-white';
      case 'ultra-dark': return 'bg-black';
      case 'dracula': return 'bg-[#44475a]';
      default: return 'bg-obsidian-light';
    }
  };

  const handleSelect = (mode: AnalysisMode) => {
    onSelectMode(mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`${getThemeInputBg()} border border-gold-dim/20 w-full max-w-md rounded-2xl p-6 shadow-[0_0_40px_rgba(212,175,55,0.1)]`}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Search className="text-gold-glow" size={20} />
            <h2 className="text-xl font-medium text-gray-100">Bússola Estratégica</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-gray-400 mb-2">Selecione seu objetivo tático:</p>

            <button onClick={() => { setSelectedGoal('iniciar'); setStep(2); }} className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-gold-glow/40 hover:bg-white/10 rounded-xl transition-all group">
              <div className="flex items-center gap-3">
                <Flame className="text-orange-400" size={20} />
                <span className="text-gray-200">Infiltração (Abrir conversa)</span>
              </div>
              <ChevronRight size={16} className="text-gray-500 group-hover:text-gold-glow" />
            </button>

            <button onClick={() => { setSelectedGoal('manter'); setStep(2); }} className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-gold-glow/40 hover:bg-white/10 rounded-xl transition-all group">
              <div className="flex items-center gap-3">
                <MessageCircle className="text-blue-400" size={20} />
                <span className="text-gray-200">Manutenção de Frame & Flow</span>
              </div>
              <ChevronRight size={16} className="text-gray-500 group-hover:text-gold-glow" />
            </button>

            <button onClick={() => { setSelectedGoal('problema'); setStep(2); }} className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 hover:border-gold-glow/40 hover:bg-white/10 rounded-xl transition-all group">
              <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-400" size={20} />
                <span className="text-gray-200">Contenção de Danos & Contra-Ataque</span>
              </div>
              <ChevronRight size={16} className="text-gray-500 group-hover:text-gold-glow" />
            </button>
          </div>
        )}

        {step === 2 && selectedGoal === 'iniciar' && (
          <div className="space-y-3 animate-fade-in">
            <button onClick={() => setStep(1)} className="text-xs text-gold-glow mb-2 hover:underline">← Voltar</button>
            <p className="text-sm text-gray-400 mb-2">Qual é o cenário exato?</p>
            
            <button onClick={() => handleSelect('FIRST_CONTACT')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-emerald-400 font-medium mb-1">Dei Match / Quero chamar no Direct</h4>
              <p className="text-xs text-gray-500">Usa o modo Primeiro Contato para criar um abridor único baseado no perfil.</p>
            </button>

            <button onClick={() => handleSelect('STORY_REPLY')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-emerald-400 font-medium mb-1">Ela postou um Story e eu quero reagir</h4>
              <p className="text-xs text-gray-500">Responda ao story de forma inteligente e desapegada sem parecer carente.</p>
            </button>

            <button onClick={() => handleSelect('REACTIVATION')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-emerald-400 font-medium mb-1">Faz tempo que não nos falamos</h4>
              <p className="text-xs text-gray-500">Reviva o contato morto aplicando gatilhos de curiosidade.</p>
            </button>
          </div>
        )}

        {step === 2 && selectedGoal === 'manter' && (
          <div className="space-y-3 animate-fade-in">
            <button onClick={() => setStep(1)} className="text-xs text-gold-glow mb-2 hover:underline">← Voltar</button>
            <p className="text-sm text-gray-400 mb-2">Como está a conversa no momento?</p>

            <button onClick={() => handleSelect('FLOWING')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-blue-400 font-medium mb-1">Está fluindo, mas não quero deixar morrer</h4>
              <p className="text-xs text-gray-500">Mantenha a fluidez, flerte um pouco e aplique tensão sutil.</p>
            </button>

            <button onClick={() => handleSelect('ONE_LINER')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-blue-400 font-medium mb-1">Quero parecer desapegado e magnético</h4>
              <p className="text-xs text-gray-500">Envie respostas cirúrgicas de 2 a 5 palavras. O ápice do desapego.</p>
            </button>

            <button onClick={() => handleSelect('NSFW')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-purple-400 font-medium mb-1">O clima esquentou (Escalação +18)</h4>
              <p className="text-xs text-gray-500">Ligue a escalação sexual. Aumente a temperatura da conversa com dominação.</p>
            </button>
          </div>
        )}

        {step === 2 && selectedGoal === 'problema' && (
          <div className="space-y-3 animate-fade-in">
            <button onClick={() => setStep(1)} className="text-xs text-gold-glow mb-2 hover:underline">← Voltar</button>
            <p className="text-sm text-gray-400 mb-2">O que deu errado?</p>

            <button onClick={() => handleSelect('COLD_RESPONSE')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-red-400 font-medium mb-1">Ela foi fria ou demorou muito</h4>
              <p className="text-xs text-gray-500">Recalcule o frame. Aplique o distanciamento correto para recuperar valor.</p>
            </button>

            <button onClick={() => handleSelect('SILENCE')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-red-400 font-medium mb-1">Levei vácuo (Ghosting)</h4>
              <p className="text-xs text-gray-500">Use técnicas de reabertura não-sequenciais após um período de silêncio.</p>
            </button>

            <button onClick={() => handleSelect('VALUE_TEST')} className="w-full text-left p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-gold-glow/40 rounded-xl">
              <h4 className="text-orange-400 font-medium mb-1">Ela está me provocando / testando (Shit-test)</h4>
              <p className="text-xs text-gray-500">Concorde e amplifique ou ignore completamente. Saiba como passar no teste.</p>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistedModeModal;
