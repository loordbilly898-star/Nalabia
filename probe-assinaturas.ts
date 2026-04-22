import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dxnxykpwmgbzsdiohgdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs'
);

async function probeAssinaturas() {
  console.log('Probing "assinaturas" with an insert attempt...');
  // This will fail but should give us the right column names in the error message
  const { error } = await supabase.from('assinaturas').upsert({
    fake_col: 'test'
  });
  
  if (error) {
    console.log('Error as expected:', error.message);
    console.log('Details:', error.details);
  }
}

probeAssinaturas();
