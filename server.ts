import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, PreApproval, Payment, Customer } from 'mercadopago';
import path from 'path';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase Admin
let db: Firestore | null = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (parseError) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON.', parseError);
    }
    
    if (serviceAccount && getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with Service Account.');
    }
  } else if (getApps().length === 0) {
    // Try initializing with Application Default Credentials (ADC)
    initializeApp();
    console.log('Firebase Admin initialized with ADC.');
  }
  
  if (getApps().length > 0) {
    db = getFirestore();
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
}

// Initialize Mercado Pago
let client: MercadoPagoConfig | null = null;
let preapproval: PreApproval | null = null;
let payment: Payment | null = null;
let customer: Customer | null = null;

try {
  if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
    client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    preapproval = new PreApproval(client);
    payment = new Payment(client);
    customer = new Customer(client);
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

    if (!db) return res.status(500).send('Server configuration error');

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

    if (!payment) return res.status(500).json({ error: 'Mercado Pago not configured' });
    let searchResult = await payment.search({
      options: { external_reference: userId, status: 'approved', sort: 'date_created', criteria: 'desc' }
    });

    if ((!searchResult.results || searchResult.results.length === 0) && db) {
      const userDoc = await db.collection('users').doc(userId).get();
      const email = userDoc.data()?.email;
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

      if (db) {
        const updatedUserDoc = await db.collection('users').doc(userId).get();
        const userData = updatedUserDoc.data();
        if (type === 'courses' && !userData?.coursesAccess) return res.json({ success: false, message: 'Pagamento do curso ainda não aprovado.' });
        if (type === 'darkpack' && !userData?.darkPackAccess) return res.json({ success: false, message: 'Pagamento do Dark Pack ainda não aprovado.' });
      }
      return res.json({ success: true, message: 'Pagamentos verificados.' });
    }
    res.json({ success: false, message: 'Nenhum pagamento aprovado encontrado.' });
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
  try {
    let payload = req.body.data || req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }
    const event = req.body.event || payload.event || payload.status;
    const status = payload.status || event;
    const userId = payload.external_reference || payload.reference || payload.metadata?.userId || payload.tracking?.src || payload.src || payload.sck || payload.utm_source;
    const amount = payload.amount ? Number(payload.amount) / 100 : (Number(payload.transaction_amount) || 0);
    const reason = payload.metadata?.planName || payload.product?.name || payload.offer?.name || payload.items?.[0]?.title || '';

    if (['paid', 'approved', 'payment.paid', 'payment.approved', 'completed'].includes(status)) {
      await processSubscriptionUpdate({
        id: payload.id?.toString() || payload.transaction_id,
        external_reference: userId,
        payer_email: payload.customer?.email || payload.client?.email || payload.email,
        status: 'authorized',
        reason: reason,
        transaction_amount: amount,
        provider: 'cakto'
      });
    } else if (['cancelled', 'canceled', 'subscription.canceled'].includes(status)) {
      await processSubscriptionUpdate({
        id: payload.id?.toString() || payload.transaction_id,
        external_reference: userId,
        payer_email: payload.customer?.email || payload.client?.email || payload.email,
        status: 'cancelled',
        reason: reason,
        transaction_amount: amount,
        provider: 'cakto'
      });
    }
    res.status(200).send('OK');
  } catch (error: any) {
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

  if (!db) {
    console.error('[Payment Process] Database not initialized');
    return;
  }

  if (!userId && payerEmail) {
    try {
      const usersSnapshot = await db.collection('users').where('email', '==', payerEmail).limit(1).get();
      if (!usersSnapshot.empty) {
        userId = usersSnapshot.docs[0].id;
        console.log(`[Payment Process] Found userId ${userId} by email ${payerEmail}`);
      }
    } catch (err) {
      console.error('[Payment Process] Error searching user by email:', err);
    }
  }

  if (userId) {
    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.error(`[Payment Process] User document ${userId} not found`);
        return;
      }
      
      if (status === 'authorized' || status === 'approved') {
        const userData = userDoc.data();
        if (userData?.lastPaymentId === subscription.id) {
          console.log(`[Payment Process] Payment ${subscription.id} already processed`);
          return;
        }

        const amount = transactionAmount;
        const isCourse = amount >= 30 && amount <= 45 || reason.toLowerCase().includes('curso') || reason.toLowerCase().includes('academia');
        const isDarkPack = amount >= 10 && amount <= 18 || reason.toLowerCase().includes('dark') || reason.toLowerCase().includes('18');

        const updateData: any = {
          status: 'ativo',
          nalabiaPrimeAcess: true, // Always grant base access on any purchase to avoid blocking the user
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
          let expiraEm = new Date();
          if (userData?.expiraEm) {
            const currentExp = new Date(userData.expiraEm);
            if (currentExp > new Date()) expiraEm = currentExp;
          }

          if (reason.toLowerCase().includes('trimestral')) expiraEm.setMonth(expiraEm.getMonth() + 3);
          else if (reason.toLowerCase().includes('anual')) expiraEm.setFullYear(expiraEm.getFullYear() + 1);
          else expiraEm.setMonth(expiraEm.getMonth() + 1);

          updateData.plano = planName || 'Premium';
          updateData.expiraEm = expiraEm.toISOString();
          console.log(`[Payment Process] Granting Subscription Access to ${userId}, Expires: ${updateData.expiraEm}`);
        }

        await userRef.update(updateData);
        console.log(`[Payment Process] Successfully updated user ${userId}`);
      } else if (['cancelled', 'paused', 'canceled', 'subscription.canceled'].includes(status)) {
        await userRef.update({ status: 'pendente', updatedAt: new Date().toISOString() });
        console.log(`[Payment Process] Subscription cancelled for user ${userId}`);
      }
    } catch (err) {
      console.error(`[Payment Process] Error updating user ${userId}:`, err);
    }
  } else {
    console.error(`[Payment Process] Could not identify user for payment ${subscription.id}`);
  }
}

app.post('/api/admin/activate-user', async (req, res) => {
  const { email, months = 1, secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET && process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Unauthorized' });
  if (!email || !db) return res.status(400).json({ error: 'Missing email or db not initialized' });

  try {
    const snapshot = await db.collection('users').where('email', '==', email).get();
    if (snapshot.empty) return res.status(404).json({ error: 'User not found' });

    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + months);
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: 'ativo',
        plano: `Manual (${months} meses)`,
        nalabiaPrimeAcess: true,
        expiraEm: expDate.toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
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
