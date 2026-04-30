import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dxnxykpwmgbzsdiohgdo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs'
);

async function checkData() {
  const email = 'gamerbilly898@gmail.com'; 
  console.log(`Checking user: ${email}`);

  const { data: user } = await supabase.from('users').select('*').eq('email', email);
  console.log('Users table:', user);

  const { data: assin } = await supabase.from('assinaturas').select('*').eq('email', email);
  console.log('Assinaturas table:', assin);
}
checkData();
