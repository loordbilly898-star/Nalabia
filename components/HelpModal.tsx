import React from 'react';
import { X, HelpCircle, ArrowRight } from 'lucide-react';
import { NalábiaMode } from '../types';

interface HelpModalProps {
  mode: NalábiaMode;
  onClose: () => void;
  settings?: any;
}

const helpContent: Record<string, { title: string; text: string }> = {
  'STORY_REPLY': {
    title: 'Responder Stories',
    text: 'Envie o print do story. A IA identifica o tipo de conteúdo (selfie, paisagem, música) e cria uma reação natural, sem elogio óbvio ou exagero. O objetivo é iniciar conversa sem parecer que você estava esperando por isso.'
  },
  'FIRST_CONTACT': {
    title: 'Primeiro Contato',
    text: 'Ideal para iniciar conversa do zero (DM fria) ou responder a um follow. A IA foca em observação e contexto, evitando o "Oi, tudo bem?" genérico que morre rápido.'
  },
  'FLOWING': {
    title: 'Conversa Fluindo',
    text: 'Use quando o papo já engatou. O objetivo aqui é manter a bola com ela, gerar tópicos novos e evitar que o assunto morra, mantendo o interesse dela ativo.'
  },
  'VALUE_TEST': {
    title: 'Teste de Valor',
    text: 'Use quando ela te provocar, for irônica ou fizer "joguinho". A IA gera respostas que passam no teste (concordar e amplificar) sem que você precise se defender ou explicar.'
  },
  'COLD_RESPONSE': {
    title: 'Resposta Fria / Seca',
    text: 'Se ela mandou algo curto ou demorou muito, use este modo. A IA vai espelhar o comportamento (mirroring), recuando o investimento para recuperar seu valor percebido.'
  },
  'SILENCE': {
    title: 'Silêncio Estratégico',
    text: 'Às vezes a melhor resposta é não responder agora. Este modo analisa se você deve dar vácuo proposital para gerar tensão e curiosidade.'
  },
  'REACTIVATION': {
    title: 'Reativação',
    text: 'Para reviver contatos antigos ou conversas que morreram há dias. Usa humor leve ou curiosidade aleatória, sem cobrar atenção ou perguntar "sumiu?".'
  },
  'ONE_LINER': {
    title: 'Uma Linha Extrema',
    text: 'Mensagens de alto impacto, curtas e grossas. Use com cautela para fechar encontros ou fazer uma declaração de intenção forte.'
  },
  'PROFILES': {
    title: 'Perfis & Memória',
    text: 'Cada perfil representa uma pessoa diferente. A IA aprende como ela conversa e adapta as respostas para funcionar melhor com aquele estilo específico. Crie um perfil para cada contatinho importante.'
  }
};

const HelpModal: React.FC<HelpModalProps> = ({ mode, onClose, settings }) => {
  const content = helpContent[mode] || { title: 'Ajuda', text: 'Selecione um modo para ver dicas.' };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
      <div className={`${getThemeInputBg().split(' ')[0]} border border-nalabia-gold/20 rounded-xl w-full max-w-sm relative overflow-hidden`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-nalabia-gold to-transparent opacity-50"></div>
        
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-2 text-nalabia-gold">
              <HelpCircle size={20} />
              <h3 className="font-mono font-bold uppercase tracking-widest text-sm">{content.title}</h3>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <p className="text-sm text-gray-300 leading-relaxed font-light mb-6">
            {content.text}
          </p>

          <button 
            onClick={onClose}
            className="w-full bg-nalabia-900 border border-gray-800 hover:border-nalabia-gold/40 text-gray-400 hover:text-white py-3 rounded text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            Entendi <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
