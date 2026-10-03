// ==========================================
// 1. CONFIG & STATE
// ==========================================
// NOTE: No API key lives in this file, so it is safe to commit.
// The key is resolved at runtime, in this order:
//   1. The key passed from the UI to analyzeFileAndGenerateQuiz()
//   2. The key saved in the browser via GroveLogic.setApiKey()
//   3. window.APP_CONFIG.geminiApiKey from the git-ignored config.js
// Or, if APP_CONFIG.proxyUrl is set, requests go through your backend
// and the browser never sees the key at all.

const CONFIG = window.APP_CONFIG || {};

// Model name comes from config.js; falls back to the default below
const GEMINI_MODEL = CONFIG.model || "gemini-3.8-flash";

// Optional backend proxy URL (see server.js). Empty string = call Gemini directly.
const PROXY_URL = (CONFIG.proxyUrl || "").trim();

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 60000;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // inline requests are capped at ~20 MB total

const STORAGE_KEY = "enchanted_grove_state_v3";
const API_KEY_STORAGE = "enchanted_grove_user_api_key"; // kept separate from game state

const defaultData = {
  starlightDew: 0,
  notes: [
    { id: "n1", author: "Moonlit Badger", content: "Hard work today blooms into clarity tomorrow.", fruitType: "blue", position: { x: 30, y: 35 } },
    { id: "n2", author: "Starfall Fox", content: "Breathe. You are prepared.", fruitType: "gold", position: { x: 65, y: 40 } }
  ]
};

// Safely load saved state; fall back to defaults if storage is empty or corrupted
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return {
      starlightDew: Number(parsed.starlightDew) || 0,
      notes: Array.isArray(parsed.notes) ? parsed.notes : structuredClone(defaultData.notes)
    };
  } catch (err) {
    console.warn("Failed to load saved state, using defaults:", err);
    return structuredClone(defaultData);
  }
}

let appState = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (err) {
    console.warn("Failed to save state:", err);
  }
}

// Resolve which API key to use (see priority list at the top)
function resolveApiKey(customApiKey = "") {
  const fromUi = (customApiKey || "").trim();
  if (fromUi) return fromUi;
  try {
    const saved = (localStorage.getItem(API_KEY_STORAGE) || "").trim();
    if (saved) return saved;
  } catch (err) {
    // Storage may be unavailable (private mode); ignore and continue
  }
  return (CONFIG.geminiApiKey || "").trim();
}

// ==========================================
// 2. HELPERS
// ==========================================

// Convert a user-selected file (PDF, image, text) into the Base64 "inlineData" part Gemini expects
function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read the file."));
        return;
      }
      resolve({
        inlineData: {
          data: result.split(",")[1],
          mimeType: file.type || "application/octet-stream"
        }
      });
    };
    reader.onerror = () => reject(new Error("Failed to read the file."));
    reader.readAsDataURL(file);
  });
}

// Remove possible markdown code fences and parse JSON
function parseJsonSafely(rawText) {
  const cleaned = rawText.replace(/```json|```/gi, "").trim();
  return JSON.parse(cleaned);
}

// Check that the parsed result matches the structure the UI expects
function validateQuizResult(result) {
  const questions = result?.quiz?.questions;
  if (!result?.analysis?.summary || !Array.isArray(questions) || questions.length === 0) {
    throw new Error("The AI response is missing required fields (analysis / quiz).");
  }
  questions.forEach((q, i) => {
    if (
      !q.question ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      !Number.isInteger(q.answerIndex) ||
      q.answerIndex < 0 ||
      q.answerIndex >= q.options.length
    ) {
      throw new Error(`Question ${i + 1} has an invalid format.`);
    }
    q.id = q.id || `q${i + 1}`;
    q.pointsAwarded = Number(q.pointsAwarded) || 100;
  });
  result.quiz.courseTitle = result.quiz.courseTitle || "Custom Study Trial";
  return result;
}

