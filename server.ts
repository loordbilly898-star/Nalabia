import { Mistral } from '@mistralai/mistralai';
import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, PreApproval, Payment, Customer } from 'mercadopago';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const allowedOrigins = [
  'https://nalabia-prime.run.app',
  'https://www.nalabia-prime.run.app',
  'https://ais-dev-2fdtxbfqn7qj57ixyqgzeg-233310227239.us-east1.run.app',
  'http://localhost:3000',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.run.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[API LOG] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Supabase
const supabaseUrl = 'https://dxnxykpwmgbzsdiohgdo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Mistral
const getMistralClient = () => {
  const apiKey = (process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[SERVER] MISTRAL_API_KEY NO ENCONTRADA.');
    console.error('[SERVER] Verifique se a variável MISTRAL_API_KEY está configurada no menu Settings do AI Studio.');
    throw new Error('MISTRAL_API_KEY not found. Please set it in the environment variables.');
  }
  const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  console.log(`[SERVER] Inicializando Mistral Client com chave: ${maskedKey}`);
  return new Mistral({ apiKey });
};

// AI Routes
app.post('/api/ai/complete', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[AI-COMPLETE][${requestId}] Iniciando requisição completa...`);
  try {
    const body = req.body;
    if (!body || !body.messages) {
      return res.status(400).json({ error: 'Mensagens ausentes.' });
    }
    
    const mistral = getMistralClient();
    const response = await mistral.chat.complete(body);
    res.json(response);
  } catch (error: any) {
    console.error(`[AI-COMPLETE] Erro:`, error);
    res.status(error.status || 500).json({ error: error.message || 'Erro na IA.' });
  }
});

app.post('/api/ai/stream', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[AI-STREAM][${requestId}] Iniciando streaming...`);
  try {
    const body = req.body;
    if (!body || !body.messages) {
      return res.status(400).json({ error: 'Mensagens ausentes.' });
    }

    const mistral = getMistralClient();
    console.log(`[AI-STREAM][${requestId}] Usando modelo: ${body.model || 'default'}`);
    const stream = await mistral.chat.stream(body);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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
      res.write('data: [DONE]\n\n');
      console.log(`[AI-STREAM][${requestId}] Stream finalizado com sucesso. Chunks: ${chunkCount}`);
    } catch (streamError: any) {
      console.error(`[AI-STREAM][${requestId}] Erro durante a iteração do stream:`, streamError);
    }
    res.end();
  } catch (error: any) {
    console.error(`[AI-STREAM] Erro:`, error);
    if (!res.headersSent) {
      res.status(error.status || 500).json({ error: error.message || 'Erro na IA.' });
    } else {
      res.end();
    }
  }
});

// ... existing server code

// Initialize Mercado Pago
let mpClient: MercadoPagoConfig | null = null;
let preapproval: PreApproval | null = null;
let payment: Payment | null = null;
let customer: Customer | null = null;

try {
  if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
    mpClient = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    preapproval = new PreApproval(mpClient);
    payment = new Payment(mpClient);
    customer = new Customer(mpClient);
  }
} catch (error) {
  console.error('Failed to initialize Mercado Pago:', error);
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/create-customer', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });
    
    if (!customer) return res.status(500).json({ error: 'Mercado Pago not configured' });
    let customerId = '';
    try {
      const nameParts = (name || 'User').trim().split(' ');
      const firstName = nameParts[0].substring(0, 256);
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ').substring(0, 256) : undefined;

      const body: any = { email: email.trim(), first_name: firstName || 'User' };
      if (lastName) body.last_name = lastName;

      const result = await customer.create({ body });
      customerId = result.id;
    } catch (error: any) {
      try {
        const searchResult = await customer.search({ options: { email: email.trim() } });
        if (searchResult.results && searchResult.results.length > 0) {
          customerId = searchResult.results[0].id;
        }
      } catch (searchError) {
        console.error('Failed to search customer:', searchError);
      }
    }
    res.json({ customer_id: customerId });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process customer' });
  }
});

