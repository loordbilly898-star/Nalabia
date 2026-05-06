import { createClient } from "@supabase/supabase-js";
const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = `test_${Date.now()}@example.com`;
  console.log("Signing up:", email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: "password123",
  });
  console.log("SignUp Error:", signUpError);

  console.log("Signing in...");
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password: "password123",
    });
  console.log("SignIn Error:", signInError);
}
test();
