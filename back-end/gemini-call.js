// ==========================================
// gemini-call.js - one place that talks to Gemini, with retries.
// Retries temporary errors (503 overloaded, 429 rate limit, 500) with a short wait,
// then tries a backup model if GEMINI_FALLBACK_MODEL is set.
// ==========================================
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRYABLE = [429, 500, 502, 503, 504];
const WAITS_MS = [800, 2000]; // wait before retry 2 and retry 3 (total 3 tries per model)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callOnce(model, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    const message = err.name === "AbortError" ? "Gemini took too long." : `Network error: ${err.message}`;
    return { status: 504, ok: false, data: { error: { message } } };
  } finally {
    clearTimeout(timer);
  }
}

/** Returns { status, ok, data, model }. Never throws. */
async function callGemini({ apiKey, models, body, timeoutMs = 60000 }) {
  let last;
  for (const model of models.filter(Boolean)) {
    for (let attempt = 0; attempt <= WAITS_MS.length; attempt++) {
      last = await callOnce(model, apiKey, body, timeoutMs);
      last.model = model;
      if (last.ok) return last;
      console.error(`Gemini ${last.status} (model ${model}, try ${attempt + 1}):`, last.data?.error?.message || last.data);
      if (!RETRYABLE.includes(last.status)) return last; // e.g. 400/403/404: retrying will not help
      if (attempt < WAITS_MS.length) await sleep(WAITS_MS[attempt]);
    }
  }
  return last;
}

module.exports = { callGemini };
