// ==========================================
// server.js - Express server: login + Gemini proxy + static pages.
// Run with:  npm install
//            npm start        (uses: node --env-file=.env server.js, Node 20.6+)
// ==========================================
const express = require("express");
const cors = require("cors");
const path = require("path");
const { sessionMiddleware, authRouter, stateRouter, requireAuth, requirePage } = require("./auth");
const { notesRouter } = require("./notes");
const { createEnchantRouter } = require("./enchant");

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY. Please set it in your .env file.");
  process.exit(1);
}

const app = express();

// Pages and API are served from the same origin, so CORS is not really needed locally.
// 【需要你改】如果以后前端和后端分开部署，把 origin 改成你的前端网址，并开启 credentials
app.use(cors({ origin: "*" }));
app.use(sessionMiddleware);

// ---------- Auth routes (small body limit, they only carry a username and password) ----------
app.use("/api/auth", express.json({ limit: "10kb" }), authRouter);

// ---------- Per-user game progress (login required) ----------
app.use("/api/state", express.json({ limit: "100kb" }), stateRouter);

// ---------- Shared Memory Tree blessings (login required) ----------
app.use("/api/notes", express.json({ limit: "10kb" }), notesRouter);

// ---------- Polish with Magic: AI rewrites a message as fantasy prose (login required) ----------
app.use("/api/enchant", express.json({ limit: "10kb" }), createEnchantRouter({ apiKey: API_KEY, model: MODEL }));

// ---------- Static files ----------
// Only an allowlist is served; never the whole folder (that would expose .env and server.js).
// These files contain no secrets, so they are public.
const PUBLIC_FILES = ["index.html", "style.css", "script.js", "grove-ui.js", "grove-api.js", "config.js", "login.html", "test.html"];
PUBLIC_FILES.forEach((name) => {
  app.get(`/${name}`, (req, res) => res.sendFile(path.join(__dirname, name)));
});

// The front page is public: it contains its own login screen. Everything that matters
// (progress, blessings, Gemini) is protected by login on the API routes below.
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// Health check: the key itself is never returned
app.get("/health", (req, res) => res.json({ ok: true, model: MODEL, keyLoaded: Boolean(API_KEY) }));

// ---------- Gemini proxy (login required, so strangers cannot use your key) ----------
app.post("/api/gemini", requireAuth, express.json({ limit: "25mb" }), async (req, res) => {
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
