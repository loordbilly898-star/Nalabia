import React, { useState, useRef } from 'react';
import { AlertTriangle, ShieldAlert, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { getGeminiAI, handleGeminiError } from '../services/gemini';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import { AppSettings, ProcessingState } from '../types';
import { checkDeviceUsage, incrementDeviceUsage } from '../services/antiFraud';
import { useAuth } from '../contexts/AuthContext';

interface RedFlagDetectorViewProps {
  settings: AppSettings;
}

const RedFlagDetectorView: React.FC<RedFlagDetectorViewProps> = ({ settings }) => {
  const { user, userData, incrementUsage } = useAuth();
  const needsSubscription = user && userData && userData.status === 'pendente' && !userData.nalabiaPrimeAcess;

  const [chatHistory, setChatHistory] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    ghostingProbability: number;
    toxicityLevel: 'Baixo' | 'Médio' | 'Alto';
    redFlags: string[];
    greenFlags: string[];
    verdict: string;
    advice: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      const newImages: string[] = [];
      let loadedCount = 0;
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newImages.push(reader.result as string);
          loadedCount++;
          if (loadedCount === files.length) {
            setSelectedImages(prev => [...prev, ...newImages]);
            setAnalysisResult(null);
            setErrorMsg(null);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    if (!chatHistory.trim() && selectedImages.length === 0) return;

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
      if (userData?.lastRequestDate === today && (userData?.dailyRequests || 0) >= 50) {
        setErrorMsg("Você atingiu o limite diário de 50 requisições. Volte amanhã para continuar usando a IA!");
        return;
      }
    }

    setStatus(ProcessingState.ANALYZING);
    setErrorMsg(null);
    try {
      const ai = getGeminiAI(settings);
      
      const imageParts = selectedImages.map(img => ({
        inlineData: { data: img.split(',')[1], mimeType: 'image/jpeg' }
      }));

      const prompt = `Você é um especialista em psicologia comportamental e relacionamentos.
Analise a seguinte interação entre um homem (o usuário) e uma mulher.
Identifique "Red Flags" (sinais de alerta de toxicidade, desinteresse, manipulação ou problemas emocionais) e "Green Flags" (sinais de interesse genuíno, maturidade).
Calcule a probabilidade de "Ghosting" (ela parar de responder) e o nível de toxicidade da interação.

${chatHistory.trim() ? `Histórico em texto:\n${chatHistory}\n` : ''}
${selectedImages.length > 0 ? `Analise também os prints de tela anexados.\n` : ''}

Retorne APENAS um JSON válido com a seguinte estrutura:
{
  "ghostingProbability": 0 a 100,
  "toxicityLevel": "Baixo" | "Médio" | "Alto",
  "redFlags": ["Sinal de alerta 1", "Sinal de alerta 2"],
  "greenFlags": ["Sinal positivo 1", "Sinal positivo 2"],
  "verdict": "Um resumo direto e brutalmente honesto da situação (ex: 'Ela está te usando para validação' ou 'Ela está muito interessada, mas você está sendo muito carente').",
  "advice": "O que o usuário deve fazer agora (ex: 'Dê um passo para trás e espere ela investir' ou 'Chame ela para sair agora')."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          ...imageParts,
          { text: prompt }
        ],
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 8192,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
          ]
        }
      });

      let text = response.text;
      if (text) {
        // Remove potential markdown formatting
        text = text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        try {
          const parsed = JSON.parse(text);
          setAnalysisResult(parsed);
        } catch (e) {
          console.error("Failed to parse JSON:", text);
          throw new Error("A IA retornou um formato inválido.");
        }
      } else {
        throw new Error("Resposta vazia da IA.");
      }

      await incrementUsage();
      if (needsSubscription) {
        await incrementDeviceUsage();
      }

    } catch (error: any) {
      console.error("Red Flag Analysis Error:", error);
      let finalError = error;
      try {
        await handleGeminiError(error);
      } catch (e) {
        finalError = e;
      }
      setErrorMsg(finalError.message || "Erro ao analisar a conversa. Tente novamente.");
    } finally {
      setStatus(ProcessingState.IDLE);
    }
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
        <div className="p-3 bg-rose-900/20 rounded-xl border border-rose-900/50">
          <AlertTriangle className="text-rose-500" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Detector de Red Flags</h2>
          <p className="text-sm text-gray-400">Cole o histórico da conversa e descubra se você está prestes a tomar ghosting ou se ela é tóxica.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="flex flex-col gap-4">
          {errorMsg && (
            <div className="bg-red-950/50 border border-red-900/50 text-red-400 p-4 rounded-xl text-sm font-mono">
              {errorMsg}
            </div>
          )}
          <div className="flex-1 min-h-[200px] flex flex-col">
            <textarea
              value={chatHistory}
              onChange={(e) => setChatHistory(e.target.value)}
              placeholder="Cole aqui o histórico da conversa do WhatsApp ou Instagram...&#10;&#10;Exemplo:&#10;Você: Oi, tudo bem?&#10;Ela: Tudo e vc?&#10;Você: O que vai fazer hoje?&#10;Ela: Nada"
              className={`flex-1 w-full ${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 rounded-2xl p-4 text-gray-300 focus:outline-none focus:border-rose-500/50 resize-none custom-scrollbar font-mono text-sm leading-relaxed`}
            />
          </div>

          <div 
            className={`relative border-2 border-dashed rounded-2xl overflow-hidden transition-colors flex flex-col items-center justify-center min-h-[120px] ${
              selectedImages.length > 0 ? `border-gold-dim/20 ${getThemeInputBg().split(' ')[0]} p-4` : `border-gold-dim/20 ${getThemeInputBg().split(' ')[0]} hover:border-rose-500/50 cursor-pointer`
            }`}
            onClick={() => selectedImages.length === 0 && fileInputRef.current?.click()}
          >
            {selectedImages.length > 0 ? (
              <div className="w-full h-full flex flex-col">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto max-h-[200px] custom-scrollbar pr-1">
                  {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-gold-dim/10">
                      <img src={img} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        onClick={(e) => handleRemoveImage(idx, e)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-500/80 rounded-full text-white backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[3/4] rounded-lg border border-dashed border-gold-dim/20 flex flex-col items-center justify-center cursor-pointer hover:border-rose-500/50 hover:bg-rose-900/10 transition-colors"
                  >
                    <Upload size={20} className="text-rose-500/50 mb-1" />
                    <span className="text-[10px] text-gray-500">Adicionar</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-4">
                <Upload size={24} className="mx-auto mb-2 text-rose-500/50" />
                <p className="text-gray-300 font-medium text-sm">Ou adicione prints da conversa</p>
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
            disabled={(!chatHistory.trim() && selectedImages.length === 0) || status !== ProcessingState.IDLE}
            className={`w-full py-4 rounded-xl font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all ${
              (!chatHistory.trim() && selectedImages.length === 0) || status !== ProcessingState.IDLE
                ? 'bg-obsidian-light text-gray-600 cursor-not-allowed border border-gold-dim/10'
                : 'bg-rose-900/50 text-rose-400 border border-rose-900/50 hover:bg-rose-900/80 hover:text-white hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]'
            }`}
          >
            {status === ProcessingState.ANALYZING ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analisando Toxicidade...
              </>
            ) : (
              <>
                <ShieldAlert size={18} />
                Detectar Red Flags
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div className="flex flex-col gap-4">
          {analysisResult ? (
            <div className="space-y-6 animate-fade-in">
              {/* Top Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 rounded-xl p-5 flex flex-col items-center justify-center text-center`}>
                  <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Chance de Ghosting</h3>
                  <div className={`text-4xl font-bold font-mono ${
                    analysisResult.ghostingProbability > 70 ? 'text-rose-500' :
                    analysisResult.ghostingProbability > 40 ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {analysisResult.ghostingProbability}%
                  </div>
                </div>
                <div className={`${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 rounded-xl p-5 flex flex-col items-center justify-center text-center`}>
                  <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Nível de Toxicidade</h3>
                  <div className={`text-2xl font-bold font-mono uppercase tracking-wider ${
                    analysisResult.toxicityLevel === 'Alto' ? 'text-rose-500' :
                    analysisResult.toxicityLevel === 'Médio' ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {analysisResult.toxicityLevel}
                  </div>
                </div>
              </div>

              {/* Verdict & Advice */}
              <div className={`${getThemeInputBg().split(' ')[0]} border border-gold-dim/10 rounded-xl p-5 space-y-4`}>
                <div>
                  <h3 className="text-xs font-mono text-gold-glow uppercase tracking-widest mb-2">Veredito</h3>
                  <p className="text-gray-200 text-sm leading-relaxed">{analysisResult.verdict}</p>
                </div>
                <div className="pt-4 border-t border-gold-dim/10">
                  <h3 className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">O que fazer agora</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{analysisResult.advice}</p>
                </div>
              </div>

              {/* Flags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-4">
                  <h3 className="text-[10px] font-mono text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertTriangle size={12} /> Red Flags
                  </h3>
                  {analysisResult.redFlags.length > 0 ? (
                    <ul className="space-y-2">
                      {analysisResult.redFlags.map((flag, i) => (
                        <li key={i} className="text-xs text-rose-100/80 flex items-start gap-2">
                          <span className="text-rose-500 mt-0.5">•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Nenhuma red flag detectada.</p>
                  )}
                </div>
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4">
                  <h3 className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles size={12} /> Green Flags
                  </h3>
                  {analysisResult.greenFlags.length > 0 ? (
                    <ul className="space-y-2">
                      {analysisResult.greenFlags.map((flag, i) => (
                        <li key={i} className="text-xs text-emerald-100/80 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Nenhuma green flag detectada.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-gold-dim/20 rounded-2xl ${getThemeInputBg().split(' ')[0]} opacity-50`}>
              <AlertTriangle className="text-gray-600 mb-4" size={48} />
              <h3 className="text-xl font-bold text-gray-400 mb-2">Aguardando Histórico</h3>
              <p className="text-gray-500 max-w-sm text-sm">
                Cole a conversa ao lado para a IA analisar o comportamento dela e detectar possíveis red flags ou ghosting iminente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RedFlagDetectorView;
