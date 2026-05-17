import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://dxnxykpwmgbzsdiohgdo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs";
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = "williamhendler711@gmail.com";
  
  console.log(`Buscando usuário por e-mail: ${email}...`);
  
  const { data: users, error: fetchError } = await supabase
    .from("users")
    .select("userID, email")
    .ilike("email", email);

  if (fetchError) {
    console.error("Erro ao buscar usuário:", fetchError);
    return;
  }

  if (!users || users.length === 0) {
    console.log("Usuário não encontrado no banco de dados.");
  } else {
    const user = users[0];
    console.log(`Limpando plano para o usuário ${user.userID}...`);
    
    const { error: updateError } = await supabase
      .from("users")
      .update({
        plano: null,
        expiraEm: null,
        status: "pendente", // Opcional: define como pendente se não tiver plano
        updatedAt: new Date().toISOString()
      })
      .eq("userID", user.userID);

    if (updateError) {
      console.error("Erro ao atualizar usuário:", updateError);
    } else {
      console.log("Usuário atualizado com sucesso.");
    }
  }

  console.log(`Removendo registros de assinaturas para ${email}...`);
  const { error: deleteError } = await supabase
    .from("assinaturas")
    .delete()
    .ilike("email", email);

  if (deleteError) {
    console.error("Erro ao deletar assinatura:", deleteError);
  } else {
    console.log("Registros de assinaturas removidos com sucesso.");
  }
}

main();
