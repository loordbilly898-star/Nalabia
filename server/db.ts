import fs from "fs";
import path from "path";

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
const DB_PATH = isServerless 
  ? path.join("/tmp", "db.json") 
  : path.join(process.cwd(), "data", "db.json");

interface DatabaseSchema {
  auth_users: Array<{
    id: string;
    email: string;
    passwordHash?: string;
    password?: string;
    full_name?: string;
    user_metadata?: any;
    created_at: string;
  }>;
  users: Array<any>;
  user_ai_profile: Array<any>;
  assinaturas: Array<any>;
  conversations: Array<any>;
  saved_responses: Array<any>;
  sign_ins: Array<any>;
}

const DEFAULT_USERS = [
  {
    userID: "gamerbilly898-id",
    name: "Billy (GamerBilly)",
    email: "gamerbilly898@gmail.com",
    level: 10,
    xp: 5500,
    createdAt: Date.now(),
    onboardingCompleted: true,
    status: "ativo",
    plano: "Mensal",
    nalabiaPrimeAcess: true,
    darkPackAccess: true,
    coursesAccess: true,
    mentoriaAccess: true,
    freeMessagesUsed: 0,
  },
  {
    userID: "loordbilly898-id",
    name: "Loord Billy",
    email: "loordbilly898@gmail.com",
    level: 99,
    xp: 99999,
    createdAt: Date.now(),
    onboardingCompleted: true,
    status: "ativo",
    plano: "Desenvolvedor",
    nalabiaPrimeAcess: true,
    darkPackAccess: true,
    coursesAccess: true,
    mentoriaAccess: true,
    freeMessagesUsed: 0,
  },
  {
    userID: "luqin-oliiver-id",
    name: "Luqin Oliver",
    email: "luqin.oliiver@gmail.com",
    level: 5,
    xp: 2500,
    createdAt: Date.now(),
    onboardingCompleted: true,
    status: "ativo",
    plano: "Mensal",
    nalabiaPrimeAcess: true,
    darkPackAccess: true,
    coursesAccess: true,
    mentoriaAccess: true,
    freeMessagesUsed: 0,
  },
  {
    userID: "williamhendler711-id",
    name: "William Hendler",
    email: "williamhendler711@gmail.com",
    level: 1,
    xp: 0,
    createdAt: Date.now(),
    onboardingCompleted: true,
    status: "ativo",
    plano: "Trimestral",
    nalabiaPrimeAcess: true,
    darkPackAccess: true,
    coursesAccess: true,
    mentoriaAccess: true,
    freeMessagesUsed: 0,
  }
];

const DEFAULT_AUTH = [
  {
    id: "gamerbilly898-id",
    email: "gamerbilly898@gmail.com",
    password: "password", // default fallback or any password accepted for legacy
    full_name: "Billy (GamerBilly)",
    created_at: new Date().toISOString()
  },
  {
    id: "loordbilly898-id",
    email: "loordbilly898@gmail.com",
    password: "password",
    full_name: "Loord Billy",
    created_at: new Date().toISOString()
  },
  {
    id: "luqin-oliiver-id",
    email: "luqin.oliiver@gmail.com",
    password: "123456",
    full_name: "Luqin Oliver",
    created_at: new Date().toISOString()
  },
  {
    id: "williamhendler711-id",
    email: "williamhendler711@gmail.com",
    password: "password",
    full_name: "William Hendler",
    created_at: new Date().toISOString()
  }
];

function initDB(): DatabaseSchema {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        auth_users: parsed.auth_users || DEFAULT_AUTH,
        users: parsed.users || DEFAULT_USERS,
        user_ai_profile: parsed.user_ai_profile || [],
        assinaturas: parsed.assinaturas || [],
        conversations: parsed.conversations || [],
        saved_responses: parsed.saved_responses || [],
        sign_ins: parsed.sign_ins || [],
      };
    }
  } catch (err) {
    console.error("[DB] Error reading db.json, creating initial:", err);
  }

  const initial: DatabaseSchema = {
    auth_users: DEFAULT_AUTH,
    users: DEFAULT_USERS,
    user_ai_profile: [],
    assinaturas: [],
    conversations: [],
    saved_responses: [],
    sign_ins: [],
  };

  saveDB(initial);
  return initial;
}

let dbMemory: DatabaseSchema = initDB();

export function saveDB(data?: DatabaseSchema) {
  try {
    if (data) dbMemory = data;
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(dbMemory, null, 2), "utf-8");
  } catch (err) {
    console.error("[DB] Error saving to db.json:", err);
  }
}

export function getCollection(name: string): any[] {
  const norm = name.toLowerCase().replace(/-/g, "_");
  if (norm === "users" || norm === "user") return dbMemory.users;
  if (norm === "user_ai_profile" || norm === "profiles") return dbMemory.user_ai_profile;
  if (norm === "assinaturas" || norm === "subscriptions") return dbMemory.assinaturas;
  if (norm === "conversations" || norm === "chats") return dbMemory.conversations;
  if (norm === "saved_responses" || norm === "vault") return dbMemory.saved_responses;
  if (norm === "sign_ins" || norm === "sign-ins") return dbMemory.sign_ins;
  if (norm === "auth_users" || norm === "auth") return dbMemory.auth_users;
  
  if (!(dbMemory as any)[norm]) {
    (dbMemory as any)[norm] = [];
  }
  return (dbMemory as any)[norm];
}

export function setCollection(name: string, items: any[]) {
  const norm = name.toLowerCase().replace(/-/g, "_");
  if (norm === "users" || norm === "user") dbMemory.users = items;
  else if (norm === "user_ai_profile" || norm === "profiles") dbMemory.user_ai_profile = items;
  else if (norm === "assinaturas" || norm === "subscriptions") dbMemory.assinaturas = items;
  else if (norm === "conversations" || norm === "chats") dbMemory.conversations = items;
  else if (norm === "saved_responses" || norm === "vault") dbMemory.saved_responses = items;
  else if (norm === "sign_ins" || norm === "sign-ins") dbMemory.sign_ins = items;
  else if (norm === "auth_users" || norm === "auth") dbMemory.auth_users = items;
  else (dbMemory as any)[norm] = items;

  saveDB();
}

export const db = {
  getCollection,
  setCollection,
  raw: () => dbMemory,
  save: () => saveDB(),
};
