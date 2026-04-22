import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || 'https://dxnxykpwmgbzsdiohgdo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSubscriptionUpdate() {
  const targetEmail = 'gamerbilly898@gmail.com';
  
  // 1. Delete existing assinaturas for this email
  console.log(`Deleting existing assinaturas for: ${targetEmail}`);
  const { error: deleteError } = await supabase
    .from('assinaturas')
    .delete()
    .eq('email', targetEmail);

  if (deleteError) {
    console.error('Delete Failed:', deleteError);
    return;
  }
  console.log('Delete Successful or no records found.');

  // 2. Fetch user ID to satisfy foreign key (Assuming email in users table matches)
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('userID')
    .eq('email', targetEmail)
    .single();

  if (userError || !user) {
    console.error('User not found. Cannot create valid assinatura.', userError);
    return;
  }

  // 3. Insert new assinatura
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  console.log(`Inserting new assinatura for: ${targetEmail}`);
  const { error: insertError } = await supabase.from('assinaturas').insert({
    id: user.userID, // Utilizing user ID as ID to satisfy foreign key
    email: targetEmail,
    status: 'ativa',
    plano: 'mensal',
    plano_nome: 'Plano Mensal Especial',
    valor_pago: '49.90',
    expira_em: expiresAt.toISOString(),
    updated_at: new Date().toISOString()
  });

  if (insertError) {
    console.error('Insert Failed:', insertError);
  } else {
    console.log('Insert Successful for existing user!', targetEmail);
  }
}

testSubscriptionUpdate();
