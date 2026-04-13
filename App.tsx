import React, { useState, useRef, useEffect } from 'react';
import { analyzeContent, runLaboratory, regenerateContent } from './services/gemini';
import { Message, ProcessingState, AnalysisMode, ConversationSpeed, AppSettings, Profile, sanitizeFirestoreData, handleFirestoreError, OperationType } from './types';
import { sendNotification } from './services/notificationService';
import AnalysisView from './components/AnalysisView';
import ResponseOptions from './components/ResponseOptions';
import SettingsView from './components/SettingsView';
import ProfilesView from './components/ProfilesView';
import LaboratoryView from './components/LaboratoryView';
import SimulatorView from './components/SimulatorView';
import DashboardView from './components/DashboardView';
import ChatbotView from './components/ChatbotView';
import VaultView from './components/VaultView';
import ProfileAnalyzerView from './components/ProfileAnalyzerView';
import RedFlagDetectorView from './components/RedFlagDetectorView';
import PlansView from './components/PlansView';
import { LoginView } from './components/LoginView';
import { LandingView } from './components/LandingView';
import HelpModal from './components/HelpModal';
import { HomeView } from './components/HomeView';
import { TutorialModal } from './components/TutorialModal';
import { DarkPackModal } from './components/DarkPackModal';
import CoursesView from './components/CoursesView';
import { CoursesModal } from './components/CoursesModal';
import { Send, ImageIcon, X, Trash2, Infinity as InfinityIcon, Camera, MessageCircle, Zap, ShieldAlert, ThermometerSnowflake, Ghost, Repeat2, Bolt, User, Crown, Feather, Settings, Users, HelpCircle, FlaskConical, AlertTriangle, LogIn, LogOut, Bot, Lock, ScanFace, Home, ArrowLeft, Flame, Brain, BookOpen } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { checkDeviceUsage, incrementDeviceUsage } from './services/antiFraud';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './services/firebase';

// --- CONSTANTS ---

const TABS: { id: AnalysisMode; label: string; icon: React.FC<any>; desc: string }[] = [
  { id: 'HOME', label: 'Início', icon: Home, desc: 'Painel Principal' },
  { id: 'STORY_REPLY', label: 'Story', icon: Camera, desc: 'Reação a Stories' },
  { id: 'FIRST_CONTACT', label: 'Abrir', icon: MessageCircle, desc: 'Primeiro Contato' },
  { id: 'PROFILE_ANALYZER', label: 'Raio-X', icon: ScanFace, desc: 'Análise de Perfil' },
  { id: 'RED_FLAG_DETECTOR', label: 'Red Flags', icon: AlertTriangle, desc: 'Detector de Riscos' },
  { id: 'FLOWING', label: 'Flow', icon: Zap, desc: 'Manter Conversa' },
  { id: 'VALUE_TEST', label: 'Teste', icon: ShieldAlert, desc: 'Teste de Valor' },
  { id: 'COLD_RESPONSE', label: 'Fria', icon: ThermometerSnowflake, desc: 'Recuperar Poder' },
  { id: 'SILENCE', label: 'Vácuo', icon: Ghost, desc: 'Estratégia de Silêncio' },
  { id: 'REACTIVATION', label: 'Reviver', icon: Repeat2, desc: 'Reativação' },
  { id: 'ONE_LINER', label: '1 Linha', icon: Bolt, desc: 'Impacto Extremo' },
  { id: 'NSFW', label: 'Modo +18', icon: Flame, desc: 'Tensão Sexual e Flerte Agressivo' },
  { id: 'MANIPULATION', label: 'Manipulação', icon: Brain, desc: 'Controle Psicológico Absoluto' },
  { id: 'COURSES', label: 'Cursos', icon: BookOpen, desc: 'Academia NaLábia' },
  { id: 'SIMULATOR', label: 'Simulador', icon: Users, desc: 'Treino com IA' },
  { id: 'VAULT', label: 'Cofre', icon: Lock, desc: 'Respostas Salvas' },
  { id: 'STATS', label: 'Estatísticas', icon: Crown, desc: 'Dashboard do Usuário' },
  { id: 'CHATBOT', label: 'Assistente', icon: Bot, desc: 'Assistente IA' },
];

const PROFILES_STYLES = [
  { id: 'CALM', label: 'Calmo', dominance: 5, mystery: 4, flirt: 3, witty: 4, speed: 'normal' as ConversationSpeed, icon: Feather },
  { id: 'IRONIC', label: 'Irônico', dominance: 6, mystery: 5, flirt: 6, witty: 8, speed: 'fluid' as ConversationSpeed, icon: Zap },
  { id: 'DOMINANT', label: 'Líder', dominance: 9, mystery: 6, flirt: 7, witty: 6, speed: 'short' as ConversationSpeed, icon: Crown },
  { id: 'BOLD', label: 'Ousado', dominance: 7, mystery: 8, flirt: 9, witty: 7, speed: 'normal' as ConversationSpeed, icon: Bolt },
];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  accentColor: 'gold',
  animations: true,
  ai: {
    shortResponses: false,
    avoidCompliments: true,
    avoidQuestions: false,
    autoAdjustFlirt: true,
    memoryEnabled: true,
    fastResponses: false,
    defaultTone: 'casual'
  },
  safety: {
    antiNeedy: true,
    antiLongText: true,
    antiRobot: true,
    antiOverflirt: true,
    nsfwFilter: true,
    toxicityFilter: true
  },
  notifications: {
    push: true,
    email: false,
    sound: true
  }
};

