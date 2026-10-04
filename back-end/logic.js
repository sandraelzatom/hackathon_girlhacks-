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
const GEMINI_MODEL = CONFIG.model || "gemini-2.5-flash";

// Optional backend proxy URL (see server.js). Empty string = call Gemini directly.
const PROXY_URL = (CONFIG.proxyUrl || "").trim();

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 60000;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // inline requests are capped at ~20 MB total


// 【可调整】挂一条祝福需要消耗多少星露 (Starlight Dew)
const HANG_BLESSING_COST = 50;
const MAX_BLESSING_LENGTH = 280; // keep in sync with notes.js

// 【可调整】连击倍数：streak = 连续答对的题数，取满足条件的最高档
const COMBO_TIERS = [
  { minStreak: 5, multiplier: 2 },
  { minStreak: 3, multiplier: 1.5 }
];

// 【可调整】在迷雾森林里重测答对时，得分占正常得分的比例
const MIST_POINTS_RATIO = 0.5;

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

// Save locally (as a cache) and schedule an upload to the server
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (err) {
    console.warn("Failed to save state:", err);
  }
  scheduleServerSync();
}

// Debounced upload: many quick changes result in a single request
let syncTimer = null;
let serverSyncEnabled = false; // becomes true after GroveLogic.init() succeeds

function scheduleServerSync() {
  if (!serverSyncEnabled) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushStateToServer, 500);
}

async function pushStateToServer() {
  try {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: appState }),
      keepalive: true // lets the request finish even if the tab is closing
    });
    if (res.status === 401) window.location.href = "/login.html"; // session expired
  } catch (err) {
    console.warn("Failed to sync progress to the server:", err);
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

// Errors caused by the user's input (wrong file type, not logged in...). analyzeWithFallback() rethrows
// these instead of silently showing the sample quiz, so the UI can tell the user what to fix.
function userError(message) {
  const err = new Error(message);
  err.userError = true;
  return err;
}

// File types Gemini can read inline, keyed by file extension.
// Markdown and CSV are sent as plain text. Word and PowerPoint files are NOT supported.
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/plain",
  csv: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};
const SUPPORTED_MIME_TYPES = ["application/pdf", "text/plain", "image/png", "image/jpeg", "image/webp"];

// Decide the MIME type to send. Some browsers leave file.type empty, so fall back to the extension.
function resolveMimeType(file) {
  const ext = (file.name || "").split(".").pop().toLowerCase();
  const fromExt = MIME_BY_EXTENSION[ext];
  if (SUPPORTED_MIME_TYPES.includes(file.type)) return file.type;
  if (fromExt) return fromExt;
  if (file.type && file.type.startsWith("text/")) return "text/plain";
  throw userError("Unsupported file type. Please upload a PDF, an image (PNG, JPG, WEBP), or a .txt file.");
}

// Convert a user-selected file (PDF, image, text) into the Base64 "inlineData" part Gemini expects
function fileToGenerativePart(file, mimeType) {
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
          mimeType: mimeType || file.type || "application/octet-stream"
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
// QUIZ SESSION: combo multiplier + Mist Forest re-testing
// Round 1 ("main"): every question once. Wrong answers reset the streak and are sent to the Mist Forest.
// Round 2 ("mist"): missed questions come back (options reshuffled) until each one is answered correctly.
// ==========================================
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shuffle the answer options and keep answerIndex pointing at the right one
function shuffleOptions(q) {
  const order = shuffleArray(q.options.map((_, i) => i));
  return { ...q, options: order.map((i) => q.options[i]), answerIndex: order.indexOf(q.answerIndex) };
}

function comboMultiplierFor(streak) {
  const tier = COMBO_TIERS.find((t) => streak >= t.minStreak);
  return tier ? tier.multiplier : 1;
}

let quizSession = null;

function createQuizSession(quizData) {
  const questions = quizData && quizData.quiz && quizData.quiz.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Quiz data has no questions.");
  }
  return {
    title: quizData.quiz.courseTitle || "Custom Study Trial",
    phase: "main",                                   // "main" | "mist" | "done"
    queue: shuffleArray(questions).map(shuffleOptions),
    pendingMist: [],                                 // missed in the main round
    total: questions.length,
    answeredMain: 0,
    streak: 0,
    bestStreak: 0,
    correctFirstTry: 0,
    mistCleared: 0,
    earned: 0
  };
}

