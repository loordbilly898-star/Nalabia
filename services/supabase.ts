import { createClient, User, Session } from "@supabase/supabase-js";

const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs";

// Create native Supabase client for remote syncing if available
const rawSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "nalabia-auth-token",
    flowType: "pkce",
  },
});

type AuthStateChangeCallback = (event: string, session: Session | null) => void;
const authListeners: Set<AuthStateChangeCallback> = new Set();

const notifyAuthChange = (event: string, session: Session | null) => {
  authListeners.forEach((cb) => {
    try {
      cb(event, session);
    } catch (e) {
      console.warn("Auth listener error:", e);
    }
  });
};

function getLocalSession(): { user: User | null; session: Session | null } {
  try {
    const raw = localStorage.getItem("nalabia_local_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) {
        return {
          user: parsed.user as User,
          session: {
            access_token: parsed.token || "local-token",
            refresh_token: "local-refresh",
            expires_in: 3600 * 24 * 30,
            token_type: "bearer",
            user: parsed.user as User,
          } as Session,
        };
      }
    }
  } catch (e) {}
  return { user: null, session: null };
}

function setLocalSession(user: any, token?: string) {
  try {
    if (user) {
      localStorage.setItem(
        "nalabia_local_session",
        JSON.stringify({ user, token: token || `local-${user.id}` }),
      );
    } else {
      localStorage.removeItem("nalabia_local_session");
    }
  } catch (e) {}
}

class QueryBuilder {
  private table: string;
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private filters: Array<{ type: "eq" | "ilike"; column: string; value: any }> = [];
  private orderCol?: string;
  private orderAsc: boolean = true;
  private limitCount?: number;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*") {
    this.op = "select";
    return this;
  }

  insert(data: any) {
    this.op = "insert";
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.op = "update";
    this.payload = data;
    return this;
  }

  upsert(data: any, options?: any) {
    this.op = "upsert";
    this.payload = data;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  ilike(column: string, value: any) {
    this.filters.push({ type: "ilike", column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute(): Promise<{ data: any; error: any }> {
    try {
      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: this.table,
          op: this.op,
          payload: this.payload,
          filters: this.filters,
          orderCol: this.orderCol,
          orderAsc: this.orderAsc,
          limitCount: this.limitCount,
          isSingle: this.isSingle,
          isMaybeSingle: this.isMaybeSingle,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return { data: null, error: errJson.error ? { message: errJson.error } : { message: "DB Error" } };
      }

      const resData = await response.json();
      return { data: resData.data, error: null };
    } catch (err: any) {
      console.warn(`[LocalDB Query fallback] ${this.table}:`, err);
      return { data: null, error: { message: err.message || "Failed to fetch DB" } };
    }
  }

  then(onfulfilled?: (value: { data: any; error: any }) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const supabase: any = {
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Email ou senha incorretos.");
        }

        const session = {
          access_token: data.token || "local-token",
          refresh_token: "local-refresh",
          expires_in: 3600 * 24 * 30,
          token_type: "bearer",
          user: data.user,
        };

        setLocalSession(data.user, data.token);
        notifyAuthChange("SIGNED_IN", session as any);

        return { data: { user: data.user, session }, error: null };
      } catch (err: any) {
        return {
          data: { user: null, session: null },
          error: { message: err.message || "Falha na autenticação", status: 400 },
        };
      }
    },

    async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: options?.data?.full_name || email.split("@")[0],
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Erro ao criar conta.");
        }

        const session = {
          access_token: data.token || "local-token",
          refresh_token: "local-refresh",
          expires_in: 3600 * 24 * 30,
          token_type: "bearer",
          user: data.user,
        };

        setLocalSession(data.user, data.token);
        notifyAuthChange("SIGNED_IN", session as any);

        return { data: { user: data.user, session }, error: null };
      } catch (err: any) {
        return {
          data: { user: null, session: null },
          error: { message: err.message || "Erro no cadastro", status: 400 },
        };
      }
    },

    async signInWithOAuth({ provider, options }: { provider: string; options?: any }) {
      const email = `google_user_${Math.random().toString(36).substring(7)}@gmail.com`;
      return this.signUp({ email, password: "oauth_password", options: { data: { full_name: "Google User" } } });
    },

    async getSession() {
      const { user, session } = getLocalSession();
      return { data: { session }, error: null };
    },

    async getUser() {
      const { user } = getLocalSession();
      return { data: { user }, error: null };
    },

    async signOut() {
      setLocalSession(null);
      notifyAuthChange("SIGNED_OUT", null);
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (e) {}
      return { error: null };
    },

    async resetPasswordForEmail(email: string) {
      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao redefinir senha");
        return { data, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },

    async updateUser(updates: any) {
      try {
        const { user } = getLocalSession();
        if (!user) throw new Error("Não autenticado");
        const res = await fetch("/api/auth/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, ...updates }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao atualizar usuário");
        if (data.user) {
          setLocalSession(data.user);
        }
        return { data: { user: data.user || user }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },

    onAuthStateChange(callback: AuthStateChangeCallback) {
      authListeners.add(callback);
      const { session } = getLocalSession();
      if (session) {
        setTimeout(() => callback("SIGNED_IN", session), 10);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  },

  from(table: string) {
    return new QueryBuilder(table);
  },

  storage: {
    from(bucket: string) {
      return {
        async upload(fileName: string, file: any) {
          return { data: { path: fileName }, error: null };
        },
        getPublicUrl(fileName: string) {
          return { data: { publicUrl: `/uploads/${fileName}` } };
        },
      };
    },
  },

  async rpc(name: string, params?: any) {
    return { data: { success: true }, error: null };
  },
};
