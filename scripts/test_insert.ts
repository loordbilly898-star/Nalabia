import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase.from("Sign-ins").insert({ email: "test@test.com" });
  console.log("Sign-ins insert error:", error);
  const { data: d2, error: e2 } = await supabase.from("sign_ins").insert({ email: "test@test.com" });
  console.log("sign_ins insert error:", e2);
  const { data: d3, error: e3 } = await supabase.from("Sign_ins").insert({ email: "test@test.com" });
  console.log("Sign_ins insert error:", e3);
  const { data: d4, error: e4 } = await supabase.from("Sign-ins").select('*').limit(1);
  console.log("Sign-ins list:", e4);
}
testInsert();
