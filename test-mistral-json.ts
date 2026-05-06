async function testMistralJson() {
  const apiKey = "zVhT2MP7mBIFTKTatkTnvA5YMuK4p11d";
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages: [
        { role: "user", content: "Return a JSON object with a 'message' key." },
      ],
      response_format: { type: "json_object" },
    }),
  });
  console.log(response.status, await response.text());
}
testMistralJson();
