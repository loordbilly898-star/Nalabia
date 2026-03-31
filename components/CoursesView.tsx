import React, { useState } from 'react';
import { BookOpen, ChevronRight, FileText, Lock, CheckCircle2, ArrowLeft, BookText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { courseContents } from '../data/coursesContent';

interface Course {
  id: string;
  title: string;
  author: string;
  description: string;
  modules: { title: string; duration: string }[];
  isNew?: boolean;
}

const COURSES: Course[] = [
  {
    id: 'mapa-seducao',
    title: 'O Mapa da Sedução: Como Manipular uma Mulher',
    author: 'Rafael Souza Ramos',
    description: 'Aprenda os caminhos ocultos da mente feminina e como guiar suas emoções para criar uma atração irresistível.',
    isNew: true,
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Fundamentos da Psicologia Feminina', duration: '15 min de leitura' },
      { title: 'Gatilhos de Atração', duration: '22 min de leitura' },
      { title: 'O Jogo do Desejo', duration: '18 min de leitura' }
    ]
  },
  {
    id: 'psicologia-sombria-3000',
    title: 'Psicologia Sombria: 3000 Técnicas',
    author: 'Flav O. L',
    description: 'Um arsenal completo para analisar, compreender e influenciar o comportamento humano em qualquer situação.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Leitura Fria e Quente', duration: '25 min de leitura' },
      { title: 'Persuasão Subliminar', duration: '30 min de leitura' },
      { title: 'Defesa contra Manipulação', duration: '20 min de leitura' }
    ]
  },
  {
    id: 'manual-proibido',
    title: 'O Manual Proibido',
    author: 'Nalábia Exclusivo',
    description: 'Técnicas avançadas para controlar, seduzir e manipular. Conteúdo restrito para quem busca domínio absoluto.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Controle de Frame', duration: '18 min de leitura' },
      { title: 'Sedução Acelerada', duration: '24 min de leitura' },
      { title: 'Ancoragem Emocional', duration: '21 min de leitura' }
    ]
  },
  {
    id: 'segredos-seducao',
    title: 'Segredos da Sedução Feminina',
    author: 'Flav O. L',
    description: 'Como conquistar uma mulher da maneira correta, entendendo seus desejos mais profundos e ocultos.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'O que elas realmente querem', duration: '16 min de leitura' },
      { title: 'Comunicação Não-Verbal', duration: '19 min de leitura' },
      { title: 'Escalação Física', duration: '22 min de leitura' }
    ]
  },
  {
    id: 'manipulacao-teste-infinito',
    title: 'Manipulação Feminina: O Teste Infinito 2',
    author: 'Nalábia Exclusivo',
    description: 'Como identificar, neutralizar e reverter os testes que as mulheres fazem constantemente.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Anatomia do Shit Test', duration: '20 min de leitura' },
      { title: 'Técnicas de Reversão', duration: '25 min de leitura' },
      { title: 'Mantendo o Poder', duration: '15 min de leitura' }
    ]
  },
  {
    id: 'teoria-manipulacao',
    title: 'A Teoria da Manipulação Feminina',
    author: 'Alexandre Rezende Vieira',
    description: 'Uma abordagem teórica e prática sobre como as dinâmicas de poder funcionam nos relacionamentos.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Dinâmicas de Poder', duration: '22 min de leitura' },
      { title: 'O Jogo de Valor', duration: '18 min de leitura' },
      { title: 'Estratégias de Longo Prazo', duration: '26 min de leitura' }
    ]
  },
  {
    id: 'psicologia-sombria-linguagem',
    title: 'Psicologia Sombria e Linguagem Corporal',
    author: 'Amanda Grapes',
    description: 'Compreenda a manipulação, traços de psicopatia e como ler a linguagem corporal como um livro aberto.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Microexpressões Faciais', duration: '24 min de leitura' },
      { title: 'Identificando Mentiras', duration: '28 min de leitura' },
      { title: 'Postura de Dominância', duration: '19 min de leitura' }
    ]
  },
  {
    id: 'manipular-linda',
    title: 'Como Manipular uma Mulher Linda',
    author: 'Nalábia Exclusivo',
    description: 'Estratégias específicas para lidar com mulheres de alto valor, criando uma relação benéfica para ambos.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Quebrando o Pedestal', duration: '21 min de leitura' },
      { title: 'Criando Conexão Real', duration: '23 min de leitura' },
      { title: 'O Bem de Ambos', duration: '17 min de leitura' }
    ]
  },
  {
    id: 'rei-da-cama',
    title: 'O Rei da Cama: Mestre dos Orgasmos',
    author: 'Nalábia Exclusivo',
    description: 'O segredo para levar qualquer mulher ao orgasmo. Técnicas físicas e mentais para prazer extremo.',
    isNew: true,
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'A Dança da Mente', duration: '25 min de leitura' },
      { title: 'O Toque Mágico', duration: '30 min de leitura' },
      { title: 'Orgasmo no Comando', duration: '20 min de leitura' }
    ]
  },
  {
    id: '16-frases',
    title: '16 Frases para Esquentar o Papo',
    author: 'Nalábia Exclusivo',
    description: 'Frases prontas e testadas para transicionar a conversa para o sexo de forma natural e irresistível.',
    modules: [
      { title: 'Descrição e Instalação do Conhecimento', duration: '12 min de leitura' },
      { title: 'Frases de Qualificação', duration: '10 min de leitura' },
      { title: 'Perguntas Sexuais Indiretas', duration: '12 min de leitura' },
      { title: 'Convites Irrecusáveis', duration: '15 min de leitura' }
    ]
  }
];

