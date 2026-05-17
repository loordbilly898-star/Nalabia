import fetch from "node-fetch";

async function sendWebhook() {
  const payload = {
    event: "payment.approved",
    status: "approved",
    external_reference: "", // let it find by email
    customer: {
      email: "williamhendler711@gmail.com"
    },
    offer: {
      name: "NaLábia - Trimestral"
    },
    transaction_amount: "99.90",
    id: "test_" + Date.now()
  };

  const res = await fetch("http://localhost:3000/api/webhook/cakto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  console.log(res.status, await res.text());
}

sendWebhook();
