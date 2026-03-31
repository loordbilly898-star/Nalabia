import React from 'react';
import { NalábiaAnalysis } from '../types';
import { Activity, Thermometer, Zap, AlertTriangle, Clock, Target } from 'lucide-react';

interface AnalysisViewProps {
  analysis: NalábiaAnalysis;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ analysis }) => {
  const renderProgressBar = (score: number, colorClass: string) => {
    return (
      <div className="w-full h-1.5 bg-nalabia-900 rounded-full overflow-hidden mt-1">
        <div 
          className={`h-full ${colorClass}`} 
          style={{ width: `${score || 0}%` }}
        />
      </div>
    );
  };

  return (
    <div className="bg-nalabia-800 border border-nalabia-600 rounded-lg p-4 space-y-4 mb-6 shadow-lg shadow-nalabia-900/50 animate-fade-in">
      {/* Header Reading */}
      <div className="border-b border-nalabia-700 pb-3">
        <h3 className="text-xs font-mono text-nalabia-glow uppercase tracking-wider mb-1">
          <span className="animate-pulse mr-2">●</span>
          Leitura do Momento
        </h3>
        <p className="text-gray-200 text-sm font-medium leading-relaxed">
          {typeof analysis.momentReading === 'string' ? analysis.momentReading : JSON.stringify(analysis.momentReading)}
        </p>
      </div>

      {/* Visual Radar */}
      <div className="space-y-3 border-b border-nalabia-700 pb-3">
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
              <span className="text-nalabia-gold">{typeof analysis.meetingChance === 'number' || typeof analysis.meetingChance === 'string' ? analysis.meetingChance : 0}%</span>
            </div>
            {renderProgressBar(typeof analysis.meetingChance === 'number' ? analysis.meetingChance : parseInt(String(analysis.meetingChance)) || 0, 'bg-nalabia-gold')}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Emotion */}
        <div className="bg-nalabia-900/50 p-2 rounded border border-nalabia-700/50">
          <div className="flex items-center space-x-2 mb-1">
            <Activity size={14} className="text-blue-400" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Emoção</span>
          </div>
          <div className="text-sm font-semibold text-blue-100">{typeof analysis.emotion === 'string' ? analysis.emotion : JSON.stringify(analysis.emotion)}</div>
        </div>

        {/* Dynamic */}
        <div className="bg-nalabia-900/50 p-2 rounded border border-nalabia-700/50">
          <div className="flex items-center space-x-2 mb-1">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Dinâmica</span>
          </div>
          <div className="text-xs text-gray-300">{typeof analysis.dynamic === 'string' ? analysis.dynamic : JSON.stringify(analysis.dynamic)}</div>
        </div>

        {/* Risk & Rhythm */}
        <div className="bg-nalabia-900/50 p-2 rounded border border-nalabia-700/50">
          <div className="flex items-center space-x-2 mb-1">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Risco</span>
          </div>
          <div className="text-xs text-red-100 leading-tight">{typeof analysis.risk === 'string' ? analysis.risk : JSON.stringify(analysis.risk)}</div>
        </div>
        
        <div className="bg-nalabia-900/50 p-2 rounded border border-nalabia-700/50">
           <div className="flex items-center space-x-2 mb-1">
            <Clock size={14} className="text-nalabia-glow" />
            <span className="text-[10px] uppercase text-gray-400 font-mono">Ritmo</span>
          </div>
          <div className="text-sm font-bold text-nalabia-glow">{typeof analysis.rhythm === 'string' ? analysis.rhythm : JSON.stringify(analysis.rhythm)}</div>
        </div>
      </div>

      <div className="text-[10px] font-mono text-gray-600 text-right uppercase mt-2">
        Modo: {typeof analysis.detectedMode === 'string' ? analysis.detectedMode : JSON.stringify(analysis.detectedMode)}
      </div>
    </div>
  );
};

export default AnalysisView;