function mistRemaining(session) {
  return session.phase === "mist" ? session.queue.length : session.pendingMist.length;
}

function currentQuestionView(session) {
  if (!session || session.phase === "done" || session.queue.length === 0) return null;
  const q = session.queue[0];
  const base = Number(q.pointsAwarded) || 100;
  const inMist = session.phase === "mist";
  const multiplier = inMist ? 1 : comboMultiplierFor(session.streak + 1); // what a correct answer would use
  const ratio = inMist ? MIST_POINTS_RATIO : 1;
  return {
    id: q.id,
    question: q.question,
    options: q.options,        // answerIndex is deliberately NOT included
    phase: session.phase,
    number: inMist ? null : session.answeredMain + 1,
    total: session.total,
    streak: session.streak,
    multiplier,
    pointsIfCorrect: Math.round(base * ratio * multiplier),
    mistRemaining: mistRemaining(session)
  };
}

function summaryOf(session) {
  const mastered = session.correctFirstTry + session.mistCleared;
  return {
    title: session.title,
    finished: session.phase === "done",
    totalQuestions: session.total,
    correctFirstTry: session.correctFirstTry,
    accuracy: Math.round((session.correctFirstTry / session.total) * 100),
    conceptsMastered: mastered,
    bestStreak: session.bestStreak,
    mistCleared: session.mistCleared,
    mistRemaining: mistRemaining(session),
    earned: session.earned
  };
}

