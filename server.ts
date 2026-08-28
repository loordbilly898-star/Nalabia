import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";
import Stripe from "stripe";
import { db } from "./server/db.js";
import {
  getStripe,
  STRIPE_PLANS,
  applyStripeAccess,
  revokeStripeAccess,
} from "./server/stripe.js";

dotenv.config();

const app = express();
const PORT = 3000;

const allowedOrigins = [
  "https://nalabia.com.br",
  "https://www.nalabia.com.br",
  "https://nalabia-prime.run.app",
  "https://www.nalabia-prime.run.app",
  "https://ais-dev-2fdtxbfqn7qj57ixyqgzeg-233310227239.us-east1.run.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allows requests with no origin (like mobile apps or curl requests)
      // Allows any origin in development or when deployed dynamically
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".run.app") ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".onrender.com") ||
        origin.endsWith(".up.railway.app") ||
        origin.includes("localhost")
      ) {
        callback(null, true);
      } else {
        // In production, if they deploy to a custom domain, we should ideally allow it
        // dynamically since we are serving both frontend and backend from the same process
        callback(null, true);
      }
    },
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "50mb",
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      console.log(
        `[API LOG] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
      );
    }
  });
  next();
});
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize Supabase
const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs";
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Mistral with Key Rotation (Load Balancing)
let currentKeyIndex = 0;

const getMistralClient = (customKey?: string) => {
  if (customKey && customKey.trim() !== "") {
    return new Mistral({ apiKey: customKey.trim(), timeoutMs: 300000 });
  }

  const rawKeyText =
    process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || "";
  // Allowed formats: "key1", "key1,key2,key3" or "key1;key2;key3"
  const apiKeys = rawKeyText
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (apiKeys.length === 0) {
    console.error("[SERVER] MISTRAL_API_KEY NO ENCONTRADA.");
    console.error(
      "[SERVER] Verifique se a variável MISTRAL_API_KEY está configurada no menu Settings do AI Studio.",
    );
    throw new Error(
      "MISTRAL_API_KEY not found. Please set it in the environment variables.",
    );
  }

  // Pick the current key in a round-robin rotation
  const apiKey = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length; // move to next key for the next request

  const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  console.log(
    `[SERVER] Mistral Load Balancer rodando. Chave escolhida (${currentKeyIndex === 0 ? apiKeys.length : currentKeyIndex}/${apiKeys.length}): ${maskedKey}`,
  );

  // Increasing default timeout from 30s to 5 minutes to avoid DOMException TimeoutError on long generations
  return new Mistral({
    apiKey,
    timeoutMs: 300000, // 300 seconds
  });
};

// AI Routes
app.post("/api/ai/complete", async (req, res) => {
  const customKey = req.headers["x-custom-api-key"] as string | undefined;
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[AI-COMPLETE][${requestId}] Iniciando requisição completa...`);
  try {
    const body = req.body;
    if (!body || !body.messages) {
      return res.status(400).json({ error: "Mensagens ausentes." });
    }

    const rawKeyText =
      process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || "";
    const keyArrayMatch = rawKeyText
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    const totalKeys = customKey ? 1 : keyArrayMatch.length || 1;

    let response;
    let retries = totalKeys * 2; // Auto scale retries if they enter multiple keys
    while (retries >= 0) {
      try {
        const mistral = getMistralClient(customKey);
        response = await mistral.chat.complete(body);
        break;
      } catch (err: any) {
        const isRateLimit =
          err.status === 429 || (err.message && err.message.includes("429"));
        const isTimeoutOrServerErr =
          err.name === "TimeoutError" ||
          (err.message && err.message.toLowerCase().includes("timeout")) ||
          err.status >= 500;

        if (retries > 0 && (isRateLimit || isTimeoutOrServerErr)) {
          console.warn(
            `[AI-COMPLETE][${requestId}] Erro ${err.status || "Timeout"} detectado. Trocando de chave/tentando novamente...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          retries--;
        } else {
          throw err;
        }
      }
    }

    res.json(response);
  } catch (error: any) {
    console.error(`[AI-COMPLETE] Erro:`, error);
    res
      .status(error.status || 500)
      .json({ error: error.message || "Erro na IA." });
  }
});

app.post("/api/ai/stream", async (req, res) => {
  const customKey = req.headers["x-custom-api-key"] as string | undefined;
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[AI-STREAM][${requestId}] Iniciando streaming...`);
  try {
    const body = req.body;
    if (!body || !body.messages) {
      return res.status(400).json({ error: "Mensagens ausentes." });
    }

    console.log(
      `[AI-STREAM][${requestId}] Usando modelo: ${body.model || "default"}`,
    );

    const rawKeyText =
      process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || "";
    // Used to scale retries automatically
    const keyArrayMatch = rawKeyText
      .split(/[,;]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    const totalKeys = customKey ? 1 : keyArrayMatch.length || 1;

    let stream;
    let retries = totalKeys * 2; // Auto scale retries if they enter multiple keys
    while (retries >= 0) {
      try {
        const mistral = getMistralClient(customKey);
        stream = await mistral.chat.stream(body);
        break; // Sucesso
      } catch (err: any) {
        const isRateLimit =
          err.status === 429 || (err.message && err.message.includes("429"));
        const isTimeoutOrServerErr =
          err.name === "TimeoutError" ||
          (err.message && err.message.toLowerCase().includes("timeout")) ||
          err.status >= 500;

        if (retries > 0 && (isRateLimit || isTimeoutOrServerErr)) {
          console.warn(
            `[AI-STREAM][${requestId}] Erro ${err.status || "Timeout"} detectado. Trocando de chave/tentando novamente...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Espera 2s antes de tentar
          retries--;
        } else {
          throw err;
        }
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Força o envio dos cabeçalhos imediatamente
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    if (!stream) throw new Error("Stream not initialized.");

    let chunkCount = 0;
    try {
      for await (const chunk of stream) {
        if (chunk) {
          chunkCount++;
          // v2 SDK wraps the chunk in a data property
          const cleanChunk = (chunk as any).data || chunk;
          res.write(`data: ${JSON.stringify(cleanChunk)}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      console.log(
        `[AI-STREAM][${requestId}] Stream finalizado com sucesso. Chunks: ${chunkCount}`,
      );
    } catch (streamError: any) {
      console.error(
        `[AI-STREAM][${requestId}] Erro durante a iteração do stream:`,
        streamError,
      );

      // Notify client visually that generation was interrupted
      const errorMsg = {
        choices: [
          {
            delta: {
              content:
                "\n\n**[Erro de Conexão: A resposta da IA foi interrompida por inatividade (Timeout). Por favor, repita a pergunta.]**\n",
            },
          },
        ],
      };
      res.write(`data: ${JSON.stringify(errorMsg)}\n\n`);
      res.write("data: [DONE]\n\n");
    }

    res.end();
  } catch (error: any) {
    console.error(`[AI-STREAM] Erro:`, error);
    if (!res.headersSent) {
      res
        .status(error.status || 500)
        .json({ error: error.message || "Erro na IA." });
    } else {
      res.end();
    }
  }
});

// ... existing server code

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ==========================================
// Stripe Integration Endpoints
// ==========================================

app.get("/api/stripe/config", (req, res) => {
  const secretKey = (
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY ||
    process.env.STRIPE_KEY ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  const publishableKey = (
    process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLIC_KEY ||
    ""
  ).trim().replace(/^["']|["']$/g, "");

  const isConfigured = Boolean(secretKey);

  res.json({
    enabled: isConfigured && Boolean(publishableKey),
    publishableKey: publishableKey || null,
    hasSecretKey: isConfigured,
    missing: {
      secretKey: !isConfigured,
      publishableKey: !publishableKey,
    },
  });
});

app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        error: "Stripe não configurado no servidor. Configure STRIPE_SECRET_KEY.",
      });
    }

    const { planId, userId, userEmail, successUrl, cancelUrl, embedded, returnUrl } = req.body;
    if (!planId) {
      return res.status(400).json({ error: "Parâmetro planId é obrigatório." });
    }

    const normPlanId = String(planId).toLowerCase();
    const planConfig = STRIPE_PLANS[normPlanId] || STRIPE_PLANS.mensal;

    const origin = req.headers.origin || "https://nalabia.com.br";
    const finalSuccessUrl =
      successUrl || `${origin}/dashboard?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${origin}/dashboard?stripe_status=cancel`;
    const finalReturnUrl =
      returnUrl || `${origin}/dashboard?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`;

    // Try to find existing Stripe Customer if userId or email is provided
    let customerId: string | undefined = undefined;
    const users = db.getCollection("users");
    const userDoc = users.find(
      (u: any) =>
        (userId && (u.userID === userId || u.id === userId)) ||
        (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()),
    );

    if (userDoc?.stripeCustomerId) {
      customerId = userDoc.stripeCustomerId;
    }

    // Build session parameters
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: planConfig.mode,
      line_items: [
        {
          price_data: {
            currency: planConfig.currency || "brl",
            product_data: {
              name: planConfig.name,
              description: `Acesso exclusivo NaLábia Prime (${planConfig.name})`,
            },
            unit_amount: planConfig.amountInCents,
            ...(planConfig.mode === "subscription"
              ? {
                  recurring: {
                    interval: planConfig.interval || "month",
                    interval_count: planConfig.intervalCount || 1,
                  },
                }
              : {}),
          },
          quantity: 1,
        },
      ],
      client_reference_id: userId || userDoc?.userID || undefined,
      metadata: {
        userId: userId || userDoc?.userID || "",
        userEmail: userEmail || userDoc?.email || "",
        planId: planConfig.id,
        planType: planConfig.type,
      },
    };

    if (embedded) {
      (sessionParams as any).ui_mode = "embedded_page";
      sessionParams.return_url = finalReturnUrl;
    } else {
      sessionParams.success_url = finalSuccessUrl;
      sessionParams.cancel_url = finalCancelUrl;
    }

    if (customerId) {
      sessionParams.customer = customerId;
    } else if (userEmail || userDoc?.email) {
      sessionParams.customer_email = userEmail || userDoc?.email;
    }

    if (planConfig.mode === "subscription") {
      sessionParams.subscription_data = {
        metadata: {
          userId: userId || userDoc?.userID || "",
          userEmail: userEmail || userDoc?.email || "",
          planId: planConfig.id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      url: session.url,
      sessionId: session.id,
      clientSecret: session.client_secret,
    });
  } catch (error: any) {
    console.error("[STRIPE API] Create checkout session error:", error);
    res.status(500).json({ error: error.message || "Erro ao criar sessão do Stripe." });
  }
});

app.post("/api/stripe/verify-session", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Stripe não configurado no servidor." });
    }

    const { sessionId, userId, userEmail } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId é obrigatório." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    if (session.payment_status === "paid" || session.status === "complete") {
      const planId = session.metadata?.planId || "mensal";
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const effectiveEmail = session.customer_details?.email || session.customer_email || userEmail;
      const effectiveUserId = session.client_reference_id || session.metadata?.userId || userId;

      const updatedUser = applyStripeAccess({
        userId: effectiveUserId,
        userEmail: effectiveEmail,
        planId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        amountTotal: session.amount_total || undefined,
      });

      return res.json({
        success: true,
        status: session.payment_status,
        user: updatedUser,
      });
    }

    res.json({
      success: false,
      status: session.payment_status,
      message: "Pagamento ainda não confirmado ou pendente.",
    });
  } catch (error: any) {
    console.error("[STRIPE API] Verify session error:", error);
    res.status(500).json({ error: error.message || "Erro ao verificar sessão do Stripe." });
  }
});

