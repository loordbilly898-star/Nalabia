import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  "https://dxnxykpwmgbzsdiohgdo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs"
);

async function main() {
  const email = "williamhendler711@gmail.com";
  const userId = uuidv4();
  
  let finalExpiraEm = new Date();
  finalExpiraEm.setDate(finalExpiraEm.getDate() + 90);

  const { error: userError } = await supabase.from("users").insert({
    userID: userId,
    email: email,
    status: "ativo",
    plano: "Trimestral",
    expiraEm: finalExpiraEm.toISOString(),
    updatedAt: new Date().toISOString(),
    createdAt: Date.now()
  });

  if (userError) {
    console.error("User error:", userError);
  } else {
    // and upadate assinaturas
    await supabase.from("assinaturas").insert({
      id: userId,
      email: email,
      status: "ativa",
      plano: "trimestral",
      plano_nome: "Trimestral",
      valor_pago: "0",
      expira_em: finalExpiraEm.toISOString(),
      updated_at: new Date().toISOString()
    });

    console.log("Success creating user and assinaturas for", email);
  }
}

main();
