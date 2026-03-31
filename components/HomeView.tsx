import React, { useState } from 'react';
import { NalábiaMode } from '../types';
import { 
  Camera, MessageCircle, ScanFace, AlertTriangle, 
  Zap, ShieldAlert, ThermometerSnowflake, Ghost, 
  Repeat2, Bolt, Users, Lock, Crown, Bot, Info, X, Flame, Brain, BookOpen
} from 'lucide-react';

interface HomeViewProps {
  setActiveTab: (tab: NalábiaMode) => void;
  accentColorText: string;
  settings: any;
}

const CATEGORIES = [
  {
    title: 'Academia & Estudo',
    description: 'Domine a teoria antes da prática.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    tools: [
      { id: 'COURSES' as NalábiaMode, label: 'Cursos', icon: BookOpen, desc: 'Academia Nalábia: Livros e Estudos', tip: 'Estude a teoria profunda da sedução e manipulação.' }
    ]
  },
  {
    title: 'Análise & Raio-X',
    description: 'Entenda a mente dela antes de agir.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    tools: [
      { id: 'PROFILE_ANALYZER' as NalábiaMode, label: 'Raio-X de Perfil', icon: ScanFace, desc: 'Analise fotos e bio para gerar abridores únicos.', tip: 'Use quando der match no Tinder/Bumble ou quiser chamar no Instagram de forma criativa.' },
      { id: 'RED_FLAG_DETECTOR' as NalábiaMode, label: 'Detector de Red Flags', icon: AlertTriangle, desc: 'Descubra se ela é tóxica ou se vai dar ghosting.', tip: 'Cole o histórico da conversa quando sentir que ela está estranha ou fria.' },
    ]
  },
  {
    title: 'Quebrar o Gelo',
    description: 'Inicie interações impossíveis de ignorar.',
    color: 'text-nalabia-gold',
    bg: 'bg-nalabia-gold/10',
    border: 'border-nalabia-gold/20',
    tools: [
      { id: 'STORY_REPLY' as NalábiaMode, label: 'Reação a Story', icon: Camera, desc: 'Respostas magnéticas para stories.', tip: 'Use quando ela postar algo interessante e você quiser puxar assunto sem parecer gado.' },
      { id: 'FIRST_CONTACT' as NalábiaMode, label: 'Primeiro Contato', icon: MessageCircle, desc: 'Abridores de alto impacto.', tip: 'A primeira mensagem no WhatsApp ou direct do zero.' },
      { id: 'ONE_LINER' as NalábiaMode, label: '1 Linha', icon: Bolt, desc: 'Respostas curtas e impactantes.', tip: 'Quando você precisa de uma resposta rápida, engraçada e que quebre o padrão.' },
    ]
  },
  {
    title: 'Manter a Conversa (Flow)',
    description: 'Escale a atração e gere conforto.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    tools: [
      { id: 'FLOWING' as NalábiaMode, label: 'Flow', icon: Zap, desc: 'Mantenha o assunto fluindo naturalmente.', tip: 'Use quando a conversa estiver morrendo ou você não souber o que responder.' },
      { id: 'VALUE_TEST' as NalábiaMode, label: 'Teste de Valor', icon: ShieldAlert, desc: 'Inverta o jogo e faça ela se qualificar.', tip: 'Quando ela estiver se achando muito ou te testando (shit tests).' },
      { id: 'CHATBOT' as NalábiaMode, label: 'Assistente IA', icon: Bot, desc: 'Converse livremente com a IA.', tip: 'Peça conselhos gerais sobre sedução, estilo ou comportamento.' },
    ]
  },
  {
    title: 'Recuperação & Riscos',
    description: 'Salve interações que estão morrendo.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    tools: [
      { id: 'COLD_RESPONSE' as NalábiaMode, label: 'Resposta Fria', icon: ThermometerSnowflake, desc: 'Recupere o poder na dinâmica.', tip: 'Quando ela demorar muito para responder ou for seca com você.' },
      { id: 'SILENCE' as NalábiaMode, label: 'Vácuo Estratégico', icon: Ghost, desc: 'Saiba quando e como ignorar.', tip: 'Use quando ela te der vácuo e você precisar saber o momento exato de voltar (se voltar).' },
      { id: 'REACTIVATION' as NalábiaMode, label: 'Reviver Contato', icon: Repeat2, desc: 'Mande mensagem para contatos antigos.', tip: 'Aquele contatinho antigo que esfriou e você quer chamar de novo do nada.' },
    ]
  },
  {
    title: 'Tensão & Escalação',
    description: 'Aumente a temperatura e crie tensão sexual.',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    tools: [
      { id: 'NSFW' as NalábiaMode, label: 'Modo +18', icon: Flame, desc: 'Flerte agressivo e tensão sexual.', tip: 'Use quando a conversa já estiver quente e você quiser escalar para o físico/íntimo.' },
      { id: 'MANIPULATION' as NalábiaMode, label: 'Manipulação', icon: Brain, desc: 'Controle Psicológico Absoluto.', tip: 'Use para criar dependência emocional, obsessão e submissão psicológica.' },
    ]
  },
  {
    title: 'Arsenal & Treino',
    description: 'Suas armas e campo de treinamento.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    tools: [
      { id: 'SIMULATOR' as NalábiaMode, label: 'Simulador', icon: Users, desc: 'Treine conversas com personas de IA.', tip: 'Pratique seu papo antes de falar com a garota real.' },
      { id: 'VAULT' as NalábiaMode, label: 'Cofre', icon: Lock, desc: 'Suas melhores respostas salvas.', tip: 'Acesse rapidamente as frases que você salvou para usar de novo.' },
      { id: 'STATS' as NalábiaMode, label: 'Estatísticas', icon: Crown, desc: 'Seu desempenho e evolução.', tip: 'Acompanhe seu nível, XP e taxa de sucesso.' },
    ]
  }
];