const App: React.FC = () => {
  const { user, userData, userAIProfile, logout, addXp, updateUserSettings, updateUserProfiles, incrementUsage, loading } = useAuth();
  const needsSubscription = user && userData && userData.status === 'pendente' && !userData.nalabiaPrimeAcess;
  
  // Global State
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const saved = localStorage.getItem('nalabia_profiles_v1_guest');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return [{ id: 'general', name: 'NaLábia', description: 'Human Attraction OS v3.0', messages: [], metrics: { interest: 'Oscilante', risk: 'Baixo', lastInteraction: Date.now() }, behavioralPattern: '' }];
  });
  const [activeProfileId, setActiveProfileId] = useState<string>('general');
  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || { id: 'general', name: 'NaLábia', description: 'Human Attraction OS v3.0', messages: [], metrics: { interest: 'Oscilante', risk: 'Baixo', lastInteraction: Date.now() }, behavioralPattern: '' };

  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingState>(ProcessingState.IDLE);
  
  // View States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfilesOpen, setIsProfilesOpen] = useState(false);
  const [isPlansDismissed, setIsPlansDismissed] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [helpMode, setHelpMode] = useState<AnalysisMode | null>(null);
  
  // Settings State with Persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('nalabia_settings_v1_guest');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });
  const hasLoadedUserData = useRef(false);

  useEffect(() => {
    if (user && userData && !hasLoadedUserData.current) {
      const keySuffix = `_${user.uid}`;
      
      // Try to load from Firestore first, then localStorage
      if (userData.settings) {
        setSettings(userData.settings);
      } else {
        try {
          const localSettings = localStorage.getItem(`nalabia_settings_v1${keySuffix}`);
          if (localSettings) {
            setSettings(JSON.parse(localSettings));
          }
        } catch (e) {}
      }
      
      if (Array.isArray(userData.profiles) && userData.profiles.length > 0) {
        // Merge with localStorage to prevent losing offline profiles
        let mergedProfiles = userData.profiles;
        try {
          const localProfilesRaw = localStorage.getItem(`nalabia_profiles_v1${keySuffix}`);
          if (localProfilesRaw) {
            const localProfiles = JSON.parse(localProfilesRaw);
            if (Array.isArray(localProfiles)) {
              // Merge messages for existing profiles if local has more messages
              mergedProfiles = userData.profiles.map(fp => {
                const lp = localProfiles.find(p => p.id === fp.id);
                if (lp && Array.isArray(lp.messages) && Array.isArray(fp.messages) && lp.messages.length > fp.messages.length) {
                  return { ...fp, messages: lp.messages, metrics: lp.metrics || fp.metrics, behavioralPattern: lp.behavioralPattern || fp.behavioralPattern };
                }
                return fp;
              });

              // Add any profiles from localStorage that are NOT in userData.profiles
              const firestoreProfileIds = new Set(userData.profiles.map(p => p.id));
              const offlineProfiles = localProfiles.filter(p => !firestoreProfileIds.has(p.id));
              if (offlineProfiles.length > 0) {
                mergedProfiles = [...mergedProfiles, ...offlineProfiles];
              }
            }
          }
        } catch (e) {}
        setProfiles(mergedProfiles);
      } else {
        try {
          const localProfiles = localStorage.getItem(`nalabia_profiles_v1${keySuffix}`);
          if (localProfiles) {
            const parsed = JSON.parse(localProfiles);
            if (Array.isArray(parsed)) setProfiles(parsed);
          }
        } catch (e) {}
      }
      hasLoadedUserData.current = true;
    } else if (!user && hasLoadedUserData.current) {
      // User logged out, reset to defaults to prevent data leaks
      setSettings(DEFAULT_SETTINGS);
      setProfiles([
        { id: 'general', name: 'NaLábia', description: 'Human Attraction OS v3.0', messages: [], metrics: { interest: 'Oscilante', risk: 'Baixo', lastInteraction: Date.now() }, behavioralPattern: '' }
      ]);
      setActiveProfileId('general');
      hasLoadedUserData.current = false;
    }
  }, [user, userData]);

  // Persist to localStorage for offline access (scoped by user)
  useEffect(() => {
    const keySuffix = user ? `_${user.uid}` : '_guest';
    try {
      localStorage.setItem(`nalabia_settings_v1${keySuffix}`, JSON.stringify(settings));
    } catch (e) {}
    
    // Update CSS variables for accent color
    const root = document.documentElement;
    switch (settings.accentColor) {
      case 'red':
        root.style.setProperty('--accent-color', '#ef4444');
        root.style.setProperty('--accent-color-dim', '#991b1b');
        root.style.setProperty('--accent-color-glow', '#f87171');
        break;
      case 'blue':
        root.style.setProperty('--accent-color', '#3b82f6');
        root.style.setProperty('--accent-color-dim', '#1e3a8a');
        root.style.setProperty('--accent-color-glow', '#60a5fa');
        break;
      case 'emerald':
        root.style.setProperty('--accent-color', '#10b981');
        root.style.setProperty('--accent-color-dim', '#065f46');
        root.style.setProperty('--accent-color-glow', '#34d399');
        break;
      case 'purple':
        root.style.setProperty('--accent-color', '#a855f7');
        root.style.setProperty('--accent-color-dim', '#581c87');
        root.style.setProperty('--accent-color-glow', '#c084fc');
        break;
      case 'neon':
        root.style.setProperty('--accent-color', '#22d3ee');
        root.style.setProperty('--accent-color-dim', '#164e63');
        root.style.setProperty('--accent-color-glow', '#67e8f9');
        break;
      case 'rose':
        root.style.setProperty('--accent-color', '#f43f5e');
        root.style.setProperty('--accent-color-dim', '#881337');
        root.style.setProperty('--accent-color-glow', '#fb7185');
        break;
      case 'amber':
        root.style.setProperty('--accent-color', '#f59e0b');
        root.style.setProperty('--accent-color-dim', '#78350f');
        root.style.setProperty('--accent-color-glow', '#fbbf24');
        break;
      case 'cyan':
        root.style.setProperty('--accent-color', '#06b6d4');
        root.style.setProperty('--accent-color-dim', '#164e63');
        root.style.setProperty('--accent-color-glow', '#67e8f9');
        break;
      case 'fuchsia':
        root.style.setProperty('--accent-color', '#d946ef');
        root.style.setProperty('--accent-color-dim', '#701a75');
        root.style.setProperty('--accent-color-glow', '#f0abfc');
        break;
      case 'lime':
        root.style.setProperty('--accent-color', '#84cc16');
        root.style.setProperty('--accent-color-dim', '#3f6212');
        root.style.setProperty('--accent-color-glow', '#bef264');
        break;
      case 'orange':
        root.style.setProperty('--accent-color', '#f97316');
        root.style.setProperty('--accent-color-dim', '#7c2d12');
        root.style.setProperty('--accent-color-glow', '#fdba74');
        break;
      case 'pink':
        root.style.setProperty('--accent-color', '#ec4899');
        root.style.setProperty('--accent-color-dim', '#831843');
        root.style.setProperty('--accent-color-glow', '#f9a8d4');
        break;
      case 'teal':
        root.style.setProperty('--accent-color', '#14b8a6');
        root.style.setProperty('--accent-color-dim', '#134e4a');
        root.style.setProperty('--accent-color-glow', '#5eead4');
        break;
      case 'indigo':
        root.style.setProperty('--accent-color', '#6366f1');
        root.style.setProperty('--accent-color-dim', '#312e81');
        root.style.setProperty('--accent-color-glow', '#a5b4fc');
        break;
      case 'violet':
        root.style.setProperty('--accent-color', '#8b5cf6');
        root.style.setProperty('--accent-color-dim', '#4c1d95');
        root.style.setProperty('--accent-color-glow', '#c4b5fd');
        break;
      case 'gold':
      default:
        root.style.setProperty('--accent-color', '#D4AF37');
        root.style.setProperty('--accent-color-dim', '#8a701e');
        root.style.setProperty('--accent-color-glow', '#F4C430');
        break;
    }
  }, [settings, user]);

  useEffect(() => {
    const keySuffix = user ? `_${user.uid}` : '_guest';
    try {
      localStorage.setItem(`nalabia_profiles_v1${keySuffix}`, JSON.stringify(profiles));
    } catch (e) {}
    
    // Save to cloud if user is logged in
    if (user && userData) {
       // Strip images for comparison to prevent infinite loops since they are stripped before saving
       // Also limit messages to last 20 to prevent Firestore 1MB document limit errors
       const strippedProfiles = profiles.map(p => ({
         ...p,
         messages: p.messages ? p.messages.slice(-20).map(m => {
           const { image, ...rest } = m;
           return rest;
         }) : []
       }));
       const sanitizedProfiles = sanitizeFirestoreData(strippedProfiles);
       const profilesString = JSON.stringify(sanitizedProfiles);
       const userDataProfilesString = JSON.stringify(userData.profiles || []);
       
       if (profilesString !== userDataProfilesString) {
         const saveProfiles = async () => {
           try {
             await updateUserProfiles(sanitizedProfiles);
           } catch (e) {
             console.error("Failed to save profiles to cloud", e);
           }
         };
         const timeoutId = setTimeout(saveProfiles, 2000);
         return () => clearTimeout(timeoutId);
       }
    }
  }, [profiles, user, userData]);

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (user) {
      try {
        await updateUserSettings(newSettings);
      } catch (e) {
        console.error("Failed to save settings to cloud", e);
      }
    }
  };
  
  // Tab & Sliders State
  const [activeTab, setActiveTab] = useState<AnalysisMode>('HOME');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showDarkPackModal, setShowDarkPackModal] = useState(false);
  const [showCoursesModal, setShowCoursesModal] = useState(false);
  const [pendingDarkTab, setPendingDarkTab] = useState<AnalysisMode | null>(null);
  const [pendingCoursesTab, setPendingCoursesTab] = useState<AnalysisMode | null>(null);

  useEffect(() => {
    const tutorialDone = localStorage.getItem('nalabia_tutorial_completed');
    if (!tutorialDone) {
      setShowTutorial(true);
    }
  }, []);

  const handleTabChange = (tabId: AnalysisMode) => {
    if ((tabId === 'NSFW' || tabId === 'MANIPULATION') && !userData?.darkPackAccess) {
      setPendingDarkTab(tabId);
      setShowDarkPackModal(true);
      return;
    }
    if (tabId === 'COURSES' && !userData?.coursesAccess) {
      setPendingCoursesTab(tabId);
      setShowCoursesModal(true);
      return;
    }
    setActiveTab(tabId);
  };

  const completeTutorial = () => {
    localStorage.setItem('nalabia_tutorial_completed', 'true');
    setShowTutorial(false);
  };
  const [activeProfileStyle, setActiveProfileStyle] = useState<string>('CALM');
  const [flirtLevel, setFlirtLevel] = useState<number>(3);
  const [wittyLevel, setWittyLevel] = useState<number>(4);
  const [dominanceLevel, setDominanceLevel] = useState<number>(5);
  const [mysteryLevel, setMysteryLevel] = useState<number>(4);
  const [speed, setSpeed] = useState<ConversationSpeed>('normal');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const activeTabData = TABS.find(t => t.id === activeTab)!;

  // --- HELPERS ---

  const updateActiveProfileMessages = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    setProfiles(prevProfiles => prevProfiles.map(p => {
      if (p.id === activeProfile.id) {
        const updatedMessages = typeof newMessages === 'function' ? newMessages(p.messages) : newMessages;
        return { ...p, messages: updatedMessages, metrics: { ...p.metrics, lastInteraction: Date.now() } };
      }
      return p;
    }));
  };

  const handleProfileStyleChange = (styleId: string) => {
    const p = PROFILES_STYLES.find(pr => pr.id === styleId);
    if (p) {
      setActiveProfileStyle(styleId);
      setFlirtLevel(p.flirt);
      setWittyLevel(p.witty);
      setDominanceLevel(p.dominance);
      setMysteryLevel(p.mystery);
      setSpeed(p.speed);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [activeProfile?.messages, status]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // Compress to 70% quality JPEG
            setSelectedImage(dataUrl);
          } else {
            setSelectedImage(reader.result as string); // Fallback
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    updateActiveProfileMessages([]);
    setInputText('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatus(ProcessingState.IDLE);
    handleProfileStyleChange('CALM');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const isDeveloper = userData?.plano === 'Desenvolvedor';

    if (needsSubscription) {
      // Check for free messages
      const userFreeMessages = userData?.freeMessagesUsed || 0;
      const deviceAllowed = await checkDeviceUsage();
      
      if (userFreeMessages >= 2 || !deviceAllowed) {
        setIsPlansDismissed(false);
        return;
      }
    } else if (!isDeveloper) {
      // Check daily limit for paid users (50 requests/day)
      const today = new Date().toISOString().split('T')[0];
      if (userData?.lastRequestDate === today && (userData?.dailyRequests || 0) >= 50) {
        alert("Você atingiu o limite diário de 50 requisições. Volte amanhã para continuar usando a IA!");
        return;
      }
    }

    if ((!inputText.trim() && !selectedImage) || (status !== ProcessingState.IDLE && status !== ProcessingState.REGENERATING)) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      image: selectedImage || undefined,
      timestamp: Date.now(),
      mode: activeTab,
      flirtLevel,
      wittyLevel,
      dominanceLevel,
      mysteryLevel,
      speed
    };

    const updatedMessages = [...(Array.isArray(activeProfile?.messages) ? activeProfile.messages : []), newMessage];
    updateActiveProfileMessages(updatedMessages);
    setInputText('');
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStatus(ProcessingState.ANALYZING);

    const stateTimer1 = setTimeout(() => setStatus(ProcessingState.PROCESSING), 1500);
    const stateTimer2 = setTimeout(() => setStatus(ProcessingState.GENERATING_RESPONSE), 3500);

    const currentModeMessages = updatedMessages.filter(m => m.mode === activeTab || (!m.mode && activeTab === 'STORY_REPLY'));

    try {
      const analysis = await analyzeContent(
        newMessage.content || '', 
        newMessage.image,
        activeTab,
        flirtLevel,
        wittyLevel,
        dominanceLevel,
        mysteryLevel,
        speed,
        settings,
        activeProfile,
        userAIProfile,
        currentModeMessages
      );
      
      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);
      
      const responseMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        analysis: analysis,
        timestamp: Date.now(),
        mode: activeTab,
      };

      if (settings.notifications?.push) {
        sendNotification('Análise Concluída', {
          body: 'O NaLábia gerou novas respostas para você.',
        });
      }

      // Update metrics based on analysis
      setProfiles(prev => prev.map(p => 
        p.id === activeProfile.id ? { 
          ...p, 
          messages: [...updatedMessages, responseMessage], 
          metrics: { 
            interest: analysis.interestLevel, 
            risk: analysis.risk, 
            lastInteraction: Date.now() 
          },
          behavioralPattern: analysis.behavioralPattern || p.behavioralPattern
        } : p
      ));

      if (user) {
        try {
          const conversationData = sanitizeFirestoreData({
            userID: user.uid,
            imageURL: newMessage.image ? 'image_attached' : null,
            contextText: newMessage.content || '',
            analysis: analysis,
            responses: analysis.responses,
          });
          conversationData.createdAt = serverTimestamp();
          console.log("conversationData to be saved:", conversationData);
          await addDoc(collection(db, 'conversations'), conversationData);
          
          // Add XP for analyzing a conversation
          await addXp(50);

          await incrementUsage();
          if (needsSubscription) {
            await incrementDeviceUsage();
          }
        } catch (dbError) {
          console.error("Firestore error during save, but response was already shown:", dbError);
        }
      }

      setStatus(ProcessingState.IDLE);
    } catch (error: any) {
      clearTimeout(stateTimer1);
      clearTimeout(stateTimer2);
      console.error(error);
      setStatus(ProcessingState.ERROR);
      
      let errorMessage = "Erro ao conectar com a IA. Tente novamente.";
      if (typeof error?.message === 'string') {
        if (error.message.includes("API Key") || error.message.includes("cota") || error.message.includes("janela") || error.message.includes("modelo")) {
          errorMessage = error.message;
        } else {
          errorMessage = `Erro: ${error.message}`;
        }
      } else if (typeof error === 'string') {
        errorMessage = `Erro: ${error}`;
      } else {
        try { errorMessage = `Erro: ${JSON.stringify(error)}`; } catch (e) {}
      }
      
      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
      };
      updateActiveProfileMessages([...updatedMessages, errMessage]);
      setTimeout(() => setStatus(ProcessingState.IDLE), 3000);
    }
  };

  const handleRunLab = async (messageId: string) => {
    const msgIndex = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;
    
    const targetMsg = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : [])[msgIndex];
    if (!targetMsg.analysis || targetMsg.labResult) return; // Already has result or no analysis

    // Find context (user input that triggered this) in the current mode
    const currentModeMessages = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).filter(m => m.mode === activeTab || (!m.mode && activeTab === 'STORY_REPLY'));
    const msgIndexInMode = currentModeMessages.findIndex(m => m.id === messageId);
    const contextMsg = currentModeMessages[msgIndexInMode - 1];
    const contextText = contextMsg?.content || (contextMsg?.image ? "Image Analysis" : "Unknown Context");

    setStatus(ProcessingState.CALCULATING);
    try {
      const labResult = await runLaboratory(contextText, targetMsg.analysis, activeProfile, settings, userAIProfile);
      
      const newMessages = [...(Array.isArray(activeProfile?.messages) ? activeProfile.messages : [])];
      newMessages[msgIndex] = { ...targetMsg, labResult: labResult };
      updateActiveProfileMessages(newMessages);

      if (settings.notifications?.push) {
        sendNotification('Laboratório Concluído', {
          body: 'A simulação de cenário foi finalizada.',
        });
      }
    } catch (e: any) {
      console.error(e);
      // Fail silently or just log in console for lab errors
    } finally {
      setStatus(ProcessingState.IDLE);
    }
  };

  const handleRegenerate = async (messageId: string) => {
    if (needsSubscription) {
      setIsPlansDismissed(false);
      return;
    }

    const msgIndex = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const targetMsg = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : [])[msgIndex];
    if (!targetMsg.analysis) return;

    // Find original context message in the current mode
    const currentModeMessages = (Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).filter(m => m.mode === activeTab || (!m.mode && activeTab === 'STORY_REPLY'));
    const msgIndexInMode = currentModeMessages.findIndex(m => m.id === messageId);
    const contextMsg = currentModeMessages[msgIndexInMode - 1];
    if (!contextMsg) return;

    const contextText = contextMsg.content || '';
    const contextImage = contextMsg.image;

    setStatus(ProcessingState.REGENERATING);
    try {
      const result = await regenerateContent(
        contextText,
        contextImage,
        (contextMsg.mode as AnalysisMode) || activeTab,
        { flirt: flirtLevel, witty: wittyLevel, dominance: dominanceLevel, mystery: mysteryLevel },
        speed,
        settings,
        activeProfile,
        userAIProfile
      );

      // Update the message with new responses
      const newMessages = [...(Array.isArray(activeProfile?.messages) ? activeProfile.messages : [])];
      newMessages[msgIndex] = {
        ...targetMsg,
        analysis: {
          ...targetMsg.analysis,
          responses: result.responses
        }
      };
      updateActiveProfileMessages(newMessages);

      if (settings.notifications?.push) {
        sendNotification('Regeneração Concluída', {
          body: 'Novas respostas foram geradas.',
        });
      }

    } catch (e) {
      console.error("Regeneration failed", e);
    } finally {
      setStatus(ProcessingState.IDLE);
    }
  };

  // --- THEMING ---
  const getAccentColor = () => {
    return 'text-gold border-gold bg-gold/10';
  };
  
  const getAccentText = () => {
    return 'text-gold';
  };
  
  const getAccentBg = () => {
    return 'bg-gold';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  // Check subscription access
  if (!user) {
    if (showLanding) {
      return <LandingView onGetStarted={() => setShowLanding(false)} />;
    }
    return <LoginView />;
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (needsSubscription && !isPlansDismissed) {
    return <PlansView onClose={() => setIsPlansDismissed(true)} />;
  }

  if (isSettingsOpen) {
    return (
      <SettingsView 
        settings={settings} 
        updateSettings={handleUpdateSettings} 
        onClose={() => setIsSettingsOpen(false)} 
        accentColor={settings.accentColor}
        profiles={profiles}
        setProfiles={setProfiles}
      />
    );
  }

  if (isProfilesOpen) {
    return (
      <ProfilesView
        profiles={profiles}
        activeProfileId={activeProfileId}
        onSelectProfile={(id) => { setActiveProfileId(id); setIsProfilesOpen(false); }}
        onAddProfile={(name, desc) => {
          const newId = Date.now().toString();
          setProfiles(prev => [...prev, { id: newId, name, description: desc, messages: [], metrics: { interest: 'Oscilante', risk: 'Baixo', lastInteraction: Date.now() }, behavioralPattern: '' }]);
          setActiveProfileId(newId);
          setIsProfilesOpen(false);
        }}
        onDeleteProfile={(id) => {
          setProfiles(prev => {
            const newProfiles = prev.filter(p => p.id !== id);
            return newProfiles.length > 0 ? newProfiles : [{ id: 'general', name: 'NaLábia', description: 'Human Attraction OS v3.0', messages: [], metrics: { interest: 'Oscilante', risk: 'Baixo', lastInteraction: Date.now() }, behavioralPattern: '' }];
          });
          if (activeProfileId === id) setActiveProfileId('general');
        }}
        settings={settings}
      />
    );
  }

  const getThemeBg = () => {
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-[#000000] text-gray-200';
      case 'light': return 'bg-[#f8fafc] text-gray-900';
      case 'midnight': return 'bg-[#0f172a] text-gray-200';
      case 'dracula': return 'bg-[#282a36] text-[#f8f8f2]';
      case 'hacker': return 'bg-[#0d1117] text-[#00ff00]';
      case 'cyberpunk': return 'bg-[#fcee0a] text-black';
      case 'dark':
      default: return 'bg-[#050505] text-gray-200';
    }
  };

  const getThemeHeaderBg = () => {
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-[#050505]';
      case 'light': return 'bg-[#ffffff]';
      case 'midnight': return 'bg-[#1e293b]';
      case 'dracula': return 'bg-[#44475a]';
      case 'hacker': return 'bg-[#000000]';
      case 'cyberpunk': return 'bg-[#000000]';
      case 'dark':
      default: return 'bg-[#0a0a0a]';
    }
  };

  const getThemeTabBg = () => {
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-[#050505]';
      case 'light': return 'bg-[#f1f5f9]';
      case 'midnight': return 'bg-[#0f172a]';
      case 'dracula': return 'bg-[#282a36]';
      case 'hacker': return 'bg-[#000000]';
      case 'cyberpunk': return 'bg-[#fcee0a]';
      case 'dark':
      default: return 'bg-[#080808]';
    }
  };

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
    <div className={`flex flex-col h-screen ${getThemeBg()} font-sans overflow-hidden transition-colors duration-500 relative`}>
      
      {showTutorial && <TutorialModal onComplete={completeTutorial} settings={settings} />}
      {helpMode && <HelpModal mode={helpMode} onClose={() => setHelpMode(null)} settings={settings} />}
      
      <DarkPackModal
        isOpen={showDarkPackModal}
        onClose={() => {
          setShowDarkPackModal(false);
          setPendingDarkTab(null);
        }}
        onSuccess={() => {
          setShowDarkPackModal(false);
          if (pendingDarkTab) {
            setActiveTab(pendingDarkTab);
            setPendingDarkTab(null);
          }
        }}
      />

      <CoursesModal
        isOpen={showCoursesModal}
        onClose={() => {
          setShowCoursesModal(false);
          setPendingCoursesTab(null);
        }}
        onSuccess={() => {
          setShowCoursesModal(false);
          if (pendingCoursesTab) {
            setActiveTab(pendingCoursesTab);
            setPendingCoursesTab(null);
          }
        }}
      />

      {/* HEADER */}
      <header className={`flex-none ${getThemeHeaderBg()} z-20 pt-4 pb-2 px-4 flex justify-between items-center border-b border-nalabia-800`}>
        <div className="flex items-center space-x-3">
          {activeTab !== 'HOME' && (
            <button 
              onClick={() => handleTabChange('HOME')}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
              title="Voltar ao Início"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="flex items-center cursor-pointer p-2" onClick={() => setIsProfilesOpen(true)}>
            <InfinityIcon className={getAccentText()} size={24} />
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {userData && (
            <div className="flex flex-col items-end mr-2">
              <span className="text-[10px] font-mono text-gold">NÍVEL {userData.level}</span>
              <span className="text-[10px] font-mono text-gray-500">{userData.xp} XP</span>
              {userData.plano && (
                <span className="text-[8px] font-mono text-emerald-400 mt-0.5 uppercase">
                  {userData.plano}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center space-x-1">
            <button onClick={() => setHelpMode(activeTab)} className="text-gray-600 hover:text-white transition-colors p-2">
              <HelpCircle size={18} />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className={`text-gray-600 hover:text-gray-300 transition-colors p-2`}>
              <Settings size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      {activeTab === 'HOME' ? (
        <div className="flex-1 overflow-hidden relative z-10">
          <HomeView setActiveTab={handleTabChange} accentColorText={getAccentText()} settings={settings} />
        </div>
      ) : activeTab === 'COURSES' ? (
        <div className="flex-1 overflow-hidden relative z-10">
          <CoursesView onBack={() => setActiveTab('HOME')} />
        </div>
      ) : activeTab === 'SIMULATOR' ? (
        <div className="flex-1 overflow-hidden">
          <SimulatorView 
            activeProfile={activeProfile} 
            updateActiveProfileMessages={updateActiveProfileMessages} 
            settings={settings}
            userAIProfile={userAIProfile}
          />
        </div>
      ) : activeTab === 'STATS' ? (
        <div className="flex-1 overflow-hidden">
          <DashboardView activeProfile={activeProfile} updateActiveProfileMessages={updateActiveProfileMessages} settings={settings} userAIProfile={userAIProfile} />
        </div>
      ) : activeTab === 'CHATBOT' ? (
        <div className="flex-1 overflow-hidden">
          <ChatbotView 
            settings={settings} 
            activeProfile={activeProfile} 
            userAIProfile={userAIProfile} 
            updateActiveProfileMessages={updateActiveProfileMessages}
          />
        </div>
      ) : activeTab === 'VAULT' ? (
        <div className="flex-1 overflow-hidden">
          <VaultView settings={settings} />
        </div>
      ) : activeTab === 'PROFILE_ANALYZER' ? (
        <div className="flex-1 overflow-hidden">
          <ProfileAnalyzerView settings={settings} />
        </div>
      ) : activeTab === 'RED_FLAG_DETECTOR' ? (
        <div className="flex-1 overflow-hidden">
          <RedFlagDetectorView settings={settings} />
        </div>
      ) : (
        <>
          {/* CHAT AREA */}
          <main ref={chatContainerRef} className={`flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth ${getThemeBg().split(' ')[0]}`}>
            {(Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).filter(m => m.mode === activeTab || (!m.mode && activeTab === 'STORY_REPLY')).length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none p-8">
            <activeTabData.icon size={48} className="mb-6 text-gray-800" />
            <div className="text-center space-y-2">
              <h2 className="text-base font-mono font-bold text-gray-600 tracking-[0.2em]">{activeTabData.desc.toUpperCase()}</h2>
              <p className="text-xs text-gray-700 font-light">
                 {activeProfile.id === 'general' ? 'Aguardando Input Social...' : `Histórico de ${typeof activeProfile.name === 'string' ? activeProfile.name : JSON.stringify(activeProfile.name)} iniciado neste modo.`}
              </p>
            </div>
            
             <div className={`mt-12 text-[10px] font-mono tracking-widest uppercase ${getAccentText()} opacity-70`}>
              NaLábia • Inteligência Social
            </div>
          </div>
        )}

        {(Array.isArray(activeProfile?.messages) ? activeProfile.messages : []).filter(m => m.mode === activeTab || (!m.mode && activeTab === 'STORY_REPLY')).map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} ${settings.animations ? 'animate-fade-in' : ''}`}>
            {msg.role === 'user' && (
              <div className="max-w-[85%] text-right">
                 {msg.image && (
                  <div className="mb-2 rounded border border-nalabia-800 inline-block overflow-hidden">
                    <img src={msg.image} alt="Upload" className="max-h-48 object-cover opacity-90" />
                  </div>
                )}
                {msg.content && (
                  <div className={`${getThemeInputBg().split(' ')[0]} border border-nalabia-800 text-gray-300 px-4 py-2 rounded-2xl rounded-tr-sm inline-block`}>
                    <p className="text-xs font-mono">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
                  </div>
                )}
                {msg.mode && (
                  <div className="flex items-center justify-end space-x-2 mt-1 opacity-40">
                    <span className="text-[8px] font-mono text-gray-600 uppercase tracking-wider">{msg.speed}</span>
                  </div>
                )}
              </div>
            )}

            {msg.role === 'assistant' && (
              <div className="w-full">
                {msg.content ? (
                   <div className="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg text-xs font-mono max-w-md">
                     {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                   </div>
                ) : msg.analysis && (
                  <>
                    <div className="max-w-md relative">
                      <AnalysisView analysis={msg.analysis} />
                      
                      {/* Lab Trigger */}
                      {!msg.labResult && (
                        <button 
                          onClick={() => handleRunLab(msg.id)}
                          className="absolute top-4 right-4 text-gray-500 hover:text-gold transition-colors p-1"
                          title="Abrir Laboratório"
                        >
                          <FlaskConical size={14} />
                        </button>
                      )}
                    </div>
                    
                    {/* Lab Result View */}
                    {msg.labResult && (
                      <div className="max-w-md mb-6">
                        <LaboratoryView simulation={msg.labResult} />
                      </div>
                    )}

                    {/* Responses Scroll */}
                    <div className="-mx-2">
                      <ResponseOptions 
                        responses={msg.analysis.responses} 
                        onRegenerate={() => handleRegenerate(msg.id)}
                        isRegenerating={status === ProcessingState.REGENERATING}
                        settings={settings}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {status !== ProcessingState.IDLE && status !== ProcessingState.ERROR && (
           <div className="flex items-center space-x-2 pl-2 opacity-50">
             <div className={`w-1 h-1 rounded-full animate-bounce ${getAccentBg()}`}></div>
             <div className={`w-1 h-1 rounded-full animate-bounce delay-100 ${getAccentBg()}`}></div>
             <div className={`w-1 h-1 rounded-full animate-bounce delay-200 ${getAccentBg()}`}></div>
             {status === ProcessingState.ANALYZING && <span className="text-[9px] font-mono text-gray-500 ml-2 uppercase animate-pulse">Analisando...</span>}
             {status === ProcessingState.PROCESSING && <span className="text-[9px] font-mono text-gray-500 ml-2 uppercase animate-pulse">Processando...</span>}
             {status === ProcessingState.GENERATING_RESPONSE && <span className="text-[9px] font-mono text-gray-500 ml-2 uppercase animate-pulse">Gerando resposta...</span>}
             {status === ProcessingState.CALCULATING && <span className="text-[9px] font-mono text-gray-500 ml-2 uppercase animate-pulse">Simulando...</span>}
             {status === ProcessingState.REGENERATING && <span className="text-[9px] font-mono text-gold ml-2 uppercase animate-pulse">Regerando...</span>}
           </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className={`flex-none ${getThemeHeaderBg()} border-t border-nalabia-800 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] z-20`}>
        
        {/* PROFILES & SLIDERS */}
        <div className="px-5 py-4 border-b border-nalabia-800/50">
          
          {/* Profiles Styles */}
          <div className="flex space-x-3 mb-4 overflow-x-auto pb-2">
             {PROFILES_STYLES.map(p => {
               const Icon = p.icon;
               const isActive = activeProfileStyle === p.id;
               return (
                 <button
                    key={p.id}
                    onClick={() => handleProfileStyleChange(p.id)}
                    className={`flex-none flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono uppercase tracking-wide transition-all ${
                      isActive 
                      ? `${getAccentColor()}` 
                      : 'bg-transparent border-nalabia-800 text-gray-600 hover:border-gray-600'
                    }`}
                 >
                   <Icon size={10} />
                   <span>{p.label}</span>
                 </button>
               )
             })}
          </div>

          {/* New Grid Layout for Advanced Sliders */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {/* Flirt */}
            <div className="space-y-1">
              <div className="flex justify-between text-[8px] font-mono text-gray-500 uppercase">
                <span>Flirt</span>
                <span className={getAccentText()}>{flirtLevel}</span>
              </div>
              <input type="range" min="0" max="10" value={flirtLevel} onChange={(e) => setFlirtLevel(parseInt(e.target.value))} className="w-full h-1 bg-nalabia-800 rounded-lg appearance-none cursor-pointer accent-gold" />
            </div>

            {/* Dominance */}
            <div className="space-y-1">
              <div className="flex justify-between text-[8px] font-mono text-gray-500 uppercase">
                <span>Dominância</span>
                <span className={getAccentText()}>{dominanceLevel}</span>
              </div>
              <input type="range" min="0" max="10" value={dominanceLevel} onChange={(e) => setDominanceLevel(parseInt(e.target.value))} className="w-full h-1 bg-nalabia-800 rounded-lg appearance-none cursor-pointer accent-gold" />
            </div>

             {/* Mystery */}
             <div className="space-y-1">
              <div className="flex justify-between text-[8px] font-mono text-gray-500 uppercase">
                <span>Mistério</span>
                <span className={getAccentText()}>{mysteryLevel}</span>
              </div>
              <input type="range" min="0" max="10" value={mysteryLevel} onChange={(e) => setMysteryLevel(parseInt(e.target.value))} className="w-full h-1 bg-nalabia-800 rounded-lg appearance-none cursor-pointer accent-gold" />
            </div>

            {/* Speed Toggle */}
            <div className="flex items-end h-full pb-1">
               <button 
                 onClick={() => setSpeed(s => s === 'short' ? 'normal' : s === 'normal' ? 'fluid' : 'short')}
                 className="w-full flex justify-between items-center bg-nalabia-800/50 px-2 py-1 rounded border border-nalabia-800 hover:border-nalabia-600 text-[9px] font-mono text-gray-400 uppercase"
               >
                 <span>Velocidade</span>
                 <span className={getAccentText()}>{speed === 'short' ? 'Curta' : speed === 'normal' ? 'Normal' : 'Fluida'}</span>
               </button>
            </div>
          </div>
        </div>

        {/* INPUT */}
        <div className="p-3 max-w-4xl mx-auto">
          {selectedImage && (
            <div className={`flex items-center ${getThemeInputBg().split(' ')[0]} p-2 rounded border border-nalabia-800 w-fit mb-2`}>
              <img src={selectedImage} alt="Preview" className="h-8 w-8 object-cover rounded mr-2 opacity-80" />
              <button onClick={() => {setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value=''}} className="text-gray-600 hover:text-white">
                <X size={14} />
              </button>
            </div>
          )}

          {needsSubscription ? (
            <div className={`flex items-center justify-between ${getThemeInputBg().split(' ')[0]} border border-nalabia-800 rounded-xl py-3 px-4`}>
              <span className="text-gray-500 text-sm">Assinatura necessária para enviar mensagens</span>
              <button 
                onClick={() => setIsPlansDismissed(false)}
                className="text-gold hover:text-gold-glow text-sm font-bold transition-colors"
              >
                Ver Planos
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center space-x-2">
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden" 
              />
              
              <button 
                type="button" 
                onClick={() => setIsProfilesOpen(true)}
                className={`p-3 rounded-xl ${getThemeInputBg().split(' ')[0]} border border-nalabia-800 text-gray-500 transition-all hover:text-white hover:border-white/20`}
              >
                <Users size={18} />
              </button>

               <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                className={`p-3 rounded-xl ${getThemeInputBg().split(' ')[0]} border border-nalabia-800 text-gray-500 transition-all hover:text-white`}
                disabled={status !== ProcessingState.IDLE}
              >
                <ImageIcon size={18} />
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={activeTab === 'STORY_REPLY' ? "Anexar Story ou descrever..." : `Comando para modo ${activeTabData.label}...`}
                  className={`w-full ${getThemeInputBg()} placeholder-gray-700 rounded-xl py-3 px-4 border border-nalabia-800 focus:border-white/20 focus:ring-1 focus:ring-white/10 focus:outline-none transition-all font-sans text-sm`}
                  disabled={status !== ProcessingState.IDLE}
                />
              </div>

              <button 
                type="submit" 
                className={`p-3 rounded-xl transition-all flex items-center justify-center border ${
                  (!inputText && !selectedImage) || status !== ProcessingState.IDLE
                    ? `${getThemeInputBg().split(' ')[0]} border-nalabia-800 text-gray-700 opacity-50 cursor-not-allowed` 
                    : `${getAccentBg()} text-black border-transparent hover:opacity-90 hover:shadow-[0_0_20px_rgba(212,175,55,0.6)] shadow-lg`
                }`}
                disabled={(!inputText && !selectedImage) || status !== ProcessingState.IDLE}
              >
                {status === ProcessingState.IDLE ? <Send size={18} /> : <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>}
              </button>
            </form>
          )}
          
          <div className="flex justify-between items-center mt-2 px-2">
            <span className={`text-[8px] font-mono tracking-widest uppercase ${getAccentText()} opacity-70`}>
              NaLábia v3.0 • Premium
            </span>
             <span className={`text-[8px] font-mono tracking-widest uppercase animate-pulse ${getAccentText()} opacity-50`}>
              ● Online
            </span>
          </div>
        </div>
      </footer>
      </>
      )}
    </div>
  );
};

export default App;