app.post('/api/create-subscription', async (req, res) => {
  try {
    const { planId, userId, userEmail } = req.body;
    if (!planId || !userId) return res.status(400).json({ error: 'Missing planId or userId' });

    if (!preapproval) return res.status(500).json({ error: 'Mercado Pago not configured' });
    const result = await preapproval.create({
      body: {
        reason: `NaLábia - Subscription`,
        external_reference: userId,
        payer_email: userEmail,
        back_url: `${process.env.APP_URL || 'https://nalabia-prime.run.app'}/dashboard`,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: planId === '9c083be662fc46a483dcb2da62b0b3e6' ? 19.90 : (planId === '73568ef6013441b6a73d428230c2b976' ? 58.90 : 149.90),
          currency_id: 'BRL'
        }
      }
    });

    res.json({ init_point: result.init_point });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

app.post('/api/webhook/mercadopago', async (req, res) => {
  try {
    const body = req.body;
    const query = req.query;
    
    // Mercado Pago can send data in body or query params
    const type = body.type || query.topic || body.resource?.split('/')[3];
    const id = body.data?.id || query.id || body.resource?.split('/').pop();
    const action = body.action || '';

    console.log(`[MP Webhook] Received: type=${type}, id=${id}, action=${action}`);

    if (type === 'subscription_preapproval' || action?.includes('subscription_preapproval') || type === 'preapproval') {
      try {
        if (!preapproval) throw new Error('Mercado Pago not configured');
        const subData = await preapproval.get({ id: id });
        await processSubscriptionUpdate(subData);
      } catch (err: any) {
        console.error(`[MP Webhook] Error fetching subscription ${id}:`, err.message || err);
      }
    } else if (type === 'payment' || action?.includes('payment')) {
      try {
        if (!payment) throw new Error('Mercado Pago not configured');
        const payData = await payment.get({ id: id });
        if (payData.status === 'approved' || payData.status === 'authorized') {
          await processSubscriptionUpdate({
            id: payData.id?.toString(),
            external_reference: payData.external_reference,
            payer_email: payData.payer?.email,
            status: 'authorized',
            reason: payData.description || 'NaLábia - Subscription',
            transaction_amount: payData.transaction_amount
          });
        }
      } catch (err: any) {
        console.error(`[MP Webhook] Error fetching payment ${id}:`, err.message || err);
      }
    }
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[MP Webhook] Global Error:', error);
    res.status(500).send('Webhook Error');
  }
});

app.post('/api/verify-payment', async (req, res) => {
  try {
    const { userId, type } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // 1. CHACAGEM RÁPIDA NO BANCO DE DADOS (Cobertura para Cakto via Webhook)
    const { data: dbUser } = await supabase.from('users').select('*').eq('userID', userId).single();
    if (dbUser && dbUser.status === 'ativo') {
      // Se já está ativo e tem acesso ao item específico, aprova imediatamente!
      if (type === 'courses' && dbUser.coursesAccess) return res.json({ success: true, message: 'Pago verificado pelo sistema.' });
      if (type === 'darkpack' && dbUser.darkPackAccess) return res.json({ success: true, message: 'Pago verificado pelo sistema.' });
      // Se não for pacote específico, basta checar se tem acesso Prime (foi assinado)
      if ((!type || type !== 'courses' && type !== 'darkpack') && dbUser.nalabiaPrimeAcess) {
         return res.json({ success: true, message: 'Assinatura verificada pelo sistema.' });
      }
    }

    // 2. BUSCAR NO MERCADO PAGO COMO FALLBACK (Apenas se o BD não estiver atualizado)
    if (!payment) return res.status(500).json({ error: 'Mercado Pago not configured' });
    let searchResult = await payment.search({
      options: { external_reference: userId, status: 'approved', sort: 'date_created', criteria: 'desc' }
    });

    if (!searchResult.results || searchResult.results.length === 0) {
      const email = dbUser?.email;
      if (email) {
        searchResult = await payment.search({
          options: { 'payer.email': email, status: 'approved', sort: 'date_created', criteria: 'desc' }
        });
      }
    }

    if (searchResult.results && searchResult.results.length > 0) {
      for (const p of searchResult.results) {
        await processSubscriptionUpdate({
          id: p.id?.toString(),
          external_reference: p.external_reference || userId,
          payer_email: p.payer?.email,
          status: 'authorized',
          reason: p.description || 'NaLábia - Subscription',
          transaction_amount: p.transaction_amount
        });
      }

      // Re-busca o usuário após tentar atualizar via Mercado Pago
      const { data: updatedUserData } = await supabase.from('users').select('*').eq('userID', userId).single();
      if (type === 'courses' && !updatedUserData?.coursesAccess) return res.json({ success: false, message: 'Pagamento do curso ainda não aprovado.' });
      if (type === 'darkpack' && !updatedUserData?.darkPackAccess) return res.json({ success: false, message: 'Pagamento do Dark Pack ainda não aprovado.' });
      
      return res.json({ success: true, message: 'Pagamentos verificados.' });
    }
    
    // Se falhou no DB e não há nada no Mercado Pago:
    res.json({ success: false, message: 'Nenhum pagamento aprovado encontrado. Se usou Cakto, aguarde uns minutos para o sistema receber o pagamento.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

app.post('/api/cakto/create-checkout', async (req, res) => {
  try {
    const { planId, userId } = req.body;
    if (!planId || !userId) return res.status(400).json({ error: 'Missing planId or userId' });

    let checkoutUrl = '';
    if (planId === 'mensal' || planId === 'monthly') checkoutUrl = 'https://pay.cakto.com.br/nnbqprt_825346';
    else if (planId === 'trimestral') checkoutUrl = 'https://pay.cakto.com.br/379zopu_826386';
    else if (planId === 'anual') checkoutUrl = 'https://pay.cakto.com.br/x4pha2o_826385';
    else if (planId === 'curso') checkoutUrl = 'https://pay.cakto.com.br/exfk6pm_826428';
    else if (planId === 'dark') checkoutUrl = 'https://pay.cakto.com.br/mnh4hcg_826434';
    else return res.status(400).json({ error: 'Invalid planId' });

    res.json({ checkout_url: `${checkoutUrl}?src=${userId}` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create Cakto checkout' });
  }
});

app.post('/api/webhook/cakto', async (req, res) => {
  console.log('[Cakto] Webhook Received. Full payload:', JSON.stringify(req.body));
  try {
    let payload = req.body.data || req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }
    const event = req.body.event || payload.event || payload.status;
    const status = payload.status || event;
    // Cakto often sends the external reference in the 'src' field or 'metadata'
    const userId = payload.external_reference || payload.reference || payload.metadata?.userId || payload.tracking?.src || payload.src || payload.sck || payload.utm_source;
    const amount = payload.amount ? Number(payload.amount) / 100 : (Number(payload.transaction_amount) || 0);
    const reason = payload.metadata?.planName || payload.product?.name || payload.offer?.name || payload.items?.[0]?.title || '';
    const payerEmail = payload.customer?.email || payload.client?.email || payload.email || payload.payer_email;

    console.log(`[Cakto] Parsed -> Status: ${status}, UserId: ${userId}, Email: ${payerEmail}, Amount: ${amount}, Reason: ${reason}`);

    if (['paid', 'approved', 'payment.paid', 'payment.approved', 'completed'].includes(status)) {
      await processSubscriptionUpdate({
        id: payload.id?.toString() || payload.transaction_id || `cakto_${Date.now()}`,
        external_reference: userId,
        payer_email: payerEmail,
        status: 'authorized',
        reason: reason,
        transaction_amount: amount,
        provider: 'cakto'
      });
    } else if (['cancelled', 'canceled', 'subscription.canceled'].includes(status)) {
      await processSubscriptionUpdate({
        id: payload.id?.toString() || payload.transaction_id || `cakto_${Date.now()}`,
        external_reference: userId,
        payer_email: payerEmail,
        status: 'cancelled',
        reason: reason,
        transaction_amount: amount,
        provider: 'cakto'
      });
    }
    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Cakto] Webhook parsing error:', error);
    res.status(500).send('Webhook Error');
  }
});

async function processSubscriptionUpdate(subscription: any) {
  const provider = subscription.provider || 'mercadopago';
  let userId = subscription.external_reference;
  const payerEmail = subscription.payer_email || subscription.payer?.email;
  const status = subscription.status;
  const reason = subscription.reason || subscription.description || '';
  const transactionAmount = Number(subscription.transaction_amount || subscription.auto_recurring?.transaction_amount || 0);
  const planName = reason.includes('NaLábia') ? reason.replace('NaLábia - ', '') : (reason || 'Premium');

  console.log(`[Payment Process] Provider: ${provider}, User: ${userId || payerEmail}, Status: ${status}, Amount: ${transactionAmount}, Reason: ${reason}`);

  if (!userId && payerEmail) {
    try {
      const { data: users } = await supabase.from('users').select('userID').eq('email', payerEmail).limit(1);
      if (users && users.length > 0) {
        userId = users[0].userID;
        console.log(`[Payment Process] Found userId ${userId} by email ${payerEmail}`);
      }
    } catch (err) {
      console.error('[Payment Process] Error searching user by email:', err);
    }
  }

  if (userId) {
    try {
      let { data: userData } = await supabase.from('users').select('*').eq('userID', userId).single();
      
      // If user document doesn't exist yet, we must create a skeleton so the payment registers!
      // This happens if the frontend hasn't synced the user doc but they triggered checkout.
      if (!userData) {
        console.log(`[Payment Process] User document ${userId} not found! Creating skeleton...`);
        userData = {
          userID: userId,
          email: payerEmail || '',
          level: 1,
          xp: 0,
          createdAt: Date.now(),
          onboardingCompleted: false
        };
      }
      
      if (status === 'authorized' || status === 'approved' || status === 'paid' || status === 'payment.paid') {
        if (userData.lastPaymentId && userData.lastPaymentId === subscription.id) {
          console.log(`[Payment Process] Payment ${subscription.id} already processed`);
          return;
        }

        const amount = transactionAmount;
        const isCourse = amount >= 30 && amount <= 45 || reason.toLowerCase().includes('curso') || reason.toLowerCase().includes('academia');
        const isDarkPack = amount >= 10 && amount <= 18 || reason.toLowerCase().includes('dark') || reason.toLowerCase().includes('18');

        // PREPARE UPSERT DATA
        const updateData: any = {
          ...userData, // spread existing data to not overwrite
          status: 'ativo',
          nalabiaPrimeAcess: true, // Always grant base access on any purchase
          lastPaymentId: subscription.id,
          updatedAt: new Date().toISOString()
        };

        if (isCourse) {
          updateData.coursesAccess = true;
          updateData.plano = 'Curso Academia';
          console.log(`[Payment Process] Granting Course Access to ${userId}`);
        } else if (isDarkPack) {
          updateData.darkPackAccess = true;
          updateData.plano = 'Pacote Dark';
          console.log(`[Payment Process] Granting Dark Pack Access to ${userId}`);
        } else {
          // Standard Subscriptions
          let expiraEm = new Date();
          if (userData.expiraEm) {
            const currentExp = new Date(userData.expiraEm);
            if (currentExp > new Date()) expiraEm = currentExp;
          }

          if (reason.toLowerCase().includes('trimestral') || planName.toLowerCase().includes('trimestral')) {
            expiraEm.setDate(expiraEm.getDate() + 90);
          } else if (reason.toLowerCase().includes('anual') || planName.toLowerCase().includes('anual')) {
            expiraEm.setDate(expiraEm.getDate() + 365);
          } else { // default to monthly
            expiraEm.setDate(expiraEm.getDate() + 30);
          }

          updateData.plano = planName || 'Premium';
          updateData.expiraEm = expiraEm.toISOString();
          console.log(`[Payment Process] Granting Subscription Access to ${userId}, Expires: ${updateData.expiraEm}`);
        }

        // UPSERT guarantees creation if missing, and update if existing
        const { error: upsertError } = await supabase.from('users').upsert(updateData);
        if (upsertError) throw upsertError;

        console.log(`[Payment Process] Successfully updated user ${userId}`);
      } else if (['cancelled', 'paused', 'canceled', 'subscription.canceled'].includes(status)) {
        // UPSERT with pending status
        const updateData: any = {
          ...userData,
          status: 'pendente',
          updatedAt: new Date().toISOString()
        };
        await supabase.from('users').upsert(updateData);
        console.log(`[Payment Process] Subscription cancelled for user ${userId}`);
      }
    } catch (err) {
      console.error(`[Payment Process] Error updating user ${userId}:`, err);
    }
  } else {
    // We don't have a userId. Let's try matching by email purely for an upsert?
    // Actually, without userId we can't reliably upsert since userID is primary key.
    console.error(`[Payment Process] Could not identify user for payment ${subscription.id} - Make sure frontend sends userId`);
  }
}

app.post('/api/admin/activate-user', async (req, res) => {
  const { email, months = 1, secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET && process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Unauthorized' });
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const { data: users } = await supabase.from('users').select('userID').eq('email', email);
    if (!users || users.length === 0) return res.status(404).json({ error: 'User not found' });

    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + months);
    
    for (const user of users) {
      await supabase.from('users').update({
        status: 'ativo',
        plano: `Manual (${months} meses)`,
        nalabiaPrimeAcess: true,
        expiraEm: expDate.toISOString(),
        updatedAt: new Date().toISOString()
      }).eq('userID', user.userID);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
async function setupVite() {
  try {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } catch (e) {
    console.log('Vite not found, skipping dev server setup');
  }
}

if (process.env.NODE_ENV !== 'production') {
  setupVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*all', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
