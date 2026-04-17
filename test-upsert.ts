import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dxnxykpwmgbzsdiohgdo.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpsert() {
  const { data, error } = await supabase.from('users').upsert({
    userID: 'dd3b516b-1678-43e8-ab64-58a13998b6aa',
    email: 'test@example.com',
    status: 'ativo'
  }).select();
  console.log('Upsert error:', error, 'Data:', data);
}
testUpsert();
