export default async function handler(req: any, res: any) {
  // Set CORS headers
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

    return res.status(200).json({
      enabled: isConfigured && Boolean(publishableKey),
      publishableKey: publishableKey || null,
      hasSecretKey: isConfigured,
      missing: {
        secretKey: !isConfigured,
        publishableKey: !publishableKey,
      },
    });
  } catch (error: any) {
    console.error("[API Stripe Config Error]", error);
    return res.status(500).json({
      error: error.message || "Erro ao obter configuração do Stripe",
    });
  }
}
