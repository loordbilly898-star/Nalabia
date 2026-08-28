import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { supabase } from "../services/supabase";
import { User } from "@supabase/supabase-js";
import { SavedResponse, Memory } from "../types";
import { logEvent } from "../services/logger";
import { verifyDeviceTrial } from "../services/antiFraud";

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
  plano?: string; // Nome do plano (ex: 'Plano Mensal', 'Vitalício')
  status?: string; // 'ativo', 'pendente', 'expirado', 'ativo_trial'
  expiraEm?: string; // Data de expiração ISO
  nalabiaPrimeAcess?: boolean;
  darkPackAccess?: boolean;
  coursesAccess?: boolean;
  mentoriaAccess?: boolean;
  mpCustomerId?: string;
  freeMessagesUsed?: number;
  dailyRequests?: number;
  lastRequestDate?: string;
  trialStartedAt?: number;
  trialExpiresAt?: number;
  trialAbuseDetected?: boolean;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  userAIProfile: UserAIProfile | null;
  loading: boolean;
  loginWithEmail: (
    email: string,
    password: string,
    onboardingData?: Omit<UserAIProfile, "userID">,
  ) => Promise<void>;
  loginWithGoogle: (
    onboardingData?: Omit<UserAIProfile, "userID">,
  ) => Promise<void>;
  registerWithEmail: (
    name: string,
    email: string,
    password: string,
    onboardingData?: Omit<UserAIProfile, "userID">,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  addXp: (amount: number) => Promise<void>;
  completeOnboarding: (
    profileData: Omit<UserAIProfile, "userID">,
  ) => Promise<void>;
  updateUserSettings: (settings: any) => Promise<void>;
  updateUserProfiles: (profiles: any[]) => Promise<void>;
  updateUserMemories: (memories: Memory[]) => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
  updateUserPhoto: (file: File) => Promise<void>;
  updateUserPassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userAIProfile, setUserAIProfile] = useState<UserAIProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const authTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchUserData = async (currentUser: User) => {
      const startTime = Date.now();
      const FETCH_TIMEOUT = 50000; // 50 seconds timeout for robustness

      try {
        // Parallelize all three main fetches
        const [userResult, profileResult, assinaturaResult]: any[] =
          await Promise.all([
            Promise.race([
              supabase
                .from("users")
                .select("*")
                .eq("userID", currentUser.id)
                .single(),
              new Promise<any>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Supabase fetch timeout (users)")),
                  FETCH_TIMEOUT,
                ),
              ),
            ]),
            Promise.race([
              supabase
                .from("user_ai_profile")
                .select("*")
                .eq("userID", currentUser.id)
                .single(),
              new Promise<any>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Supabase fetch timeout (profile)")),
                  FETCH_TIMEOUT,
                ),
              ),
            ]),
            Promise.race([
              supabase
                .from("assinaturas")
                .select("*")
                .eq("email", currentUser.email)
                .order("expira_em", { ascending: false })
                .maybeSingle(),
              new Promise<any>((_, reject) =>
                setTimeout(
                  () =>
                    reject(new Error("Supabase fetch timeout (assinaturas)")),
                  FETCH_TIMEOUT,
                ),
              ),
            ]),
          ]);

        const { data: userDoc, error: userError } = userResult;
        const { data: profileDoc, error: profileError } = profileResult;
        const { data: assinatura } = assinaturaResult;

        if (userError && userError.code !== "PGRST116") {
          logEvent("auth", "Error fetching user data", {
            userId: currentUser.id,
            errorCode: userError.code,
            errorDetail: userError.message,
          });
        }

        let data: UserData;
        if (userDoc) {
          data = userDoc as UserData;

          // Auto-expire check
          if (
            (data.status === "ativo" || data.nalabiaPrimeAcess) &&
            data.expiraEm
          ) {
            const expDate = new Date(data.expiraEm);
            if (new Date() > expDate) {
              console.log(
                "Subscription expired! Updating database to inactive.",
              );
              data.status = "inativo";
              data.nalabiaPrimeAcess = false;
              // Update database automatically
              supabase
                .from("users")
                .update({ status: "inativo", nalabiaPrimeAcess: false })
                .eq("userID", data.userID)
                .then(({ error }) => {
                  if (error) console.error("Error auto-expiring:", error);
                });
            }
          }
        } else {
          // Create new user profile on first login
          data = {
            userID: currentUser.id,
            name: currentUser.user_metadata?.full_name || "Usuário",
            email: currentUser.email || "",
            photoURL: currentUser.user_metadata?.avatar_url || undefined,
            level: 1,
            xp: 0,
            createdAt: Date.now(),
            onboardingCompleted: true, // Assume true so UI continues.
            status: "pendente",
            plano: "",
            nalabiaPrimeAcess: false,
            darkPackAccess: false,
            coursesAccess: false,
            mentoriaAccess: false,
            freeMessagesUsed: 0,
          };

          // Apply developer and legacy bypasses
          const isDeveloper =
            currentUser.email === "loordbilly898@gmail.com" ||
            currentUser.email === "nalabiainc@gmail.com";
          const isLegacyPremium =
            currentUser.email === "kauanhenrique171822@gmail.com" ||
            currentUser.email === "gamerbilly898@gmail.com" ||
            currentUser.email === "nauandematoss@gmail.com" ||
            currentUser.email === "encantomirim53@gmail.com" ||
            currentUser.email === "lucastorresoliveira77@gmail.com" ||
            currentUser.email === "Luqin.oliiver@gmail.com" ||
            currentUser.email === "luqin.oliiver@gmail.com";

          if (isDeveloper) {
            data.plano = "Desenvolvedor";
            data.status = "ativo";
            data.nalabiaPrimeAcess = true;
            data.darkPackAccess = true;
            data.coursesAccess = true;
            data.mentoriaAccess = true;
          } else if (isLegacyPremium) {
            data.plano = "Mensal";
            data.status = "ativo";
            data.nalabiaPrimeAcess = true;
            data.darkPackAccess = true;
            data.coursesAccess = true;
            data.mentoriaAccess = true;
          }

          // Insert into database, handling RLS via auth matching
          Promise.race([
            supabase.from("users").insert(data),
            new Promise((_, r) =>
              setTimeout(() => r(new Error("Insert timeout")), 10000),
            ),
          ])
            .then((res: any) => {
              if (res && res.error)
                console.error(
                  "Could not sync new user on first login:",
                  res.error,
                );
            })
            .catch((e) => console.error("Insert timeout/error:", e));
        }

        // --- NEW: Prioritize check in 'assinaturas' table ---
        if (assinatura && assinatura.status === "ativa") {
          const expirationDate = new Date(assinatura.expira_em);
          // Vitalicio is +10 years, so it's always actively overriding.
          if (expirationDate > new Date()) {
            console.log(
              `[Auth] Valid assinatura found for ${data.email}. Overriding status.`,
            );
            data.status = "ativo";
            data.nalabiaPrimeAcess = true;
            data.plano = assinatura.plano_nome;
            data.expiraEm = assinatura.expira_em;
            
            const pNome = (assinatura.plano_nome || "").toLowerCase();
            if (pNome.includes("curso") || pNome.includes("academia")) {
              data.coursesAccess = true;
            }
            if (pNome.includes("dark")) {
              data.darkPackAccess = true;
            }
            if (pNome.includes("mentoria")) {
              data.mentoriaAccess = true;
              data.settings = { ...(data.settings || {}), mentoriaAccess: true };
            }
          }
        }
        // --- END NEW ---

        // Developer bypass (double check for existing users)
        if (
          currentUser.email === "loordbilly898@gmail.com" ||
          currentUser.email === "nalabiainc@gmail.com"
        ) {
          data.nalabiaPrimeAcess = true;
          data.darkPackAccess = true;
          data.coursesAccess = true;
          data.mentoriaAccess = true;
          data.status = "ativo";
          data.plano = "Desenvolvedor";
        } else if (
          currentUser.email === "kauanhenrique171822@gmail.com" ||
          currentUser.email === "nauandematoss@gmail.com" ||
          currentUser.email === "Paz180511@gmail.com" ||
          currentUser.email === "encantomirim53@gmail.com" ||
          currentUser.email === "lucastorresoliveira77@gmail.com" ||
          currentUser.email === "Luqin.oliiver@gmail.com" ||
          currentUser.email === "luqin.oliiver@gmail.com"
        ) {
          data.nalabiaPrimeAcess = true;
          data.darkPackAccess = true;
          data.coursesAccess = true;
          data.mentoriaAccess = true;
          data.status = "ativo";
          data.plano = "Mensal";
        } else if (currentUser.email === "gamerbilly898@gmail.com") {
          data.nalabiaPrimeAcess = true;
          data.status = "ativo";
          data.plano = "Mensal";
        }

        // --- 24-HOUR FREE TRIAL CHECK ---
        if (!data.nalabiaPrimeAcess && data.status !== "ativo") {
          try {
            const trialInfo = await verifyDeviceTrial(
              currentUser.email || undefined,
              currentUser.id,
            );
            data.trialStartedAt = trialInfo.trialStartedAt;
            data.trialExpiresAt = trialInfo.trialExpiresAt;
            data.trialAbuseDetected = trialInfo.isAbuseBlocked;
            if (trialInfo.isActive) {
              data.status = "ativo_trial";
            } else if (trialInfo.isExpired) {
              data.status = "expirado";
            }
          } catch (e) {
            console.warn("Trial check warning:", e);
          }
        }

        setUserData(data);
        logEvent("auth", "User data loaded", {
          userId: currentUser.id,
          responseTime: Date.now() - startTime,
        });

        if (profileError && profileError.code !== "PGRST116") {
          console.error("Error fetching user AI profile:", profileError);
        }

        if (profileDoc) {
          setUserAIProfile(profileDoc as UserAIProfile);
        } else {
          setUserAIProfile(null);
        }
      } catch (error) {
        console.error("Error in fetchUserData:", error);
        // CRITICAL FALLBACK: If Supabase connection fails entirely, create an offline-like skeleton so the app doesn't infinite loop.
        setUserData({
          userID: currentUser.id,
          name: currentUser.user_metadata?.full_name || "Usuário",
          email: currentUser.email || "",
          level: 1,
          xp: 0,
          createdAt: Date.now(),
          onboardingCompleted: true,
          status: "pendente",
          nalabiaPrimeAcess: false,
        });
      } finally {
        setLoading(false);
        if (authTimeoutRef.current) clearTimeout(authTimeoutRef.current);
      }
    };

    // Safety timeout to ensure app always starts
    authTimeoutRef.current = setTimeout(() => {
      if (loading) {
        logEvent("system", "Auth initialization watchdog triggered");
        setLoading(false);
      }
    }, 40000);

    const initAuth = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const {
          data: { session },
          error: sessionError,
        } = await Promise.race([
          sessionPromise,
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error("Session timeout")), 30000),
          ),
        ]);

        if (sessionError) throw sessionError;

        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserData(session.user);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        logEvent("auth", "Initial session fetch failed", {
          errorCode: err.code || "TIMEOUT",
        });
        setInitError("Falha na conexão com o servidor. Verifique sua rede.");
        setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          try {
            // Tenta logar também globalmente a cada SIGNED_IN capturado
            supabase.from("sign_ins").insert({
              user_id: session.user.id,
              email: session.user.email,
              signed_in_at: new Date().toISOString()
            }).then();
            
            supabase.from("Sign-ins").insert({
              user_id: session.user.id,
              email: session.user.email,
              signed_in_at: new Date().toISOString()
            }).then();
          } catch(e) {}
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          fetchUserData(session.user);
        } else {
          setUserData(null);
          setUserAIProfile(null);
          setLoading(false);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loginWithEmail = async (
    email: string,
    password: string,
    onboardingData?: Omit<UserAIProfile, "userID">,
  ) => {
    const startTime = Date.now();
    try {
      const authPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });

      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "O servidor demorou muito para responder. Tente novamente.",
              ),
            ),
          25000,
        ),
      );

      const { data, error } = await Promise.race([authPromise, timeoutPromise]);

      if (error) {
        logEvent("auth", "Login failed", {
          email,
          errorCode: error.status?.toString() || "AUTH_ERROR",
          errorDetail: error.message,
        });
        throw error;
      }

      logEvent("auth", "Login successful", {
        userId: data.user?.id,
        responseTime: Date.now() - startTime,
      });

      if (data.user) {
        // Envia log de login para a tabela sign_ins para o admin visualizar
        try {
          // Tenta formatos prováveis caso a tabela tenha nomes diferentes (silencia erros)
          supabase.from("sign_ins").insert({
            user_id: data.user.id,
            email: data.user.email,
            signed_in_at: new Date().toISOString()
          }).then();
          
          supabase.from("Sign-ins").insert({
            user_id: data.user.id,
            email: data.user.email,
            signed_in_at: new Date().toISOString()
          }).then();
        } catch (e) {
          // Ignorar erros se a tabela não existir
        }

        const { error: updateError } = await supabase
          .from("users")
          .update({ onboardingCompleted: true })
          .eq("userID", data.user.id);

        if (updateError)
          console.error("Error updating onboarding status:", updateError);

        const fullProfile: UserAIProfile = {
          ...onboardingData,
          userID: data.user.id,
        };

        const { error: profileError } = await supabase
          .from("user_ai_profile")
          .upsert(fullProfile);

        if (profileError)
          console.error("Error saving AI profile:", profileError);
      }
    } catch (error: any) {
      logEvent("auth", "Login exception", {
        email,
        errorDetail: error.message,
      });
      throw error;
    }
  };

  const loginWithGoogle = async (
    onboardingData?: Omit<UserAIProfile, "userID">,
  ) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
    // Note: Supabase OAuth redirects, so onboardingData handling here might not work as expected immediately after redirect.
    // It's usually handled in the onAuthStateChange listener after redirect.
  };

  const registerWithEmail = async (
    name: string,
    email: string,
    password: string,
    onboardingData?: Omit<UserAIProfile, "userID">,
  ) => {
    const startTime = Date.now();
    const signUpPromise = supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });

    const timeoutPromise = new Promise<any>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: null,
            error: { message: "too long to respond", status: 504 },
          }),
        25000,
      ),
    );

    let signUpResult = await Promise.race([signUpPromise, timeoutPromise]);

    let { data, error } = signUpResult;

    if (error && error.message?.toLowerCase().includes("user already registered")) {
        // Tentativa de "Claim" para contas auto-criadas pelo webhook
        try {
          const claimRes = await fetch("/api/auth/claim-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const rawClaimText = await claimRes.text();
          let claimData: any = {};
          try {
            claimData = JSON.parse(rawClaimText);
          } catch {
            claimData = { error: rawClaimText || "Erro no servidor" };
          }
          
          if (claimRes.ok && claimData.success) {
             // Success! The password was updated. Let's log in instead of throwing error.
             const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
             if (loginErr) throw loginErr;
             data = loginData;
             error = null as any;
          } else {
             // Some other error or it was conventionally registered
             throw new Error(claimData.error || "Este e-mail já está em uso.");
          }
        } catch (claimErr: any) {
          throw new Error(claimErr.message || "Este e-mail já está em uso.");
        }
    }

    // Se houve erro de servidor demorando (Timeout) nativo do Supabase
    if (
      error &&
      (error.message.includes("too long to respond") ||
        error.status === 504 ||
        error.name === "AuthRetryableFetchError")
    ) {
      logEvent("auth", "Signup timeout, attempting invisible login check", {
        email,
      });
      // Vamos tentar fazer um login invisível rápido só pra ver se por acaso ele criou a conta antes de dar timeout
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (loginError && loginError.message.includes("Email not confirmed")) {
        // A conta FOI CRIADA, mas o email ainda não foi confirmado.
        logEvent("auth", "Signup partial success (unconfirmed)", {
          email,
          responseTime: Date.now() - startTime,
        });
        throw new Error("SLOW_SERVER_SIGNUP");
      } else if (loginData?.user) {
        // Incrivelmente a conta foi criada E logou
        logEvent("auth", "Signup full success after timeout", {
          userId: loginData.user.id,
          responseTime: Date.now() - startTime,
        });
        data = loginData;
        error = null as any;
      } else {
        // Realmente falhou, repassa o erro
        logEvent("auth", "Signup total timeout", {
          email,
          responseTime: Date.now() - startTime,
        });
        throw new Error("SLOW_SERVER_SIGNUP");
      }
    } else if (error) {
      logEvent("auth", "Signup failed", {
        email,
        errorCode: error.status?.toString() || "SIGNUP_ERROR",
        errorDetail: error.message,
      });
      throw error;
    }

    logEvent("auth", "Signup successful", {
      userId: data?.user?.id,
      responseTime: Date.now() - startTime,
    });

    if (data?.user && !error) {
      // Inserir os dados diretamente na tabela users do banco de dados na criação de conta
      try {
        const newUserToInsert = {
          userID: data.user.id,
          name: name || data.user.user_metadata?.full_name || "Usuário",
          email: email,
          level: 1,
          xp: 0,
          createdAt: Date.now(),
          onboardingCompleted: !!onboardingData,
          status: "pendente",
          plano: "",
          nalabiaPrimeAcess: false,
          darkPackAccess: false,
          coursesAccess: false,
          mentoriaAccess: false,
          freeMessagesUsed: 0,
        };
        await supabase.from("users").insert(newUserToInsert);
      } catch (insertEx) {
        console.warn("Nao foi possivel salvar na tabela users pre-login", insertEx);
      }

      if (onboardingData) {
        // Tenta também enviar o AI perfil 
        try {
          const fullProfile: UserAIProfile = {
            ...onboardingData,
            userID: data.user.id,
          };
          await supabase.from("user_ai_profile").upsert(fullProfile);
        } catch (pfEx) {}

        console.log(
          "Registry successful. Data sync attempted.",
        );
      }
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const completeOnboarding = async (
    profileData: Omit<UserAIProfile, "userID">,
  ) => {
    if (!user || !userData) return;

    const fullProfile: UserAIProfile = {
      ...profileData,
      userID: user.id,
    };

    try {
      const { error: profileError } = await supabase
        .from("user_ai_profile")
        .upsert(fullProfile);

      if (profileError) throw profileError;
      setUserAIProfile(fullProfile);

      const { error: userError } = await supabase
        .from("users")
        .update({ onboardingCompleted: true })
        .eq("userID", user.id);

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
        localStorage.removeItem("nalabia_settings_v1");
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
        .from("users")
        .update({ xp: newXp, level: newLevel })
        .eq("userID", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error adding XP:", error);
    }
  };

  const updateUserSettings = async (settings: any) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ settings })
        .eq("userID", user.id);

      if (error) throw error;
      setUserData((prev) => (prev ? { ...prev, settings } : null));
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    }
  };

  const updateUserProfiles = async (profiles: any[]) => {
    if (!user) return;
    try {
      const strippedProfiles = profiles.map((p) => ({
        ...p,
        messages: p.messages
          ? p.messages.slice(-20).map((m: any) => {
              const { image, ...rest } = m;
              return rest;
            })
          : [],
      }));

      const { error } = await supabase
        .from("users")
        .update({ profiles: strippedProfiles })
        .eq("userID", user.id);

      if (error) throw error;
      setUserData((prev) =>
        prev ? { ...prev, profiles: strippedProfiles } : null,
      );
    } catch (error) {
      console.error("Error updating profiles:", error);
      throw error;
    }
  };

  const updateUserMemories = async (memories: Memory[]) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("users")
        .update({ memories })
        .eq("userID", user.id);

      if (error) throw error;
      setUserData((prev) => (prev ? { ...prev, memories } : null));
    } catch (error) {
      console.error("Error updating memories:", error);
      throw error;
    }
  };

  const updateUserName = async (name: string) => {
    if (!user) return;
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: name },
      });
      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from("users")
        .update({ name })
        .eq("userID", user.id);

      if (dbError) throw dbError;
      setUserData((prev) => (prev ? { ...prev, name } : null));
    } catch (error) {
      console.error("Error updating name:", error);
    }
  };

  const updateUserPhoto = async (file: File) => {
    if (!user) return;
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/profile.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (authError) throw authError;

      const { error: dbError } = await supabase
        .from("users")
        .update({ photoURL: publicUrl })
        .eq("userID", user.id);

      if (dbError) throw dbError;
      setUserData((prev) => (prev ? { ...prev, photoURL: publicUrl } : null));
    } catch (error) {
      console.error("Error updating photo:", error);
    }
  };

  const updateUserPassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    if (!user) return;
    // Supabase doesn't require current password for update if user is already logged in
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const verifyEmail = async () => {
    // Supabase sends verification email automatically on signup if configured.
    // To resend, we can use resend()
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });
    if (error) throw error;
  };

  const createBackup = async () => {
    if (!user || !userData) return;

    const backupData = {
      userData,
      userAIProfile,
      timestamp: Date.now(),
    };

    const jsonString = JSON.stringify(backupData);
    const blob = new Blob([jsonString], { type: "application/json" });

    const fileName = `${user.id}/backup_${Date.now()}.json`;
    const { error } = await supabase.storage
      .from("backups")
      .upload(fileName, blob);

    if (error) console.error("Error saving backup to storage:", error);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
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
          .from("users")
          .upsert(backupData.userData);

        if (userError) throw userError;
        setUserData(backupData.userData);

        if (backupData.userAIProfile) {
          const { error: profileError } = await supabase
            .from("user_ai_profile")
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
      await supabase.from("users").delete().eq("userID", user.id);
      await supabase.from("user_ai_profile").delete().eq("userID", user.id);

      // Delete user account (Requires Edge Function or Admin API usually, but we can try RPC if configured)
      // For now, we sign out. To truly delete the auth user, you need a Supabase Edge Function or call the admin API from your backend.
      const { error } = await supabase.rpc("delete_user");
      if (error) {
        console.warn(
          "RPC delete_user failed (might not exist), signing out instead.",
          error,
        );
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
    throw new Error(
      "A campanha de Teste Grátis foi encerrada. O acesso gratuito não está mais disponível.",
    );
  };

  const incrementUsage = async () => {
    if (!user || !userData) return;
    try {
      const today = new Date().toISOString().split("T")[0];

      const updates: any = {};

      if (userData.lastRequestDate !== today) {
        updates.dailyRequests = 1;
        updates.lastRequestDate = today;
      } else {
        updates.dailyRequests = (userData.dailyRequests || 0) + 1;
      }

      const needsSubscription =
        !userData?.nalabiaPrimeAcess && userData?.status !== "ativo";
      if (needsSubscription) {
        updates.freeMessagesUsed = (userData.freeMessagesUsed || 0) + 1;
      }

      const { error } = await supabase
        .from("users")
        .update(updates)
        .eq("userID", user.id);

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
        createdAt: Date.now(),
      };

      const { error } = await supabase
        .from("saved_responses")
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
        .from("saved_responses")
        .select("*")
        .eq("userID", user.id)
        .order("createdAt", { ascending: false });

      if (error) throw error;
      return data as SavedResponse[];
    } catch (error) {
      console.error("Error getting saved responses:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        userAIProfile,
        loading,
        loginWithEmail,
        loginWithGoogle,
        registerWithEmail,
        resetPassword,
        logout,
        addXp,
        completeOnboarding,
        updateUserSettings,
        updateUserProfiles,
        updateUserMemories,
        updateUserName,
        updateUserPhoto,
        updateUserPassword,
        verifyEmail,
        createBackup,
        restoreBackup,
        deleteAccount,
        unlockFreeTrial,
        incrementUsage,
        saveResponseToVault,
        getSavedResponses,
      }}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-gold font-mono">
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full animate-spin"></div>
            <div className="absolute w-8 h-8 border-4 border-gold/10 border-b-gold rounded-full animate-spin"></div>
          </div>
          <p className="text-sm tracking-widest uppercase animate-pulse">
            SISTEMA INICIANDO...
          </p>
          {initError && (
            <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-red-500 text-xs mb-4">{initError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-gold/10 border border-gold text-gold text-xs rounded-full hover:bg-gold/20 transition-all"
              >
                TENTAR NOVAMENTE
              </button>
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
