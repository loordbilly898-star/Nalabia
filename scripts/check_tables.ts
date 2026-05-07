import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://dxnxykpwmgbzsdiohgdo.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs");
async function go() {
  const { data: usersData, error: err1 } = await supabase.from("Users").select("*").limit(1);
  console.log("Users:", err1 ? err1 : "OK", usersData && usersData.length ? Object.keys(usersData[0]) : "Empty");
  
  const { data: qData, error: qErr } = await supabase.from("users").select("*").limit(1);
  console.log("users:", qErr ? qErr : "OK", qData && qData.length ? Object.keys(qData[0]) : "Empty");
  
  const { data: sigData, error: sigErr } = await supabase.from("Sign-ins").select("*").limit(1);
  console.log("Sign-ins:", sigErr ? sigErr : "OK", sigData && sigData.length ? Object.keys(sigData[0]) : "Empty");
  const { data: signData, error: signErr } = await supabase.from("sign_ins").select("*").limit(1);
  console.log("sign_ins:", signErr ? signErr : "OK", signData && signData.length ? Object.keys(signData[0]) : "Empty");
}
go();
