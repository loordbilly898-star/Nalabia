import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, PreApproval, Payment, Customer } from 'mercadopago';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import axios from 'axios';

dotenv.config();

// Initialize Firebase Admin (Optional, for webhook)
let db: Firestore | null = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (parseError) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON. Please ensure it is a valid JSON string.', parseError);
      // Fallback: try to read it as a file path if it's not a JSON string
      // This is a common mistake where people put the path to the JSON file instead of the JSON content
      if (typeof process.env.FIREBASE_SERVICE_ACCOUNT_KEY === 'string' && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY.startsWith('{')) {
         console.warn('FIREBASE_SERVICE_ACCOUNT_KEY does not look like a JSON string. It might be a file path. Please provide the JSON content directly.');
      }
    }
    
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount)
      });
      db = getFirestore();
      console.log('Firebase Admin initialized successfully.');
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not found. Webhook will not be able to update Firestore.');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
}

// Initialize Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' });
const preapproval = new PreApproval(client);
const payment = new Payment(client);
const customer = new Customer(client);

// Cakto OAuth2 Token Management
let caktoAccessToken: string | null = null;
let caktoTokenExpiresAt: number = 0;

async function getCaktoToken() {
  if (caktoAccessToken && Date.now() < caktoTokenExpiresAt) {
    return caktoAccessToken;
  }

  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('CAKTO_CLIENT_ID and CAKTO_CLIENT_SECRET must be configured');
  }

  try {
    // A API da Cakto usa o endpoint /oauth/token/ com Content-Type application/x-www-form-urlencoded
    const response = await axios.post('https://api.cakto.com.br/oauth/token/', 
      new URLSearchParams({ 
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      }).toString(), 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    caktoAccessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    caktoTokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;

    return caktoAccessToken;
  } catch (error: any) {
    console.error('Error fetching Cakto token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Cakto API');
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  // Script temporário para ativação manual (Pode ser removido após o deploy)
  if (db) {
    const emailsToActivate = [
      { email: 'kauanhenrique171822@gmail.com', days: 30, plano: 'Mensal (Manual)' },
      { email: 'hhudson714@gmail.com', days: 7, plano: 'Teste Grátis (7 Dias)' }
    ];

    emailsToActivate.forEach(({ email, days, plano }) => {
      db.collection('users').where('email', '==', email).get().then(snapshot => {
        if (snapshot.empty) {
          console.log(`[Admin] Usuário ${email} não encontrado no Firestore. Certifique-se de que ele já fez login pelo menos uma vez.`);
        } else {
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.plano === plano || data.plano === 'Expirado') {
              console.log(`[Admin] Usuário ${email} já possui ou possuiu o plano ${plano}. Status atual: ${data.status}`);
              return;
            }
            const expDate = new Date();
            expDate.setDate(expDate.getDate() + days);
            doc.ref.update({
              status: 'ativo',
              plano: plano,
              nalabiaPrimeAcess: true,
              expiraEm: expDate.toISOString(),
              updatedAt: new Date().toISOString()
            }).then(() => console.log(`[Admin] Sucesso: Acesso liberado por ${days} dias para ${email}`));
          });
        }
      }).catch(err => console.error(`[Admin] Erro na ativação manual de ${email}:`, err));
    });
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/create-customer', async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }
      
      let customerId = '';
      try {
        // Split name to avoid validation errors if it contains spaces
        const nameParts = (name || 'User').trim().split(' ');
        const firstName = nameParts[0].substring(0, 256);
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ').substring(0, 256) : undefined;

        const body: any = {
          email: email.trim(),
          first_name: firstName || 'User'
        };
        if (lastName) {
          body.last_name = lastName;
        }

        const result = await customer.create({ body });
        customerId = result.id;
      } catch (error: any) {
        console.warn('Error creating customer, trying to search...', error.message || error);
        try {
          const searchResult = await customer.search({ options: { email: email.trim() } });
          if (searchResult.results && searchResult.results.length > 0) {
            customerId = searchResult.results[0].id;
          } else {
             // If search fails and create failed, just return empty or throw
             console.warn('Customer not found in search either.');
          }
        } catch (searchError) {
          console.error('Failed to search customer:', searchError);
        }
      }
      
      res.json({ customer_id: customerId });
    } catch (error: any) {
      console.error('Error in create-customer endpoint:', error.message || error);
      res.status(500).json({ error: 'Failed to process customer' });
    }
  });

  // Create Subscription Preference
  app.post('/api/create-subscription', async (req, res) => {
    try {
      const { planId, userId, userEmail } = req.body;
      
      if (!planId || !userId) {
        return res.status(400).json({ error: 'Missing planId or userId' });
      }

      console.log(`[MP] Creating subscription for user: ${userId}, plan: ${planId}`);

      // Create the preapproval (subscription)
      const result = await preapproval.create({
        body: {
          reason: `Nalábia - Subscription`,
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
      console.error('Error creating subscription:', error.message || error);
      res.status(500).json({ error: 'Failed to create subscription' });
    }
  });

  // Webhook for Mercado Pago
  app.post('/api/webhook/mercadopago', async (req, res) => {
    try {
      const body = req.body;
      const { type, data, action } = body;
      console.log(`[MP Webhook] Full Body: ${JSON.stringify(body)}`);
      console.log(`[MP Webhook] Received: type=${type}, action=${action}, id=${data?.id}`);

      if (!db) {
        console.error('[MP Webhook] CRITICAL: Firebase Admin (db) is not initialized. Check FIREBASE_SERVICE_ACCOUNT_KEY.');
        return res.status(500).send('Server configuration error');
      }

      let subscriptionId = null;
      let paymentId = null;

      // Handle different types of events from Mercado Pago
      if (type === 'subscription_preapproval' || action?.includes('subscription_preapproval') || type === 'preapproval') {
        subscriptionId = data?.id || body.resource?.split('/').pop();
      } else if (type === 'payment' || action?.includes('payment')) {
        paymentId = data?.id || body.resource?.split('/').pop();
      }

      if (subscriptionId) {
        console.log(`[MP Webhook] Fetching subscription details for ID: ${subscriptionId}`);
        try {
          const subData = await preapproval.get({ id: subscriptionId });
          await processSubscriptionUpdate(subData);
        } catch (err: any) {
          console.error(`[MP Webhook] Error fetching subscription ${subscriptionId}:`, err.message || err);
        }
      } else if (paymentId) {
        console.log(`[MP Webhook] Fetching payment details for ID: ${paymentId}`);
        try {
          const payData = await payment.get({ id: paymentId });
          console.log(`[MP Webhook] Payment ${paymentId} status: ${payData.status}, external_ref: ${payData.external_reference}`);
          
          // Se for um pagamento aprovado e tiver a referência do usuário, libera o acesso
          if (payData.status === 'approved' || payData.status === 'authorized') {
            await processSubscriptionUpdate({
              id: payData.id?.toString(),
              external_reference: payData.external_reference,
              payer_email: payData.payer?.email,
              status: 'authorized', // Forçamos status autorizado para liberar o acesso
              reason: payData.description || 'Nalábia - Subscription',
              transaction_amount: payData.transaction_amount
            });
          }
        } catch (err: any) {
          console.error(`[MP Webhook] Error fetching payment ${paymentId}:`, err.message || err);
        }
      } else {
        console.log('[MP Webhook] Event type not handled or ID missing.');
      }

      res.status(200).send('OK');
    } catch (error: any) {
      console.error('[MP Webhook] Error processing webhook:', error.message || error);
      res.status(500).send('Webhook Error');
    }
  });

  // Manual Payment Verification Fallback
  app.post('/api/verify-payment', async (req, res) => {
    try {
      const { userId, type } = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });

      console.log(`[Verify Payment] Searching for approved payments for user: ${userId}`);
      
      let searchResult = await payment.search({
        options: {
          external_reference: userId,
          status: 'approved',
          sort: 'date_created',
          criteria: 'desc'
        }
      });

      if (!searchResult.results || searchResult.results.length === 0) {
        // Fallback: search by user email if external_reference is not set (e.g., generic payment link)
        if (db) {
          const userDoc = await db.collection('users').doc(userId).get();
          const email = userDoc.data()?.email;
          if (email) {
            console.log(`[Verify Payment] No payment found by external_reference. Searching by email: ${email}`);
            searchResult = await payment.search({
              options: {
                'payer.email': email,
                status: 'approved',
                sort: 'date_created',
                criteria: 'desc'
              }
            });
          }
        }
      }

      if (searchResult.results && searchResult.results.length > 0) {
        console.log(`[Verify Payment] Found ${searchResult.results.length} approved payments for user ${userId}`);
        
        for (const p of searchResult.results) {
          await processSubscriptionUpdate({
            id: p.id?.toString(),
            external_reference: p.external_reference || userId,
            payer_email: p.payer?.email,
            status: 'authorized',
            reason: p.description || 'Nalábia - Subscription',
            transaction_amount: p.transaction_amount
          });
        }

        if (db) {
          const updatedUserDoc = await db.collection('users').doc(userId).get();
          const userData = updatedUserDoc.data();
          
          if (type === 'courses' && !userData?.coursesAccess) {
            return res.json({ success: false, message: 'Pagamento do curso ainda não aprovado. Tente novamente em instantes.' });
          }
          if (type === 'darkpack' && !userData?.darkPackAccess) {
            return res.json({ success: false, message: 'Pagamento do Dark Pack ainda não aprovado. Tente novamente em instantes.' });
          }
        }

        return res.json({ success: true, message: 'Pagamentos verificados e acessos liberados.' });
      }

      console.log(`[Verify Payment] No approved payment found for user ${userId}`);
      res.json({ success: false, message: 'Nenhum pagamento aprovado encontrado.' });
    } catch (error: any) {
      console.error('[Verify Payment] Error verifying payment:', error.message || error);
      res.status(500).json({ error: 'Failed to verify payment' });
    }
  });

  // Cakto Checkout Creation
  app.post('/api/cakto/create-checkout', async (req, res) => {
    console.log('[Cakto] create-checkout called with body:', req.body);
    try {
      const { planId, userId, userEmail, userName } = req.body;
      
      if (!planId || !userId) {
        console.log('[Cakto] Missing planId or userId');
        return res.status(400).json({ error: 'Missing planId or userId' });
      }

      // Links diretos de pagamento da Cakto fornecidos pelo usuário
      let checkoutUrl = '';
      
      if (planId === 'mensal' || planId === 'monthly') {
        checkoutUrl = 'https://pay.cakto.com.br/nnbqprt_825346';
      } else if (planId === 'trimestral') {
        checkoutUrl = 'https://pay.cakto.com.br/379zopu_826386';
      } else if (planId === 'anual') {
        checkoutUrl = 'https://pay.cakto.com.br/x4pha2o_826385';
      } else if (planId === 'curso') {
        checkoutUrl = 'https://pay.cakto.com.br/exfk6pm_826428'; // academia nalabia
      } else if (planId === 'dark') {
        checkoutUrl = 'https://pay.cakto.com.br/mnh4hcg_826434'; // DARK PACK
      } else {
        return res.status(400).json({ error: 'Invalid planId' });
      }

      // Adiciona o userId como parâmetro na URL para podermos rastrear quem pagou
      // A Cakto geralmente suporta parâmetros como src, sck, ou utm_source para rastreamento
      const finalUrl = `${checkoutUrl}?src=${userId}`;

      res.json({ checkout_url: finalUrl });
    } catch (error: any) {
      console.error('Error creating Cakto checkout:', error.message);
      res.status(500).json({ error: 'Failed to create Cakto checkout' });
    }
  });

  // Webhook for Cakto
  app.post('/api/webhook/cakto', async (req, res) => {
    try {
      const body = req.body;
      console.log(`[Cakto Webhook] Received: ${JSON.stringify(body)}`);

      // Verificação de assinatura (Opcional, se Cakto fornecer um secret)
      // const signature = req.headers['x-cakto-signature'];
      // if (!verifyCaktoSignature(body, signature)) { ... }

      const status = body.status || body.event;
      // Extract userId from various possible Cakto tracking/metadata fields
      const userId = body.external_reference || 
                     body.metadata?.userId || 
                     body.tracking?.src || 
                     body.src || 
                     body.sck || 
                     body.utm_source;
                     
      const amount = body.amount ? body.amount / 100 : (body.transaction_amount || 0);
      
      // Extract plan name/reason
      const reason = body.metadata?.planName || 
                     body.product?.name || 
                     body.offer?.name || 
                     body.items?.[0]?.title || 
                     '';

      if (status === 'paid' || status === 'approved' || status === 'payment.paid' || status === 'completed') {
        await processSubscriptionUpdate({
          id: body.id?.toString() || body.transaction_id,
          external_reference: userId,
          payer_email: body.customer?.email,
          status: 'authorized',
          reason: reason,
          transaction_amount: amount,
          provider: 'cakto'
        });
        console.log(`[Cakto Webhook] Payment approved for user ${userId}`);
      } else if (status === 'cancelled' || status === 'canceled' || status === 'subscription.canceled') {
        await processSubscriptionUpdate({
          id: body.id?.toString() || body.transaction_id,
          external_reference: userId,
          payer_email: body.customer?.email,
          status: 'cancelled',
          reason: reason,
          transaction_amount: amount,
          provider: 'cakto'
        });
        console.log(`[Cakto Webhook] Payment cancelled for user ${userId}`);
      }

      res.status(200).send('OK');
    } catch (error: any) {
      console.error('[Cakto Webhook] Error processing webhook:', error.message || error);
      res.status(500).send('Webhook Error');
    }
  });

  async function processSubscriptionUpdate(subscription: any) {
    const provider = subscription.provider || 'mercadopago';
    let userId = subscription.external_reference;
    const payerEmail = subscription.payer_email || subscription.payer?.email;
    const status = subscription.status; // 'authorized', 'paused', 'cancelled'
    const reason = subscription.reason || '';
    const transactionAmount = subscription.transaction_amount;
    const planName = reason.includes('Nalábia') ? reason.replace('Nalábia - ', '') : (reason || 'Premium');

    console.log(`[${provider.toUpperCase()} Webhook] Processing update: id=${subscription.id}, user=${userId}, email=${payerEmail}, status=${status}, amount=${transactionAmount}`);

    if (!db) return;

    // If no external_reference is found, try to find by email
    if (!userId && payerEmail) {
      const usersSnapshot = await db.collection('users').where('email', '==', payerEmail).limit(1).get();
      if (!usersSnapshot.empty) {
        userId = usersSnapshot.docs[0].id;
        console.log(`[MP Webhook] Found user by email: ${userId}`);
      }
    }

    if (userId) {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        console.warn(`[${provider.toUpperCase()} Webhook] User document ${userId} does not exist in Firestore.`);
        return;
      }
      
      if (status === 'authorized' || status === 'approved') {
        const userData = userDoc.data();
        
        // Prevent processing the same payment multiple times
        if (userData?.lastPaymentId === subscription.id) {
          console.log(`[${provider.toUpperCase()} Webhook] Payment ${subscription.id} already processed for user ${userId}. Ignoring.`);
          return;
        }

        const amount = Number(transactionAmount);
        // Check if it's a Courses payment (R$ 39,90)
        if (amount === 39.9 || amount === 39.90 || amount === 3990 || amount === 0.399 || reason.toLowerCase().includes('curso') || reason.toLowerCase().includes('academia')) {
          await userRef.update({
            coursesAccess: true,
            lastPaymentId: subscription.id,
            updatedAt: new Date().toISOString()
          });
          console.log(`[${provider.toUpperCase()} Webhook] User ${userId} Courses activated.`);
          return;
        }

        // Check if it's a Dark Pack payment (R$ 15,00 or specific description)
        if (amount === 15 || amount === 1500 || amount === 0.15 || reason.toLowerCase().includes('dark') || reason.toLowerCase().includes('18')) {
          await userRef.update({
            darkPackAccess: true,
            lastPaymentId: subscription.id,
            updatedAt: new Date().toISOString()
          });
          console.log(`[${provider.toUpperCase()} Webhook] User ${userId} Dark Pack activated.`);
          return;
        }

        // Calculate expiration date
        let expiraEm = new Date();
        
        // If user already has an active plan that hasn't expired, add to the existing expiration date
        if (userData?.expiraEm) {
          const currentExp = new Date(userData.expiraEm);
          if (currentExp > new Date()) {
            expiraEm = currentExp;
          }
        }

        // Determine duration based on plan or default to 1 month
        if (reason.toLowerCase().includes('trimestral')) {
          expiraEm.setMonth(expiraEm.getMonth() + 3);
        } else if (reason.toLowerCase().includes('anual')) {
          expiraEm.setFullYear(expiraEm.getFullYear() + 1);
        } else {
          expiraEm.setMonth(expiraEm.getMonth() + 1);
        }

        await userRef.update({
          status: 'ativo',
          nalabiaPrimeAcess: true,
          plano: planName || 'Premium',
          expiraEm: expiraEm.toISOString(),
          lastPaymentId: subscription.id,
          updatedAt: new Date().toISOString()
        });
        console.log(`[${provider.toUpperCase()} Webhook] User ${userId} subscription activated/renewed.`);
      } else if (status === 'cancelled' || status === 'paused' || status === 'canceled' || status === 'subscription.canceled') {
        await userRef.update({
          status: 'pendente',
          updatedAt: new Date().toISOString()
        });
        console.log(`[${provider.toUpperCase()} Webhook] User ${userId} subscription cancelled (access remains until expiraEm).`);
      }
    } else {
      console.warn(`[${provider.toUpperCase()} Webhook] Could not find user for subscription ${subscription.id}`);
    }
  }

  // Admin endpoint for manual activation (Protect this in production!)
  app.post('/api/admin/activate-user', async (req, res) => {
    const { email, months = 1, secret } = req.body;
    
    // Simple secret check (User should set this in environment variables)
    if (secret !== process.env.ADMIN_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!email || !db) {
      return res.status(400).json({ error: 'Missing email or db not initialized' });
    }

    try {
      const snapshot = await db.collection('users').where('email', '==', email).get();
      if (snapshot.empty) {
        return res.status(404).json({ error: 'User not found' });
      }

      const results: string[] = [];
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
        results.push(doc.id);
      });

      await batch.commit();
      res.json({ success: true, activatedUsers: results });
    } catch (error: any) {
      console.error('Admin activation error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
