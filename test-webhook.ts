import fetch from "node-fetch";

async function testWebhook() {
  const req = await fetch("http://localhost:3000/api/webhook/cakto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "paid", // Or status
      customer: { email: "gamerbilly898@gmail.com" },
      planName: "NaLábia - Mensal",
      amount: 1990,
      transaction_id: "test_12345",
    }),
  });
  console.log(req.status, await req.text());
}

testWebhook();
