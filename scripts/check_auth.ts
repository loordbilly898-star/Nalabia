import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://dxnxykpwmgbzsdiohgdo.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs");
async function go() {
  const { data: d1, error: e1 } = await supabase.from('Authenticatable').select('*').limit(1);
  console.log("Authenticatable:", e1 ? e1 : d1);
  const { data: d2, error: e2 } = await supabase.from('Sign-ins').select('*').limit(1);
  console.log("Sign-ins:", e2 ? e2 : d2);
  const { data: d3, error: e3 } = await supabase.from('sign_ins').select('*').limit(1);
  console.log("sign_ins:", e3 ? e3 : d3);
}
go();
