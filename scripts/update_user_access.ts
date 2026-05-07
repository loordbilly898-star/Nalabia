import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUser() {
  const targetEmail = "Luqin.oliiver@gmail.com";
  
  const expiraEm = new Date();
  expiraEm.setMonth(expiraEm.getMonth() + 1); // 1 month from now
  
  let { data, error } = await supabase.from("users").update({
    plano: "Mensal",
    expiraEm: expiraEm.toISOString(),
    status: "ativo",
    nalabiaPrimeAcess: true,
  }).eq("email", targetEmail.toLowerCase()).select();
  
  if (data && data.length === 0) {
      const res = await supabase.from("users").update({
        plano: "Mensal",
        expiraEm: expiraEm.toISOString(),
        status: "ativo",
        nalabiaPrimeAcess: true,
      }).eq("email", targetEmail).select();
      console.log("Updated case sensitive:", res.data, res.error);
  } else {
      console.log("Updated:", data, error);
  }
}

updateUser();
