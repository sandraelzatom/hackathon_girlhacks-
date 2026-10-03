// ==========================================
// server.js - OPTIONAL tiny proxy that keeps the API key on the server.
// Run with:  npm install express cors
//            node --env-file=.env server.js      (Node 20.6+)
// ==========================================
const express = require("express");
const cors = require("cors");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY. Please set it in your .env file.");
  process.exit(1);
}

const app = express();

// 【需要你改】部署后把 origin 改成你的前端网址，例如 "https://yourname.github.io"
// 本地开发时允许所有来源即可
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "25mb" }));

// Serve ONLY an allowlist of front-end files (never the whole folder,
// otherwise .env and server.js would be downloadable).
const PUBLIC_FILES = ["test.html", "index.html", "style.css", "logic.js", "config.js"];
PUBLIC_FILES.forEach((name) => {
  app.get(`/${name}`, (req, res) => res.sendFile(path.join(__dirname, name)));
});

// Health check: confirms the server is up and the key is loaded (the key itself is never returned)
app.get("/health", (req, res) => res.json({ ok: true, model: MODEL, keyLoaded: Boolean(API_KEY) }));

app.post("/api/gemini", async (req, res) => {
  try {
    const { contents, generationConfig } = req.body || {};
    if (!Array.isArray(contents)) {
      return res.status(400).json({ error: { message: "Invalid request body." } });
    }

    // The model is fixed on the server so clients cannot pick expensive models
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({ contents, generationConfig })
    });

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: `Proxy error: ${err.message}` } });
  }
});

app.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));
