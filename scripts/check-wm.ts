import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const email = "williamhendler711@gmail.com";
  const { data: user } = await supabase.from("users").select("email, plano, expiraEm").ilike("email", email);
  const { data: assin } = await supabase.from("assinaturas").select("email, plano, expira_em").ilike("email", email);
  
  console.log("user:", user);
  console.log("assinaturas:", assin);
}

check();