// ==========================================
// 3. CORE LOGIC API (exposed for the UI to call)
// ==========================================
window.GroveLogic = {
  /** Get the current global state. */
  getState: () => appState,

  /**
   * Call this ONCE after the page loads and BEFORE rendering the UI.
   * Loads the logged-in user's saved progress from the server.
   * Redirects to the login page if the user is not logged in.
   */
  init: async () => {
    try {
      const res = await fetch("/api/state");
      if (res.status === 401) {
        window.location.href = "/login.html";
        return appState;
      }
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const { state } = await res.json();
      // New account: start from defaults instead of inheriting another user's local cache
      appState = state || structuredClone(defaultData);
      serverSyncEnabled = true;
      saveState(); // refreshes the local cache (and uploads defaults for a new account)
    } catch (err) {
      // Server unreachable: keep working locally without syncing
      console.warn("Could not load progress from the server, using local data:", err);
    }
    return appState;
  },

  /** Returns the logged-in user ({ username }) or null if not logged in. */
  getCurrentUser: async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      return (await res.json()).user;
    } catch (err) {
      return null;
    }
  },

  /** Log out and go back to the login page. */
  logout: async () => {
    try {
      if (serverSyncEnabled) await pushStateToServer(); // make sure the latest progress is saved
      serverSyncEnabled = false;
      await fetch("/api/auth/logout", { method: "POST" });
      try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
    } finally {
      window.location.href = "/login.html";
    }
  },

  /** Add points (Starlight Dew) and persist them. */
  addDew: (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value)) return appState.starlightDew;
    appState.starlightDew += value;
    saveState();
    return appState.starlightDew;
  },

  /** @deprecated Local-only note (private to this account). Use hangBlessing() for the shared Memory Tree. */
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
      throw userError("No file has been selected!");
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw userError("The file is too large. Please choose a file under 15 MB.");
    }

    // 1. Check the type and convert the file to a Gemini-compatible part
    const mimeType = resolveMimeType(file);
    const filePart = await fileToGenerativePart(file, mimeType);

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

    if (response.status === 401) {
      throw userError("Please log in first.");
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
   * Try Gemini first, fall back to local mock data when Gemini or the network fails,
   * so the app never breaks. Throws (no fallback) for user-fixable problems such as an
   * unsupported file type, a file that is too large, or being logged out.
   */
  analyzeWithFallback: async (file, customApiKey = "") => {
    try {
      const result = await window.GroveLogic.analyzeFileAndGenerateQuiz(file, customApiKey);
      return { result, usedFallback: false };
    } catch (err) {
      // Problems the user can fix (wrong file type, too large, logged out) are shown, not hidden
      if (err.userError) throw err;
      console.error("Gemini analysis failed, using fallback quiz:", err);
      return {
        result: window.GroveLogic.getFallbackQuiz(),
        usedFallback: true,
        error: err.message
      };
    }
  },

  // ----- Quiz session: combo + Mist Forest -----
  quiz: {
    /** Start a session from the data returned by analyzeWithFallback().result. Returns the first question. */
    start: (quizData) => {
      quizSession = createQuizSession(quizData);
      return currentQuestionView(quizSession);
    },

    /** The question to show now (without the answer), or null when the session is finished. */
    getCurrent: () => currentQuestionView(quizSession),

    /**
     * Submit the chosen option index for the current question.
     * Awards Starlight Dew automatically. Returns the result and moves on to the next question.
     */
    answer: (optionIndex) => {
      const session = quizSession;
      if (!session || session.phase === "done") throw new Error("No quiz is in progress.");
      if (!Number.isInteger(optionIndex)) throw new Error("optionIndex must be an integer.");

      const q = session.queue[0];
      if (optionIndex < 0 || optionIndex >= q.options.length) throw new Error("optionIndex is out of range.");

      const base = Number(q.pointsAwarded) || 100;
      const correct = optionIndex === q.answerIndex;
      const answeredPhase = session.phase;
      let points = 0;
      let multiplier = 1;
      let enteringMist = false;

      session.queue.shift();

      if (answeredPhase === "main") {
        session.answeredMain += 1;
        if (correct) {
          session.streak += 1;
          session.bestStreak = Math.max(session.bestStreak, session.streak);
          session.correctFirstTry += 1;
          multiplier = comboMultiplierFor(session.streak);
          points = Math.round(base * multiplier);
        } else {
          session.streak = 0;
          session.pendingMist.push(q); // goes to the Mist Forest
        }
        if (session.queue.length === 0) {
          if (session.pendingMist.length > 0) {
            session.phase = "mist";
            session.queue = shuffleArray(session.pendingMist).map(shuffleOptions);
            session.pendingMist = [];
            enteringMist = true;
          } else {
            session.phase = "done";
          }
        }
      } else {
        // Mist Forest: no combo; wrong answers come back at the end of the line
        if (correct) {
          session.mistCleared += 1;
          points = Math.round(base * MIST_POINTS_RATIO);
        } else {
          session.queue.push(shuffleOptions(q));
        }
        if (session.queue.length === 0) session.phase = "done";
      }

      if (points > 0) {
        session.earned += points;
        window.GroveLogic.addDew(points);
      }

      return {
        correct,
        correctIndex: q.answerIndex,
        pointsAwarded: points,
        multiplier,
        streak: session.streak,
        bestStreak: session.bestStreak,
        dewTotal: appState.starlightDew,
        phase: answeredPhase,
        enteringMist,
        finished: session.phase === "done",
        mistRemaining: mistRemaining(session)
      };
    },

    /** Give up on the remaining Mist Forest questions and finish the session. */
    skipMist: () => {
      if (quizSession && quizSession.phase === "mist") {
        quizSession.queue = [];
        quizSession.phase = "done";
      }
      return quizSession ? summaryOf(quizSession) : null;
    },

    /** Stats for the results screen. Works at any time during or after a session. */
    getSummary: () => (quizSession ? summaryOf(quizSession) : null),

    /** Throw the current session away. */
    reset: () => { quizSession = null; }
  },

  // ----- Shared Memory Tree (blessings from all students) -----

  /** Cost in Starlight Dew to hang one blessing. */
  getBlessingCost: () => HANG_BLESSING_COST,

  /** Load every blessing on the tree: [{ id, author, content, fruitType, position, likes, likedByMe, createdAt }] */
  loadBlessings: async () => {
    const res = await fetch("/api/notes");
    if (res.status === 401) throw new Error("Please log in first.");
    if (!res.ok) throw new Error(`Could not load blessings (${res.status}).`);
    return (await res.json()).notes;
  },

  /** Read one random blessing ("read a whisper"). */
  getRandomBlessing: async () => {
    const res = await fetch("/api/notes/random");
    if (res.status === 401) throw new Error("Please log in first.");
    if (!res.ok) throw new Error(`Could not load a blessing (${res.status}).`);
    return (await res.json()).note;
  },

  /**
   * Hang your own blessing on the tree. Costs Starlight Dew (see getBlessingCost()).
   * Dew is only deducted after the server accepts the message. Returns the new note.
   */
  hangBlessing: async (text) => {
    const content = String(text || "").trim();
    if (!content) throw new Error("Please write a message first.");
    if (content.length > MAX_BLESSING_LENGTH) {
      throw new Error(`Messages can be at most ${MAX_BLESSING_LENGTH} characters.`);
    }
    if (appState.starlightDew < HANG_BLESSING_COST) {
      throw new Error(`You need ${HANG_BLESSING_COST} Starlight Dew to hang a blessing.`);
    }

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    if (res.status === 401) throw new Error("Please log in first.");
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Could not hang the blessing (${res.status}).`);
    }

    appState.starlightDew -= HANG_BLESSING_COST;
    saveState();
    return (await res.json()).note;
  },

  /**
   * Infuse Energy: like a blessing (press again to take the like back).
   * @param {string} noteId - the id from loadBlessings()
   * @returns {Promise<object>} the updated blessing ({ id, likes, likedByMe, ... })
   */
  infuseEnergy: async (noteId) => {
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}/like`, { method: "POST" });
    if (res.status === 401) throw new Error("Please log in first.");
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Could not infuse energy (${res.status}).`);
    }
    return (await res.json()).note;
  },

  /**
   * Stats for the "Forest awakening" summary:
   * how many blessings you hung and how much energy (likes) they received.
   * @returns {Promise<{ blessings: number, energyReceived: number }>}
   */
  getMyBlessingStats: async () => {
    const user = await window.GroveLogic.getCurrentUser();
    if (!user) throw new Error("Please log in first.");
    const mine = (await window.GroveLogic.loadBlessings()).filter(
      (n) => String(n.author).toLowerCase() === user.username.toLowerCase()
    );
    return { blessings: mine.length, energyReceived: mine.reduce((sum, n) => sum + (n.likes || 0), 0) };
  },

  /**
   * "Polish with Magic": rewrites a message as fantasy-style poetic prose using Gemini.
   * @param {string} text - the user's plain message (max 280 characters)
   * @param {string} [discipline] - optional subject (e.g. "Psychology") to flavor the imagery
   * @returns {Promise<{ paraphrase: string, prose: string, runeType?: string }>}
   *   paraphrase: the enchanted message (pass it to hangBlessing() if the user accepts it)
   *   prose: a short line spoken by the Keeper of the grove
   *   runeType: "wisdom" | "courage" | "rest" | "hope" | "focus" (may be missing)
   */
  enchantWish: async (text, discipline = "") => {
    const wish = String(text || "").trim();
    if (!wish) throw new Error("Please write a message first.");
    if (wish.length > MAX_BLESSING_LENGTH) {
      throw new Error(`Messages can be at most ${MAX_BLESSING_LENGTH} characters.`);
    }

    const res = await fetch("/api/enchant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wish, discipline })
    });
    if (res.status === 401) throw new Error("Please log in first.");

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `The magic failed (${res.status}).`);
    return data;
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
