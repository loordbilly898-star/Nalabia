import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, updatePassword, sendEmailVerification, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, googleProvider, db, storage } from '../services/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { sanitizeFirestoreData, handleFirestoreError, OperationType, SavedResponse } from '../types';

export interface UserAIProfile {
  userID: string;
  goal: string;
  experienceLevel: string;
  communicationStyle: string;
  flirtLevel: string;
  responseLength: string;
  mainPlatform: string;
  conversationGoal: string;
  personalityType: string;
}

interface UserData {
  userID: string;
  name: string;
  email: string;
  photoURL?: string;
  level: number;
  xp: number;
  createdAt: number;
  onboardingCompleted: boolean;
  settings?: any;
  profiles?: any[];
  plano?: string;
  status?: string;
  expiraEm?: string;
  nalabiaPrimeAcess?: boolean;
  darkPackAccess?: boolean;
  coursesAccess?: boolean;
  mpCustomerId?: string;
  freeMessagesUsed?: number;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  userAIProfile: UserAIProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string, onboardingData?: Omit<UserAIProfile, 'userID'>) => Promise<void>;
  loginWithGoogle: (onboardingData?: Omit<UserAIProfile, 'userID'>) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string, onboardingData?: Omit<UserAIProfile, 'userID'>) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  addXp: (amount: number) => Promise<void>;
  completeOnboarding: (profileData: Omit<UserAIProfile, 'userID'>) => Promise<void>;
  updateUserSettings: (settings: any) => Promise<void>;
  updateUserProfiles: (profiles: any[]) => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
  updateUserPhoto: (file: File) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  createBackup: () => Promise<void>;
  restoreBackup: (file: File) => Promise<void>;
  deleteAccount: () => Promise<void>;
  unlockFreeTrial: (code: string) => Promise<void>;
  incrementFreeMessages: () => Promise<void>;
  saveResponseToVault: (text: string, category?: string) => Promise<void>;
  getSavedResponses: () => Promise<SavedResponse[]>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userAIProfile, setUserAIProfile] = useState<UserAIProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | undefined;
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          
          // Set up the real-time listener
          unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserData;
              // Developer bypass
              if (currentUser.email === 'loordbilly898@gmail.com') {
                data.nalabiaPrimeAcess = true;
                data.darkPackAccess = true;
                data.coursesAccess = true;
                data.status = 'ativo';
                data.plano = 'Desenvolvedor';
              } else if (currentUser.email === 'kauanhenrique171822@gmail.com') {
                data.nalabiaPrimeAcess = true;
                data.darkPackAccess = true;
                data.coursesAccess = true;
                data.status = 'ativo';
                data.plano = 'Mensal';
              } else if (currentUser.email === 'gamerbilly898@gmail.com') {
                data.nalabiaPrimeAcess = true;
                // Cursos pagos agora, removido acesso gratuito
                // Não forçamos darkPackAccess para permitir testes de pagamento
                data.status = 'ativo';
                data.plano = 'Mensal';
              } else if (currentUser.email === 'encantomirim53@gmail.com') {
                data.coursesAccess = true;
                data.darkPackAccess = true;
              } else if (currentUser.email === 'nauandematoss@gmail.com') {
                data.coursesAccess = true;
              } else if (currentUser.email?.toLowerCase() === 'luissilva960884@gmail.com' || currentUser.email?.toLowerCase() === 'paz180511@gmail.com') {
                const expDate = new Date();
                expDate.setDate(expDate.getDate() + 30);
                
                const currentExp = data.expiraEm ? new Date(data.expiraEm) : new Date(0);
                const daysUntilExp = (currentExp.getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                
                if (daysUntilExp < 29 || data.status !== 'ativo' || data.darkPackAccess || data.coursesAccess) {
                  data.nalabiaPrimeAcess = true;
                  data.status = 'ativo';
                  data.plano = 'Mensal (Liberado)';
                  data.expiraEm = expDate.toISOString();
                  data.darkPackAccess = false;
                  data.coursesAccess = false;
                  try {
                    await updateDoc(userRef, {
                      nalabiaPrimeAcess: true,
                      status: 'ativo',
                      plano: 'Mensal (Liberado)',
                      expiraEm: expDate.toISOString(),
                      darkPackAccess: false,
                      coursesAccess: false
                    });
                  } catch (e) {
                    console.error("Failed to activate 30-day access", e);
                  }
                }
              } else if (currentUser.email === 'hhudson714@gmail.com' && data.plano !== 'Teste Grátis (7 Dias)' && data.plano !== 'Expirado') {
                const expDate = new Date();
                expDate.setDate(expDate.getDate() + 7);
                data.nalabiaPrimeAcess = true;
                data.status = 'ativo';
                data.plano = 'Teste Grátis (7 Dias)';
                data.expiraEm = expDate.toISOString();
                try {
                  await updateDoc(userRef, {
                    nalabiaPrimeAcess: true,
                    status: 'ativo',
                    plano: 'Teste Grátis (7 Dias)',
                    expiraEm: expDate.toISOString()
                  });
                } catch (e) {
                  console.error("Failed to activate 7-day trial", e);
                }
              } else if (currentUser.email?.toLowerCase() === 'luqinziky@hotmail.com' && data.plano !== 'Mensal' && data.plano !== 'Expirado') {
                const expDate = new Date();
                expDate.setDate(expDate.getDate() + 30);
                data.nalabiaPrimeAcess = true;
                data.status = 'ativo';
                data.plano = 'Mensal';
                data.expiraEm = expDate.toISOString();
                try {
                  await updateDoc(userRef, {
                    nalabiaPrimeAcess: true,
                    status: 'ativo',
                    plano: 'Mensal',
                    expiraEm: expDate.toISOString()
                  });
                } catch (e) {
                  console.error("Failed to activate 30-day access", e);
                }
              } else if (data.plano === 'Teste Grátis' && data.nalabiaPrimeAcess && !data.expiraEm) {
                data.nalabiaPrimeAcess = false;
                data.status = 'pendente';
                data.plano = 'Expirado';
                try {
                  await updateDoc(userRef, {
                    nalabiaPrimeAcess: false,
                    status: 'pendente',
                    plano: 'Expirado'
                  });
                } catch (e) {
                  console.error("Failed to revoke free trial", e);
                }
              } else if (data.expiraEm) {
                const expDate = new Date(data.expiraEm);
                if (expDate < new Date() && data.nalabiaPrimeAcess) {
                  data.nalabiaPrimeAcess = false;
                  data.status = 'pendente';
                  data.plano = 'Expirado';
                  try {
                    await updateDoc(userRef, {
                      nalabiaPrimeAcess: false,
                      status: 'pendente',
                      plano: 'Expirado'
                    });
                  } catch (e) {
                    console.error("Failed to update expired plan", e);
                  }
                }
              }
              setUserData(data);
            }
          }, (error) => {
             handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`, auth);
          });

          // Fetch AI Profile with real-time listener
          const profileRef = doc(db, 'user_ai_profile', currentUser.uid);
          unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserAIProfile(docSnap.data() as UserAIProfile);
            } else {
              setUserAIProfile(null);
            }
          }, (error) => {
             handleFirestoreError(error, OperationType.GET, `user_ai_profile/${currentUser.uid}`, auth);
          });
          
        } catch (error: any) {
          // If the client is offline or using a mock key, Firestore will fail to connect.
          // We handle this gracefully by providing fallback data instead of throwing a scary error.
          console.warn("Could not fetch user data from Firestore (client may be offline). Using local fallback.");
          
          // Fallback to basic user data so the app doesn't break
          setUserData({
            userID: currentUser.uid,
            name: currentUser.displayName || 'Usuário',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || undefined,
            level: 1,
            xp: 0,
            createdAt: Date.now(),
            onboardingCompleted: true, // Assume true to avoid getting stuck in onboarding while offline
          });
        }
      } else {
        setUserData(null);
        setUserAIProfile(null);
        if (unsubscribeUser) unsubscribeUser();
        if (unsubscribeProfile) unsubscribeProfile();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string, onboardingData?: Omit<UserAIProfile, 'userID'>) => {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "mock-api-key" || firebaseConfig.apiKey.includes("TODO")) {
      throw new Error("Para usar o login, configure o Firebase no painel do AI Studio.");
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    if (onboardingData) {
      try {
        const userRef = doc(db, 'users', userCredential.user.uid);
        await updateDoc(userRef, { onboardingCompleted: true });
        
        const fullProfile: UserAIProfile = {
          ...onboardingData,
          userID: userCredential.user.uid,
        };
        const profileRef = doc(db, 'user_ai_profile', userCredential.user.uid);
        await setDoc(profileRef, sanitizeFirestoreData(fullProfile));
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userCredential.user.uid}`, auth);
      }
    }
  };

  const loginWithGoogle = async (onboardingData?: Omit<UserAIProfile, 'userID'>) => {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "mock-api-key" || firebaseConfig.apiKey.includes("TODO")) {
      throw new Error("Para usar o login, configure o Firebase no painel do AI Studio.");
    }
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'users', userCredential.user.uid);
      
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userCredential.user.uid}`, auth);
        throw error;
      }

      if (!userSnap.exists()) {
        const isDeveloper = userCredential.user.email === 'loordbilly898@gmail.com';
        const isLegacyPremium = userCredential.user.email === 'kauanhenrique171822@gmail.com' || userCredential.user.email === 'gamerbilly898@gmail.com';
        
        let customerId = '';
        try {
          const response = await fetch('/api/create-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: userCredential.user.email || '', 
              name: userCredential.user.displayName || 'Usuário' 
            })
          });
          if (response.ok) {
            const data = await response.json();
            customerId = data.customer_id || '';
          }
        } catch (err) {
          console.warn('Failed to create Mercado Pago customer:', err);
        }

        const newUserData: UserData = {
          userID: userCredential.user.uid,
          name: userCredential.user.displayName || 'Usuário',
          email: userCredential.user.email || '',
          photoURL: userCredential.user.photoURL || undefined,
          level: 1,
          xp: 0,
          createdAt: Date.now(),
          onboardingCompleted: !!onboardingData,
          plano: isDeveloper ? 'Desenvolvedor' : (isLegacyPremium ? 'Mensal' : ''),
          status: (isDeveloper || isLegacyPremium) ? 'ativo' : 'pendente',
          expiraEm: '',
          nalabiaPrimeAcess: (isDeveloper || isLegacyPremium),
          mpCustomerId: customerId,
          freeMessagesUsed: 0,
        };
        try {
          await setDoc(userRef, sanitizeFirestoreData(newUserData));
          setUserData(newUserData);
        } catch (error) {
          await signOut(auth);
          throw error;
        }
      }

      if (onboardingData) {
        await updateDoc(userRef, { onboardingCompleted: true });
        const fullProfile: UserAIProfile = {
          ...onboardingData,
          userID: userCredential.user.uid,
        };
        const profileRef = doc(db, 'user_ai_profile', userCredential.user.uid);
        await setDoc(profileRef, sanitizeFirestoreData(fullProfile));
        setUserAIProfile(fullProfile);
      }
    } catch (error) {
      console.warn("Google Login Error:", error);
      throw error;
    }
  };

  const registerWithEmail = async (name: string, email: string, password: string, onboardingData?: Omit<UserAIProfile, 'userID'>) => {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "mock-api-key" || firebaseConfig.apiKey.includes("TODO")) {
      throw new Error("Para usar o login, configure o Firebase no painel do AI Studio.");
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    
    try {
      const userRef = doc(db, 'users', userCredential.user.uid);
      const isDeveloper = email === 'loordbilly898@gmail.com';
      const isLegacyPremium = email === 'kauanhenrique171822@gmail.com' || email === 'gamerbilly898@gmail.com';
      
      let customerId = '';
      try {
        const response = await fetch('/api/create-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name })
        });
        if (response.ok) {
          const data = await response.json();
          customerId = data.customer_id || '';
        }
      } catch (err) {
        console.warn('Failed to create Mercado Pago customer:', err);
      }

      const newUserData: UserData = {
        userID: userCredential.user.uid,
        name: name,
        email: email,
        level: 1,
        xp: 0,
        createdAt: Date.now(),
        onboardingCompleted: !!onboardingData,
        plano: isDeveloper ? 'Desenvolvedor' : (isLegacyPremium ? 'Mensal' : ''),
        status: (isDeveloper || isLegacyPremium) ? 'ativo' : 'pendente',
        expiraEm: '',
        nalabiaPrimeAcess: (isDeveloper || isLegacyPremium),
        mpCustomerId: customerId,
        freeMessagesUsed: 0,
      };
      try {
        await setDoc(userRef, sanitizeFirestoreData(newUserData));
        setUserData(newUserData);
      } catch (error) {
        await signOut(auth);
        throw error;
      }

      if (onboardingData) {
        const fullProfile: UserAIProfile = {
          ...onboardingData,
          userID: userCredential.user.uid,
        };
        const profileRef = doc(db, 'user_ai_profile', userCredential.user.uid);
        await setDoc(profileRef, sanitizeFirestoreData(fullProfile));
        setUserAIProfile(fullProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${userCredential.user.uid}`, auth);
    }
  };

  const resetPassword = async (email: string) => {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "mock-api-key" || firebaseConfig.apiKey.includes("TODO")) {
      throw new Error("Para usar a recuperação de senha, configure o Firebase no painel do AI Studio.");
    }
    await sendPasswordResetEmail(auth, email);
  };

  const completeOnboarding = async (profileData: Omit<UserAIProfile, 'userID'>) => {
    if (!user || !userData) return;

    const fullProfile: UserAIProfile = {
      ...profileData,
      userID: user.uid,
    };

    try {
      // Save AI Profile
      const profileRef = doc(db, 'user_ai_profile', user.uid);
      await setDoc(profileRef, sanitizeFirestoreData(fullProfile));
      setUserAIProfile(fullProfile);

      // Update User Data
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { onboardingCompleted: true });
      setUserData({ ...userData, onboardingCompleted: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`, auth);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserData(null);
      setUserAIProfile(null);
    try {
      localStorage.removeItem('nalabia_settings_v1');
    } catch (e) {}
      // Force reload to clear all React state and memory
      window.location.reload();
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const addXp = async (amount: number) => {
    if (!user || !userData) return;
    
    const newXp = userData.xp + amount;
    const newLevel = Math.floor(newXp / 1000) + 1;
    
    const updatedData = { ...userData, xp: newXp, level: newLevel };
    setUserData(updatedData);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, sanitizeFirestoreData({ xp: newXp, level: newLevel }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`, auth);
    }
  };

  const updateUserSettings = async (settings: any) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, sanitizeFirestoreData({
        settings: settings
      }));
      setUserData(prev => prev ? { ...prev, settings } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`, auth);
      throw error;
    }
  };

  const updateUserProfiles = async (profiles: any[]) => {
    if (!user) return;
    try {
      // Strip images from messages to prevent exceeding the 1MB Firestore document limit
      // Also limit messages to last 20 to prevent Firestore 1MB document limit errors
      const strippedProfiles = profiles.map(p => ({
        ...p,
        messages: p.messages ? p.messages.slice(-20).map((m: any) => {
          const { image, ...rest } = m;
          return rest;
        }) : []
      }));

      const userRef = doc(db, 'users', user.uid);
      const sanitizedProfiles = sanitizeFirestoreData(strippedProfiles);
      await updateDoc(userRef, {
        profiles: sanitizedProfiles
      });
      setUserData(prev => prev ? { ...prev, profiles: sanitizedProfiles } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`, auth);
      throw error;
    }
  };

  const updateUserName = async (name: string) => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName: name });
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, sanitizeFirestoreData({ name }));
      setUserData(prev => prev ? { ...prev, name } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`, auth);
    }
  };

  const updateUserPhoto = async (file: File) => {
    if (!user) return;
    try {
      const storageRef = ref(storage, `users/${user.uid}/profile.jpg`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      await updateProfile(user, { photoURL });
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, sanitizeFirestoreData({ photoURL }));
      setUserData(prev => prev ? { ...prev, photoURL } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`, auth);
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !user.email) return;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  const verifyEmail = async () => {
    if (!user) return;
    await sendEmailVerification(user);
  };

  const createBackup = async () => {
    if (!user || !userData) return;
    
    const backupData = {
      userData,
      userAIProfile,
      timestamp: Date.now()
    };
    
    const jsonString = JSON.stringify(backupData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const storageRef = ref(storage, `backups/${user.uid}/backup_${Date.now()}.json`);
    await uploadBytes(storageRef, blob);
    
    // Also trigger download for user
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nalabia_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restoreBackup = async (file: File) => {
    if (!user) return;
    
    const text = await file.text();
    const backupData = JSON.parse(text);
    
    if (backupData.userData && backupData.userData.userID === user.uid) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, sanitizeFirestoreData(backupData.userData));
        setUserData(backupData.userData);
        
        if (backupData.userAIProfile) {
          const profileRef = doc(db, 'user_ai_profile', user.uid);
          await setDoc(profileRef, sanitizeFirestoreData(backupData.userAIProfile));
          setUserAIProfile(backupData.userAIProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`, auth);
      }
    } else {
      throw new Error("Backup inválido ou pertence a outro usuário.");
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      // Check if recent login is required before deleting data
      const lastSignInTime = new Date(user.metadata.lastSignInTime || '').getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now - lastSignInTime > fiveMinutes) {
        throw new Error('Para sua segurança, você precisa fazer login novamente antes de excluir sua conta. Por favor, saia do aplicativo, faça login novamente e tente excluir a conta.');
      }

      // Delete user data from Firestore
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteDoc(doc(db, 'user_ai_profile', user.uid));
      
      // Delete user account
      await user.delete();
      
      // Clear local state
      setUserData(null);
      setUserAIProfile(null);
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login' || error.message?.includes('auth/requires-recent-login')) {
        throw new Error('Para sua segurança, você precisa fazer login novamente antes de excluir sua conta. Por favor, saia do aplicativo, faça login novamente e tente excluir a conta.');
      }
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`, auth);
      throw error;
    }
  };

  const VALID_INVITE_CODES = [
    'NaLábia-7X9P-2K4M',
    'NaLábia-3B8N-5V1C',
    'NaLábia-9M2Q-8L6Z',
    'NaLábia-4F1W-7T3Y',
    'NaLábia-6H5R-9J2D',
    'NaLábia-1K8C-4N7X',
    'NaLábia-5V3M-2B9L',
    'NaLábia-8T6Y-1W4F',
    'NaLábia-2J9D-6H5R',
    'NaLábia-7P4M-3X8N',
    'NaLábia-9L1C-5V2Q',
    'NaLábia-3W8Z-7T4F',
    'NaLábia-6N2X-1K9C',
    'NaLábia-4R5D-8J3H',
    'NaLábia-5M7P-2B6L'
  ];

  const unlockFreeTrial = async (code: string) => {
    throw new Error("A campanha de Teste Grátis foi encerrada. O acesso gratuito não está mais disponível.");
  };

  const incrementFreeMessages = async () => {
    if (!user || !userData) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const newCount = (userData.freeMessagesUsed || 0) + 1;
      await updateDoc(userRef, { freeMessagesUsed: newCount });
      setUserData({ ...userData, freeMessagesUsed: newCount });
    } catch (error) {
      console.error("Error incrementing free messages:", error);
    }
  };

  const saveResponseToVault = async (text: string, category?: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    try {
      const newResponseRef = doc(collection(db, 'saved_responses'));
      const newResponse: SavedResponse = {
        id: newResponseRef.id,
        userID: user.uid,
        text,
        category,
        createdAt: Date.now()
      };
      await setDoc(newResponseRef, sanitizeFirestoreData(newResponse));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'saved_responses', auth);
      throw error;
    }
  };

  const getSavedResponses = async (): Promise<SavedResponse[]> => {
    if (!user) return [];
    try {
      const q = query(collection(db, 'saved_responses'), where('userID', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const responses: SavedResponse[] = [];
      querySnapshot.forEach((doc) => {
        responses.push(doc.data() as SavedResponse);
      });
      return responses.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'saved_responses', auth);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, userData, userAIProfile, loading, 
      loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword, logout, 
      addXp, completeOnboarding, updateUserSettings, updateUserProfiles,
      updateUserName, updateUserPhoto, updateUserPassword, verifyEmail,
      createBackup, restoreBackup, deleteAccount, unlockFreeTrial, incrementFreeMessages,
      saveResponseToVault, getSavedResponses
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
