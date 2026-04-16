import React, { useState } from 'react';
import { Profile, Memory } from '../types';
import { User, Plus, Search, MessageCircle, BarChart2, Trash2, Edit2, Check, BrainCircuit } from 'lucide-react';

interface ProfilesViewProps {
  profiles: Profile[];
  memories?: Memory[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onAddProfile: (name: string, description: string) => void;
  onDeleteProfile: (id: string) => void;
  settings?: any;
}

const ProfilesView: React.FC<ProfilesViewProps> = ({ profiles, memories, activeProfileId, onSelectProfile, onAddProfile, onDeleteProfile, settings }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

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

  const handleAdd = () => {
    if (newName.trim()) {
      onAddProfile(newName, newDesc);
      setNewName('');
      setNewDesc('');
      setIsAdding(false);
    }
  };

  const getThemeBg = () => {
    // We can just use the global theme bg from App.tsx, but since we don't have it here, we'll use a transparent bg and let the parent handle it, or we can use the same switch.
    // Actually, ProfilesView is rendered inside App.tsx which already has the theme bg.
    // So we can just remove the hardcoded bg.
  };

  return (
    <div className="flex flex-col h-full animate-fade-in p-4 pb-20 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-mono font-bold tracking-[0.2em] uppercase text-nalabia-gold">Perfis & Memória</h2>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-nalabia-900 border border-nalabia-gold/30 text-nalabia-gold p-2 rounded hover:bg-nalabia-gold hover:text-black transition-all"
        >
          <Plus size={18} />
        </button>
      </div>

      {isAdding && (
        <div className={`${getThemeInputBg().split(' ')[0]} p-4 rounded-lg border border-nalabia-gold/50 mb-6 animate-fade-in`}>
          <h3 className="text-xs font-mono uppercase text-gray-400 mb-3">Novo Perfil</h3>
          <input 
            type="text" 
            placeholder="Nome (ex: Ana Academia)" 
            className={`w-full ${getThemeInputBg().split(' ')[0]} border border-gray-700 rounded p-2 text-sm mb-2 focus:border-nalabia-gold outline-none text-white`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="Descrição (ex: Curte arte, low profile)" 
            className={`w-full ${getThemeInputBg().split(' ')[0]} border border-gray-700 rounded p-2 text-sm mb-3 focus:border-nalabia-gold outline-none text-white`}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsAdding(false)} className="text-xs text-gray-500 px-3 py-2">Cancelar</button>
            <button onClick={handleAdd} className="bg-nalabia-gold text-black text-xs font-bold px-4 py-2 rounded">Criar Perfil</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {profiles.map(profile => (
          <div 
            key={profile.id}
            onClick={() => onSelectProfile(profile.id)}
            className={`group relative border rounded-lg p-4 cursor-pointer transition-all duration-300
              ${activeProfileId === profile.id 
                ? 'bg-nalabia-gold/10 border-nalabia-gold shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
                : `${getThemeInputBg()} border-gray-800 hover:border-gray-600`}
            `}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                   ${activeProfileId === profile.id ? 'bg-nalabia-gold text-black' : 'bg-gray-800 text-gray-400'}
                `}>
                  {profile.avatar || (typeof profile.name === 'string' ? profile.name.charAt(0).toUpperCase() : '?')}
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${activeProfileId === profile.id ? 'text-white' : 'text-gray-300'}`}>
                    {typeof profile.name === 'string' ? profile.name : JSON.stringify(profile.name)}
                  </h3>
                  <p className="text-[10px] text-gray-500">{typeof profile.description === 'string' ? profile.description : JSON.stringify(profile.description)}</p>
                </div>
              </div>
              
              {activeProfileId === profile.id && <Check size={16} className="text-nalabia-gold" />}
            </div>

            <div className="mt-4 flex items-center gap-4 border-t border-gray-800/50 pt-3">
              <div className="flex flex-col">
                <span className="text-[8px] text-gray-600 uppercase font-mono">Interesse</span>
                <span className={`text-[10px] font-bold ${
                  typeof profile.metrics.interest === 'string' && profile.metrics.interest === 'Alto' ? 'text-green-400' :
                  typeof profile.metrics.interest === 'string' && profile.metrics.interest === 'Baixo' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {typeof profile.metrics.interest === 'string' ? profile.metrics.interest : JSON.stringify(profile.metrics.interest)}
                </span>
              </div>
               <div className="flex flex-col">
                <span className="text-[8px] text-gray-600 uppercase font-mono">Risco</span>
                <span className="text-[10px] text-gray-400 font-bold">{typeof profile.metrics.risk === 'string' ? profile.metrics.risk : (profile.metrics.risk ? JSON.stringify(profile.metrics.risk) : 'N/A')}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] text-gray-600 uppercase font-mono">Msgs</span>
                <span className="text-[10px] text-gray-400 font-bold">{profile.messages.length}</span>
              </div>
            </div>
            
            {/* Memory Display */}
            {memories && memories.find(m => m.id === profile.id)?.observations && (
              <div className="mt-3 pt-3 border-t border-gray-800/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <BrainCircuit size={12} className="text-blue-400" />
                  <span className="text-[10px] font-mono uppercase text-gray-500 tracking-wider">Memória Estratégica</span>
                </div>
                <ul className="space-y-1">
                  {memories.find(m => m.id === profile.id)?.observations?.map((obs, idx) => (
                    <li key={idx} className="text-[10px] text-gray-400 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[5px] before:w-1 before:h-1 before:bg-blue-400/50 before:rounded-full">
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {profile.id !== 'general' && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteProfile(profile.id); }}
                className={`absolute top-3 right-3 p-2 rounded-full transition-all z-10 ${activeProfileId === profile.id ? 'opacity-100 text-red-500 bg-red-500/10' : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 hover:bg-red-500/10'}`}
                title="Excluir perfil"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-8 text-center px-6">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          Cada perfil mantém uma memória isolada. A IA aprende o padrão de comportamento específico de cada pessoa para sugerir estratégias melhores com o tempo.
        </p>
      </div>
    </div>
  );
};

export default ProfilesView;
