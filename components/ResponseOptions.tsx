import React, { useState } from 'react';
import { Copy, Check, Sparkles, ChevronRight, RefreshCw, Volume2, Loader2, Bookmark } from 'lucide-react';
import { generateAudio } from '../services/gemini';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../types';

interface ResponseOption {
  type: string;
  text: string;
  explanation?: string;
}

interface ResponseOptionsProps {
  responses: ResponseOption[];
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  settings?: any;
}

const ResponseOptions: React.FC<ResponseOptionsProps> = ({ responses, onRegenerate, isRegenerating, settings }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const { user, addXp, saveResponseToVault } = useAuth();

  const getThemeInputBg = () => {
    if (!settings) return 'bg-obsidian';
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-obsidian';
      case 'light': return 'bg-[#ffffff]';
      case 'midnight': return 'bg-[#1e293b]';
      case 'dracula': return 'bg-[#44475a]';
      case 'hacker': return 'bg-[#000000]';
      case 'cyberpunk': return 'bg-[#000000]';
      case 'dark':
      default: return 'bg-obsidian';
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedIndex(index);
      addXp(200); // +200 XP gerar resposta usada
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleSave = async (text: string, category: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || savedIndex === index) return;
    
    try {
      await saveResponseToVault(text, category);
      setSavedIndex(index);
      setTimeout(() => setSavedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to save response:", error);
    }
  };

  const handlePlayAudio = async (text: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingIndex === index || loadingAudioIndex === index) return;
    
    try {
      setLoadingAudioIndex(index);
      
      // Initialize AudioContext synchronously to bypass iOS Safari restrictions
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("AudioContext not supported in this browser.");
      }
      const audioContext = new AudioContextClass();

      const base64Audio = await generateAudio(text);
      
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const sampleRate = 24000;
      const numChannels = 1;
      const numSamples = bytes.length / 2;
      
      const audioBuffer = audioContext.createBuffer(numChannels, numSamples, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      const dataView = new DataView(bytes.buffer);
      for (let i = 0; i < numSamples; i++) {
        const sample = dataView.getInt16(i * 2, true);
        channelData[i] = sample < 0 ? sample / 32768 : sample / 32767;
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        setPlayingIndex(null);
      };
      
      setLoadingAudioIndex(null);
      setPlayingIndex(index);
      source.start();
      
    } catch (error) {
      console.error("Failed to play audio", error);
      setLoadingAudioIndex(null);
      setPlayingIndex(null);
    }
  };

  return (
    <div className="space-y-3 w-full animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-mono text-gold-glow uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={10} className="text-gold-glow" />
          Opções Geradas
        </h3>
        
        {onRegenerate && (
          <button 
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border border-gold-dim/20 ${getThemeInputBg()} hover:border-gold-glow/50 hover:text-gold-glow transition-all group ${isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RefreshCw size={10} className={`text-gray-500 group-hover:text-gold-glow ${isRegenerating ? 'animate-spin' : ''}`} />
            <span className="text-[8px] font-mono text-gray-500 group-hover:text-gold-glow uppercase">Regerar</span>
          </button>
        )}
      </div>
      
      {/* Horizontal Scroll Container */}
      <div className="flex overflow-x-auto gap-4 pb-4 -mx-1 px-1 snap-x snap-mandatory hide-scrollbar">
        {(Array.isArray(responses) ? responses : []).map((res, idx) => (
          <div 
            key={idx} 
            onClick={() => handleCopy(typeof res.text === 'string' ? res.text : (typeof res === 'string' ? res : JSON.stringify(res)), idx)}
            className={`flex-none w-[85%] sm:w-[300px] snap-center group relative bg-obsidian-light border transition-all duration-300 rounded-xl p-5 cursor-pointer flex flex-col justify-between
              ${copiedIndex === idx 
                ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                : `border-gold-dim/20 hover:border-gold-glow/40 hover:${getThemeInputBg()} hover:shadow-[0_0_20px_rgba(212,175,55,0.05)]`}
            `}
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider border border-white/5 px-2 py-0.5 rounded-full">{res.type || 'Opção'}</span>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={(e) => handleSave(typeof res.text === 'string' ? res.text : (typeof res === 'string' ? res : JSON.stringify(res)), typeof res.type === 'string' ? res.type : 'Geral', idx, e)}
                    className="text-gray-600 hover:text-gold-glow transition-colors"
                  >
                    {savedIndex === idx ? <Check size={14} className="text-emerald-500" /> : <Bookmark size={14} />}
                  </button>
                  <button 
                    onClick={(e) => handlePlayAudio(typeof res.text === 'string' ? res.text : (typeof res === 'string' ? res : JSON.stringify(res)), idx, e)}
                    className="text-gray-600 hover:text-gold-glow transition-colors"
                  >
                    {loadingAudioIndex === idx ? (
                      <Loader2 size={14} className="animate-spin text-gold-glow" />
                    ) : (
                      <Volume2 size={14} className={playingIndex === idx ? "text-gold-glow" : ""} />
                    )}
                  </button>
                  <div className="text-gray-600 group-hover:text-gold-glow transition-colors">
                    {copiedIndex === idx ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </div>
                </div>
              </div>
              <p className="text-gray-200 font-medium text-sm leading-relaxed select-none whitespace-pre-wrap">
                {typeof res.text === 'string' ? res.text : (typeof res === 'string' ? res : JSON.stringify(res))}
              </p>
              {res.explanation && (
                <div className="mt-3 p-2.5 bg-obsidian-lighter/50 rounded-lg border border-gold-dim/10">
                  <p className="text-[10px] text-gold-glow/80 font-mono leading-relaxed">
                    <span className="font-bold text-gold-glow mr-1">🧠 NaLábia:</span>
                    {res.explanation}
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-900/50 flex justify-end">
              <span className="text-[8px] text-gray-700 font-mono uppercase">
                {copiedIndex === idx ? 'Copiado!' : 'Toque para copiar'}
              </span>
            </div>

            {copiedIndex === idx && (
              <div className="absolute inset-0 rounded-xl border border-green-500/20 animate-pulse pointer-events-none"></div>
            )}
          </div>
        ))}
        {/* Spacer for right padding in scroll */}
        <div className="w-2 flex-none"></div>
      </div>
    </div>
  );
};

export default ResponseOptions;