// ==========================================
// 3. CORE LOGIC API (exposed for the UI to call)
// ==========================================
window.GroveLogic = {
  /** Get the current global state. */
  getState: () => appState,

  /** Add points (Starlight Dew) and persist them. */
  addDew: (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return appState.starlightDew;
    appState.starlightDew += value;
    saveState();
    return appState.starlightDew;
  },

  /** Add a blessing fruit (note) to the memory tree. */
  addNote: (text, author = "Wanderer Owl") => {
    const colors = ["gold", "blue", "green"];
    const newNote = {
      id: `n-${Date.now()}`,
      author,
      content: text,
      fruitType: colors[Math.floor(Math.random() * colors.length)],
      position: { x: 20 + Math.random() * 60, y: 15 + Math.random() * 45 }
    };
    appState.notes.push(newNote);
    saveState();
    return newNote;
  },

  /** Reset all saved progress back to the default data. */
  resetState: () => {
    appState = structuredClone(defaultData);
    saveState();
    return appState;
  },

  // ----- API key management (for a "Settings" input box in the UI) -----

  /** Save a key the user typed in. It stays in this browser only and is never committed to git. */
  setApiKey: (key) => {
    try {
      localStorage.setItem(API_KEY_STORAGE, (key || "").trim());
    } catch (err) {
      console.warn("Failed to save API key:", err);
    }
  },

  /** Remove the saved key from this browser. */
  clearApiKey: () => {
    try {
      localStorage.removeItem(API_KEY_STORAGE);
    } catch (err) {
      // ignore
    }
  },

  /** True if a usable key exists (or a proxy is configured). Handy for showing/hiding the key input. */
  hasApiKey: () => Boolean(PROXY_URL) || Boolean(resolveApiKey()),

  /**
   * Analyze an uploaded file with Gemini and generate quiz questions.
   * @param {File} file - the file selected by the user
   * @param {string} [customApiKey] - optional key from the UI input box
   * @returns {Promise<{analysis: {summary: string}, quiz: object}>}
   */
  analyzeFileAndGenerateQuiz: async (file, customApiKey = "") => {
    // In proxy mode the key lives on the server, so the browser needs none
    const apiKey = PROXY_URL ? "" : resolveApiKey(customApiKey);

    if (!PROXY_URL && !apiKey) {
      throw new Error("No API key found. Please enter your Gemini API key in the settings box.");
    }
    if (!file) {
      throw new Error("No file has been selected!");
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error("The file is too large. Please choose a file under 15 MB.");
    }

    // 1. Convert the file to a Gemini-compatible part
    const filePart = await fileToGenerativePart(file);

    // 2. Build the prompt, strongly constraining the output to clean JSON
    const promptText = `
      Analyze this attached study material and perform two tasks:
      1. Provide a brief 2-sentence summary of key insights.
      2. Generate 3 multiple-choice quiz questions based directly on the file.

      Respond STRICTLY with a valid JSON object matching this schema (do NOT surround with markdown format):
      {
        "analysis": { "summary": "2-sentence summary here..." },
        "quiz": {
          "courseTitle": "Custom Study Trial",
          "questions": [
            { "id": "q1", "question": "Question text", "options": ["Option A","Option B","Option C","Option D"], "answerIndex": 0, "pointsAwarded": 100 }
          ]
        }
      }
      "answerIndex" is the zero-based index of the correct option.
    `;

    const requestBody = {
      contents: [{ parts: [filePart, { text: promptText }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    // 3. Choose the endpoint and headers depending on the mode
    const url = PROXY_URL || `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent`;
    const headers = { "Content-Type": "application/json" };
    if (!PROXY_URL) headers["x-goog-api-key"] = apiKey; // key goes in a header, never in the URL

    // 4. Send the request with a timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === "AbortError") throw new Error("Request timed out. Please try again.");
      throw new Error(`Network error: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        `Gemini API error (${response.status}): ${errData.error?.message || response.statusText}`
      );
    }

    // 5. Parse and validate the response
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      const reason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason || "unknown";
      throw new Error(`Gemini returned no content (reason: ${reason}).`);
    }

    let parsed;
    try {
      parsed = parseJsonSafely(rawText);
    } catch (err) {
      throw new Error("Failed to parse the AI response as JSON. Please try again.");
    }

    return validateQuizResult(parsed);
  },

  /**
   * Try Gemini first, fall back to local mock data on any failure,
   * so the app never breaks when the network or key is unavailable.
   */
  analyzeWithFallback: async (file, customApiKey = "") => {
    try {
      const result = await window.GroveLogic.analyzeFileAndGenerateQuiz(file, customApiKey);
      return { result, usedFallback: false };
    } catch (err) {
      console.error("Gemini analysis failed, using fallback quiz:", err);
      return {
        result: window.GroveLogic.getFallbackQuiz(),
        usedFallback: true,
        error: err.message
      };
    }
  },

  /** Static fallback data used when the network or API is unavailable. */
  getFallbackQuiz: () => ({
    analysis: { summary: "This is a fallback summary loaded when API or network is unavailable." },
    quiz: {
      courseTitle: "Introductory Psychology",
      questions: [
        { id: "q1", question: "Which brain structure acts as the primary sensory relay station?", options: ["Hippocampus", "Thalamus", "Amygdala", "Cerebellum"], answerIndex: 1, pointsAwarded: 100 },
        { id: "q2", question: "Which lobe is responsible for visual processing?", options: ["Frontal", "Parietal", "Occipital", "Temporal"], answerIndex: 2, pointsAwarded: 100 }
      ]
    }
  })
};
