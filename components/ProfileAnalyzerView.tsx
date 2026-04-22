import React, { useState, useRef } from 'react';
import { ScanFace, Upload, X, Loader2, Sparkles, Copy, Check } from 'lucide-react';
import { analyzeProfile } from '../services/aiService';
import { AppSettings, ProcessingState } from '../types';
import { checkDeviceUsage, incrementDeviceUsage } from '../services/antiFraud';
import { useAuth } from '../contexts/AuthContext';

import { resizeImage } from '../utils/imageResizer';

interface ProfileAnalyzerViewProps {
  settings: AppSettings;
}

const ProfileAnalyzerView: React.FC<ProfileAnalyzerViewProps> = ({ settings }) => {
  const { user, userData, incrementUsage } = useAuth();
  const needsSubscription = user && userData && userData.status === 'pendente' && !userData.nalabiaPrimeAcess;

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  const [analysisResult, setAnalysisResult] = useState<{
    vibe: string;
    redFlags: string[];
    greenFlags: string[];
    icebreakers: string[];
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      setStatus(ProcessingState.PROCESSING);
      try {
        const newImages: string[] = [];
        for (const file of files) {
          const resizedBase64 = await resizeImage(file, 1024, 1024);
          newImages.push(resizedBase64);
        }
        setSelectedImages(prev => [...prev, ...newImages]);
        setAnalysisResult(null); // Reset previous analysis
        setErrorMsg(null);
      } catch (error) {
        console.error("Error resizing image:", error);
        setErrorMsg("Erro ao processar a imagem. Tente novamente.");
      } finally {
        setStatus(ProcessingState.IDLE);
      }
    }
  };

  const handleRemoveImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    if (selectedImages.length === 0) return;

    const isDeveloper = userData?.plano === 'Desenvolvedor';

    if (needsSubscription) {
      const userFreeMessages = userData?.freeMessagesUsed || 0;
      const deviceAllowed = await checkDeviceUsage();
      
      if (userFreeMessages >= 2 || !deviceAllowed) {
        setErrorMsg("Seu limite de 2 mensagens gratuitas foi atingido. Assine um plano para continuar usando o NaLábia.");
        return;
      }
    } else if (!isDeveloper) {
      const today = new Date().toISOString().split('T')[0];
      if (userData?.lastRequestDate === today && (userData?.dailyRequests || 0) >= 1000) {
        setErrorMsg("Você atingiu o limite de segurança de 1000 requisições. Volte amanhã para continuar!");
        return;
      }
    }

    setStatus(ProcessingState.ANALYZING);
    setErrorMsg(null);
    try {
      const data = await analyzeProfile(selectedImages, settings);

      setAnalysisResult({
        vibe: data.vibe || "Vibe não detectada.",
        redFlags: Array.isArray(data.redFlags) ? data.redFlags : [],
        greenFlags: Array.isArray(data.greenFlags) ? data.greenFlags : [],
        icebreakers: Array.isArray(data.icebreakers) ? data.icebreakers : []
      });

      await incrementUsage();
      if (needsSubscription) {
        await incrementDeviceUsage();
      }

    } catch (error: any) {
      console.error("Profile Analysis Error:", error);
      let errorMessage = "Erro ao analisar o perfil. Tente novamente.";
      if (error?.message) {
        if (typeof error.message === 'string') {
          if (error.message.includes("429") || error.message.includes("Rate limit")) {
            errorMessage = "Limite de requisições da API excedido. Por favor, aguarde alguns instantes e tente novamente.";
          } else {
            errorMessage = error.message;
          }
        } else {
          errorMessage = JSON.stringify(error.message);
        }
      }
      setErrorMsg(errorMessage);
    } finally {
      setStatus(ProcessingState.IDLE);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getThemeInputBg = () => {
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-obsidian text-gray-200';
      case 'light': return 'bg-[#ffffff] text-gray-900 border-gray-300';
      case 'midnight': return 'bg-[#1e293b] text-gray-200';
      case 'dracula': return 'bg-[#44475a] text-[#f8f8f2]';
      case 'hacker': return 'bg-[#000000] text-[#00ff00] border-green-900';
      case 'cyberpunk': return 'bg-[#000000] text-[#fcee0a] border-yellow-900';
      case 'dark':
      default: return 'bg-obsidian text-gray-200';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto custom-scrollbar p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-obsidian-light rounded-xl border border-gold-dim/10">
          <ScanFace className="text-gold-glow" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Raio-X de Perfil</h2>
          <p className="text-sm text-gray-400">Envie um print do perfil dela e receba a análise completa e os melhores abridores.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <div className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-red-950/50 border border-red-900/50 text-red-400 p-4 rounded-xl text-sm font-mono">
              {errorMsg}
            </div>
          )}
          <div 
            className={`relative border-2 border-dashed rounded-2xl overflow-hidden transition-colors flex flex-col items-center justify-center min-h-[300px] ${
              selectedImages.length > 0 ? `border-gold-dim/20 ${getThemeInputBg().split(' ')[0]} p-4` : `border-gold-dim/20 ${getThemeInputBg().split(' ')[0]} hover:border-gold-glow/50 cursor-pointer`
            }`}
            onClick={() => selectedImages.length === 0 && fileInputRef.current?.click()}
          >
            {selectedImages.length > 0 ? (
              <div className="w-full h-full flex flex-col">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-gold-dim/10">
                      <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={(e) => handleRemoveImage(idx, e)}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-500/80 rounded-full text-white backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[3/4] rounded-lg border border-dashed border-gold-dim/20 flex flex-col items-center justify-center cursor-pointer hover:border-gold-glow/50 hover:bg-obsidian-light transition-colors"
                  >
                    <Upload size={24} className="text-gold-glow/50 mb-2" />
                    <span className="text-xs text-gray-500">Adicionar</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-6">
                <Upload size={48} className="mx-auto mb-4 text-gold-glow/50" />
                <p className="text-gray-300 font-medium mb-2">Toque para enviar prints</p>
                <p className="text-gray-500 text-sm">Tinder, Bumble, Instagram (Fotos + Bio)</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              multiple
              className="hidden" 
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={selectedImages.length === 0 || status !== ProcessingState.IDLE}
            className={`w-full py-4 rounded-xl font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${
              selectedImages.length === 0 || status !== ProcessingState.IDLE
                ? 'bg-obsidian-light text-gray-600 cursor-not-allowed border border-gold-dim/10'
                : 'bg-gold-glow text-black hover:bg-gold-glow/90 hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]'
            }`}
          >
            {status === ProcessingState.ANALYZING ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analisando Perfil...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Gerar Raio-X
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div className="flex flex-col gap-4">
          {analysisResult ? (
            <div className="space-y-6 animate-fade-in">
              {/* Vibe */}
              <div className={`${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 rounded-xl p-5`}>
                <h3 className="text-xs font-mono text-gold-glow uppercase tracking-widest mb-2">Vibe Detectada</h3>
                <p className="text-gray-200 text-sm leading-relaxed">
                  {typeof analysisResult.vibe === 'string' ? analysisResult.vibe : JSON.stringify(analysisResult.vibe)}
                </p>
              </div>

              {/* Flags */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4">
                  <h3 className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest mb-3">Green Flags</h3>
                  <ul className="space-y-2">
                    {Array.isArray(analysisResult.greenFlags) && analysisResult.greenFlags.map((flag, i) => (
                      <li key={i} className="text-xs text-emerald-100/80 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{typeof flag === 'string' ? flag : JSON.stringify(flag)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-4">
                  <h3 className="text-[10px] font-mono text-rose-500 uppercase tracking-widest mb-3">Red Flags</h3>
                  <ul className="space-y-2">
                    {Array.isArray(analysisResult.redFlags) && analysisResult.redFlags.map((flag, i) => (
                      <li key={i} className="text-xs text-rose-100/80 flex items-start gap-2">
                        <span className="text-rose-500 mt-0.5">•</span>
                        <span>{typeof flag === 'string' ? flag : JSON.stringify(flag)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Icebreakers */}
              <div className={`${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 rounded-xl p-5`}>
                <h3 className="text-xs font-mono text-gold-glow uppercase tracking-widest mb-4">Abridores Sugeridos</h3>
                <div className="space-y-3">
                  {Array.isArray(analysisResult.icebreakers) && analysisResult.icebreakers.map((icebreaker, i) => (
                    <div key={i} className={`${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 rounded-lg p-3 flex items-start justify-between group hover:border-gold-glow/30 transition-colors`}>
                      <p className="text-sm text-gray-300 pr-4">{typeof icebreaker === 'string' ? icebreaker : JSON.stringify(icebreaker)}</p>
                      <button
                        onClick={() => handleCopy(typeof icebreaker === 'string' ? icebreaker : JSON.stringify(icebreaker), i)}
                        className="text-gray-500 hover:text-gold-glow transition-colors p-1 flex-shrink-0"
                        title="Copiar Abridor"
                      >
                        {copiedIndex === i ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={`h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-gold-dim/20 rounded-2xl ${getThemeInputBg().split(' ')[0]} opacity-50`}>
              <ScanFace className="text-gray-600 mb-4" size={48} />
              <h3 className="text-xl font-bold text-gray-400 mb-2">Aguardando Perfil</h3>
              <p className="text-gray-500 max-w-sm text-sm">
                Faça o upload de um print para a IA analisar a personalidade e gerar abridores personalizados.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileAnalyzerView;
