import Stripe from "stripe";

const STRIPE_PLANS: Record<string, any> = {
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

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Use POST." });
  }

  try {
    const rawKey =
      process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_API_KEY ||
      process.env.STRIPE_KEY ||
      "";
    const secretKey = rawKey.trim().replace(/^["']|["']$/g, "");

    if (!secretKey) {
      return res.status(503).json({
        error:
          "STRIPE_SECRET_KEY não configurada nas variáveis de ambiente da Vercel. Configure no painel da Vercel em Settings > Environment Variables.",
      });
    }

    const stripe = new Stripe(secretKey);

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { planId, userId, userEmail, successUrl, cancelUrl, embedded, returnUrl } = body;

    if (!planId) {
      return res.status(400).json({ error: "Parâmetro planId é obrigatório." });
    }

    const normPlanId = String(planId).toLowerCase();
    const planConfig = STRIPE_PLANS[normPlanId] || STRIPE_PLANS.mensal;

    const origin =
      req.headers?.origin ||
      (req.headers?.host ? `https://${req.headers.host}` : "https://nalabia.com.br");

    const finalSuccessUrl =
      successUrl || `${origin}/dashboard?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${origin}/dashboard?stripe_status=cancel`;
    const finalReturnUrl =
      returnUrl || `${origin}/dashboard?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`;

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
      client_reference_id: userId || undefined,
      metadata: {
        userId: userId || "",
        userEmail: userEmail || "",
        planId: planConfig.id,
        planType: planConfig.type,
      },
    };

    if (embedded) {
      sessionParams.ui_mode = "embedded";
      sessionParams.return_url = finalReturnUrl;
    } else {
      sessionParams.success_url = finalSuccessUrl;
      sessionParams.cancel_url = finalCancelUrl;
    }

    if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    if (planConfig.mode === "subscription") {
      sessionParams.subscription_data = {
        metadata: {
          userId: userId || "",
          userEmail: userEmail || "",
          planId: planConfig.id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
      clientSecret: session.client_secret,
    });
  } catch (error: any) {
    console.error("[Vercel Serverless Stripe Error]:", error);
    return res.status(500).json({
      error: error.message || "Erro ao criar sessão de pagamento no Stripe.",
    });
  }
}
