const testServer = async () => {
  try {
    const response = await fetch("http://localhost:3000/api/ai/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: "test" }],
      }),
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
};

testServer();
