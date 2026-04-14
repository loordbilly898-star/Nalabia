const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// 1. Coloque o caminho para o seu arquivo JSON de chave de serviço do Firebase aqui
const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. Coloque suas credenciais do Supabase aqui
const supabaseUrl = 'https://dxnxykpwmgbzsdiohgdo.supabase.co';
const supabaseKey = 'SUA_SUPABASE_SERVICE_ROLE_KEY_AQUI'; // Pegue em Project Settings > API > service_role
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
  console.log('Iniciando migração...');

  // Migrar Usuários
  const usersSnapshot = await db.collection('users').get();
  const users = [];
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    users.push({
      userID: data.userID || doc.id,
      name: data.name,
      email: data.email,
      photoURL: data.photoURL,
      level: data.level || 1,
      xp: data.xp || 0,
      createdAt: data.createdAt,
      onboardingCompleted: data.onboardingCompleted || false,
      settings: data.settings || {},
      profiles: data.profiles || [],
      plano: data.plano,
      status: data.status || 'pendente',
      expiraEm: data.expiraEm,
      nalabiaPrimeAcess: data.nalabiaPrimeAcess || false,
      darkPackAccess: data.darkPackAccess || false,
      coursesAccess: data.coursesAccess || false,
      mpCustomerId: data.mpCustomerId,
      freeMessagesUsed: data.freeMessagesUsed || 0,
      dailyRequests: data.dailyRequests || 0,
      lastRequestDate: data.lastRequestDate,
      lastPaymentId: data.lastPaymentId,
      updatedAt: data.updatedAt
    });
  });

  console.log(`Migrando ${users.length} usuários...`);
  for (const user of users) {
    const { error } = await supabase.from('users').upsert(user);
    if (error) console.error(`Erro ao migrar usuário ${user.email}:`, error);
  }

  console.log('Migração concluída com sucesso!');
}

migrateData();
