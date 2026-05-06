import { Mistral } from "@mistralai/mistralai";
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

const allowedOrigins = [
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

app.use(express.json({ limit: "50mb" }));
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

app.post("/api/verify-payment", async (req, res) => {
  try {
    const { userId, type } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // 1. CHACAGEM RÁPIDA NO BANCO DE DADOS (Cobertura para Cakto via Webhook)
    const { data: dbUser } = await supabase
      .from("users")
      .select("*")
      .eq("userID", userId)
      .single();
    if (dbUser && dbUser.status === "ativo") {
      // Se já está ativo e tem acesso ao item específico, aprova imediatamente!
      if (type === "courses" && dbUser.coursesAccess)
        return res.json({
          success: true,
          message: "Pago verificado pelo sistema.",
        });
      if (type === "darkpack" && dbUser.darkPackAccess)
        return res.json({
          success: true,
          message: "Pago verificado pelo sistema.",
        });
      if (type === "mentoria" && dbUser.mentoriaAccess)
        return res.json({
          success: true,
          message: "Pago verificado pelo sistema.",
        });
      // Se não for pacote específico, basta checar se tem acesso Prime (foi assinado)
      if (
        (!type ||
          (type !== "courses" && type !== "darkpack" && type !== "mentoria")) &&
        dbUser.nalabiaPrimeAcess
      ) {
        return res.json({
          success: true,
          message: "Assinatura verificada pelo sistema.",
        });
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
      checkoutUrl = "https://pay.cakto.com.br/nnbqprt_825346";
    else if (planId === "trimestral")
      checkoutUrl = "https://pay.cakto.com.br/379zopu_826386";
    else if (planId === "anual")
      checkoutUrl = "https://pay.cakto.com.br/x4pha2o_826385";
    else if (planId === "curso")
      checkoutUrl = "https://pay.cakto.com.br/exfk6pm_826428";
    else if (planId === "dark")
      checkoutUrl = "https://pay.cakto.com.br/mnh4hcg_826434";
    else if (planId === "mentoria")
      checkoutUrl = "https://pay.cakto.com.br/obgpnz3_874157";
    else return res.status(400).json({ error: "Invalid planId" });

    res.json({ checkout_url: `${checkoutUrl}?src=${userId}` });
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
    const reason =
      payload.metadata?.planName ||
      payload.product?.name ||
      payload.offer?.name ||
      payload.items?.[0]?.title ||
      "";
    const payerEmail =
      payload.customer?.email ||
      payload.client?.email ||
      payload.email ||
      payload.payer_email;

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

  if (!userId && payerEmail) {
    try {
      // Trying case-insensitive matching first
      console.log(
        `[Payment Process] Searching for userId using ilike for email: ${payerEmail}`,
      );
      const { data: users } = await supabase
        .from("users")
        .select("userID")
        .ilike("email", payerEmail)
        .limit(1);
      if (users && users.length > 0) {
        userId = users[0].userID;
        console.log(
          `[Payment Process] Found userId ${userId} by ilike email ${payerEmail}`,
        );
      } else {
        console.warn(
          `[Payment Process] User not found by email ${payerEmail} in Supabase`,
        );
      }
    } catch (err) {
      console.error("[Payment Process] Error searching user by email:", err);
    }
  }

  if (userId) {
    let retries = 3;
    let success = false;

    while (retries > 0 && !success) {
      try {
        let { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("userID", userId)
          .single();

        // If user document doesn't exist yet, we must create a skeleton so the payment registers!
        if (!userData) {
          console.log(
            `[Payment Process] User document ${userId} not found! Creating skeleton...`,
          );
          userData = {
            userID: userId,
            email: payerEmail || "",
            level: 1,
            xp: 0,
            createdAt: Date.now(),
            onboardingCompleted: false,
          };
        }

        if (
          status === "authorized" ||
          status === "approved" ||
          status === "paid" ||
          status === "payment.paid" ||
          status === "completed"
        ) {
          if (
            userData.lastPaymentId &&
            userData.lastPaymentId === subscription.id
          ) {
            console.log(
              `[Payment Process] Payment ${subscription.id} already processed`,
            );
            return;
          }

          const amount = transactionAmount;
          const isCourse =
            reason.toLowerCase().includes("curso") ||
            reason.toLowerCase().includes("academia") ||
            (amount === 19.9 && reason.toLowerCase().includes("curso"));
          const isDarkPack =
            reason.toLowerCase().includes("dark") ||
            reason.toLowerCase().includes("18") ||
            reason.toLowerCase().includes("manipula") ||
            (amount === 19.9 && reason.toLowerCase().includes("dark"));
          const isMentoria =
            reason.toLowerCase().includes("mentoria") ||
            (amount === 19.9 && reason.toLowerCase().includes("mentoria"));

          // PREPARE UPSERT DATA
          const updateData: any = {
            ...userData, // spread existing data to not overwrite
            status: "ativo",
            nalabiaPrimeAcess: true, // Always grant base access on any purchase
            lastPaymentId: subscription.id,
            updatedAt: new Date().toISOString(),
          };

          let finalExpiraEm = new Date();
          let finalPlano = planName || "Premium";
          let finalPlanoType = "mensal";

          if (isCourse) {
            updateData.coursesAccess = true;
            updateData.plano = "Curso Academia";
            finalPlano = "Curso Academia";
            finalPlanoType = "vitalicio";
            finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10); // Vitalício
            console.log(
              `[Payment Process] Granting Course Access to ${userId}`,
            );
          } else if (isDarkPack) {
            updateData.darkPackAccess = true;
            updateData.plano = "Pacote Dark";
            finalPlano = "Pacote Dark";
            finalPlanoType = "vitalicio";
            finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10); // Vitalício
            console.log(
              `[Payment Process] Granting Dark Pack Access to ${userId}`,
            );
          } else if (isMentoria) {
            updateData.mentoriaAccess = true;
            updateData.plano = "Mentoria VIP";
            finalPlano = "Mentoria VIP";
            finalPlanoType = "vitalicio";
            finalExpiraEm.setFullYear(finalExpiraEm.getFullYear() + 10); // Vitalício
            console.log(
              `[Payment Process] Granting Mentoria Access to ${userId}`,
            );
          } else {
            // Standard Subscriptions
            if (userData.expiraEm) {
              const currentExp = new Date(userData.expiraEm);
              if (currentExp > new Date()) finalExpiraEm = currentExp;
            }

            if (
              reason.toLowerCase().includes("trimestral") ||
              planName.toLowerCase().includes("trimestral")
            ) {
              finalExpiraEm.setDate(finalExpiraEm.getDate() + 90);
              finalPlanoType = "trimestral";
            } else if (
              reason.toLowerCase().includes("anual") ||
              planName.toLowerCase().includes("anual")
            ) {
              finalExpiraEm.setDate(finalExpiraEm.getDate() + 365);
              finalPlanoType = "anual";
            } else {
              // default to monthly
              finalExpiraEm.setDate(finalExpiraEm.getDate() + 30);
              finalPlanoType = "mensal";
            }

            updateData.plano = finalPlano;
            updateData.expiraEm = finalExpiraEm.toISOString();
            console.log(
              `[Payment Process] Granting Subscription Access to ${userId}, Expires: ${updateData.expiraEm}`,
            );
          }

          // UPSERT guarantees creation if missing, and update if existing
          const { error: upsertError } = await supabase
            .from("users")
            .upsert(updateData);
          if (upsertError) throw upsertError;

          // 2. Insert/Upsert into assinaturas (The Architecture fix)
          const { error: assinError } = await supabase
            .from("assinaturas")
            .upsert(
              {
                email: payerEmail || userData.email,
                status: "ativa",
                plano: finalPlanoType,
                plano_nome: finalPlano,
                valor_pago: String(amount || "0.00"),
                expira_em: finalExpiraEm.toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "email" },
            );
          if (assinError)
            console.error(
              "[Payment Process] Error updating public.assinaturas:",
              assinError,
            );

          console.log(`[Payment Process] Successfully updated user ${userId}`);
          success = true;
        } else if (
          ["cancelled", "paused", "canceled", "subscription.canceled"].includes(
            status,
          )
        ) {
          // UPSERT with pending status
          const updateData: any = {
            ...userData,
            status: "pendente",
            updatedAt: new Date().toISOString(),
          };
          await supabase.from("users").upsert(updateData);
          console.log(
            `[Payment Process] Subscription cancelled for user ${userId}`,
          );
          success = true;
        } else {
          console.log(
            `[Payment Process] Ignored status: ${status} for user ${userId}`,
          );
          success = true; // Not an error to ignore
        }
      } catch (err: any) {
        console.error(
          `[Payment Process] Error updating user ${userId} (Retries left: ${retries - 1}):`,
          err.message || err,
        );
        retries--;
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  } else {
    console.error(
      `[Payment Process] FATAL: Could not identify user for payment ${subscription.id} (Email: ${payerEmail}). User mismatch or frontend didn't pass external_reference.`,
    );
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
    const { data: users } = await supabase
      .from("users")
      .select("userID")
      .eq("email", email);
    if (!users || users.length === 0)
      return res.status(404).json({ error: "User not found" });

    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + months);

    for (const user of users) {
      await supabase
        .from("users")
        .update({
          status: "ativo",
          plano: `Manual (${months} meses)`,
          nalabiaPrimeAcess: true,
          expiraEm: expDate.toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq("userID", user.userID);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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

export default app;
