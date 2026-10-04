// ==========================================
// notes.js - Shared Memory Tree: blessings that every logged-in student can read.
// Notes are stored in notes.json (created on first run from seed-notes.json).
// ==========================================
const fs = require("fs");
const path = require("path");
const express = require("express");
const { requireAuth } = require("./auth");

const NOTES_FILE = path.join(__dirname, "notes.json");
const SEED_FILE = path.join(__dirname, "seed-notes.json");

const FRUIT_TYPES = ["gold", "blue", "green"];
const MAX_CONTENT_LENGTH = 280;
const MAX_NOTES = 500;          // oldest user notes are dropped beyond this (seed notes are kept)
const MIN_POST_INTERVAL_MS = 3000; // anti-spam: one new blessing per user every 3 seconds

const clampNum = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const fail = (res, status, message) => res.status(status).json({ error: { message } });

// ---------- Storage ----------
function readSeedNotes() {
  try {
    const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
    return seed.map((n, i) => ({
      id: `seed-${i + 1}`,
      seed: true,
      author: String(n.author || "Wanderer Owl").slice(0, 40),
      content: String(n.content || "").slice(0, MAX_CONTENT_LENGTH),
      fruitType: FRUIT_TYPES.includes(n.fruitType) ? n.fruitType : "gold",
      position: { x: clampNum(n.position?.x, 0, 100, 50), y: clampNum(n.position?.y, 0, 100, 50) },
      likes: Math.max(0, Math.floor(Number(n.likes) || 0)),
      baseLikes: Math.max(0, Math.floor(Number(n.likes) || 0)), // likes from before the app existed
      likedBy: [],
      createdAt: new Date().toISOString()
    })).filter((n) => n.content);
  } catch (err) {
    console.warn("Could not read seed-notes.json, starting with an empty tree:", err.message);
    return [];
  }
}

function readNotes() {
  try {
    return JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    const seeded = readSeedNotes(); // first run: plant the sample blessings
    writeNotes(seeded);
    return seeded;
  }
}

function writeNotes(notes) {
  const tmp = `${NOTES_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(notes, null, 2));
  fs.renameSync(tmp, NOTES_FILE);
}

// What the browser is allowed to see (likedBy is never exposed, only "likedByMe")
function toPublic(note, userId) {
  return {
    id: note.id,
    author: note.author,
    content: note.content,
    fruitType: note.fruitType,
    position: note.position,
    likes: note.likes || 0,
    likedByMe: Array.isArray(note.likedBy) && note.likedBy.includes(userId),
    createdAt: note.createdAt
  };
}

// ---------- Routes (mounted at /api/notes) ----------
const notesRouter = express.Router();
notesRouter.use(requireAuth);

// All blessings on the tree
notesRouter.get("/", (req, res) => {
  const notes = readNotes();
  res.json({ notes: notes.map((n) => toPublic(n, req.session.userId)) });
});

// One random blessing ("read a whisper")
notesRouter.get("/random", (req, res) => {
  const notes = readNotes();
  if (notes.length === 0) return fail(res, 404, "The tree has no blessings yet.");
  const pick = notes[Math.floor(Math.random() * notes.length)];
  res.json({ note: toPublic(pick, req.session.userId) });
});

// Hang a new blessing. The author is always the logged-in user (never taken from the request).
const lastPostAt = new Map();

notesRouter.post("/", (req, res) => {
  const userId = req.session.userId;

  const now = Date.now();
  if (now - (lastPostAt.get(userId) || 0) < MIN_POST_INTERVAL_MS) {
    return fail(res, 429, "Please wait a moment before hanging another blessing.");
  }

  // Remove control characters and trim
  const content = String(req.body?.content || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!content) return fail(res, 400, "Please write a message first.");
  if (content.length > MAX_CONTENT_LENGTH) {
    return fail(res, 400, `Messages can be at most ${MAX_CONTENT_LENGTH} characters.`);
  }

  const note = {
    id: `n-${now}-${Math.floor(Math.random() * 1e6)}`,
    seed: false,
    author: req.session.username,
    content,
    fruitType: FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)],
    position: { x: 15 + Math.random() * 70, y: 12 + Math.random() * 48 },
    likes: 0,
    baseLikes: 0,
    likedBy: [],
    createdAt: new Date(now).toISOString()
  };

  const notes = readNotes();
  notes.push(note);
  while (notes.length > MAX_NOTES) {
    const oldest = notes.findIndex((n) => !n.seed);
    if (oldest === -1) break;
    notes.splice(oldest, 1);
  }
  writeNotes(notes);
  lastPostAt.set(userId, now);

  res.status(201).json({ note: toPublic(note, userId) });
});

// Infuse Energy: toggle your "like" on a blessing (one per student; press again to take it back)
notesRouter.post("/:id/like", (req, res) => {
  const userId = req.session.userId;
  const id = String(req.params.id || "").slice(0, 80);

  const notes = readNotes();
  const note = notes.find((n) => n.id === id);
  if (!note) return fail(res, 404, "That blessing could not be found.");

  // Students cannot boost their own blessings
  if (String(note.author).toLowerCase() === userId) {
    return fail(res, 400, "You can't infuse energy into your own blessing.");
  }

  if (!Array.isArray(note.likedBy)) note.likedBy = [];
  // Older notes.json files have no baseLikes; derive it once
  if (typeof note.baseLikes !== "number") {
    note.baseLikes = Math.max(0, (note.likes || 0) - note.likedBy.length);
  }

  const at = note.likedBy.indexOf(userId);
  if (at === -1) note.likedBy.push(userId);
  else note.likedBy.splice(at, 1);
  note.likes = note.baseLikes + note.likedBy.length;

  writeNotes(notes);
  res.json({ note: toPublic(note, userId) });
});

module.exports = { notesRouter, readNotes, writeNotes, toPublic };
