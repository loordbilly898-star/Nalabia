import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const t1 = await supabase.from("user_ai_profile").select("*").limit(1);
  console.log("user_ai_profile:", t1.data?.[0] ? Object.keys(t1.data[0]) : "Empty");
  const t2 = await supabase.from("saved_responses").select("*").limit(1);
  console.log("saved_responses:", t2.data?.[0] ? Object.keys(t2.data[0]) : "Empty");
  const t3 = await supabase.from("assinaturas").select("*").limit(1);
  console.log("assinaturas:", t3.data?.[0] ? Object.keys(t3.data[0]) : "Empty");
}
test();
