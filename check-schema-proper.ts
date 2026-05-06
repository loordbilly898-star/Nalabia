import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://dxnxykpwmgbzsdiohgdo.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4bnh5a3B3bWdienNkaW9oZ2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDQzODksImV4cCI6MjA5MTY4MDM4OX0.P5TiAYDvDAoBs4I_T3d4IC6xVKVCfiqZIkVV81IJphs",
);

async function checkSchema() {
  const { data, error } = await supabase.rpc("get_table_columns", {
    table_name: "assinaturas",
  });

  if (error) {
    console.error("RPC Error (it might not exist):", error.message);

    // Fallback: try querying a row and look at the keys
    const { data: row, error: rowError } = await supabase
      .from("assinaturas")
      .select("*")
      .limit(1);
    if (row && row.length > 0) {
      console.log("Columns found in row:", Object.keys(row[0]));
    } else {
      console.log("No rows in assinaturas to infer columns.");
    }
  } else {
    console.log("Columns:", data);
  }
}

checkSchema();
