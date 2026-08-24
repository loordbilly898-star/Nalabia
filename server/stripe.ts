import Stripe from "stripe";
import { db } from "./db";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const rawKey =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_KEY;

  if (!rawKey) {
    return null;
  }

  const key = rawKey.trim().replace(/^["']|["']$/g, "");
  if (!key) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export interface PlanConfig {
  id: string;
  name: string;
  amountInCents: number;
  currency: string;
  interval?: "month" | "year";
  intervalCount?: number;
  mode: "subscription" | "payment";
  type: "subscription" | "course" | "darkpack" | "mentoria";
}

export const STRIPE_PLANS: Record<string, PlanConfig> = {
  mensal: {
    id: "mensal",
    name: "NaLábia Prime - Plano Mensal",
    amountInCents: 1990, // R$ 19,90
    currency: "brl",
    interval: "month",
    intervalCount: 1,
    mode: "subscription",
    type: "subscription",
  },
  monthly: {
    id: "monthly",
    name: "NaLábia Prime - Plano Mensal",
    amountInCents: 1990,
    currency: "brl",
    interval: "month",
    intervalCount: 1,
    mode: "subscription",
    type: "subscription",
  },
  trimestral: {
    id: "trimestral",
    name: "NaLábia Prime - Plano Trimestral",
    amountInCents: 5890, // R$ 58,90
    currency: "brl",
    interval: "month",
    intervalCount: 3,
    mode: "subscription",
    type: "subscription",
  },
  anual: {
    id: "anual",
    name: "NaLábia Prime - Plano Anual",
    amountInCents: 14990, // R$ 149,90
    currency: "brl",
    interval: "year",
    intervalCount: 1,
    mode: "subscription",
    type: "subscription",
  },
  dark: {
    id: "dark",
    name: "Modo +18 & DarkPack (Acesso Vitalício)",
    amountInCents: 1990, // R$ 19,90
    currency: "brl",
    mode: "payment",
    type: "darkpack",
  },
  darkpack: {
    id: "darkpack",
    name: "Modo +18 & DarkPack (Acesso Vitalício)",
    amountInCents: 1990,
    currency: "brl",
    mode: "payment",
    type: "darkpack",
  },
  curso: {
    id: "curso",
    name: "Academia NaLábia (Acesso Vitalício)",
    amountInCents: 3990, // R$ 39,90
    currency: "brl",
    mode: "payment",
    type: "course",
  },
  courses: {
    id: "courses",
    name: "Academia NaLábia (Acesso Vitalício)",
    amountInCents: 3990,
    currency: "brl",
    mode: "payment",
    type: "course",
  },
  mentoria: {
    id: "mentoria",
    name: "Mentoria NaLábia VIP",
    amountInCents: 1990, // R$ 19,90
    currency: "brl",
    mode: "payment",
    type: "mentoria",
  },
};

/**
 * Applies access and subscription updates to database records
 */
export function applyStripeAccess({
  userId,
  userEmail,
  planId,
  stripeCustomerId,
  stripeSubscriptionId,
  amountTotal,
}: {
  userId?: string;
  userEmail?: string;
  planId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  amountTotal?: number;
}) {
  const users = db.getCollection("users");
  const authUsers = db.getCollection("auth_users");
  const assinaturas = db.getCollection("assinaturas");

  const normEmail = userEmail?.trim().toLowerCase();
  let user = users.find(
    (u: any) =>
      (userId && (u.userID === userId || u.id === userId)) ||
      (normEmail && u.email?.toLowerCase() === normEmail),
  );

  const plan = STRIPE_PLANS[planId.toLowerCase()] || STRIPE_PLANS.mensal;
  const planName = plan.name;
  const isCourse = plan.type === "course" || planId.includes("curso");
  const isDarkPack = plan.type === "darkpack" || planId.includes("dark");
  const isMentoria = plan.type === "mentoria" || planId.includes("mentoria");

  const effectiveUserId = user?.userID || userId || `usr_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;

  if (!user) {
    user = {
      userID: effectiveUserId,
      email: normEmail || "",
      name: normEmail ? normEmail.split("@")[0] : "Usuário",
      level: 1,
      xp: 0,
      createdAt: Date.now(),
      onboardingCompleted: true,
      status: "ativo",
      plano: planName,
      nalabiaPrimeAcess: true,
      darkPackAccess: isDarkPack,
      coursesAccess: isCourse,
      mentoriaAccess: isMentoria,
      stripeCustomerId,
      stripeSubscriptionId,
      freeMessagesUsed: 0,
    };
    users.push(user);

    if (normEmail && !authUsers.some((a: any) => a.email?.toLowerCase() === normEmail)) {
      authUsers.push({
        id: effectiveUserId,
        email: normEmail,
        password: "AutoPass" + Math.random().toString(36) + "!",
        full_name: normEmail.split("@")[0],
        created_at: new Date().toISOString(),
      });
      db.setCollection("auth_users", authUsers);
    }
  }

  user.status = "ativo";
  user.nalabiaPrimeAcess = true;
  user.updatedAt = new Date().toISOString();
  if (stripeCustomerId) user.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) user.stripeSubscriptionId = stripeSubscriptionId;

  let finalExpiraEm = new Date();
  let finalPlanoType = "mensal";

  if (isCourse) {
    user.coursesAccess = true;
    user.plano = "Curso Academia";
    finalPlanoType = "vitalicio";
    finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10);
  } else if (isDarkPack) {
    user.darkPackAccess = true;
    user.plano = "Pacote Dark";
    finalPlanoType = "vitalicio";
    finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10);
  } else if (isMentoria) {
    user.mentoriaAccess = true;
    user.settings = { ...(user.settings || {}), mentoriaAccess: true };
    user.plano = "Mentoria VIP";
    finalPlanoType = "vitalicio";
    finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10);
  } else {
    if (plan.id === "trimestral") {
      finalExpiraEm.setDate(finalExpiraEm.getDate() + 90);
      finalPlanoType = "trimestral";
      user.plano = "Trimestral";
    } else if (plan.id === "anual") {
      finalExpiraEm.setDate(finalExpiraEm.getDate() + 365);
      finalPlanoType = "anual";
      user.plano = "Anual";
    } else {
      finalExpiraEm.setDate(finalExpiraEm.getDate() + 30);
      finalPlanoType = "mensal";
      user.plano = "Mensal";
    }
    user.expiraEm = finalExpiraEm.toISOString();
  }

  db.setCollection("users", users);

  // Update assinaturas table
  const existingAssinIdx = assinaturas.findIndex(
    (a: any) =>
      a.id === effectiveUserId ||
      (normEmail && a.email?.toLowerCase() === normEmail) ||
      (stripeSubscriptionId && a.stripe_subscription_id === stripeSubscriptionId),
  );

  const assinObj = {
    id: effectiveUserId,
    email: normEmail || user.email,
    status: "ativa",
    plano: finalPlanoType,
    plano_nome: user.plano,
    valor_pago: amountTotal ? (amountTotal / 100).toFixed(2) : (plan.amountInCents / 100).toFixed(2),
    expira_em: finalExpiraEm.toISOString(),
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    updated_at: new Date().toISOString(),
  };

  if (existingAssinIdx >= 0) {
    assinaturas[existingAssinIdx] = { ...assinaturas[existingAssinIdx], ...assinObj };
  } else {
    assinaturas.push(assinObj);
  }

  db.setCollection("assinaturas", assinaturas);
  console.log(`[Stripe Process] Applied access for user ${effectiveUserId} (${user.email}) - Plan: ${user.plano}`);
  return user;
}

/**
 * Revokes or pauses subscription on cancellation / payment failure
 */
export function revokeStripeAccess({
  stripeCustomerId,
  stripeSubscriptionId,
}: {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}) {
  const users = db.getCollection("users");
  const assinaturas = db.getCollection("assinaturas");

  let modified = false;
  users.forEach((u: any) => {
    if (
      (stripeSubscriptionId && u.stripeSubscriptionId === stripeSubscriptionId) ||
      (stripeCustomerId && u.stripeCustomerId === stripeCustomerId)
    ) {
      u.status = "pendente";
      u.nalabiaPrimeAcess = false;
      u.updatedAt = new Date().toISOString();
      modified = true;
    }
  });
  if (modified) db.setCollection("users", users);

  assinaturas.forEach((a: any) => {
    if (
      (stripeSubscriptionId && a.stripe_subscription_id === stripeSubscriptionId) ||
      (stripeCustomerId && a.stripe_customer_id === stripeCustomerId)
    ) {
      a.status = "cancelada";
      a.updated_at = new Date().toISOString();
    }
  });
  db.setCollection("assinaturas", assinaturas);
}
