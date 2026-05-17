import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://dxnxykpwmgbzsdiohgdo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs"
);

async function main() {
  const { data } = await supabase.from("users").select("*").ilike("email", "%william%").limit(10);
  console.log(data);
}
main();
