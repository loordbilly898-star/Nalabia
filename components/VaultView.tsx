import React, { useState, useEffect } from 'react';
import { Lock, Search, Trash2, Copy, Check, Loader2, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SavedResponse, AppSettings } from '../types';

interface VaultViewProps {
  settings: AppSettings;
}

const VaultView: React.FC<VaultViewProps> = ({ settings }) => {
  const { getSavedResponses } = useAuth();
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    setLoading(true);
    try {
      const data = await getSavedResponses();
      setResponses(data);
    } catch (error) {
      console.error("Error loading vault:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredResponses = responses.filter(r => {
    const matchesSearch = r.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (r.category && r.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filter === 'all' || r.category === filter;
    return matchesSearch && matchesFilter;
  });

  const categories = Array.from(new Set(responses.map(r => r.category).filter(Boolean)));

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
    <div className="h-full flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-nalabia-900/30 rounded-xl border border-nalabia-800/50">
          <Lock className="text-nalabia-gold" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Cofre de Respostas</h2>
          <p className="text-sm text-gray-400">Seu arsenal pessoal de abridores e respostas que funcionam.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Buscar no cofre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${getThemeInputBg().split(' ')[0]} border border-nalabia-800/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-nalabia-gold/50 transition-colors`}
          />
        </div>
        {categories.length > 0 && (
          <div className="relative min-w-[150px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`w-full ${getThemeInputBg().split(' ')[0]} border border-nalabia-800/50 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-nalabia-gold/50 appearance-none cursor-pointer`}
            >
              <option value="all">Todas</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-nalabia-gold" size={32} />
        </div>
      ) : filteredResponses.length === 0 ? (
        <div className={`flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-nalabia-800/50 rounded-2xl ${getThemeInputBg().split(' ')[0]}`}>
          <Lock className="text-gray-600 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">Cofre Vazio</h3>
          <p className="text-gray-400 max-w-md">
            Você ainda não salvou nenhuma resposta. Quando a IA gerar uma resposta matadora, clique no ícone de salvar para guardá-la aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResponses.map((response) => (
            <div key={response.id} className={`${getThemeInputBg().split(' ')[0]} border border-nalabia-800/50 rounded-xl p-5 flex flex-col group hover:border-nalabia-gold/30 transition-colors`}>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono text-nalabia-gold/70 bg-nalabia-900/20 px-2 py-1 rounded">
                  {response.category || 'Geral'}
                </span>
                <button
                  onClick={() => handleCopy(response.id, response.text)}
                  className="text-gray-500 hover:text-nalabia-gold transition-colors p-1"
                  title="Copiar"
                >
                  {copiedId === response.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-gray-200 text-sm flex-1 mb-4 leading-relaxed">
                "{response.text}"
              </p>
              <div className="text-[10px] text-gray-600 font-mono mt-auto pt-3 border-t border-nalabia-800/30">
                Salvo em {new Date(response.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VaultView;
