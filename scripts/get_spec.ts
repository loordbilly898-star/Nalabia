import dotenv from "dotenv";
dotenv.config();

async function getSpec() {
  const res = await fetch("https://dxnxykpwmgbzsdiohgdo.supabase.co/rest/v1/", {
    headers: {
      "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const data = await res.json();
  console.log("Paths:", Object.keys(data.paths || {}));
}
getSpec();
