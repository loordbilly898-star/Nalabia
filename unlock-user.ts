import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dxnxykpwmgbzsdiohgdo.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function unlockUser() {
  console.log("Fetching user...");
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'encantomirim53@gmail.com')
    .single();

  if (fetchError) {
    console.error("Error fetching:", fetchError);
    return;
  }

  if (user) {
    console.log("Updating user...");
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        nalabiaPrimeAcess: true,
        darkPackAccess: true,
        coursesAccess: true,
        plano: 'Mensal',
        status: 'ativo',
        assinaturaInicio: new Date().toISOString()
      })
      .eq('email', 'encantomirim53@gmail.com');

    if (updateError) {
      console.error("Error updating:", updateError);
    } else {
      console.log("Successfully unlocked packs for encantomirim53@gmail.com!");
    }
  } else {
    console.log("User not found in DB.");
  }
}
unlockUser();
