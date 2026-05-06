import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://dxnxykpwmgbzsdiohgdo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs",
);

async function fixUser() {
  const email = "marcelo.ornelas@hotmail.com";
  console.log("Searching for:", email);
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email);

  if (error || !users || users.length === 0) {
    console.log("User not found or error:", error);
    return;
  }

  const user = users[0];
  console.log("Found user:", user.userID);

  // 1. Update user
  await supabase
    .from("users")
    .update({
      status: "ativo",
      plano: "Mensal",
      nalabiaPrimeAcess: true,
      premium: true,
      updatedAt: new Date().toISOString(),
    })
    .eq("userID", user.userID);

  // 2. Insert/Upsert into assinaturas
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  const { error: assinError } = await supabase.from("assinaturas").upsert({
    id: user.userID,
    email: email,
    status: "ativa",
    plano: "mensal",
    plano_nome: "Plano Mensal",
    expira_em: expires.toISOString(),
  });

  if (assinError) console.error("Assinaturas error:", assinError);
  else console.log("Assinatura created/updated successfully!");
}

fixUser();
