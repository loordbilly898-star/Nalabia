import Stripe from "stripe";

export default async function handler(req: any, res: any) {
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

  try {
    const rawKey =
      process.env.STRIPE_SECRET_KEY ||
      process.env.STRIPE_API_KEY ||
      process.env.STRIPE_KEY ||
      "";
    const secretKey = rawKey.trim().replace(/^["']|["']$/g, "");

    if (!secretKey) {
      return res.status(503).json({ error: "Stripe não configurado no servidor." });
    }

    const stripe = new Stripe(secretKey);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { sessionId, userId, userEmail } = body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId é obrigatório." });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const isPaid = session.payment_status === "paid" || session.status === "complete";

    return res.status(200).json({
      success: isPaid,
      status: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email,
      planId: session.metadata?.planId,
    });
  } catch (error: any) {
    console.error("[Verify Session Error]:", error);
    return res.status(500).json({ error: error.message || "Erro ao verificar sessão." });
  }
}
