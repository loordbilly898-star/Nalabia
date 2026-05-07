import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { v4 as uuid } from "uuid";
dotenv.config();

const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const fakeId = uuid();
  const res = await supabase.from("saved_responses").insert({
    userID: fakeId,
    text: JSON.stringify({ pendingPayment: true, email: "test@example.com", amount: 20 }),
    category: "webhook"
  });
  console.log("saved_responses test:", res.error || "OK");
}
test();