app.post("/api/stripe/create-portal-session", async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Stripe não configurado no servidor." });
    }

    const { userId, userEmail, returnUrl } = req.body;
    const users = db.getCollection("users");
    const userDoc = users.find(
      (u: any) =>
        (userId && (u.userID === userId || u.id === userId)) ||
        (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()),
    );

    let customerId = userDoc?.stripeCustomerId;

    if (!customerId && (userEmail || userDoc?.email)) {
      const email = userEmail || userDoc?.email;
      const customers = await stripe.customers.list({ email: email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        if (userDoc) {
          userDoc.stripeCustomerId = customerId;
          db.setCollection("users", users);
        }
      }
    }

    if (!customerId) {
      return res.status(404).json({
        error: "Nenhum cliente Stripe ativo encontrado para este usuário.",
      });
    }

    const origin = req.headers.origin || "https://nalabia.com.br";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${origin}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("[STRIPE API] Create portal session error:", error);
    res.status(500).json({ error: error.message || "Erro ao abrir portal do cliente." });
  }
});

app.post("/api/stripe/webhook", async (req: any, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  let event: Stripe.Event;

  try {
    if (stripe && webhookSecret && sig && req.rawBody) {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } else {
      // Fallback for tests / unverified requests if secret not configured
      event = req.body as Stripe.Event;
    }
  } catch (err: any) {
    console.error("[STRIPE WEBHOOK] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE WEBHOOK] Event received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const userEmail = session.customer_details?.email || session.customer_email || session.metadata?.userEmail;
        const planId = session.metadata?.planId || "mensal";
        const customerId = session.customer as string | undefined;
        const subscriptionId = session.subscription as string | undefined;
        const amountTotal = session.amount_total || undefined;

        console.log(`[STRIPE WEBHOOK] Checkout completed for ${userEmail || userId}, plan: ${planId}`);
        applyStripeAccess({
          userId,
          userEmail,
          planId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          amountTotal,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer as string | undefined;
        const subscriptionId = invoice.subscription as string | undefined;
        const userEmail = invoice.customer_email || undefined;
        const amountTotal = invoice.amount_paid || undefined;

        if (subscriptionId) {
          applyStripeAccess({
            userEmail,
            planId: "mensal",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            amountTotal,
          });
        }
        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[STRIPE WEBHOOK] Subscription cancelled/paused: ${subscription.id}`);
        revokeStripeAccess({
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        if (subscription.status === "active") {
          applyStripeAccess({
            planId: "mensal",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
          });
        } else if (["canceled", "unpaid", "past_due"].includes(subscription.status)) {
          revokeStripeAccess({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
          });
        }
        break;
      }

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("[STRIPE WEBHOOK] Handler error:", err);
    res.status(500).json({ error: "Webhook processing error" });
  }
});

// Trial & Anti-Abuse Endpoints
app.post("/api/trial/status", async (req, res) => {
  try {
    const { hwid, deviceHash, email, userId } = req.body;
    const clientIp = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "");
    const deviceTrials = db.getCollection("device_trials");
    const normEmail = email ? String(email).trim().toLowerCase() : "";

    // Search for existing record by hwid, deviceHash, or email
    let existing = deviceTrials.find(
      (t: any) =>
        (hwid && (t.hwid === hwid || t.id === hwid)) ||
        (deviceHash && (t.device_hash === deviceHash || t.id === deviceHash)) ||
        (normEmail && Array.isArray(t.registered_emails) && t.registered_emails.includes(normEmail)),
    );

    const now = Date.now();

    if (existing) {
      // If email provided and not yet registered under this device, track it for multi-account anti-abuse
      if (normEmail && Array.isArray(existing.registered_emails) && !existing.registered_emails.includes(normEmail)) {
        existing.registered_emails.push(normEmail);
        db.setCollection("device_trials", deviceTrials);
      }

      const remainingMs = Math.max(0, existing.trial_expires_at - now);
      const isExpired = remainingMs <= 0;
      existing.is_expired = isExpired;
      db.setCollection("device_trials", deviceTrials);

      return res.json({
        isEligible: false,
        isActive: !isExpired,
        isExpired: isExpired,
        trialStartedAt: existing.first_trial_start,
        trialExpiresAt: existing.trial_expires_at,
        remainingMs: remainingMs,
        registeredEmailsCount: existing.registered_emails?.length || 1,
        isAbuseBlocked: isExpired && (existing.registered_emails?.length || 1) > 1,
        message: isExpired
          ? "O período de teste grátis de 24 horas deste dispositivo já encerrou."
          : "Teste grátis de 24 horas ativo no dispositivo.",
      });
    }

    // Brand new device/browser claiming their initial 24h trial
    const firstTrialStart = now;
    const trialExpiresAt = firstTrialStart + 24 * 60 * 60 * 1000;
    const newEntry = {
      id: hwid || deviceHash || `dev_${Date.now()}`,
      device_hash: deviceHash || "",
      hwid: hwid || "",
      ip: clientIp,
      first_trial_start: firstTrialStart,
      trial_expires_at: trialExpiresAt,
      registered_emails: normEmail ? [normEmail] : [],
      is_expired: false,
      created_at: new Date().toISOString(),
    };

    deviceTrials.push(newEntry);
    db.setCollection("device_trials", deviceTrials);

    return res.json({
      isEligible: true,
      isActive: true,
      isExpired: false,
      trialStartedAt: firstTrialStart,
      trialExpiresAt: trialExpiresAt,
      remainingMs: 24 * 60 * 60 * 1000,
      registeredEmailsCount: 1,
      isAbuseBlocked: false,
      message: "Você ganhou um dia de teste grátis para utilizar o NaLábia!",
    });
  } catch (err: any) {
    console.error("[TRIAL API] Error checking trial status:", err);
    res.status(500).json({ error: err.message || "Erro ao verificar teste grátis." });
  }
});

// Authentication Endpoints
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, hwid, deviceHash } = req.body;
    if (!email) return res.status(400).json({ error: "Email obrigatório." });

    const normEmail = String(email).trim().toLowerCase();
    const authUsers = db.getCollection("auth_users");
    const users = db.getCollection("users");
    const deviceTrials = db.getCollection("device_trials");

    let authUser = authUsers.find((u: any) => u.email?.toLowerCase() === normEmail);
    let userDoc = users.find((u: any) => u.email?.toLowerCase() === normEmail);

    const isDeveloper =
      normEmail === "loordbilly898@gmail.com" ||
      normEmail === "nalabiainc@gmail.com";
    const isLegacyPremium =
      normEmail === "kauanhenrique171822@gmail.com" ||
      normEmail === "gamerbilly898@gmail.com" ||
      normEmail === "nauandematoss@gmail.com" ||
      normEmail === "encantomirim53@gmail.com" ||
      normEmail === "lucastorresoliveira77@gmail.com" ||
      normEmail === "luqin.oliiver@gmail.com" ||
      normEmail === "williamhendler711@gmail.com";

    // Auto-create or allow developer/legacy/existing accounts
    if (!authUser) {
      const generatedId = `usr_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      authUser = {
        id: generatedId,
        email: normEmail,
        password: password || "password",
        full_name: normEmail.split("@")[0],
        created_at: new Date().toISOString(),
      };
      authUsers.push(authUser);
      db.setCollection("auth_users", authUsers);
    } else if (password && (!authUser.password || isDeveloper || isLegacyPremium)) {
      // Update password for seamless access
      authUser.password = password;
      db.setCollection("auth_users", authUsers);
    } else if (password && authUser.password && authUser.password !== password && !isDeveloper && !isLegacyPremium) {
      return res.status(400).json({ error: "Senha incorreta. Tente novamente." });
    }

    // Device trial anti-abuse lookup
    let deviceEntry = deviceTrials.find(
      (t: any) =>
        (hwid && (t.hwid === hwid || t.id === hwid)) ||
        (deviceHash && (t.device_hash === deviceHash || t.id === deviceHash)) ||
        (Array.isArray(t.registered_emails) && t.registered_emails.includes(normEmail)),
    );

    const now = Date.now();
    let trialStart = now;
    let trialExpires = now + 24 * 60 * 60 * 1000;
    let isTrialExpired = false;

    if (deviceEntry) {
      trialStart = deviceEntry.first_trial_start;
      trialExpires = deviceEntry.trial_expires_at;
      isTrialExpired = now >= trialExpires;
      if (!deviceEntry.registered_emails.includes(normEmail)) {
        deviceEntry.registered_emails.push(normEmail);
        db.setCollection("device_trials", deviceTrials);
      }
    } else if (!isDeveloper && !isLegacyPremium) {
      // Create trial entry for new device
      deviceEntry = {
        id: hwid || deviceHash || `dev_${Date.now()}`,
        device_hash: deviceHash || "",
        hwid: hwid || "",
        ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""),
        first_trial_start: trialStart,
        trial_expires_at: trialExpires,
        registered_emails: [normEmail],
        is_expired: false,
        created_at: new Date().toISOString(),
      };
      deviceTrials.push(deviceEntry);
      db.setCollection("device_trials", deviceTrials);
    }

    if (!userDoc) {
      userDoc = {
        userID: authUser.id,
        name: authUser.full_name || normEmail.split("@")[0],
        email: normEmail,
        level: isDeveloper ? 99 : isLegacyPremium ? 10 : 1,
        xp: isDeveloper ? 99999 : isLegacyPremium ? 5000 : 0,
        createdAt: now,
        onboardingCompleted: true,
        status: isDeveloper || isLegacyPremium ? "ativo" : isTrialExpired ? "expirado" : "ativo_trial",
        plano: isDeveloper ? "Desenvolvedor" : isLegacyPremium ? "Mensal" : "",
        nalabiaPrimeAcess: isDeveloper || isLegacyPremium,
        darkPackAccess: isDeveloper || isLegacyPremium,
        coursesAccess: isDeveloper || isLegacyPremium,
        mentoriaAccess: isDeveloper || isLegacyPremium,
        trialStartedAt: trialStart,
        trialExpiresAt: trialExpires,
        trialAbuseDetected: isTrialExpired && (deviceEntry?.registered_emails?.length || 1) > 1,
        freeMessagesUsed: 0,
      };
      users.push(userDoc);
      db.setCollection("users", users);
    } else {
      // Ensure VIP flags for developer/legacy
      if (isDeveloper) {
        userDoc.status = "ativo";
        userDoc.plano = "Desenvolvedor";
        userDoc.nalabiaPrimeAcess = true;
        userDoc.darkPackAccess = true;
        userDoc.coursesAccess = true;
        userDoc.mentoriaAccess = true;
      } else if (isLegacyPremium) {
        userDoc.status = "ativo";
        userDoc.nalabiaPrimeAcess = true;
        userDoc.darkPackAccess = true;
        userDoc.coursesAccess = true;
        userDoc.mentoriaAccess = true;
      } else {
        // Sync trial timestamps from device entry
        userDoc.trialStartedAt = trialStart;
        userDoc.trialExpiresAt = trialExpires;
        if (userDoc.status !== "ativo") {
          userDoc.status = isTrialExpired ? "expirado" : "ativo_trial";
        }
      }
      db.setCollection("users", users);
    }

    // Record sign_in log
    const signIns = db.getCollection("sign_ins");
    signIns.push({
      user_id: authUser.id,
      email: normEmail,
      signed_in_at: new Date().toISOString(),
    });
    db.setCollection("sign_ins", signIns);

    const userPayload = {
      id: authUser.id,
      email: authUser.email,
      user_metadata: {
        full_name: authUser.full_name || userDoc?.name || normEmail.split("@")[0],
      },
    };

    return res.json({
      user: userPayload,
      token: `token_${authUser.id}_${Date.now()}`,
    });
  } catch (err: any) {
    console.error("[AUTH API] Login error:", err);
    res.status(500).json({ error: err.message || "Erro no login." });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name, hwid, deviceHash } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatórios." });
    }

    const normEmail = String(email).trim().toLowerCase();
    const authUsers = db.getCollection("auth_users");
    const users = db.getCollection("users");
    const deviceTrials = db.getCollection("device_trials");

    let authUser = authUsers.find((u: any) => u.email?.toLowerCase() === normEmail);
    if (!authUser) {
      const generatedId = `usr_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      authUser = {
        id: generatedId,
        email: normEmail,
        password: password,
        full_name: name || normEmail.split("@")[0],
        created_at: new Date().toISOString(),
      };
      authUsers.push(authUser);
      db.setCollection("auth_users", authUsers);
    } else {
      authUser.password = password;
      if (name) authUser.full_name = name;
      db.setCollection("auth_users", authUsers);
    }

    // Anti-Abuse Device Check: Has this device already started a 24-hour trial before?
    const now = Date.now();
    let deviceEntry = deviceTrials.find(
      (t: any) =>
        (hwid && (t.hwid === hwid || t.id === hwid)) ||
        (deviceHash && (t.device_hash === deviceHash || t.id === deviceHash)),
    );

    let trialStart = now;
    let trialExpires = now + 24 * 60 * 60 * 1000;
    let isTrialExpired = false;
    let isAbuseAttempt = false;

    if (deviceEntry) {
      // Device already claimed trial in the past! Anchor to original device start date.
      trialStart = deviceEntry.first_trial_start;
      trialExpires = deviceEntry.trial_expires_at;
      isTrialExpired = now >= trialExpires;
      isAbuseAttempt = !deviceEntry.registered_emails.includes(normEmail);

      if (isAbuseAttempt) {
        deviceEntry.registered_emails.push(normEmail);
        db.setCollection("device_trials", deviceTrials);
      }
    } else {
      // First time device: Grant full 24h trial
      deviceEntry = {
        id: hwid || deviceHash || `dev_${Date.now()}`,
        device_hash: deviceHash || "",
        hwid: hwid || "",
        ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || ""),
        first_trial_start: trialStart,
        trial_expires_at: trialExpires,
        registered_emails: [normEmail],
        is_expired: false,
        created_at: new Date().toISOString(),
      };
      deviceTrials.push(deviceEntry);
      db.setCollection("device_trials", deviceTrials);
    }

    let userDoc = users.find((u: any) => u.email?.toLowerCase() === normEmail || u.userID === authUser.id);
    if (!userDoc) {
      userDoc = {
        userID: authUser.id,
        name: name || authUser.full_name || normEmail.split("@")[0],
        email: normEmail,
        level: 1,
        xp: 0,
        createdAt: now,
        onboardingCompleted: true,
        status: isTrialExpired ? "expirado" : "ativo_trial",
        plano: "",
        nalabiaPrimeAcess: false,
        darkPackAccess: false,
        coursesAccess: false,
        mentoriaAccess: false,
        trialStartedAt: trialStart,
        trialExpiresAt: trialExpires,
        trialAbuseDetected: isAbuseAttempt && isTrialExpired,
        freeMessagesUsed: 0,
      };
      users.push(userDoc);
      db.setCollection("users", users);
    } else {
      userDoc.trialStartedAt = trialStart;
      userDoc.trialExpiresAt = trialExpires;
      if (userDoc.status !== "ativo") {
        userDoc.status = isTrialExpired ? "expirado" : "ativo_trial";
      }
      db.setCollection("users", users);
    }

    const userPayload = {
      id: authUser.id,
      email: authUser.email,
      user_metadata: {
        full_name: authUser.full_name || userDoc.name,
      },
    };

    return res.json({
      user: userPayload,
      token: `token_${authUser.id}_${Date.now()}`,
      trialExpiresAt: trialExpires,
      isTrialActive: !isTrialExpired,
      isAbuseDetected: isAbuseAttempt && isTrialExpired,
    });
  } catch (err: any) {
    console.error("[AUTH API] Signup error:", err);
    res.status(500).json({ error: err.message || "Erro no cadastro." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.json({ success: true });
});

app.post("/api/auth/reset-password", (req, res) => {
  res.json({ success: true, message: "Instruções enviadas para seu e-mail." });
});

app.post("/api/auth/update-user", (req, res) => {
  const { userId, password, data } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const authUsers = db.getCollection("auth_users");
  const authUser = authUsers.find((u: any) => u.id === userId);
  if (authUser) {
    if (password) authUser.password = password;
    if (data?.full_name) authUser.full_name = data.full_name;
    db.setCollection("auth_users", authUsers);
  }

  const users = db.getCollection("users");
  const userDoc = users.find((u: any) => u.userID === userId);
  if (userDoc && data?.full_name) {
    userDoc.name = data.full_name;
    db.setCollection("users", users);
  }

  res.json({
    user: authUser
      ? {
          id: authUser.id,
          email: authUser.email,
          user_metadata: { full_name: authUser.full_name },
        }
      : null,
  });
});

// Resilient DB Query Endpoint
app.post("/api/db/query", async (req, res) => {
  try {
    const {
      table,
      op = "select",
      payload,
      filters = [],
      orderCol,
      orderAsc = true,
      limitCount,
      isSingle = false,
      isMaybeSingle = false,
    } = req.body;

    if (!table) return res.status(400).json({ error: "Missing table" });

    const collection = db.getCollection(table);

    if (op === "select") {
      let filtered = [...collection];

      for (const filter of filters) {
        if (filter.type === "eq") {
          filtered = filtered.filter((item: any) => {
            const itemVal = item[filter.column];
            return String(itemVal).toLowerCase() === String(filter.value).toLowerCase();
          });
        } else if (filter.type === "ilike") {
          filtered = filtered.filter((item: any) => {
            const itemVal = String(item[filter.column] || "").toLowerCase();
            return itemVal.includes(String(filter.value || "").toLowerCase());
          });
        }
      }

      if (orderCol) {
        filtered.sort((a: any, b: any) => {
          const valA = a[orderCol];
          const valB = b[orderCol];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          if (valA < valB) return orderAsc ? -1 : 1;
          return orderAsc ? 1 : -1;
        });
      }

      if (limitCount && limitCount > 0) {
        filtered = filtered.slice(0, limitCount);
      }

      if (isSingle) {
        return res.json({ data: filtered[0] || null });
      }
      if (isMaybeSingle) {
        return res.json({ data: filtered[0] || null });
      }

      return res.json({ data: filtered });
    }

    if (op === "insert") {
      const itemsToInsert = Array.isArray(payload) ? payload : [payload];
      for (const item of itemsToInsert) {
        collection.push(item);
      }
      db.setCollection(table, collection);
      return res.json({ data: payload });
    }

    if (op === "update") {
      let updatedCount = 0;
      for (let i = 0; i < collection.length; i++) {
        let match = true;
        for (const filter of filters) {
          if (filter.type === "eq") {
            if (
              String(collection[i][filter.column]).toLowerCase() !==
              String(filter.value).toLowerCase()
            ) {
              match = false;
              break;
            }
          }
        }
        if (match) {
          collection[i] = { ...collection[i], ...payload };
          updatedCount++;
        }
      }
      db.setCollection(table, collection);
      return res.json({ data: payload, updatedCount });
    }

    if (op === "upsert") {
      const itemsToUpsert = Array.isArray(payload) ? payload : [payload];
      for (const item of itemsToUpsert) {
        const idKey = item.userID ? "userID" : item.id ? "id" : item.user_id ? "user_id" : null;
        let index = -1;
        if (idKey && item[idKey]) {
          index = collection.findIndex((x: any) => String(x[idKey]).toLowerCase() === String(item[idKey]).toLowerCase());
        } else if (item.email) {
          index = collection.findIndex((x: any) => String(x.email).toLowerCase() === String(item.email).toLowerCase());
        }

        if (index >= 0) {
          collection[index] = { ...collection[index], ...item };
        } else {
          collection.push(item);
        }
      }
      db.setCollection(table, collection);
      return res.json({ data: payload });
    }

    if (op === "delete") {
      const remaining = collection.filter((item: any) => {
        for (const filter of filters) {
          if (filter.type === "eq") {
            if (
              String(item[filter.column]).toLowerCase() ===
              String(filter.value).toLowerCase()
            ) {
              return false; // Remove
            }
          }
        }
        return true;
      });
      db.setCollection(table, remaining);
      return res.json({ data: { success: true } });
    }

    res.json({ data: null });
  } catch (err: any) {
    console.error("[DB API] Query error:", err);
    res.status(500).json({ error: err.message || "Erro no banco de dados." });
  }
});

app.post("/api/verify-payment", async (req, res) => {
  try {
    const { userId, type } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const users = db.getCollection("users");
    const assinaturas = db.getCollection("assinaturas");

    // 1. CHECAGEM NO BANCO LOCAL
    const dbUser = users.find((u: any) => u.userID === userId || u.id === userId);
    const emailToCheck = dbUser?.email || "";
    const currAssinatura = emailToCheck
      ? assinaturas.find((a: any) => a.email?.toLowerCase() === emailToCheck.toLowerCase())
      : null;

    if (dbUser && dbUser.status === "ativo") {
      if (type === "courses" && dbUser.coursesAccess) return res.json({ success: true, message: "Pago verificado." });
      if (type === "darkpack" && dbUser.darkPackAccess) return res.json({ success: true, message: "Pago verificado." });
      if (type === "mentoria" && (dbUser.mentoriaAccess || dbUser.settings?.mentoriaAccess)) return res.json({ success: true, message: "Pago verificado." });
      if ((!type || (type !== "courses" && type !== "darkpack" && type !== "mentoria")) && dbUser.nalabiaPrimeAcess) {
        return res.json({ success: true, message: "Assinatura verificada." });
      }
    }

    // Fallback check from assinaturas
    if (currAssinatura && currAssinatura.status === "ativa" && new Date(currAssinatura.expira_em) > new Date()) {
      const pNome = (currAssinatura.plano_nome || "").toLowerCase();
      if (type === "courses" && (pNome.includes("curso") || pNome.includes("academia"))) return res.json({ success: true, message: "Pago verificado." });
      if (type === "darkpack" && pNome.includes("dark")) return res.json({ success: true, message: "Pago verificado." });
      if (type === "mentoria" && pNome.includes("mentoria")) return res.json({ success: true, message: "Pago verificado." });
      if (!type || (type !== "courses" && type !== "darkpack" && type !== "mentoria")) {
        return res.json({ success: true, message: "Assinatura verificada." });
      }
    }

    res.json({
      success: false,
      message:
        "Nenhum pagamento aprovado encontrado. Se usou Cakto, aguarde uns minutos para o sistema receber o pagamento via webhook.",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

app.post("/api/cakto/create-checkout", async (req, res) => {
  try {
    const { planId, userId } = req.body;
    if (!planId || !userId)
      return res.status(400).json({ error: "Missing planId or userId" });

    let checkoutUrl = "";
    if (planId === "mensal" || planId === "monthly")
      checkoutUrl = "https://pay.cakto.com.br/nnbqprt_825346?affiliate=NAwEEUbX";
    else if (planId === "trimestral")
      checkoutUrl = "https://pay.cakto.com.br/379zopu_826386?affiliate=NAwEEUbX";
    else if (planId === "anual")
      checkoutUrl = "https://pay.cakto.com.br/x4pha2o_826385?affiliate=NAwEEUbX";
    else if (planId === "curso")
      checkoutUrl = "https://pay.cakto.com.br/exfk6pm_826428?affiliate=NAwEEUbX";
    else if (planId === "dark")
      checkoutUrl = "https://pay.cakto.com.br/mnh4hcg_826434?affiliate=NAwEEUbX";
    else if (planId === "mentoria")
      checkoutUrl = "https://pay.cakto.com.br/obgpnz3_874157?affiliate=43LRhHmd";
    else return res.status(400).json({ error: "Invalid planId" });

    const separator = checkoutUrl.includes("?") ? "&" : "?";
    res.json({ checkout_url: `${checkoutUrl}${separator}src=${userId}` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create Cakto checkout" });
  }
});

app.post("/api/webhook/cakto", async (req, res) => {
  console.log(
    "[Cakto] Webhook Received. Full payload:",
    JSON.stringify(req.body),
  );
  try {
    let payload = req.body.data || req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (e) {}
    }
    const event = String(
      req.body.event || payload.event || payload.status || "",
    ).toLowerCase();
    const status = String(payload.status || event).toLowerCase();

    // Cakto often sends the external reference in the 'src' field or 'metadata'
    const userId =
      payload.external_reference ||
      payload.reference ||
      payload.metadata?.userId ||
      payload.tracking?.src ||
      payload.src ||
      payload.sck ||
      payload.utm_source ||
      payload.tracking?.source;
    const amount = payload.amount
      ? Number(payload.amount) / 100
      : Number(payload.transaction_amount) || 0;
    const payloadString = JSON.stringify(payload).toLowerCase();
    
    // Add known Cakto offer IDs if present in payload to help identification
    let extraReason = "";
    if (payloadString.includes("nnbqprt")) extraReason += " mensal";
    if (payloadString.includes("379zopu")) extraReason += " trimestral";
    if (payloadString.includes("x4pha2o")) extraReason += " anual";
    if (payloadString.includes("exfk6pm")) extraReason += " curso";
    if (payloadString.includes("mnh4hcg")) extraReason += " darkpack";
    if (payloadString.includes("obgpnz3")) extraReason += " mentoria";

    const reason =
      (payload.metadata?.planName ||
      payload.product?.name ||
      payload.offer?.name ||
      payload.items?.[0]?.title ||
      "") + extraReason;
    const rawEmail =
      payload.customer?.email ||
      payload.client?.email ||
      payload.email ||
      payload.payer_email || "";
      
    const payerEmail = String(rawEmail).trim().toLowerCase();

    console.log(
      `[Cakto] Parsed -> Status: ${status}, UserId: ${userId}, Email: ${payerEmail}, Amount: ${amount}, Reason: ${reason}`,
    );

    if (
      [
        "paid",
        "approved",
        "payment.paid",
        "payment.approved",
        "completed",
      ].includes(status)
    ) {
      await processSubscriptionUpdate({
        id:
          payload.id?.toString() ||
          payload.transaction_id ||
          `cakto_${Date.now()}`,
        external_reference: userId,
        payer_email: payerEmail,
        status: "authorized",
        reason: reason,
        transaction_amount: amount,
        provider: "cakto",
      });
    } else if (
      ["cancelled", "canceled", "subscription.canceled"].includes(status)
    ) {
      await processSubscriptionUpdate({
        id:
          payload.id?.toString() ||
          payload.transaction_id ||
          `cakto_${Date.now()}`,
        external_reference: userId,
        payer_email: payerEmail,
        status: "cancelled",
        reason: reason,
        transaction_amount: amount,
        provider: "cakto",
      });
    }
    res.status(200).send("OK");
  } catch (error: any) {
    console.error("[Cakto] Webhook parsing error:", error);
    res.status(500).send("Webhook Error");
  }
});

async function processSubscriptionUpdate(subscription: any) {
  let userId = subscription.external_reference;
  const payerEmail = subscription.payer_email || subscription.payer?.email;
  const status = String(subscription.status || "").toLowerCase();
  const reason = subscription.reason || subscription.description || "";
  const transactionAmount = Number(
    subscription.transaction_amount ||
      subscription.auto_recurring?.transaction_amount ||
      0,
  );
  const planName = reason.includes("NaLábia")
    ? reason.replace("NaLábia - ", "")
    : reason || "Premium";

  console.log(
    `[Payment Process] User: ${userId || payerEmail}, Status: ${status}, Amount: ${transactionAmount}, Reason: ${reason}`,
  );

  const users = db.getCollection("users");
  const authUsers = db.getCollection("auth_users");
  const assinaturas = db.getCollection("assinaturas");

  let userData: any = null;
  if (userId) {
    userData = users.find((u: any) => u.userID === userId || u.id === userId);
  }
  if (!userData && payerEmail) {
    userData = users.find((u: any) => u.email?.toLowerCase() === payerEmail.toLowerCase());
    if (userData) userId = userData.userID;
  }

  if (!userData) {
    const generatedId = userId || `usr_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    userId = generatedId;
    userData = {
      userID: userId,
      email: payerEmail || "",
      name: payerEmail ? payerEmail.split("@")[0] : "Usuário",
      level: 1,
      xp: 0,
      createdAt: Date.now(),
      onboardingCompleted: true,
      status: "pendente",
      plano: "",
      nalabiaPrimeAcess: false,
      darkPackAccess: false,
      coursesAccess: false,
      mentoriaAccess: false,
      freeMessagesUsed: 0,
    };
    users.push(userData);

    // Also ensure auth_user exists
    if (payerEmail && !authUsers.some((a: any) => a.email?.toLowerCase() === payerEmail.toLowerCase())) {
      authUsers.push({
        id: userId,
        email: payerEmail,
        password: "AutoPass" + Math.random().toString(36) + "!",
        full_name: payerEmail.split("@")[0],
        created_at: new Date().toISOString(),
      });
      db.setCollection("auth_users", authUsers);
    }
  }

  if (
    status === "authorized" ||
    status === "approved" ||
    status === "paid" ||
    status === "payment.paid" ||
    status === "completed"
  ) {
    const amount = transactionAmount;
    const isCourse =
      reason.toLowerCase().includes("curso") ||
      reason.toLowerCase().includes("academia") ||
      (amount === 39.9 && reason.toLowerCase().includes("curso"));
    const isDarkPack =
      reason.toLowerCase().includes("dark") ||
      reason.toLowerCase().includes("18") ||
      reason.toLowerCase().includes("manipula") ||
      (amount === 19.9 && reason.toLowerCase().includes("dark"));
    const isMentoria =
      reason.toLowerCase().includes("mentoria") ||
      (amount === 19.9 && reason.toLowerCase().includes("mentoria"));

    let finalExpiraEm = new Date();
    let finalPlano = planName || "Premium";
    let finalPlanoType = "mensal";

    userData.status = "ativo";
    userData.nalabiaPrimeAcess = true;
    userData.lastPaymentId = subscription.id;
    userData.updatedAt = new Date().toISOString();

    if (isCourse) {
      userData.coursesAccess = true;
      userData.plano = "Curso Academia";
      finalPlano = "Curso Academia";
      finalPlanoType = "vitalicio";
      finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10);
    } else if (isDarkPack) {
      userData.darkPackAccess = true;
      userData.plano = "Pacote Dark";
      finalPlano = "Pacote Dark";
      finalPlanoType = "vitalicio";
      finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10);
    } else if (isMentoria) {
      userData.settings = { ...(userData.settings || {}), mentoriaAccess: true };
      userData.mentoriaAccess = true;
      userData.plano = "Mentoria VIP";
      finalPlano = "Mentoria VIP";
      finalPlanoType = "vitalicio";
      finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10);
    } else {
      if (
        reason.toLowerCase().includes("trimestral") ||
        planName.toLowerCase().includes("trimestral")
      ) {
        finalExpiraEm.setDate(finalExpiraEm.getDate() + 90);
        finalPlanoType = "trimestral";
      } else if (
        reason.toLowerCase().includes("semestral") ||
        planName.toLowerCase().includes("semestral")
      ) {
        finalExpiraEm.setDate(finalExpiraEm.getDate() + 180);
        finalPlanoType = "semestral";
      } else if (
        reason.toLowerCase().includes("anual") ||
        planName.toLowerCase().includes("anual")
      ) {
        finalExpiraEm.setDate(finalExpiraEm.getDate() + 365);
        finalPlanoType = "anual";
      } else {
        finalExpiraEm.setDate(finalExpiraEm.getDate() + 30);
        finalPlanoType = "mensal";
      }
      userData.plano = finalPlano;
      userData.expiraEm = finalExpiraEm.toISOString();
    }

    db.setCollection("users", users);

    // Update assinaturas
    const existingAssinIndex = assinaturas.findIndex(
      (a: any) => a.id === userId || a.email?.toLowerCase() === payerEmail?.toLowerCase(),
    );
    const assinObj = {
      id: userId,
      email: payerEmail || userData.email,
      status: "ativa",
      plano: finalPlanoType,
      plano_nome: finalPlano,
      valor_pago: String(amount || "0.00"),
      expira_em: finalExpiraEm.toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (existingAssinIndex >= 0) {
      assinaturas[existingAssinIndex] = assinObj;
    } else {
      assinaturas.push(assinObj);
    }
    db.setCollection("assinaturas", assinaturas);

    console.log(`[Payment Process] Successfully updated user ${userId} to active in DB`);
  } else if (
    ["cancelled", "paused", "canceled", "subscription.canceled"].includes(status)
  ) {
    userData.status = "pendente";
    userData.nalabiaPrimeAcess = false;
    userData.updatedAt = new Date().toISOString();
    db.setCollection("users", users);
  }
}