export const HomeView: React.FC<HomeViewProps> = ({ setActiveTab, accentColorText, settings }) => {
  const [selectedTip, setSelectedTip] = useState<{title: string, desc: string, tip: string} | null>(null);

  const getThemeInputBg = () => {
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-[#0a0a0a] text-gray-200';
      case 'light': return 'bg-[#ffffff] text-gray-900 border-gray-300';
      case 'midnight': return 'bg-[#1e293b] text-gray-200';
      case 'dracula': return 'bg-[#44475a] text-[#f8f8f2]';
      case 'hacker': return 'bg-[#000000] text-[#00ff00] border-green-900';
      case 'cyberpunk': return 'bg-[#000000] text-[#fcee0a] border-yellow-900';
      case 'dark':
      default: return 'bg-[#0a0a0a] text-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar p-4 md:p-8 relative">
      
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-nalabia-gold/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="mb-12 mt-4 animate-fade-in relative z-10">
        <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-3">
          Bem-vindo ao <span className={`font-semibold ${accentColorText}`}>Nalábia ∞</span>
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-2xl leading-relaxed">
          Seu arsenal completo de atração. Escolha a ferramenta ideal para o seu momento atual na conversa.
        </p>
      </div>

      {/* Categories Grid */}
      <div className="space-y-10 pb-20">
        {CATEGORIES.map((category, idx) => (
          <div key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="mb-4">
              <h2 className={`text-lg font-semibold tracking-wide ${category.color}`}>
                {category.title}
              </h2>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mt-1">
                {category.description}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {category.tools.map((tool) => (
                <div 
                  key={tool.id}
                  className={`relative group ${getThemeInputBg().split(' ')[0]}/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:border-white/10 overflow-hidden ${settings?.theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/5'}`}
                  onClick={() => setActiveTab(tool.id)}
                >
                  {/* Subtle hover gradient */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br from-transparent to-current ${category.color} pointer-events-none`}></div>
                  
                  <div className="flex items-start justify-between mb-5 relative z-10">
                    <div className={`p-3.5 rounded-xl ${category.bg} ${category.color} shadow-inner`}>
                      <tool.icon size={26} strokeWidth={1.5} />
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTip({ title: tool.label, desc: tool.desc, tip: tool.tip });
                      }}
                      className="p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10"
                      title="Dica de uso"
                    >
                      <Info size={20} />
                    </button>
                  </div>
                  <h3 className="text-gray-100 font-medium text-xl mb-2 relative z-10 tracking-wide">{tool.label}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed relative z-10">{tool.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tip Modal */}
      {selectedTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedTip(null)}>
          <div 
            className={`${getThemeInputBg().split(' ')[0]} border border-nalabia-800 rounded-2xl p-6 max-w-md w-full shadow-2xl`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">{selectedTip.title}</h3>
              <button onClick={() => setSelectedTip(null)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-300 mb-6">{selectedTip.desc}</p>
            <div className="bg-nalabia-gold/10 border border-nalabia-gold/20 rounded-xl p-4">
              <h4 className="text-xs font-mono text-nalabia-gold uppercase tracking-widest mb-2 flex items-center gap-2">
                <Info size={14} /> Quando usar?
              </h4>
              <p className="text-sm text-gray-200 leading-relaxed">
                {selectedTip.tip}
              </p>
            </div>
            <button 
              onClick={() => setSelectedTip(null)}
              className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
