import React from 'react';
import { NalabiaResponse } from '../types';
import { Activity, Thermometer, Zap, AlertTriangle, Clock, Target, Ghost } from 'lucide-react';

interface AnalysisViewProps {
  analysis: NalabiaResponse;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis }) => {
  const renderProgressBar = (score: number, colorClass: string) => {
    return (
      <div className="w-full h-1.5 bg-obsidian-lighter rounded-full overflow-hidden mt-1">
        <div 
          className={`h-full ${colorClass}`} 
          style={{ width: `${score || 0}%` }}
        />
      </div>
    );
  };

  return (
    <div className="bg-obsidian-light border border-gold-dim/20 rounded-lg p-4 space-y-4 mb-6 shadow-lg shadow-black/50 animate-fade-in">
      {/* Header Reading */}
      <div className="border-b border-gold-dim/10 pb-3">
        <h3 className="text-xs font-mono text-gold-glow uppercase tracking-wider mb-1">
          <span className="animate-pulse mr-2">●</span>
          Leitura do Momento
        </h3>
        <p className="text-gray-200 text-sm font-medium leading-relaxed">
          {typeof analysis.momentReading === 'string' ? analysis.momentReading : JSON.stringify(analysis.momentReading)}
        </p>
      </div>

      {/* Visual Radar */}
      <div className="space-y-3 border-b border-gold-dim/10 pb-3">
        <div>
          <div className="flex justify-between text-[10px] font-mono uppercase text-gray-400 mb-1">
            <span>Interesse Dela</span>
            <span className="text-emerald-400">{typeof analysis.interestScore === 'number' || typeof analysis.interestScore === 'string' ? analysis.interestScore : 0}%</span>
          </div>
          {renderProgressBar(typeof analysis.interestScore === 'number' ? analysis.interestScore : parseInt(String(analysis.interestScore)) || 0, 'bg-emerald-400')}
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-mono uppercase text-gray-400 mb-1">
            <span>Investimento</span>
            <span className="text-blue-400">{typeof analysis.investmentScore === 'number' || typeof analysis.investmentScore === 'string' ? analysis.investmentScore : 0}%</span>
          </div>
          {renderProgressBar(typeof analysis.investmentScore === 'number' ? analysis.investmentScore : parseInt(String(analysis.investmentScore)) || 0, 'bg-blue-400')}
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] font-mono uppercase text-gray-400 mb-1">
              <span>Risco</span>
              <span className="text-red-400">{typeof analysis.riskScore === 'number' || typeof analysis.riskScore === 'string' ? analysis.riskScore : 0}%</span>
            </div>
            {renderProgressBar(typeof analysis.riskScore === 'number' ? analysis.riskScore : parseInt(String(analysis.riskScore)) || 0, 'bg-red-400')}
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[10px] font-mono uppercase text-gray-400 mb-1">
              <span>Encontro</span>
              <span className="text-gold">{typeof analysis.meetingChance === 'number' || typeof analysis.meetingChance === 'string' ? analysis.meetingChance : 0}%</span>
            </div>
            {renderProgressBar(typeof analysis.meetingChance === 'number' ? analysis.meetingChance : parseInt(String(analysis.meetingChance)) || 0, 'bg-gold')}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Emotion */}
        <div className="bg-obsidian/50 p-2 rounded border border-gold-dim/10">
          <div className="flex items-center space-x-2 mb-1">
            <Activity size={14} className="text-blue-400" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Emoção</span>
          </div>
          <div className="text-sm font-semibold text-blue-100">{typeof analysis.emotion === 'string' ? analysis.emotion : JSON.stringify(analysis.emotion)}</div>
        </div>

        {/* Dynamic */}
        <div className="bg-obsidian/50 p-2 rounded border border-gold-dim/10">
          <div className="flex items-center space-x-2 mb-1">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Dinâmica</span>
          </div>
          <div className="text-xs text-gray-300">{typeof analysis.dynamic === 'string' ? analysis.dynamic : JSON.stringify(analysis.dynamic)}</div>
        </div>

        {/* Risk & Rhythm */}
        <div className="bg-obsidian/50 p-2 rounded border border-gold-dim/10">
          <div className="flex items-center space-x-2 mb-1">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Risco</span>
          </div>
          <div className="text-xs text-red-100 leading-tight">{typeof analysis.risk === 'string' ? analysis.risk : JSON.stringify(analysis.risk)}</div>
        </div>
        
        <div className="bg-obsidian/50 p-2 rounded border border-gold-dim/10">
           <div className="flex items-center space-x-2 mb-1">
            <Clock size={14} className="text-gold-glow" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Ritmo</span>
          </div>
          <div className="text-sm font-bold text-gold-glow">{typeof analysis.rhythm === 'string' ? analysis.rhythm : JSON.stringify(analysis.rhythm)}</div>
        </div>
      </div>

      {/* No Reply Warning */}
      {analysis.shouldReply === false && (
        <div className="bg-blue-900/40 border border-blue-500/50 rounded-lg p-3 flex items-start space-x-3 mb-2 animate-pulse">
          <div className="bg-blue-500 p-1.5 rounded-full mt-0.5">
            <Ghost size={14} className="text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1">Estratégia: Sem Resposta</h4>
            <p className="text-[11px] text-blue-100 leading-snug">
              A última mensagem identificada é sua. O NaLábia recomenda aguardar o movimento dela para não parecer ansioso ou reativo.
            </p>
          </div>
        </div>
      )}

      {/* Suggested Timing & Error Alert */}
      {(analysis.suggestedTiming || analysis.errorAlert) && (
        <div className="space-y-2 border-t border-gold-dim/10 pt-3">
          {analysis.suggestedTiming && (
            <div className="bg-obsidian/50 p-2 rounded border border-blue-500/20">
              <div className="flex items-center space-x-2 mb-1 text-blue-400">
                <Clock size={12} />
                <span className="text-[10px] uppercase font-mono">Timing Ideal de Resposta</span>
              </div>
              <div className="text-xs text-blue-100">{typeof analysis.suggestedTiming === 'string' ? analysis.suggestedTiming : JSON.stringify(analysis.suggestedTiming)}</div>
            </div>
          )}
          {analysis.errorAlert && (
            <div className="bg-red-950/30 p-2 rounded border border-red-500/30">
              <div className="flex items-center space-x-2 mb-1 text-red-400">
                <AlertTriangle size={12} />
                <span className="text-[10px] uppercase font-mono font-bold">Alerta Crítico</span>
              </div>
              <div className="text-xs text-red-200">{typeof analysis.errorAlert === 'string' ? analysis.errorAlert : JSON.stringify(analysis.errorAlert)}</div>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] font-mono text-gray-600 text-right uppercase mt-2">
        Modo: {typeof analysis.detectedMode === 'string' ? analysis.detectedMode : JSON.stringify(analysis.detectedMode)}
      </div>
    </div>
  );
};

export default AnalysisView;
