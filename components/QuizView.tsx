import React, { useState, useEffect } from "react";
import { ChevronRight, Camera, MessageSquare, BriefcaseMedical, CheckCircle2 } from "lucide-react";
import { safeFetchJson } from "../utils/apiHelper";

interface QuizViewProps {
  onFinish: () => void;
  onGoToLogin: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ onFinish, onGoToLogin }) => {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<any>({});
  const [profile, setProfile] = useState<any>(null);
  const [freeUses, setFreeUses] = useState(3);
  const [trialChat, setTrialChat] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [countdown, setCountdown] = useState(600);
  const [chatResponse, setChatResponse] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showPaywall && countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [showPaywall, countdown]);

  const saveAnswer = (key: string, val: any) => {
    setAnswers({ ...answers, [key]: val });
  };

  const nextStep = (target: number) => {
    setStep(target);
  };

  const calculateProfile = () => {
    const labia = parseInt(answers.labia || "0");
    const encontros = parseInt(answers.encontros || "0");
    const obj = answers.objetivo || "";
    const idade = answers.idade || "";
    const dor = answers.dor || "";

    // NIVEL
    let nivel = "intermediario";
    if (labia <= 3 || encontros === 0) nivel = "iniciante";
    else if (labia >= 8 || encontros >= 4) nivel = "avancado";

    // TOM
    let tom = "direto";
    if (obj === "Sério") tom = "romantico";
    if (obj === "Diversão") tom = "leve";
    if (obj === "Pegação") tom = "ousado";
    if (obj === "Reconquistar") tom = "estrategico";

    // OUSADIA
    let ousadia = labia;
    if (obj === "Pegação") ousadia += 2;
    if (obj === "Casual") ousadia += 1;
    if (obj === "Sério" || obj === "Reconquistar") ousadia -= 2;
    if (ousadia < 1) ousadia = 1;
    if (ousadia > 10) ousadia = 10;

    // VOCABULARIO
    let vocab = "moderno";
    if (idade === "18-24") vocab = "casual";
    if (idade === "31-40" || idade === "40+") vocab = "maduro";

    // FOCO
    let foco = "manter_chama";
    if (dor === "travado") foco = "abertura";
    if (dor === "sumida") foco = "manter_chama";
    if (dor === "encontro") foco = "fechar_encontro";
    if (dor === "semsal") foco = "humor";
    if (obj === "Reconquistar") foco = "reconquista";
    if (dor === "print") foco = "interpretar_print";

    const p = { nivel, tom, ousadia, vocabulario: vocab, foco_estrategico: foco };
    setProfile(p);
    localStorage.setItem("nalabia_profile", JSON.stringify(p));
    localStorage.setItem("nalabia_quiz", JSON.stringify(answers));
    localStorage.setItem("nalabia_free_uses", "3");
  };

  const finishQuiz = () => {
    setStep(8);
    calculateProfile();
    setTimeout(() => {
      setStep(9);
    }, 3000);
  };

  const formatCountdown = () => {
    const m = Math.floor(countdown / 60).toString().padStart(2, "0");
    const s = (countdown % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const mockResponses: any = {
    print: "🔥 A IA analisou: Ela está te testando pra ver sua confiança. Responda: 'Gostei da atitude. Mas na vida real você também tem toda essa marra ou é só por aqui? 😏'",
    gelo: "🧊 Quebra-gelo gerado: 'Acabei de decidir que vamos pular a fase do oi tudo bem e ir direto pra parte que brigamos pra escolher o que assistir na Netflix🍿'",
    conselho: "🤔 Conselho Tático: Se ela deu vácuo, não mande '??'. Espere 48h e mande um meme situacional sem cobrar resposta. Tire a pressão e inverta o frame."
  };

  const [activeTrialMode, setActiveTrialMode] = useState<string | null>(null);
  const [trialText, setTrialText] = useState("");
  const [trialImage, setTrialImage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTrialImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const executeRealTrial = async () => {
    if (freeUses <= 0) {
      setShowPaywall(true);
      return;
    }
    
    if (activeTrialMode === 'conselho' && !trialText.trim()) return;
    if (activeTrialMode === 'print' && !trialImage) return;

    setFreeUses(freeUses - 1);
    localStorage.setItem("nalabia_free_uses", String(freeUses - 1));
    setTrialChat("loading");
    setChatResponse(null);

    try {
      const p = JSON.parse(localStorage.getItem('nalabia_profile') || '{}');
      
      let prompt = `
      Você é a inteligência artificial NaLábia. Mostre seu poder de resposta tática avançada. Não seja genérico.
      
      CONFIGURAÇÃO DE PERFIL:
      - Nível: ${p.nivel}
      - Tom: ${p.tom}
      - Ousadia: ${p.ousadia}/10
      - Foco Estratégico: ${p.foco_estrategico}
      
      Diretriz: Você está em um 'Test Drive' gratuito. Dê 1 (uma) única resposta ou conselho magistral, rápido e de impacto. Mostre autoridade.

      ⚠️ REGRAS DE LINGUAGEM E FORMATAÇÃO (RIGOROSO):
      - NÃO use formatação Markdown. PROIBIDO usar asteriscos (* ou **), hashtags (#), sublinhados (_), ou itálicos (*).
      - Use APENAS texto puro na resposta.
      - NÃO use palavras em inglês (como briefing, target, mindset, insight, etc). Use apenas português simples, casual e 100% natural do Brasil.
      - A resposta deve parecer uma mensagem normal. Não explique demais.

`;

      if (activeTrialMode === 'print') {
        prompt += `CONTEXTO (PRINT): Analise a imagem. A usuária (mulher) está na esquerda e o usuário (eu) na direita. Me diga EXATAMENTE qual a próxima mensagem eu devo enviar agora. Sem aspas e sem markdown.`;
        if (trialText) prompt += `\nObservações minhas: ${trialText}`;
      } else if (activeTrialMode === 'gelo') {
        prompt += `CONTEXTO (QUEBRA GELO): Crie a melhor mensagem de abertura possível para essa situação.\nContexto: ${trialText}`;
      } else {
        prompt += `CONTEXTO (CONSELHEIRO): Analise essa situação e me dê um conselho estratégico pratico e direto.\nSituação: ${trialText}`;
      }

      let content: any = [{ type: "text", text: prompt }];

      if (trialImage) {
        content.push({ type: "image_url", imageUrl: { url: trialImage } });
      }

      const response = await safeFetchJson("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: trialImage ? "pixtral-12b-2409" : "mistral-large-latest",
          messages: [{ role: "user", content }]
        }),
      });

      if (!response.ok || !response.data?.choices?.[0]?.message?.content) {
        throw new Error(response.error || "Erro na API.");
      }
      
      const reply = response.data.choices[0].message.content;

      setTrialChat("done");
      setChatResponse(reply);
      
      if (freeUses - 1 === 2) {
         // Do nothing
      } else if (freeUses - 1 === 0) {
        localStorage.setItem("nalabia_trial_done", "true");
        setTimeout(() => setShowPaywall(true), 12000); // 12s para conseguir ler
      }

    } catch (e: any) {
      setTrialChat("done");
      setChatResponse("Ocorreu um erro ao gerar a resposta. Tente novamente.");
      setFreeUses(freeUses); // reimburse try
    }
  };

  const useTrial = (type: string) => {
    if (freeUses <= 0) {
      setShowPaywall(true);
      return;
    }
    setActiveTrialMode(type);
    setTrialChat("");
    setChatResponse(null);
    setTrialText("");
    setTrialImage(null);
  };

  const handleSignup = () => {
    localStorage.setItem("nalabia_from_quiz", "true");
    onFinish();
  };

  const nomes: any = {
    travado: "O Travado 😶",
    sumida: "O Sumido 👻",
    encontro: "O Quase Lá 📅",
    semsal: "O Sem Sal 😴",
    print: "O Decifrador 🖼️"
  };

  const focos: any = {
    abertura: "Primeiras mensagens matadoras",
    manter_chama: "Manter a conversa quente",
    fechar_encontro: "Marcar encontro com naturalidade",
    humor: "Conversas mais divertidas",
    reconquista: "Estratégia de reconquista nua e crua",
    interpretar_print: "Decifrar o que ela quis dizer"
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex flex-col items-center overflow-x-hidden relative">
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-800 z-50">
        <div 
          className="h-full bg-yellow-500 transition-all duration-300 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
          style={{ width: `${(step / 10) * 100}%` }}
        ></div>
      </div>

      <div className="w-full max-w-lg px-6 py-12 flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        {step === 1 && (
          <div className="text-center">
            <h2 className="text-3xl font-black mb-4 leading-tight">Pare de perder match no 'oi, tudo bem?' 😮‍💨</h2>
            <p className="text-gray-400 mb-8 text-lg">Descubra em 60s qual seu nível de lábia e a estratégia certa para você dominar conversas.</p>
            <button onClick={() => nextStep(2)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-wide py-4 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_20px_rgba(234,179,8,0.3)]">
              Começar <ChevronRight className="inline ml-1" size={20} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-2xl font-black mb-6 text-center">Qual sua idade?</h3>
            <div className="space-y-3">
              {['18-24', '25-30', '31-40', '40+'].map(idade => (
                <button
                  key={idade}
                  onClick={() => { saveAnswer('idade', idade); nextStep(3); }}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-yellow-500 hover:bg-gray-800 text-white rounded-xl py-4 px-6 font-medium transition-all text-left"
                >
                  {idade === '40+' ? '40+ anos' : `${idade} anos`}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-2xl font-black mb-6 text-center">Onde você mais conversa?</h3>
            <div className="space-y-3">
              {['Tinder', 'Bumble', 'Instagram', 'WhatsApp', 'Outro'].map(app => (
                <button
                  key={app}
                  onClick={() => { saveAnswer('app', app); nextStep(4); }}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-yellow-500 hover:bg-gray-800 text-white rounded-xl py-4 px-6 font-medium transition-all text-left"
                >
                  {app}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="text-2xl font-black mb-6 text-center">Qual seu objetivo atual?</h3>
            <div className="space-y-3">
              {[
                { val: 'Sério', label: '💕 Algo Sério' },
                { val: 'Casual', label: '🥂 Casual / Dates' },
                { val: 'Diversão', label: '🎉 Só Diversão' },
                { val: 'Pegação', label: '😈 Pegação Intensa' },
                { val: 'Reconquistar', label: '💔 Reconquistar a ex' }
              ].map(obj => (
                <button
                  key={obj.val}
                  onClick={() => { saveAnswer('objetivo', obj.val); nextStep(5); }}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-yellow-500 hover:bg-gray-800 text-white rounded-xl py-4 px-6 font-medium transition-all text-left"
                >
                  {obj.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 className="text-2xl font-black mb-6 text-center">Qual seu maior problema hoje?</h3>
            <div className="space-y-3">
              {[
                { val: 'travado', label: 'Travo na primeira mensagem' },
                { val: 'sumida', label: 'Elas param de responder do nada' },
                { val: 'encontro', label: 'Não consigo chamar pro encontro' },
                { val: 'semsal', label: 'Minhas conversas são muito chatas' },
                { val: 'print', label: 'Não sei decifrar os sinais dela' }
              ].map(dor => (
                <button
                  key={dor.val}
                  onClick={() => { saveAnswer('dor', dor.val); nextStep(6); }}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-yellow-500 hover:bg-gray-800 text-white rounded-xl py-4 px-6 font-medium transition-all text-left"
                >
                  {dor.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h3 className="text-2xl font-black mb-6 text-center">Quantos matches viram encontro por semana?</h3>
            <div className="space-y-3">
              {[
                { val: 0, label: 'Nenhum (0)' },
                { val: 1, label: '1 encontro' },
                { val: 2, label: '2 a 3 encontros' },
                { val: 4, label: '4+ encontros' }
              ].map(enc => (
                <button
                  key={enc.val}
                  onClick={() => { saveAnswer('encontros', enc.val); nextStep(7); }}
                  className="w-full bg-gray-900 border border-gray-800 hover:border-yellow-500 hover:bg-gray-800 text-white rounded-xl py-4 px-6 font-medium transition-all text-left"
                >
                  {enc.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="text-center">
            <h3 className="text-2xl font-black mb-2">De 0 a 10, como você avalia sua lábia?</h3>
            <div className="my-10 w-full px-4">
              <input
                type="range"
                min="0"
                max="10"
                value={answers.labia || 5}
                onChange={e => saveAnswer('labia', e.target.value)}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
              <div className="text-5xl font-black text-yellow-500 mt-6">{answers.labia || 5}</div>
            </div>
            <button onClick={finishQuiz} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-wide py-4 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_20px_rgba(234,179,8,0.3)] mt-4">
              Ver meu Diagnóstico <ChevronRight className="inline ml-1" size={20} />
            </button>
          </div>
        )}

        {step === 8 && (
          <div className="text-center flex flex-col items-center justify-center py-10">
            <div className="w-16 h-16 border-4 border-gray-800 border-t-yellow-500 rounded-full animate-spin mb-6"></div>
            <h3 className="text-2xl font-black text-yellow-500 mb-2">Analisando seu perfil...</h3>
            <p className="text-gray-400">Calculando algoritmo de sedução e calibrando a Inteligência Artificial para o seu estilo.</p>
          </div>
        )}

        {step === 9 && profile && (
          <div className="text-center">
            <h2 className="text-3xl font-black mb-2 text-white">Diagnóstico Concluído.</h2>
            <p className="text-gray-400 mb-8">A NaLábia foi calibrada EXATAMENTE para o seu jeito de conversar.</p>
            
            <div className="bg-gray-900 border border-yellow-500/50 rounded-2xl p-6 text-left shadow-[0_10px_40px_rgba(234,179,8,0.05)] mb-8">
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">🎯 Seu perfil</div>
                <div className="text-lg font-bold text-yellow-500">{nomes[answers.dor] || 'O Estrategista 🧠'}</div>
              </div>
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">📊 Nível Detectado</div>
                <div className="text-lg font-bold text-yellow-500 capitalize">{profile.nivel} ({answers.labia}/10)</div>
              </div>
              <div className="mb-4">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">🎯 Foco da sua IA</div>
                <div className="text-lg font-bold text-yellow-500">{focos[profile.foco_estrategico] || focos['manter_chama']}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">🎚️ Ousadia Calibrada</div>
                <div className="text-lg font-bold text-yellow-500">{profile.ousadia}/10</div>
              </div>
            </div>
            
            <button onClick={() => nextStep(10)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase tracking-wide py-4 px-6 rounded-xl transition-all hover:scale-[1.02] shadow-[0_4px_20px_rgba(234,179,8,0.3)]">
              Testar IA Grátis Agora <ChevronRight className="inline ml-1" size={20} />
            </button>
          </div>
        )}

        {step === 10 && (
          <div className="relative pt-8">
            <div className="absolute top-0 right-0 bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold shadow-[0_0_10px_rgba(234,179,8,0.2)]">
              Testes restantes: {freeUses}
            </div>
            
            <h3 className="text-2xl font-black mb-2 mt-4 text-center">🎁 Teste a NaLábia Agora</h3>
            <p className="text-gray-400 text-sm mb-8 text-center px-4">Sem cadastro. Sem cartão. Veja o poder da IA configurada pra você.</p>

            {!activeTrialMode && (
              <div className="space-y-4">
                <button onClick={() => useTrial('print')} className="w-full flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-yellow-500/50 p-5 rounded-xl transition-all text-left group">
                  <span className="text-2xl group-hover:scale-110 transition-transform"><Camera className="text-yellow-500"/></span>
                  <div>
                    <div className="font-bold text-gray-100">Responder um print</div>
                    <div className="text-xs text-gray-500 mt-1">Decifre o que ela disse</div>
                  </div>
                </button>

                <button onClick={() => useTrial('gelo')} className="w-full flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-yellow-500/50 p-5 rounded-xl transition-all text-left group">
                  <span className="text-2xl group-hover:scale-110 transition-transform"><MessageSquare className="text-cyan-500" /></span>
                  <div>
                    <div className="font-bold text-gray-100">Quebra-gelo</div>
                    <div className="text-xs text-gray-500 mt-1">Abrir conversa do zero</div>
                  </div>
                </button>

                <button onClick={() => useTrial('conselho')} className="w-full flex items-center gap-4 bg-gray-900 border border-gray-800 hover:border-yellow-500/50 p-5 rounded-xl transition-all text-left group">
                  <span className="text-2xl group-hover:scale-110 transition-transform"><BriefcaseMedical className="text-rose-500" /></span>
                  <div>
                    <div className="font-bold text-gray-100">Conselheiro</div>
                    <div className="text-xs text-gray-500 mt-1">Estratégia para situação</div>
                  </div>
                </button>
              </div>
            )}

            {activeTrialMode && trialChat !== "done" && trialChat !== "loading" && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
                <button 
                  onClick={() => setActiveTrialMode(null)} 
                  className="text-xs text-gray-500 hover:text-yellow-500 mb-4 flex items-center"
                >
                  &larr; Voltar
                </button>

                {activeTrialMode === 'print' && (
                  <div>
                    <h4 className="font-bold mb-3 text-yellow-500 flex items-center gap-2">
                      <Camera size={18}/> Envie o Print
                    </h4>
                    {!trialImage ? (
                      <div className="border-2 border-dashed border-gray-700 hover:border-yellow-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors relative">
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Camera className="mx-auto text-gray-600 mb-2" size={32} />
                        <span className="text-sm text-gray-400">Toque para selecionar imagem</span>
                      </div>
                    ) : (
                      <div className="mb-4 relative rounded-xl overflow-hidden border border-gray-700">
                        <img src={trialImage} alt="Print" className="w-full h-48 object-cover opacity-80" />
                        <button onClick={() => setTrialImage(null)} className="absolute top-2 right-2 bg-black/50 p-2 rounded-lg text-xs backdrop-blur-md hover:bg-black/80">Trocar</button>
                      </div>
                    )}
                    <textarea 
                      placeholder="Alguma observação extra? (Opcional)" 
                      className="w-full bg-gray-800 border-none rounded-xl p-4 text-sm resize-none mt-4 h-20 text-white placeholder-gray-500 focus:ring-1 focus:ring-yellow-500"
                      value={trialText}
                      onChange={e => setTrialText(e.target.value)}
                    ></textarea>
                    <button 
                      disabled={!trialImage}
                      onClick={executeRealTrial} 
                      className="w-full bg-yellow-500 text-black font-bold uppercase py-3 rounded-xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Analisar Print
                    </button>
                  </div>
                )}

                {activeTrialMode === 'gelo' && (
                  <div>
                    <h4 className="font-bold mb-3 text-cyan-500 flex items-center gap-2">
                      <MessageSquare size={18}/> Novo Quebra-Gelo
                    </h4>
                    <textarea 
                      placeholder="Cole a bio dela aqui, ou fale sobre ela..." 
                      className="w-full bg-gray-800 border-none rounded-xl p-4 text-sm resize-none h-32 text-white placeholder-gray-500 focus:ring-1 focus:ring-cyan-500"
                      value={trialText}
                      onChange={e => setTrialText(e.target.value)}
                    ></textarea>
                    
                    <div className="mt-4">
                      <span className="text-xs text-gray-500 mb-2 block">Ou envie uma foto dela:</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                        className="text-xs text-gray-400 w-full file:bg-gray-800 file:border-none file:text-white file:px-3 file:py-1 file:rounded-md file:mr-3"
                      />
                    </div>

                    <button 
                      disabled={!trialText.trim() && !trialImage}
                      onClick={executeRealTrial} 
                      className="w-full bg-cyan-500 text-black font-bold uppercase py-3 rounded-xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Gerar Abertura
                    </button>
                  </div>
                )}
                
                {activeTrialMode === 'conselho' && (
                  <div>
                    <h4 className="font-bold mb-3 text-rose-500 flex items-center gap-2">
                      <BriefcaseMedical size={18}/> Mentoria Rápida
                    </h4>
                    <textarea 
                      placeholder="Me conte o que rolou... Onde você travou? Qual foi a última mensagem?" 
                      className="w-full bg-gray-800 border-none rounded-xl p-4 text-sm resize-none h-40 text-white placeholder-gray-500 focus:ring-1 focus:ring-rose-500"
                      value={trialText}
                      onChange={e => setTrialText(e.target.value)}
                    ></textarea>
                    <button 
                      disabled={!trialText.trim()}
                      onClick={executeRealTrial} 
                      className="w-full bg-rose-500 text-white font-bold uppercase py-3 rounded-xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pedir Conselho
                    </button>
                  </div>
                )}
              </div>
            )}

            {trialChat === "loading" && (
              <div className="mt-6 bg-gray-800/50 border-l-4 border-yellow-500 p-4 rounded-r-xl">
                <div className="text-gray-400 text-sm animate-pulse">Pensando de forma estratégica...</div>
              </div>
            )}

            {trialChat === "done" && chatResponse && (
              <div className="mt-6 bg-gray-900 border-l-4 border-yellow-500 p-5 rounded-r-xl shadow-lg">
                <div className="text-gray-100 text-sm mb-4 leading-relaxed whitespace-pre-wrap">{chatResponse}</div>
                {freeUses > 0 && (
                  <div className="text-xs text-yellow-500 mb-3 font-semibold">🔥 Menos 1 teste grátis consumido. Cadastre-se para usos ilimitados.</div>
                )}
                {freeUses === 0 && (
                  <div className="text-xs text-rose-500 mb-3 font-semibold">Seus testes acabaram. 😢</div>
                )}
                
                <div className="space-y-3">
                  <button onClick={handleSignup} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold uppercase py-3 px-4 rounded-lg transition-all text-sm shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                    Ver Planos
                  </button>
                  {freeUses > 0 && (
                    <button 
                      onClick={() => {
                        setActiveTrialMode(null);
                        setTrialChat("");
                        setChatResponse(null);
                        setTrialText("");
                        setTrialImage(null);
                      }} 
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-all text-sm border border-gray-700"
                    >
                      Fazer outro teste
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {(step === 10 || step === 9) && !showPaywall && (
              <div className="mt-8 text-center pb-8 p-4">
                 <button onClick={handleSignup} className="text-sm text-gray-500 hover:text-white underline">Pular e assinar logo</button>
              </div>
            )}
          </div>
        )}

      </div>

      {showPaywall && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <h2 className="text-4xl font-black text-rose-500 mb-4">Você gostou, né? 😏</h2>
          <p className="text-gray-300 text-lg mb-6 max-w-md">Seus 3 testes grátis acabaram. Assine agora e tenha respostas ILIMITADAS.</p>
          
          <div className="text-5xl font-black text-yellow-500 mb-8 font-mono tracking-wider tabular-nums drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
            {formatCountdown()}
          </div>
          
          <ul className="text-left space-y-3 mb-10 text-gray-200">
            <li className="flex items-center gap-3"><CheckCircle2 className="text-green-500" size={20} /> <span>Respostas infinitas da NaLábia</span></li>
            <li className="flex items-center gap-3"><CheckCircle2 className="text-green-500" size={20} /> <span>Perfil de IA configurado: <b className="text-yellow-500 uppercase">{profile?.nivel}</b></span></li>
            <li className="flex items-center gap-3"><CheckCircle2 className="text-green-500" size={20} /> <span>Ousadia ajustada automaticamente</span></li>
          </ul>

          <button onClick={handleSignup} className="w-full max-w-xs bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest py-5 px-6 rounded-2xl transition-all hover:scale-[1.05] shadow-[0_0_30px_rgba(225,29,72,0.6)] mb-6">
            VER PLANOS 🔥
          </button>
          
          <button onClick={onGoToLogin} className="text-gray-500 hover:text-gray-300 underline underline-offset-4 font-medium transition-colors">
            Já tenho conta — entrar
          </button>
        </div>
      )}
    </div>
  );
};
