import React, { useState } from 'react';
import { useAuth, UserAIProfile } from '../contexts/AuthContext';
import { Infinity as InfinityIcon, ArrowRight, Check } from 'lucide-react';

const SLIDES = [
  {
    title: "Bem-vindo ao Nalábia",
    subtitle: "Seu assistente de inteligência social.",
  },
  {
    title: "Analise conversas e stories automaticamente.",
    subtitle: "Entenda o contexto e a intenção por trás de cada mensagem.",
  },
  {
    title: "Receba respostas naturais prontas para enviar.",
    subtitle: "Aumente seu carisma e presença social com IA avançada.",
  },
  {
    title: "Treine sua inteligência social com IA.",
    subtitle: "Simule conversas e evolua suas habilidades de comunicação.",
  }
];

const QUESTIONS = [
  {
    id: 'goal',
    question: 'Qual seu principal objetivo usando o app?',
    options: [
      { value: 'melhorar conversas', label: 'Melhorar conversas' },
      { value: 'melhorar flerte', label: 'Melhorar flerte' },
      { value: 'conseguir encontros', label: 'Conseguir encontros' },
      { value: 'desenvolver presença social', label: 'Desenvolver presença social' },
      { value: 'aprender comunicação', label: 'Aprender comunicação' },
    ]
  },
  {
    id: 'experienceLevel',
    question: 'Qual seu nível atual em conversas sociais?',
    options: [
      { value: 'iniciante', label: 'Iniciante' },
      { value: 'intermediário', label: 'Intermediário' },
      { value: 'avançado', label: 'Avançado' },
    ]
  },
  {
    id: 'communicationStyle',
    question: 'Qual estilo de comunicação você prefere?',
    options: [
      { value: 'natural', label: 'Natural' },
      { value: 'misterioso', label: 'Misterioso' },
      { value: 'provocador', label: 'Provocador' },
      { value: 'elegante', label: 'Elegante' },
      { value: 'humorístico', label: 'Humorístico' },
    ]
  },
  {
    id: 'flirtLevel',
    question: 'Qual intensidade de flerte você prefere?',
    options: [
      { value: 'nenhum', label: 'Nenhum' },
      { value: 'leve', label: 'Leve' },
      { value: 'moderado', label: 'Moderado' },
      { value: 'ousado', label: 'Ousado' },
    ]
  },
  {
    id: 'responseLength',
    question: 'Você prefere respostas:',
    options: [
      { value: 'muito curtas', label: 'Muito curtas' },
      { value: 'equilibradas', label: 'Equilibradas' },
      { value: 'mais elaboradas', label: 'Mais elaboradas' },
    ]
  },
  {
    id: 'mainPlatform',
    question: 'Qual rede social você usa mais?',
    options: [
      { value: 'Instagram', label: 'Instagram' },
      { value: 'WhatsApp', label: 'WhatsApp' },
      { value: 'Tinder', label: 'Tinder' },
      { value: 'outras', label: 'Outras' },
    ]
  },
  {
    id: 'conversationGoal',
    question: 'Qual tipo de resultado você quer alcançar?',
    options: [
      { value: 'iniciar conversas', label: 'Iniciar conversas' },
      { value: 'manter conversas', label: 'Manter conversas' },
      { value: 'gerar encontros', label: 'Gerar encontros' },
      { value: 'recuperar conversa perdida', label: 'Recuperar conversa perdida' },
    ]
  }
];

