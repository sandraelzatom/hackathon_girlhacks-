// ==========================================
// test-proxy.js - command-line test for the proxy (no browser needed).
// Usage: start the server first (npm start), then run: npm run test:proxy
// ==========================================
const BASE = process.env.PROXY_BASE || "http://localhost:3000"; // 【可改】代理地址

const sampleText = `
The thalamus is the brain's main sensory relay station. It receives signals from
the senses and forwards them to the cerebral cortex. The occipital lobe processes
visual information, while the hippocampus is essential for forming new memories.
`;

async function main() {
  // Step 1: health check
  console.log("1) Checking /health ...");
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  console.log("   ->", health);
  if (!health.keyLoaded) throw new Error("Server has no API key. Check your .env file.");

  // Step 2: send a small text file through the proxy
  console.log("2) Sending a sample text to /api/gemini ...");
  const body = {
    contents: [{
      parts: [
        { inlineData: { mimeType: "text/plain", data: Buffer.from(sampleText).toString("base64") } },
        { text: 'Generate 1 multiple-choice question about this text. Respond ONLY with JSON: {"question":"...","options":["A","B","C","D"],"answerIndex":0}' }
      ]
    }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const res = await fetch(`${BASE}/api/gemini`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();

  if (!res.ok) {
    console.error(`   FAILED (${res.status}):`, data.error?.message || data);
    process.exit(1);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("   OK. Gemini replied:\n", text);
  console.log("\n✅ Proxy works. Your key stays on the server.");
}

main().catch((err) => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
