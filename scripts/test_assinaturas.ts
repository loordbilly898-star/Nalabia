import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://dxnxykpwmgbzsdiohgdo.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs");
async function go() {
  const { data: d1, error: e1 } = await supabase.from("assinaturas").select("*").limit(1);
  console.log("assinaturas:", e1 ? e1 : "OK", d1 && d1.length ? Object.keys(d1[0]) : "Empty");
}
go();