export interface OnboardingViewProps {
  onComplete: (profileData: Omit<UserAIProfile, 'userID'>) => void;
  onSkip: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState<'presentation' | 'questionnaire'>('presentation');
  const [slideIndex, setSlideIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNextSlide = () => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex(prev => prev + 1);
    } else {
      setStep('questionnaire');
    }
  };

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    
    setTimeout(() => {
      if (questionIndex < QUESTIONS.length - 1) {
        setQuestionIndex(prev => prev + 1);
      } else {
        finishOnboarding({ ...answers, [questionId]: value });
      }
    }, 300);
  };

  const determinePersonalityType = (ans: Record<string, string>) => {
    const style = ans.communicationStyle;
    const flirt = ans.flirtLevel;
    
    if (style === 'misterioso' && flirt === 'ousado') return 'Sedutor';
    if (style === 'natural' && flirt === 'nenhum') return 'Analítico';
    if (style === 'provocador') return 'Confiante';
    if (style === 'humorístico') return 'Comunicador';
    return 'Explorador';
  };

  const finishOnboarding = async (finalAnswers: Record<string, string>) => {
    setIsSubmitting(true);
    const profileData: Omit<UserAIProfile, 'userID'> = {
      goal: finalAnswers.goal || '',
      experienceLevel: finalAnswers.experienceLevel || '',
      communicationStyle: finalAnswers.communicationStyle || '',
      flirtLevel: finalAnswers.flirtLevel || '',
      responseLength: finalAnswers.responseLength || '',
      mainPlatform: finalAnswers.mainPlatform || '',
      conversationGoal: finalAnswers.conversationGoal || '',
      personalityType: determinePersonalityType(finalAnswers),
    };
    
    setTimeout(() => {
      onComplete(profileData);
    }, 1000);
  };

  if (step === 'presentation') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-gray-200 font-sans p-4">
        <div className="w-full max-w-md p-8 bg-[#0a0a0a] rounded-2xl border border-nalabia-800 shadow-2xl flex flex-col items-center text-center min-h-[400px] justify-between transition-all duration-500 relative">
          <button 
            onClick={onSkip}
            className="absolute top-4 right-4 text-xs font-mono text-gray-500 hover:text-nalabia-gold transition-colors"
          >
            JÁ TENHO CONTA
          </button>
          
          <InfinityIcon className="text-nalabia-gold mb-8 mt-4" size={48} />
          
          <div className="flex-1 flex flex-col justify-center animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-4">{SLIDES[slideIndex].title}</h2>
            <p className="text-gray-400">{SLIDES[slideIndex].subtitle}</p>
          </div>

          <div className="w-full mt-8">
            <div className="flex justify-center space-x-2 mb-8">
              {SLIDES.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1 rounded-full transition-all duration-300 ${idx === slideIndex ? 'w-8 bg-nalabia-gold' : 'w-2 bg-gray-700'}`}
                />
              ))}
            </div>

            <button
              onClick={handleNextSlide}
              className="w-full py-4 px-4 bg-nalabia-gold text-black rounded-xl font-bold tracking-wider hover:bg-nalabia-gold-glow transition-colors flex items-center justify-center space-x-2"
            >
              <span>{slideIndex === SLIDES.length - 1 ? 'COMEÇAR' : 'PRÓXIMO'}</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = QUESTIONS[questionIndex];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-gray-200 font-sans p-4">
      <div className="w-full max-w-md p-8 bg-[#0a0a0a] rounded-2xl border border-nalabia-800 shadow-2xl flex flex-col">
        
        <div className="flex justify-between items-center mb-8">
          <span className="text-xs font-mono text-nalabia-gold">PERFIL IA</span>
          <span className="text-xs font-mono text-gray-500">{questionIndex + 1} / {QUESTIONS.length}</span>
        </div>

        <div className="w-full bg-gray-800 h-1 rounded-full mb-8">
          <div 
            className="bg-nalabia-gold h-1 rounded-full transition-all duration-500" 
            style={{ width: `${((questionIndex) / QUESTIONS.length) * 100}%` }}
          />
        </div>

        <h2 className="text-xl font-bold text-white mb-6 animate-fade-in">{currentQuestion.question}</h2>

        <div className="space-y-3 flex-1 overflow-y-auto">
          {currentQuestion.options.map((option) => {
            const isSelected = answers[currentQuestion.id] === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleAnswer(currentQuestion.id, option.value)}
                disabled={isSubmitting}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-200 flex justify-between items-center ${
                  isSelected 
                    ? 'border-nalabia-gold bg-nalabia-gold/10 text-nalabia-gold' 
                    : 'border-gray-800 bg-[#111] text-gray-300 hover:border-gray-600'
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={18} />}
              </button>
            );
          })}
        </div>

        {isSubmitting && (
          <div className="mt-8 text-center text-nalabia-gold text-sm font-mono animate-pulse">
            SINTETIZANDO PERFIL NEURAL...
          </div>
        )}

      </div>
    </div>
  );
};
