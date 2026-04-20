import React, { useState, useRef } from 'react';
import { AppSettings, Profile } from '../types';
import { Shield, Brain, Palette, User, ToggleLeft, ToggleRight, ArrowLeft, Bell, LogOut, ChevronRight, Lock, Download, Upload, Trash2, CheckCircle, AlertCircle, Camera, Database, Zap, Eye, EyeOff, MessageCircle, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { requestNotificationPermission, sendNotification } from '../services/notificationService';

interface SettingsViewProps {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
  accentColor: string;
  profiles: Profile[];
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
}

type SettingsSection = 'main' | 'account' | 'appearance' | 'ai' | 'safety' | 'backup' | 'notifications';

const SettingsView: React.FC<SettingsViewProps> = ({ settings, updateSettings, onClose, accentColor, profiles, setProfiles }) => {
  const { user, userData, userAIProfile, logout, updateUserName, updateUserPhoto, updateUserPassword, verifyEmail, createBackup, restoreBackup, deleteAccount } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('main');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  
  // Account state
  const [name, setName] = useState(userData?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [accountMessage, setAccountMessage] = useState({ type: '', text: '' });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm'; onConfirm?: () => void }>({ isOpen: false, title: '', message: '', type: 'alert' });

  const getThemeInputBg = () => {
    if (!settings) return 'bg-[#0a0a0a]';
    switch (settings.theme) {
      case 'ultra-dark': return 'bg-[#0a0a0a]';
      case 'light': return 'bg-[#ffffff]';
      case 'midnight': return 'bg-[#1e293b]';
      case 'dracula': return 'bg-[#44475a]';
      case 'hacker': return 'bg-[#000000]';
      case 'cyberpunk': return 'bg-[#000000]';
      case 'dark':
      default: return 'bg-[#0a0a0a]';
    }
  };

  const showAlert = (title: string, message: string) => {
    setModalConfig({ isOpen: true, title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ isOpen: true, title, message, type: 'confirm', onConfirm });
  };

  const handleNameSave = async () => {
    try {
      await updateUserName(name);
      setIsEditingName(false);
      setAccountMessage({ type: 'success', text: 'Nome atualizado com sucesso.' });
      setTimeout(() => setAccountMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setAccountMessage({ type: 'error', text: 'Erro ao atualizar nome.' });
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setAccountMessage({ type: 'info', text: 'Enviando foto...' });
        await updateUserPhoto(file);
        setAccountMessage({ type: 'success', text: 'Foto atualizada com sucesso.' });
        setTimeout(() => setAccountMessage({ type: '', text: '' }), 3000);
      } catch (error) {
        setAccountMessage({ type: 'error', text: 'Erro ao atualizar foto.' });
      }
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      setAccountMessage({ type: 'error', text: 'Preencha ambos os campos.' });
      return;
    }
    try {
      await updateUserPassword(currentPassword, newPassword);
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setAccountMessage({ type: 'success', text: 'Senha alterada com sucesso.' });
      setTimeout(() => setAccountMessage({ type: '', text: '' }), 3000);
    } catch (error: any) {
      setAccountMessage({ type: 'error', text: error.message || 'Erro ao alterar senha.' });
    }
  };

  const handleVerifyEmail = async () => {
    try {
      await verifyEmail();
      setAccountMessage({ type: 'success', text: 'Email de verificação enviado.' });
      setTimeout(() => setAccountMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setAccountMessage({ type: 'error', text: 'Erro ao enviar email.' });
    }
  };

  const handleDeleteAccount = async () => {
    showConfirm('Excluir Conta', 'Tem certeza absoluta que deseja excluir sua conta? Esta ação é irreversível e todos os seus dados serão perdidos.', async () => {
      try {
        await deleteAccount();
      } catch (error: any) {
        setAccountMessage({ type: 'error', text: error.message || 'Erro ao excluir conta.' });
      }
    });
  };

  const handleClearCache = () => {
    showConfirm('Limpar Cache', 'Deseja limpar o cache local? Isso não apagará seus dados na nuvem.', () => {
    try {
      localStorage.clear();
    } catch (e) {}
      try {
        sessionStorage.clear();
      } catch (e) {}
      showAlert('Sucesso', 'Cache limpo com sucesso. O aplicativo será recarregado.');
      setTimeout(() => window.location.reload(), 2000);
    });
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      await createBackup();
      showAlert('Sucesso', 'Backup criado e salvo na nuvem com sucesso. O download iniciará em breve.');
    } catch (error) {
      console.error(error);
      showAlert('Erro', 'Erro ao criar backup na nuvem.');
    }
    setIsBackingUp(false);
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await restoreBackup(file);
      showAlert('Sucesso', 'Dados restaurados com sucesso! O aplicativo será recarregado.');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error("Error parsing backup file:", error);
      showAlert('Erro', error.message || 'Erro ao restaurar dados. Arquivo inválido.');
    }
  };

  const toggle = async (section: 'ai' | 'safety' | 'notifications', key: string) => {
    const sectionData = settings[section] || {};
    const newValue = !sectionData[key as keyof typeof sectionData];

    if (section === 'notifications' && key === 'push' && newValue) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        showAlert('Permissão Negada', 'Permissão para notificações negada ou não suportada pelo navegador.');
        return;
      } else {
        sendNotification('NaLábia', {
          body: 'Notificações ativadas com sucesso!',
        });
      }
    }

    updateSettings({
      ...settings,
      [section]: {
        ...sectionData,
        [key]: newValue
      }
    });
  };

  const setAccent = (color: 'gold' | 'red' | 'blue' | 'emerald' | 'purple' | 'neon' | 'rose' | 'amber' | 'cyan' | 'fuchsia' | 'lime' | 'orange' | 'pink' | 'teal' | 'indigo' | 'violet') => {
    updateSettings({ ...settings, accentColor: color });
  };

  const setTheme = (theme: 'dark' | 'ultra-dark' | 'light' | 'midnight' | 'dracula' | 'hacker' | 'cyberpunk') => {
    updateSettings({ ...settings, theme: theme });
  };

  const getToggleColor = (isOn: boolean) => {
    if (!isOn) return 'text-gray-600';
    return 'text-gold';
  };

  const renderMain = () => (
    <div className="p-5 space-y-6 pb-20">
      {/* User Profile Summary */}
      <div 
        onClick={() => setActiveSection('account')}
        className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-5 flex items-center justify-between cursor-pointer hover:border-gray-700 transition-all shadow-lg"
      >
         <div className="flex items-center space-x-4">
           <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 overflow-hidden ring-2 ring-gray-800">
             {userData?.photoURL ? <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <User size={28} />}
           </div>
           <div>
             <div className="text-base font-bold text-white">{userData?.name || 'Usuário'}</div>
             <div className="text-xs text-gray-400 mt-0.5">{userData?.email}</div>
             <div className="flex items-center space-x-2 mt-2">
               <span className="px-2 py-0.5 rounded-full bg-nalabia-gold/10 text-nalabia-gold text-[10px] font-medium border border-nalabia-gold/20">
                 Nível {userData?.level || 1}
               </span>
               <span className="text-[10px] text-gray-500">{userData?.xp || 0} XP</span>
             </div>
           </div>
         </div>
         <ChevronRight size={20} className="text-gray-600" />
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setActiveSection('appearance')} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col items-start space-y-3 hover:bg-gray-800/50 transition-all text-left">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Palette size={20} className="text-purple-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200">Aparência</div>
            <div className="text-[10px] text-gray-500 mt-1">Temas e cores</div>
          </div>
        </button>

        <button onClick={() => setActiveSection('ai')} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col items-start space-y-3 hover:bg-gray-800/50 transition-all text-left">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Brain size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200">Inteligência</div>
            <div className="text-[10px] text-gray-500 mt-1">Comportamento IA</div>
          </div>
        </button>

        <button onClick={() => setActiveSection('safety')} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col items-start space-y-3 hover:bg-gray-800/50 transition-all text-left">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <Shield size={20} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200">Segurança</div>
            <div className="text-[10px] text-gray-500 mt-1">Filtros e proteção</div>
          </div>
        </button>

        <button onClick={() => setActiveSection('notifications')} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex flex-col items-start space-y-3 hover:bg-gray-800/50 transition-all text-left">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Bell size={20} className="text-orange-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-200">Notificações</div>
            <div className="text-[10px] text-gray-500 mt-1">Avisos e sons</div>
          </div>
        </button>

        <button onClick={() => setActiveSection('backup')} className="col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-4 flex items-center justify-between hover:bg-gray-800/50 transition-all">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-gray-800 rounded-lg">
              <Database size={20} className="text-gray-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-200">Dados & Backup</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Exportar, importar e cache</div>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="pt-4 space-y-3">
        <a 
          href="mailto:nalabiainc@gmail.com"
          className="w-full bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-center space-x-2 hover:bg-blue-500/20 transition-all font-sans"
        >
          <HelpCircle size={18} className="text-blue-400" />
          <span className="text-sm font-bold text-blue-400">Suporte: nalabiainc@gmail.com</span>
        </a>
        {(userData?.status === 'ativo' || userData?.nalabiaPrimeAcess) && (
          <a 
            href="https://chat.whatsapp.com/BXLIzZGreSOCqYT3l6g65l"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center justify-center space-x-2 hover:bg-green-500/20 transition-all"
          >
            <MessageCircle size={18} className="text-green-500" />
            <span className="text-sm font-bold text-green-500">Comunidade VIP no WhatsApp</span>
          </a>
        )}
        <button onClick={logout} className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-center space-x-2 hover:bg-red-500/20 transition-all">
          <LogOut size={18} className="text-red-400" />
          <span className="text-sm font-medium text-red-400">Sair da Conta</span>
        </button>
      </div>

      <div className="text-center pt-8 pb-4 opacity-50">
        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">NaLábia Professional</div>
        <div className="text-[9px] text-gray-600">Build 5.0.0 • Secure Enclave</div>
      </div>
    </div>
  );

  const renderAccount = () => (
    <div className="p-5 space-y-6 pb-20 animate-fade-in">
      {accountMessage.text && (
        <div className={`p-4 rounded-xl text-sm flex items-center space-x-3 ${
          accountMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
          accountMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        }`}>
          {accountMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{accountMessage.text}</span>
        </div>
      )}

      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 space-y-6">
        <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest border-b border-gray-800/50 pb-3">Perfil Público</h3>
        
        <div className="flex items-center space-x-5">
          <div className="relative w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 overflow-hidden group ring-4 ring-gray-900">
            {userData?.photoURL ? <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <User size={36} />}
            <div 
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm"
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera size={24} className="text-white" />
            </div>
            <input type="file" accept="image/*" ref={photoInputRef} onChange={handlePhotoChange} className="hidden" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-200 mb-1">Foto de Perfil</div>
            <div className="text-xs text-gray-500 leading-relaxed">Formatos suportados: JPG, PNG. Tamanho máximo: 5MB.</div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400">Nome de Exibição</label>
          <div className="flex space-x-2">
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              readOnly={!isEditingName} 
              className={`flex-1 bg-black/50 border ${isEditingName ? 'border-gold' : 'border-gray-800'} rounded-xl p-3 text-sm text-gray-200 focus:outline-none transition-colors`} 
            />
            {isEditingName ? (
              <button onClick={handleNameSave} className="bg-gold text-black px-4 rounded-xl text-sm font-bold hover:bg-gold-glow transition-colors shadow-lg shadow-gold/20">
                Salvar
              </button>
            ) : (
              <button onClick={() => setIsEditingName(true)} className="bg-gray-800 text-gray-300 px-4 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
                Editar
              </button>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400">Endereço de Email</label>
          <div className="flex space-x-2">
            <input type="email" value={userData?.email || ''} readOnly className="flex-1 bg-black/50 border border-gray-800 rounded-xl p-3 text-sm text-gray-500 focus:outline-none" />
            {!user?.emailVerified && (
              <button onClick={handleVerifyEmail} className="bg-gold/10 text-gold border border-gold/30 px-4 rounded-xl text-sm font-medium hover:bg-gold/20 transition-colors">
                Verificar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 space-y-5">
        <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest border-b border-gray-800/50 pb-3">Segurança da Conta</h3>
        
        {isChangingPassword ? (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">Senha Atual</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-black/50 border border-gray-800 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-gray-600 transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">Nova Senha</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black/50 border border-gray-800 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-gray-600 transition-colors" 
              />
            </div>
            <div className="flex space-x-3 pt-2">
              <button onClick={handlePasswordChange} className="flex-1 bg-white text-black py-3 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                Atualizar Senha
              </button>
              <button onClick={() => setIsChangingPassword(false)} className="flex-1 bg-gray-800 text-gray-300 py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsChangingPassword(true)} className="w-full flex items-center justify-between p-4 bg-black/30 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-800/50 rounded-lg group-hover:bg-gray-800 transition-colors">
                <Lock size={18} className="text-gray-400" />
              </div>
              <span className="text-sm font-medium text-gray-300">Alterar Senha</span>
            </div>
            <ChevronRight size={18} className="text-gray-600" />
          </button>
        )}
      </div>

      <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-mono text-red-500/70 uppercase tracking-widest border-b border-red-500/10 pb-3">Zona de Risco</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          A exclusão da conta é permanente. Todos os seus dados, perfis e configurações serão removidos de nossos servidores.
        </p>
        <button onClick={handleDeleteAccount} className="w-full flex items-center justify-center space-x-2 p-3 bg-red-500/10 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-colors">
          <Trash2 size={16} className="text-red-500" />
          <span className="text-sm font-bold text-red-500">Excluir Conta Permanentemente</span>
        </button>
      </div>
    </div>
  );

  const renderAppearance = () => (
    <div className="p-5 space-y-6 pb-20 animate-fade-in">
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 space-y-6">
        <div className="space-y-4">
          <label className="text-xs font-mono text-gray-500 uppercase tracking-widest block">Tema do Sistema</label>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setTheme('dark')}
              className={`relative overflow-hidden p-4 rounded-xl border-2 text-left transition-all ${settings.theme === 'dark' ? 'bg-gray-800 border-gray-400 shadow-lg' : 'bg-black/50 border-gray-800 hover:border-gray-700'}`}
            >
              <div className="text-sm font-bold text-white mb-1">Dark</div>
              <div className="text-[10px] text-gray-400">Cinza profundo, suave para os olhos</div>
              {settings.theme === 'dark' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white"></div>}
            </button>
            <button 
              onClick={() => setTheme('ultra-dark')}
              className={`relative overflow-hidden p-4 rounded-xl border-2 text-left transition-all ${settings.theme === 'ultra-dark' ? 'bg-black border-white/30 shadow-lg' : 'bg-black/50 border-gray-800 hover:border-gray-700'}`}
            >
              <div className="text-sm font-bold text-white mb-1">Ultra Dark</div>
              <div className="text-[10px] text-gray-400">Preto puro, ideal para telas AMOLED</div>
              {settings.theme === 'ultra-dark' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white"></div>}
            </button>
            <button 
              onClick={() => setTheme('light')}
              className={`relative overflow-hidden p-4 rounded-xl border-2 text-left transition-all ${settings.theme === 'light' ? 'bg-gray-100 border-gray-400 shadow-lg' : 'bg-white/10 border-gray-800 hover:border-gray-700'}`}
            >
              <div className={`text-sm font-bold mb-1 ${settings.theme === 'light' ? 'text-gray-900' : 'text-white'}`}>Light</div>
              <div className={`text-[10px] ${settings.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>Claro, limpo e minimalista</div>
              {settings.theme === 'light' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-black"></div>}
            </button>
            <button 
              onClick={() => setTheme('midnight')}
              className={`relative overflow-hidden p-4 rounded-xl border-2 text-left transition-all ${settings.theme === 'midnight' ? 'bg-slate-800 border-blue-400 shadow-lg' : 'bg-slate-900/50 border-gray-800 hover:border-gray-700'}`}
            >
              <div className="text-sm font-bold text-white mb-1">Midnight</div>
              <div className="text-[10px] text-gray-400">Azul escuro profundo, elegante</div>
              {settings.theme === 'midnight' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-400"></div>}
            </button>
            <button 
              onClick={() => setTheme('dracula')}
              className={`relative overflow-hidden p-4 rounded-xl border-2 text-left transition-all ${settings.theme === 'dracula' ? 'bg-[#282a36] border-purple-400 shadow-lg' : 'bg-[#282a36]/50 border-gray-800 hover:border-gray-700'}`}
            >
              <div className="text-sm font-bold text-white mb-1">Dracula</div>
              <div className="text-[10px] text-gray-400">Tons de roxo e rosa escuro</div>
              {settings.theme === 'dracula' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-purple-400"></div>}
            </button>
            <button 
              onClick={() => setTheme('hacker')}
              className={`relative overflow-hidden p-4 rounded-xl border-2 text-left transition-all ${settings.theme === 'hacker' ? 'bg-[#0d1117] border-green-500 shadow-lg' : 'bg-[#0d1117]/50 border-gray-800 hover:border-gray-700'}`}
            >
              <div className="text-sm font-bold text-green-500 mb-1">Hacker</div>
              <div className="text-[10px] text-green-700">Preto e verde neon, estilo terminal</div>
              {settings.theme === 'hacker' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-500"></div>}
            </button>
            <button 
              onClick={() => setTheme('cyberpunk')}
              className={`relative overflow-hidden p-4 rounded-xl border-2 text-left transition-all ${settings.theme === 'cyberpunk' ? 'bg-[#fcee0a] border-black shadow-lg' : 'bg-[#fcee0a]/20 border-gray-800 hover:border-gray-700'}`}
            >
              <div className="text-sm font-bold text-yellow-500 mb-1">Cyberpunk</div>
              <div className="text-[10px] text-yellow-700">Amarelo neon e preto</div>
              {settings.theme === 'cyberpunk' && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-black"></div>}
            </button>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-gray-800/50">
          <label className="text-xs font-mono text-gray-500 uppercase tracking-widest block">Cor de Destaque</label>
          <div className="flex flex-wrap gap-4">
            {[
              { id: 'gold', color: '#D4AF37', shadow: 'rgba(212,175,55,0.4)' },
              { id: 'red', color: '#ef4444', shadow: 'rgba(239,68,68,0.4)' },
              { id: 'blue', color: '#3b82f6', shadow: 'rgba(59,130,246,0.4)' },
              { id: 'emerald', color: '#10b981', shadow: 'rgba(16,185,129,0.4)' },
              { id: 'purple', color: '#a855f7', shadow: 'rgba(168,85,247,0.4)' },
              { id: 'neon', color: '#22d3ee', shadow: 'rgba(34,211,238,0.4)' },
              { id: 'rose', color: '#f43f5e', shadow: 'rgba(244,63,94,0.4)' },
              { id: 'amber', color: '#f59e0b', shadow: 'rgba(245,158,11,0.4)' },
              { id: 'cyan', color: '#06b6d4', shadow: 'rgba(6,182,212,0.4)' },
              { id: 'fuchsia', color: '#d946ef', shadow: 'rgba(217,70,239,0.4)' },
              { id: 'lime', color: '#84cc16', shadow: 'rgba(132,204,22,0.4)' },
              { id: 'orange', color: '#f97316', shadow: 'rgba(249,115,22,0.4)' },
              { id: 'pink', color: '#ec4899', shadow: 'rgba(236,72,153,0.4)' },
              { id: 'teal', color: '#14b8a6', shadow: 'rgba(20,184,166,0.4)' },
              { id: 'indigo', color: '#6366f1', shadow: 'rgba(99,102,241,0.4)' },
              { id: 'violet', color: '#8b5cf6', shadow: 'rgba(139,92,246,0.4)' }
            ].map(c => (
              <button 
                key={c.id}
                onClick={() => setAccent(c.id as any)} 
                className={`w-12 h-12 rounded-full transition-all relative flex items-center justify-center`}
                style={{ 
                  backgroundColor: c.color,
                  boxShadow: settings.accentColor === c.id ? `0 0 20px ${c.shadow}` : 'none',
                  transform: settings.accentColor === c.id ? 'scale(1.1)' : 'scale(1)',
                  border: settings.accentColor === c.id ? '2px solid white' : '2px solid transparent',
                  opacity: settings.accentColor === c.id ? 1 : 0.5
                }}
              >
                {settings.accentColor === c.id && <CheckCircle size={16} className="text-white drop-shadow-md" />}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-800/50">
          <div className="flex items-center justify-between py-3">
            <div className="pr-4">
              <div className="text-sm font-medium text-gray-200">Animações da Interface</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">Ative para transições suaves e efeitos visuais. Desative para economizar bateria.</div>
            </div>
            <button 
              onClick={() => updateSettings({ ...settings, animations: !settings.animations })} 
              className={getToggleColor(settings.animations)}
            >
              {settings.animations ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-gray-700" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAI = () => (
    <div className="p-5 space-y-6 pb-20 animate-fade-in">
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 space-y-5">
        <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest border-b border-gray-800/50 pb-3 flex items-center">
          <Zap size={14} className="mr-2 text-gold" />
          Motor de Inteligência
        </h3>
        
        <div className="space-y-3 pt-4 border-t border-gray-800/50">
          <label className="text-xs font-medium text-gray-400">Tom Padrão de Resposta</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'professional', label: 'Profissional' },
              { id: 'casual', label: 'Casual' },
              { id: 'empathetic', label: 'Empático' },
              { id: 'direct', label: 'Direto' }
            ].map(tone => (
              <button
                key={tone.id}
                onClick={() => updateSettings({ ...settings, ai: { ...settings.ai, defaultTone: tone.id as any } })}
                className={`p-3 rounded-xl border text-xs font-medium transition-all ${
                  (settings.ai.defaultTone || 'casual') === tone.id 
                    ? 'bg-gray-800 border-gray-500 text-white' 
                    : 'bg-black/30 border-gray-800 text-gray-500 hover:border-gray-700'
                }`}
              >
                {tone.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl divide-y divide-gray-800/50">
        <div className="p-4 bg-gray-800/30 rounded-t-2xl">
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Comportamento Avançado</h3>
        </div>
        {[
          { key: 'avoidCompliments', label: 'Evitar Elogios Diretos', desc: 'A IA evitará palavras como "linda", "perfeita", focando em interações mais desafiadoras.' },
          { key: 'shortResponses', label: 'Respostas Curtas', desc: 'Força a IA a gerar textos breves, simulando a Lei do Menor Esforço.' },
          { key: 'avoidQuestions', label: 'Evitar Perguntas', desc: 'Transforma perguntas em afirmações para manter o frame dominante.' },
          { key: 'autoAdjustFlirt', label: 'Auto-Ajuste de Risco', desc: 'A IA reduzirá o flirt automaticamente se detectar desinteresse no texto analisado.' },
          { key: 'memoryEnabled', label: 'Memória de Contexto', desc: 'A IA lembrará de detalhes de conversas anteriores dentro do mesmo perfil.' },
          { key: 'fastResponses', label: 'Geração Rápida', desc: 'Otimiza o prompt para respostas mais rápidas, com leve perda de complexidade analítica.' },
        ].map((item) => (
          <div key={item.key} className="p-5 flex items-center justify-between hover:bg-gray-800/20 transition-colors">
            <div className="pr-5">
              <div className="text-sm font-medium text-gray-200">{item.label}</div>
              <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.desc}</div>
            </div>
            <button onClick={() => toggle('ai', item.key)} className="flex-shrink-0">
              {/* @ts-ignore */}
              {settings.ai[item.key] ? <ToggleRight size={36} className={getToggleColor(true)} /> : <ToggleLeft size={36} className="text-gray-700" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSafety = () => (
    <div className="p-5 space-y-6 pb-20 animate-fade-in">
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 bg-emerald-900/10 border-b border-gray-800/50">
          <div className="flex items-center space-x-3 mb-2">
            <Shield size={20} className="text-emerald-500" />
            <h3 className="text-sm font-bold text-emerald-500">Proteção Ativa</h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Os filtros de segurança analisam suas mensagens antes do envio para evitar erros comuns que diminuem seu valor social.
          </p>
        </div>
        
        <div className="divide-y divide-gray-800/50">
          {[
            { key: 'antiNeedy', label: 'Filtro Anti-Carência', desc: 'Bloqueia mensagens que demonstram necessidade, cobrança ou busca por validação.' },
            { key: 'antiLongText', label: 'Alerta Anti-Textão', desc: 'Avisa se sua mensagem for desproporcionalmente maior que a última recebida.' },
            { key: 'antiRobot', label: 'Naturalidade (Anti-Robô)', desc: 'Garante que as respostas geradas pela IA pareçam humanas, com gírias e ritmo natural.' },
            { key: 'antiOverflirt', label: 'Controle de Overflirt', desc: 'Evita avanços agressivos ou sexuais fora de contexto que podem gerar bloqueio.' },
            { key: 'nsfwFilter', label: 'Filtro NSFW', desc: 'Bloqueia análise e geração de conteúdo explícito ou inapropriado.' },
            { key: 'toxicityFilter', label: 'Filtro de Toxicidade', desc: 'Evita respostas agressivas, ofensivas ou passivo-agressivas em excesso.' },
          ].map((item) => (
            <div key={item.key} className="p-5 flex items-center justify-between hover:bg-gray-800/20 transition-colors">
              <div className="pr-5">
                <div className="text-sm font-medium text-gray-200">{item.label}</div>
                <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.desc}</div>
              </div>
              <button onClick={() => toggle('safety', item.key)} className="flex-shrink-0">
                {/* @ts-ignore */}
                {settings.safety[item.key] ? <ToggleRight size={36} className="text-emerald-500" /> : <ToggleLeft size={36} className="text-gray-700" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const handleExportCSV = () => {
    let csvContent = "Profile ID,Profile Name,Timestamp,Role,Content\n";
    
    profiles.forEach(profile => {
      profile.messages.forEach(msg => {
        const date = new Date(msg.timestamp).toISOString();
        const content = msg.content?.replace(/"/g, '""') || '';
        csvContent += `"${profile.id}","${profile.name}","${date}","${msg.role}","${content}"\n`;
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nalabia_messages_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderBackup = () => (
    <div className="p-5 space-y-6 pb-20 animate-fade-in">
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 space-y-5">
        <div className="flex items-center space-x-3 border-b border-gray-800/50 pb-3">
          <Download size={18} className="text-blue-400" />
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Exportar Dados</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Baixe uma cópia local de todas as suas conversas, perfis e configurações. O backup JSON também é salvo na nuvem.
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={handleCreateBackup} disabled={isBackingUp} className="flex items-center justify-center space-x-2 p-4 bg-black/50 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50">
            <Database size={18} className="text-gray-300" />
            <span className="text-sm font-medium text-gray-200">{isBackingUp ? 'Salvando...' : 'Backup Completo (JSON)'}</span>
          </button>
          <button onClick={handleExportCSV} className="flex items-center justify-center space-x-2 p-4 bg-black/50 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors">
            <Download size={18} className="text-gray-300" />
            <span className="text-sm font-medium text-gray-200">Exportar Conversas (CSV)</span>
          </button>
        </div>
      </div>

      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5 space-y-5">
        <div className="flex items-center space-x-3 border-b border-gray-800/50 pb-3">
          <Upload size={18} className="text-emerald-400" />
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Restaurar Dados</h3>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Restaure seus dados a partir de um arquivo de backup JSON anterior. Isso substituirá os dados locais atuais.
        </p>
        
        <input 
          type="file" 
          accept=".json" 
          ref={fileInputRef} 
          onChange={handleRestoreBackup} 
          className="hidden" 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center space-x-2 p-4 bg-black/50 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors"
        >
          <Upload size={18} className="text-gray-300" />
          <span className="text-sm font-medium text-gray-200">Selecionar Arquivo JSON</span>
        </button>
      </div>

      <div className="bg-orange-900/10 border border-orange-900/30 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-mono text-orange-500/80 uppercase tracking-widest border-b border-orange-900/30 pb-3">Manutenção</h3>
        <p className="text-xs text-gray-500 leading-relaxed">
          Se o aplicativo estiver lento ou apresentando problemas, limpar o cache local pode ajudar. Seus dados salvos na nuvem não serão afetados.
        </p>
        <button onClick={handleClearCache} className="w-full flex items-center justify-center space-x-2 p-3 bg-orange-500/10 rounded-xl border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
          <Trash2 size={16} className="text-orange-500" />
          <span className="text-sm font-bold text-orange-500">Limpar Cache Local</span>
        </button>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="p-5 space-y-6 pb-20 animate-fade-in">
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-5 bg-gray-800/30 border-b border-gray-800/50">
          <h3 className="text-xs font-mono text-gray-400 uppercase tracking-widest">Preferências de Alerta</h3>
        </div>
        
        <div className="divide-y divide-gray-800/50">
          {[
            { id: 'push', title: 'Notificações Push', desc: 'Receba alertas diretamente no seu dispositivo sobre atualizações e dicas.' },
            { id: 'email', title: 'Notificações por Email', desc: 'Receba resumos semanais de desempenho, novidades e avisos de segurança.' },
            { id: 'sound', title: 'Sons no Aplicativo', desc: 'Efeitos sonoros sutis ao enviar mensagens, receber análises ou concluir ações.' }
          ].map(item => (
            <div key={item.id} className="p-5 flex items-center justify-between hover:bg-gray-800/20 transition-colors">
              <div className="pr-5">
                <div className="text-sm font-medium text-gray-200">{item.title}</div>
                <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.desc}</div>
              </div>
              <button 
                onClick={() => toggle('notifications' as any, item.id)} 
                className={getToggleColor(settings.notifications?.[item.id as keyof typeof settings.notifications] ?? false)}
              >
                {settings.notifications?.[item.id as keyof typeof settings.notifications] ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-gray-700" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'account': return 'Conta & Perfil';
      case 'appearance': return 'Aparência';
      case 'ai': return 'Inteligência';
      case 'safety': return 'Segurança';
      case 'backup': return 'Dados & Backup';
      case 'notifications': return 'Notificações';
      default: return 'Configurações';
    }
  };

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
      case 'ultra-dark': return 'bg-black/80';
      case 'light': return 'bg-white/80';
      case 'midnight': return 'bg-[#1e293b]/80';
      case 'dracula': return 'bg-[#44475a]/80';
      case 'hacker': return 'bg-black/80';
      case 'cyberpunk': return 'bg-black/80';
      case 'dark':
      default: return 'bg-black/80';
    }
  };

  return (
    <div className={`flex flex-col h-full ${getThemeBg()} animate-fade-in overflow-y-auto`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b border-gray-900 sticky top-0 ${getThemeHeaderBg()} backdrop-blur-md z-20`}>
        <div className="flex items-center">
          <button 
            onClick={() => activeSection === 'main' ? onClose() : setActiveSection('main')} 
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-900"
          >
            <ArrowLeft size={22} />
          </button>
          <h2 className="ml-2 text-sm font-bold tracking-wide">{getSectionTitle()}</h2>
        </div>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto">
        {activeSection === 'main' && renderMain()}
        {activeSection === 'account' && renderAccount()}
        {activeSection === 'appearance' && renderAppearance()}
        {activeSection === 'ai' && renderAI()}
        {activeSection === 'safety' && renderSafety()}
        {activeSection === 'backup' && renderBackup()}
        {activeSection === 'notifications' && renderNotifications()}
      </div>

      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up">
            <h3 className="text-lg font-bold text-white mb-2">{modalConfig.title}</h3>
            <p className="text-sm text-gray-400 mb-6">{modalConfig.message}</p>
            <div className="flex justify-end gap-3">
              {modalConfig.type === 'confirm' && (
                <button 
                  onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button 
                onClick={() => {
                  if (modalConfig.onConfirm) modalConfig.onConfirm();
                  setModalConfig({ ...modalConfig, isOpen: false });
                }}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
                  modalConfig.type === 'confirm' && modalConfig.title.includes('Excluir') 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-nalabia-gold text-black hover:bg-nalabia-gold-glow'
                }`}
              >
                {modalConfig.type === 'confirm' ? 'Confirmar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
