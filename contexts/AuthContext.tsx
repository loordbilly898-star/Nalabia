import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '@supabase/supabase-js';
import { SavedResponse, Memory } from '../types';

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
  memories?: Memory[];
  plano?: string;
  status?: string;
  expiraEm?: string;
  nalabiaPrimeAcess?: boolean;
  darkPackAccess?: boolean;
  coursesAccess?: boolean;
  mpCustomerId?: string;
  freeMessagesUsed?: number;
  dailyRequests?: number;
  lastRequestDate?: string;
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
  updateUserMemories: (memories: Memory[]) => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
  updateUserPhoto: (file: File) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  createBackup: () => Promise<void>;
  restoreBackup: (file: File) => Promise<void>;
  deleteAccount: () => Promise<void>;
  unlockFreeTrial: (code: string) => Promise<void>;
  incrementUsage: () => Promise<void>;
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
    const fetchUserData = async (currentUser: User) => {
      try {
        const { data: userDoc, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('userID', currentUser.id)
          .single();

        if (userError && userError.code !== 'PGRST116') {
          console.error("Error fetching user data:", userError);
        }

        let data: UserData;
        if (userDoc) {
          data = userDoc as UserData;
          
          // Auto-expire check
          if ((data.status === 'ativo' || data.nalabiaPrimeAcess) && data.expiraEm) {
            const expDate = new Date(data.expiraEm);
            if (new Date() > expDate) {
              console.log("Subscription expired! Updating database to pending.");
              data.status = 'expirado';
              data.nalabiaPrimeAcess = false;
              // Update database automatically
              supabase.from('users').update({ status: 'expirado', nalabiaPrimeAcess: false }).eq('userID', data.userID).then(({error}) => {
                if (error) console.error("Error auto-expiring:", error);
              });
            }
          }
        } else {
           // Fallback to basic user data so the app doesn't break
           data = {
            userID: currentUser.id,
            name: currentUser.user_metadata?.full_name || 'Usuário',
            email: currentUser.email || '',
            photoURL: currentUser.user_metadata?.avatar_url || undefined,
            level: 1,
            xp: 0,
            createdAt: Date.now(),
            onboardingCompleted: true, // Assume true to avoid getting stuck in onboarding while offline
          };
        }

        // Developer bypass
        if (currentUser.email === 'loordbilly898@gmail.com') {
          data.nalabiaPrimeAcess = true;
          data.darkPackAccess = true;
          data.coursesAccess = true;
          data.status = 'ativo';
          data.plano = 'Desenvolvedor';
        } else if (
          currentUser.email === 'kauanhenrique171822@gmail.com' ||
          currentUser.email === 'nauandematoss@gmail.com' ||
          currentUser.email === 'Paz180511@gmail.com' ||
          currentUser.email === 'encantomirim53@gmail.com'
        ) {
          data.nalabiaPrimeAcess = true;
          data.darkPackAccess = true;
          data.coursesAccess = true;
          data.status = 'ativo';
          data.plano = 'Mensal';
        } else if (currentUser.email === 'gamerbilly898@gmail.com') {
          data.nalabiaPrimeAcess = true;
          data.status = 'ativo';
          data.plano = 'Mensal';
        }

        setUserData(data);

        const { data: profileDoc, error: profileError } = await supabase
          .from('user_ai_profile')
          .select('*')
          .eq('userID', currentUser.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error("Error fetching user AI profile:", profileError);
        }

        if (profileDoc) {
          setUserAIProfile(profileDoc as UserAIProfile);
        } else {
          setUserAIProfile(null);
        }
      } catch (error) {
        console.error("Error in fetchUserData:", error);
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user);
        } else {
          setUserData(null);
          setUserAIProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string, onboardingData?: Omit<UserAIProfile, 'userID'>) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (onboardingData && data.user) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ onboardingCompleted: true })
        .eq('userID', data.user.id);
      
      if (updateError) console.error("Error updating onboarding status:", updateError);

      const fullProfile: UserAIProfile = {
        ...onboardingData,
        userID: data.user.id,
      };
      
      const { error: profileError } = await supabase
        .from('user_ai_profile')
        .upsert(fullProfile);
        
      if (profileError) console.error("Error saving AI profile:", profileError);
    }
  };

  const loginWithGoogle = async (onboardingData?: Omit<UserAIProfile, 'userID'>) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    // Note: Supabase OAuth redirects, so onboardingData handling here might not work as expected immediately after redirect.
    // It's usually handled in the onAuthStateChange listener after redirect.
  };

  const registerWithEmail = async (name: string, email: string, password: string, onboardingData?: Omit<UserAIProfile, 'userID'>) => {
    let attempts = 0;
    const maxAttempts = 2;
    let signUpResult: { data: any, error: any } = { data: null, error: null };

    while (attempts < maxAttempts) {
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: window.location.origin
        }
      });

      // 15-second timeout
      const timeoutPromise = new Promise<{data: any, error: any}>((resolve) => {
        setTimeout(() => {
          resolve({ 
            data: { user: null, session: null }, 
            error: { status: 504, name: 'TimeoutError', message: 'A requisição demorou muito tempo.' } 
          });
        }, 15000);
      });

      signUpResult = await Promise.race([signUpPromise, timeoutPromise]);
      
      if (!signUpResult.error) break;
      attempts++;
    }

    let { data, error } = signUpResult;

    if (error) {
      if (error.status === 504 || error.name === 'AuthRetryableFetchError' || error.name === 'TimeoutError') {
        // Fallback: The server timed out, but the account might have been created in the background.
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        
        if (loginError && loginError.message === 'Email not confirmed') {
          throw new Error('Email not confirmed');
        } else if (loginData?.user) {
          data = loginData;
          error = null as any;
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    if (data?.user && !error) {
      const isDeveloper = email === 'loordbilly898@gmail.com';
      const isLegacyPremium = email === 'kauanhenrique171822@gmail.com' || email === 'gamerbilly898@gmail.com' || email === 'nauandematoss@gmail.com' || email === 'Paz180511@gmail.com' || email === 'encantomirim53@gmail.com';
      const hasPackages = email === 'kauanhenrique171822@gmail.com' || email === 'nauandematoss@gmail.com' || email === 'Paz180511@gmail.com' || email === 'encantomirim53@gmail.com' || isDeveloper;

      const newUserData: UserData = {
        userID: data.user.id,
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
        darkPackAccess: hasPackages,
        coursesAccess: hasPackages,
        freeMessagesUsed: 0,
      };

      const { error: userError } = await supabase
        .from('users')
        .upsert(newUserData);

      if (userError) {
        throw userError; // Throw so LoginView can handle it
      } else {
        setUserData(newUserData);
      }

      if (onboardingData) {
        const fullProfile: UserAIProfile = {
          ...onboardingData,
          userID: data.user.id,
        };
        const { error: profileError } = await supabase
          .from('user_ai_profile')
          .upsert(fullProfile);
          
        if (profileError) {
           throw profileError; // Throw so LoginView can handle it
        } else {
           setUserAIProfile(fullProfile);
        }
      }
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const completeOnboarding = async (profileData: Omit<UserAIProfile, 'userID'>) => {
    if (!user || !userData) return;

    const fullProfile: UserAIProfile = {
      ...profileData,
      userID: user.id,
    };

    try {
      const { error: profileError } = await supabase
        .from('user_ai_profile')
        .upsert(fullProfile);
        
      if (profileError) throw profileError;
      setUserAIProfile(fullProfile);

      const { error: userError } = await supabase
        .from('users')
        .update({ onboardingCompleted: true })
        .eq('userID', user.id);
        
      if (userError) throw userError;
      setUserData({ ...userData, onboardingCompleted: true });
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUserData(null);
      setUserAIProfile(null);
      try {
        localStorage.removeItem('nalabia_settings_v1');
      } catch (e) {}
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
      const { error } = await supabase
        .from('users')
        .update({ xp: newXp, level: newLevel })
        .eq('userID', user.id);
        
      if (error) throw error;
    } catch (error) {
      console.error("Error adding XP:", error);
    }
  };

  const updateUserSettings = async (settings: any) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ settings })
        .eq('userID', user.id);
        
      if (error) throw error;
      setUserData(prev => prev ? { ...prev, settings } : null);
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    }
  };

  const updateUserProfiles = async (profiles: any[]) => {
    if (!user) return;
    try {
      const strippedProfiles = profiles.map(p => ({
        ...p,
        messages: p.messages ? p.messages.slice(-20).map((m: any) => {
          const { image, ...rest } = m;
          return rest;
        }) : []
      }));

      const { error } = await supabase
        .from('users')
        .update({ profiles: strippedProfiles })
        .eq('userID', user.id);
        
      if (error) throw error;
      setUserData(prev => prev ? { ...prev, profiles: strippedProfiles } : null);
    } catch (error) {
      console.error("Error updating profiles:", error);
      throw error;
    }
  };

  const updateUserMemories = async (memories: Memory[]) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ memories })
        .eq('userID', user.id);
        
      if (error) throw error;
      setUserData(prev => prev ? { ...prev, memories } : null);
    } catch (error) {
      console.error("Error updating memories:", error);
      throw error;
    }
  };

  const updateUserName = async (name: string) => {
    if (!user) return;
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: name }
      });
      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from('users')
        .update({ name })
        .eq('userID', user.id);
        
      if (dbError) throw dbError;
      setUserData(prev => prev ? { ...prev, name } : null);
    } catch (error) {
      console.error("Error updating name:", error);
    }
  };

  const updateUserPhoto = async (file: File) => {
    if (!user) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/profile.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });
        
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });
      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from('users')
        .update({ photoURL: publicUrl })
        .eq('userID', user.id);
        
      if (dbError) throw dbError;
      setUserData(prev => prev ? { ...prev, photoURL: publicUrl } : null);
    } catch (error) {
      console.error("Error updating photo:", error);
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return;
    // Supabase doesn't require current password for update if user is already logged in
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  };

  const verifyEmail = async () => {
    // Supabase sends verification email automatically on signup if configured.
    // To resend, we can use resend()
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });
    if (error) throw error;
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
    
    const fileName = `${user.id}/backup_${Date.now()}.json`;
    const { error } = await supabase.storage
      .from('backups')
      .upload(fileName, blob);
      
    if (error) console.error("Error saving backup to storage:", error);
    
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
    
    if (backupData.userData && backupData.userData.userID === user.id) {
      try {
        const { error: userError } = await supabase
          .from('users')
          .upsert(backupData.userData);
          
        if (userError) throw userError;
        setUserData(backupData.userData);
        
        if (backupData.userAIProfile) {
          const { error: profileError } = await supabase
            .from('user_ai_profile')
            .upsert(backupData.userAIProfile);
            
          if (profileError) throw profileError;
          setUserAIProfile(backupData.userAIProfile);
        }
      } catch (error) {
        console.error("Error restoring backup:", error);
      }
    } else {
      throw new Error("Backup inválido ou pertence a outro usuário.");
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    try {
      // Delete user data from Supabase
      await supabase.from('users').delete().eq('userID', user.id);
      await supabase.from('user_ai_profile').delete().eq('userID', user.id);
      
      // Delete user account (Requires Edge Function or Admin API usually, but we can try RPC if configured)
      // For now, we sign out. To truly delete the auth user, you need a Supabase Edge Function or call the admin API from your backend.
      const { error } = await supabase.rpc('delete_user');
      if (error) {
         console.warn("RPC delete_user failed (might not exist), signing out instead.", error);
      }
      
      await supabase.auth.signOut();
      
      setUserData(null);
      setUserAIProfile(null);
    } catch (error: any) {
      console.error("Error deleting account:", error);
      throw error;
    }
  };

  const unlockFreeTrial = async (code: string) => {
    throw new Error("A campanha de Teste Grátis foi encerrada. O acesso gratuito não está mais disponível.");
  };

  const incrementUsage = async () => {
    if (!user || !userData) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const updates: any = {};
      
      if (userData.lastRequestDate !== today) {
        updates.dailyRequests = 1;
        updates.lastRequestDate = today;
      } else {
        updates.dailyRequests = (userData.dailyRequests || 0) + 1;
      }

      const needsSubscription = !userData?.nalabiaPrimeAcess && userData?.status !== 'ativo';
      if (needsSubscription) {
        updates.freeMessagesUsed = (userData.freeMessagesUsed || 0) + 1;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('userID', user.id);

      if (error) throw error;
      setUserData({ ...userData, ...updates });
    } catch (error) {
      console.error("Error incrementing usage:", error);
    }
  };

  const saveResponseToVault = async (text: string, category?: string) => {
    if (!user) throw new Error("Usuário não autenticado.");
    try {
      const newResponse = {
        userID: user.id,
        text,
        category,
        createdAt: Date.now()
      };
      
      const { error } = await supabase
        .from('saved_responses')
        .insert(newResponse);
        
      if (error) throw error;
    } catch (error) {
      console.error("Error saving response:", error);
      throw error;
    }
  };

  const getSavedResponses = async (): Promise<SavedResponse[]> => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('saved_responses')
        .select('*')
        .eq('userID', user.id)
        .order('createdAt', { ascending: false });
        
      if (error) throw error;
      return data as SavedResponse[];
    } catch (error) {
      console.error("Error getting saved responses:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, userData, userAIProfile, loading, 
      loginWithEmail, loginWithGoogle, registerWithEmail, resetPassword, logout, 
      addXp, completeOnboarding, updateUserSettings, updateUserProfiles, updateUserMemories,
      updateUserName, updateUserPhoto, updateUserPassword, verifyEmail,
      createBackup, restoreBackup, deleteAccount, unlockFreeTrial, incrementUsage,
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
