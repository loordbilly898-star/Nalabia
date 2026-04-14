async function testMistral() {
  const apiKey = "zVhT2MP7mBIFTKTatkTnvA5YMuK4p11d";
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Hello" }]
    })
  });
  console.log(response.status, await response.text());
}
testMistral();