app.post("/api/admin/activate-user", async (req, res) => {
  const { email, months = 1, secret } = req.body;
  if (
    secret !== process.env.ADMIN_SECRET &&
    process.env.NODE_ENV === "production"
  )
    return res.status(403).json({ error: "Unauthorized" });
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    const users = db.getCollection("users");
    const matched = users.filter((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (matched.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + months);

    for (const user of matched) {
      user.status = "ativo";
      user.plano = `Manual (${months} meses)`;
      user.nalabiaPrimeAcess = true;
      user.expiraEm = expDate.toISOString();
      user.updatedAt = new Date().toISOString();
    }

    db.setCollection("users", users);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/claim-account", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

  try {
    // 1. Find user in auth
    const { data: existingAuth, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;
    
    const authUser = existingAuth?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (!authUser) {
       return res.status(404).json({ error: "Account not found." });
    }

    // 2. Verify that it was auto-created
    if (!authUser.user_metadata?.auto_created) {
       return res.status(403).json({ error: "This email is already registered conventionally. Please login instead." });
    }

    // 3. Update the user password and remove the auto_created flag
    const { error: updateErr } = await supabase.auth.admin.updateUserById(authUser.id, {
       password: password,
       user_metadata: { ...authUser.user_metadata, auto_created: false }
    });

    if (updateErr) throw updateErr;

    res.json({ success: true, message: "Account claimed successfully. You can now login." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global API 404 & error handler to ensure JSON response instead of HTML
app.use("/api/*all", (req, res) => {
  res.status(404).json({ error: `Rota da API não encontrada: ${req.originalUrl}` });
});

// Vite middleware for development
async function setupVite() {
  try {
    const vitePkg = "vite";
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } catch (e) {
    console.log("Vite not found, skipping dev server setup");
  }
}

// Global Express error handler returning JSON for /api
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith("/api")) {
    console.error("[API Error Handler]", err);
    return res.status(err.status || 500).json({
      error: err.message || "Ocorreu um erro interno no servidor.",
    });
  }
  next(err);
});

const isServerlessEnv = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NOW_REGION
);

if (!isServerlessEnv) {
  if (process.env.NODE_ENV !== "production") {
    setupVite().then(() => {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

export default app;
