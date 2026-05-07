import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient("https://dxnxykpwmgbzsdiohgdo.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || "");
async function go() {
  const email = `novo_user_${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: "TempPassword123!",
    email_confirm: true,
  });
  console.log("Create Auth User:", error ? error : "OK");
  
  if (data?.user) {
    console.log("User id:", data.user.id);
    const { data: d2, error: e2 } = await supabase.from("users").insert({
      userID: data.user.id,
      email,
      plano: "Test"
    });
    console.log("Insert users table:", e2 ? e2 : "OK");
  }
}
go();
