import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  'https://dxnxykpwmgbzsdiohgdo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function findUser() {
  const { data, error } = await supabase.from('users').select('userID').eq('email', 'marcelo.ornelas@hotmail.com');
  if (error) console.error(error);
  else console.log('Found user:', data);
}

findUser();