interface CoursesViewProps {
  onBack: () => void;
}

const CoursesView: React.FC<CoursesViewProps> = ({ onBack }) => {
  const { userData } = useAuth();
  const hasAccess = userData?.coursesAccess;
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeModule, setActiveModule] = useState<{course: Course, moduleIndex: number} | null>(null);

  if (activeModule) {
    const moduleData = activeModule.course.modules[activeModule.moduleIndex];
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed inset-0 z-[100] bg-[#050505] flex flex-col"
      >
        <div className="p-4 flex items-center justify-between border-b border-white/10 bg-black/50 backdrop-blur-md">
          <button 
            onClick={() => setActiveModule(null)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <h3 className="text-white font-bold truncate px-4 text-sm md:text-base">
            {moduleData.title}
          </h3>
          <div className="w-10" /> {/* Spacer */}
        </div>
        
        <div className="flex-1 overflow-y-auto pb-20 bg-white text-black">
          {/* Content Info */}
          <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-8 mt-4">
            <div className="border-b border-gray-200 pb-8">
              <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full mb-4 uppercase tracking-wider">
                Capítulo {activeModule.moduleIndex + 1}
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight font-serif">
                {moduleData.title}
              </h2>
              <div className="flex items-center gap-4 text-gray-500 text-sm md:text-base font-medium">
                <p>Livro: <span className="text-gray-800">{activeModule.course.title}</span></p>
                <span>•</span>
                <p className="flex items-center gap-1"><BookText size={16}/> {moduleData.duration}</p>
              </div>
            </div>
            
            <div 
              className="prose prose-lg md:prose-xl max-w-none text-gray-800 leading-relaxed font-serif course-content-html"
              dangerouslySetInnerHTML={{ __html: courseContents[activeModule.course.id]?.[activeModule.moduleIndex] || '<p>Conteúdo em desenvolvimento...</p>' }}
            />
            
            <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-2xl">
              <h4 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
                <BookOpen className="text-blue-600" size={20} />
                Nota do Autor ({activeModule.course.author})
              </h4>
              <p className="text-blue-800 leading-relaxed text-sm md:text-base">
                Revise este conteúdo pelo menos duas vezes antes de tentar aplicar na prática. O domínio vem da repetição e internalização dos conceitos. O conhecimento sem ação é apenas entretenimento.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (selectedCourse) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0a] text-white overflow-y-auto">
        <div className="p-4 border-b border-white/10 flex items-center gap-3 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10">
          <button 
            onClick={() => setSelectedCourse(null)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="font-bold truncate">{selectedCourse.title}</h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              {selectedCourse.title}
            </h1>
            <p className="text-gray-400 text-sm">Por {selectedCourse.author}</p>
          </div>

          <p className="text-gray-300 leading-relaxed">
            {selectedCourse.description}
          </p>

          <div className="space-y-4 mt-8">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <FileText className="text-blue-400" size={20} />
              Capítulos do Livro
            </h3>
            
            <div className="space-y-3">
              {selectedCourse.modules.map((mod, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setActiveModule({ course: selectedCourse, moduleIndex: idx })}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{mod.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{mod.duration}</p>
                    </div>
                  </div>
                  <FileText size={20} className="text-gray-600 group-hover:text-blue-400 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-white overflow-y-auto">
      <div className="p-6 space-y-2 border-b border-white/10">
        <h1 className="text-2xl font-black flex items-center gap-2">
          <BookOpen className="text-blue-500" size={28} />
          Academia Nalábia
        </h1>
        <p className="text-gray-400 text-sm">
          Domine a psicologia sombria, sedução e manipulação com os melhores materiais do mercado.
        </p>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {COURSES.map(course => (
          <div 
            key={course.id}
            onClick={() => hasAccess && setSelectedCourse(course)}
            className={`relative bg-white/5 border border-white/10 rounded-2xl p-5 overflow-hidden transition-all duration-300 ${hasAccess ? 'hover:bg-white/10 hover:border-blue-500/30 cursor-pointer group' : 'opacity-75 grayscale-[0.5]'}`}
          >
            {!hasAccess && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                <div className="bg-black/80 px-4 py-2 rounded-full flex items-center gap-2 border border-white/10">
                  <Lock size={16} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-300">Bloqueado</span>
                </div>
              </div>
            )}

            {course.isNew && (
              <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl z-0">
                NOVO
              </div>
            )}

            <div className="space-y-3 relative z-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                <BookOpen size={20} className="text-blue-400" />
              </div>
              
              <div>
                <h3 className="font-bold text-lg leading-tight group-hover:text-blue-400 transition-colors">{course.title}</h3>
                <p className="text-xs text-gray-500 mt-1">Por {course.author}</p>
              </div>

              <p className="text-sm text-gray-400 line-clamp-2">
                {course.description}
              </p>

              <div className="pt-4 flex items-center justify-between border-t border-white/10">
                <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <FileText size={14} />
                  {course.modules.length} Capítulos
                </span>
                <ChevronRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoursesView;
