import React from 'react';
import { LaboratorySimulation } from '../types';
import { FlaskConical, Target, Brain, AlertTriangle, MessageSquare, ArrowRight, Zap } from 'lucide-react';

interface LaboratoryViewProps {
  simulation: LaboratorySimulation;
}

const LaboratoryView: React.FC<LaboratoryViewProps> = ({ simulation }) => {
  return (
    <div className="bg-gray-900 border border-nalabia-gold/30 rounded-lg p-5 mt-4 animate-fade-in relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <FlaskConical size={100} />
      </div>

      <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-2">
        <FlaskConical className="text-nalabia-gold" size={16} />
        <h3 className="text-xs font-mono font-bold text-nalabia-gold uppercase tracking-[0.2em]">Laboratório de Simulação</h3>
      </div>

      {/* Variations */}
      <div className="space-y-4 mb-6">
        <h4 className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2">Variações Estratégicas</h4>
        <div className="space-y-3">
          {(Array.isArray(simulation.variations) ? simulation.variations : []).map((variant, idx) => (
            <div key={idx} className="bg-black/40 border border-gray-800 rounded p-3 hover:border-nalabia-gold/20 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[9px] px-2 py-0.5 rounded border ${
                  variant.style === 'Confiante' ? 'border-blue-900 text-blue-400 bg-blue-900/10' :
                  variant.style === 'Provocante' ? 'border-red-900 text-red-400 bg-red-900/10' :
                  'border-purple-900 text-purple-400 bg-purple-900/10'
                } font-mono uppercase`}>
                  {variant.style}
                </span>
                <div className="flex gap-2 text-[8px] font-mono text-gray-500">
                  <span title="Atração">🔥 {variant.impact?.attraction}</span>
                  <span title="Risco">⚠️ {variant.impact?.risk}</span>
                </div>
              </div>
              <p className="text-sm text-gray-200 mb-2 font-medium">"{typeof variant.text === 'string' ? variant.text : JSON.stringify(variant.text)}"</p>
              <p className="text-[9px] text-gray-500 italic border-l-2 border-gray-700 pl-2">
                {typeof variant.bestScenario === 'string' ? variant.bestScenario : JSON.stringify(variant.bestScenario)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Prediction Engine */}
      <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="text-purple-400" size={14} />
          <h4 className="text-[10px] text-purple-200 font-mono uppercase tracking-wider">Motor de Predição</h4>
        </div>
        
        <div className="space-y-3">
          <div>
            <div className="text-[9px] text-gray-500 font-mono uppercase mb-1">Reação Provável</div>
            <div className="flex items-start gap-2">
              <ArrowRight size={12} className="mt-1 text-gray-600" />
              <p className="text-xs text-gray-300">{typeof simulation.prediction?.likelyResponse === 'string' ? simulation.prediction.likelyResponse : JSON.stringify(simulation.prediction?.likelyResponse)}</p>
            </div>
          </div>
          
          <div>
            <div className="text-[9px] text-gray-500 font-mono uppercase mb-1">Se ela testar você</div>
            <div className="flex items-start gap-2">
              <AlertTriangle size={12} className="mt-1 text-yellow-600" />
              <p className="text-xs text-gray-400">{typeof simulation.prediction?.alternativeResponse === 'string' ? simulation.prediction.alternativeResponse : JSON.stringify(simulation.prediction?.alternativeResponse)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-700/30">
            <div>
              <div className="text-[8px] text-gray-600 font-mono uppercase mb-1">Se silêncio</div>
              <p className="text-[10px] text-gray-400">{typeof simulation.prediction?.adviceIfSilence === 'string' ? simulation.prediction.adviceIfSilence : JSON.stringify(simulation.prediction?.adviceIfSilence)}</p>
            </div>
             <div>
              <div className="text-[8px] text-gray-600 font-mono uppercase mb-1">Se resposta positiva</div>
              <p className="text-[10px] text-gray-400">{typeof simulation.prediction?.adviceIfResponse === 'string' ? simulation.prediction.adviceIfResponse : JSON.stringify(simulation.prediction?.adviceIfResponse)}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-2 text-center">
         <span className="text-[8px] text-gray-600 font-mono uppercase">Simulação baseada em comportamento provável</span>
      </div>
    </div>
  );
};

export default LaboratoryView;
