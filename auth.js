// ==========================================
// auth.js - Simple username/password login for Express.
// Passwords are hashed with bcrypt, sessions use an httpOnly cookie,
// and users are stored in a local users.json file (fine for a hackathon demo).
// ==========================================
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const USERS_FILE = path.join(__dirname, "users.json");
const BCRYPT_ROUNDS = 10;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/; // 3-20 letters, digits or underscores
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 72; // bcrypt only uses the first 72 bytes
const COOKIE_NAME = "grove.sid";

// ---------- Session setup ----------
// 【需要你做】在 .env 里设置 SESSION_SECRET（一串随机字符）。
// 没设置也能跑，但每次重启服务器所有人都会被登出。
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET is not set. Using a temporary secret; logins reset on every restart.");
}

const sessionMiddleware = session({
  name: COOKIE_NAME,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                                  // JS in the page cannot read the cookie
    sameSite: "lax",                                 // basic protection against cross-site requests
    secure: process.env.NODE_ENV === "production",   // HTTPS only when deployed
    maxAge: 7 * 24 * 60 * 60 * 1000                  // 7 days
  }
});

// ---------- User storage ----------
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {}; // file does not exist yet
    throw err;
  }
}

function writeUsers(users) {
  // Write to a temp file first so a crash cannot leave a half-written users.json
  const tmp = `${USERS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}

// ---------- Helpers ----------
const fail = (res, status, message) => res.status(status).json({ error: { message } });

// Used so that "user not found" takes as long as "wrong password" (prevents username probing)
const DUMMY_HASH = bcrypt.hashSync("dummy-password", BCRYPT_ROUNDS);

// Very small in-memory rate limiter: max attempts per IP per window
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const attempts = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  let entry = attempts.get(req.ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    attempts.set(req.ip, entry);
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return fail(res, 429, "Too many attempts. Please try again in a few minutes.");
  }
  next();
}

// Create a fresh session after login/register (prevents session fixation)
function startSession(req, user, callback) {
  req.session.regenerate((err) => {
    if (err) return callback(err);
    req.session.userId = user.username.toLowerCase();
    req.session.username = user.username;
    req.session.save(callback);
  });
}

// ---------- Middleware for protecting routes ----------

// For API routes: respond with 401 JSON if not logged in
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return fail(res, 401, "Please log in first.");
}

// For HTML pages: redirect to the login page if not logged in
function requirePage(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.redirect("/login.html");
}

// ---------- Routes (mounted at /api/auth) ----------
const authRouter = express.Router();

authRouter.post("/register", rateLimit, async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!USERNAME_RE.test(username)) {
      return fail(res, 400, "Username must be 3-20 characters: letters, numbers or underscore.");
    }
    if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
      return fail(res, 400, `Password must be ${MIN_PASSWORD_LEN}-${MAX_PASSWORD_LEN} characters.`);
    }

    const users = readUsers();
    const key = username.toLowerCase();
    if (users[key]) return fail(res, 409, "That username is already taken.");

    users[key] = {
      username,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      createdAt: new Date().toISOString()
    };
    writeUsers(users);

    startSession(req, users[key], (err) => {
      if (err) return fail(res, 500, "Could not start a session.");
      res.status(201).json({ user: { username } });
    });
  } catch (err) {
    console.error("Register error:", err);
    fail(res, 500, "Something went wrong. Please try again.");
  }
});

authRouter.post("/login", rateLimit, async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    const user = readUsers()[username.toLowerCase()];
    // Always run bcrypt.compare, even for unknown users
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !ok) return fail(res, 401, "Incorrect username or password.");

    startSession(req, user, (err) => {
      if (err) return fail(res, 500, "Could not start a session.");
      res.json({ user: { username: user.username } });
    });
  } catch (err) {
    console.error("Login error:", err);
    fail(res, 500, "Something went wrong. Please try again.");
  }
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });
});

// Lets the front end ask "who am I?"
authRouter.get("/me", (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ user: { username: req.session.username } });
  }
  return fail(res, 401, "Not logged in.");
});

// ---------- Per-user game progress (mounted at /api/state) ----------
const FRUIT_TYPES = ["gold", "blue", "green"];
const MAX_NOTES = 200;

const clampNum = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Never trust the client: rebuild the state with only the fields and sizes we expect
function sanitizeState(input) {
  if (!input || typeof input !== "object") return null;
  const notes = Array.isArray(input.notes) ? input.notes.slice(-MAX_NOTES) : [];
  return {
    starlightDew: Math.floor(clampNum(input.starlightDew, 0, 1e9, 0)),
    notes: notes
      .filter((n) => n && typeof n === "object")
      .map((n, i) => ({
        id: String(n.id || `n-${Date.now()}-${i}`).slice(0, 60),
        author: String(n.author || "Wanderer Owl").slice(0, 40),
        content: String(n.content || "").slice(0, 500),
        fruitType: FRUIT_TYPES.includes(n.fruitType) ? n.fruitType : "gold",
        position: {
          x: clampNum(n.position && n.position.x, 0, 100, 50),
          y: clampNum(n.position && n.position.y, 0, 100, 50)
        }
      }))
  };
}

const stateRouter = express.Router();
stateRouter.use(requireAuth); // every state route needs a logged-in user

// Load the current user's saved progress (state is null for a brand-new account)
stateRouter.get("/", (req, res) => {
  const user = readUsers()[req.session.userId];
  if (!user) return fail(res, 401, "Please log in first.");
  res.json({ state: user.state || null });
});

// Save the current user's progress
stateRouter.put("/", (req, res) => {
  const clean = sanitizeState(req.body && req.body.state);
  if (!clean) return fail(res, 400, "Invalid state.");

  const users = readUsers();
  const user = users[req.session.userId];
  if (!user) return fail(res, 401, "Please log in first.");

  user.state = clean;
  user.stateUpdatedAt = new Date().toISOString();
  writeUsers(users);
  res.json({ ok: true });
});

module.exports = { sessionMiddleware, authRouter, stateRouter, requireAuth, requirePage };
