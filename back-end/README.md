# 🌳 Enchanted Grove

> *Welcome to the Grove of Trials. Nourish the forest with knowledge, and illuminate each other with warmth.*

Enchanted Grove is a study companion set in an enchanted forest. Upload your course notes, let AI turn them into quizzes, earn Starlight Dew for every right answer, and spend it to leave words of encouragement on a glowing Memory Tree that other students can read.

<!-- 【需要你填写】如果有演示视频或截图，把链接或图片放在这里 -->
<!-- ![Screenshot](docs/screenshot.png) -->

## Features

### 1. Immersive entrance
Deep emerald and twilight backdrop, floating bioluminescent firefly particles, and optional ambient forest sounds.

### 2. The Grove of Trials (AI quiz and gamification)
- **AI knowledge extraction:** upload course notes or PDFs, and Gemini turns the key concepts into multiple-choice questions plus a short summary.
- **Interactive gameplay:** parchment and glowing-rune UI. Correct answers trigger light-burst animations and award **Starlight Dew** (points).
- **Streaks and the Mist Forest:** consecutive correct answers build a combo multiplier, and missed questions are routed to the Mist Forest for targeted re-testing.

### 3. The Memory Tree (community and encouragement)
- **Read a whisper:** click a glowing fruit to read an encouraging message left by another student, and "Infuse Energy" to make it shine brighter.
- **Hang a blessing:** spend a little Starlight Dew to hang your own message on the tree.
- **Polish with Magic:** an AI button rewrites a plain message into fantasy-style poetic prose.

### 4. Forest awakening
Your total points, concepts mastered, and energy boosts received are shown in a summary. As points grow, the fog retreats and the forest becomes brighter.

### 5. Accounts
Log in with your own account so your progress follows you across browsers and devices.

## Current status

<!-- 【需要你填写】按实际进度更新下面的表格（Done / In progress / Planned） -->

| Area | Status |
|---|---|
| Accounts, login, and per-user progress saving | Done |
| Gemini proxy (API key stays on the server) | Done |
| AI summary and multiple-choice quiz from an uploaded file | Done |
| Starlight Dew points | Done |
| Shared Memory Tree (every student's blessings, seeded with sample notes) | Done |
| Infuse Energy (likes) | Backend done; UI in progress |
| Polish with Magic (AI message enchantment) | Backend done; UI in progress |
| Combo multiplier and Mist Forest re-testing | Logic done; UI in progress |
| Animations, fireflies, and ambient sound | Done (UI) |
| UI connected to the backend (login, quiz, tree, stats) | Done |

## Tech stack

- **Front end:** HTML, CSS, JavaScript <!-- 【需要你改】如果用了 Framer Motion、Tailwind 等，请在这里补充 -->
- **Back end:** Node.js + Express
- **AI:** Google Gemini API (called from the server, so the key is never exposed to the browser)
- **Auth:** `express-session` (httpOnly cookies) + `bcryptjs` password hashing
- **Storage:** local `users.json` file (accounts and per-user progress)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) **20.6 or newer** (check with `node -v`)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 1. Install dependencies

```bash
npm install
```

### 2. Create your `.env` file

Create a file named `.env` in the project root (it is git-ignored, so your key stays private):

```bash
cat > .env << EOF
GEMINI_API_KEY=paste_your_key_here
GEMINI_MODEL=gemini-3.8-flash
PORT=3000
SESSION_SECRET=$(openssl rand -hex 32)
EOF
```

Then open `.env` and replace `paste_your_key_here` with your real key (no quotes, no spaces).

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Your Gemini API key |
| `GEMINI_MODEL` | No | Model name. If you get a 404 error, the model name is outdated; check the [model list](https://ai.google.dev/gemini-api/docs/models) |
| `PORT` | No | Server port (default `3000`) |
| `SESSION_SECRET` | Recommended | Random string used to sign login cookies. Without it, everyone is logged out whenever the server restarts |

### 3. Create `config.js`

`config.js` is git-ignored, so create it locally:

```bash
cat > config.js << 'EOF'
window.APP_CONFIG = {
  geminiApiKey: "",
  model: "gemini-3.8-flash",
  proxyUrl: "/api/gemini"
};
EOF
```

The API key stays empty on purpose: requests go through the server proxy, which adds the key.

### 4. Start the server

```bash
npm start
```

Open **http://localhost:3000** in your browser. The Grove's entrance has its own login: enter a wanderer name and a secret rune (password). New wanderers are registered automatically; returning ones are logged in. Names use letters, numbers, or underscores (3-20 characters, spaces become underscores) and the password needs at least 8 characters.

> ⚠️ Always open the app through `http://localhost:3000`. Double-clicking an HTML file will not work, because login and Gemini both need the server.

## Project structure

```
.
├── index.html        # The Grove UI (entrance, quiz, Memory Tree, music, awakening)
├── style.css         # Styles and animations
├── script.js         # UI visuals, music, and animations (owned by the UI teammate)
├── grove-ui.js       # Connects the UI to the backend: login, quiz, tree, stats
├── login.html        # Simple stand-alone login page (fallback)
├── test.html         # Developer test page for login, progress, quiz, and blessings
├── grove-api.js      # Front-end logic: state, progress sync, Gemini calls (window.GroveLogic)
├── server.js         # Express server: static files, auth routes, Gemini proxy
├── auth.js           # Login, sessions, and per-user progress routes
├── notes.js          # Shared Memory Tree routes (blessings)
├── enchant.js        # Polish with Magic: AI rewrites messages as fantasy prose
├── seed-notes.json   # Sample blessings planted on the tree on first run
├── package.json
├── config.js         # Local front-end config (git-ignored)
├── .env              # Secrets (git-ignored)
├── users.json        # Accounts and progress, created automatically (git-ignored)
└── notes.json        # Shared blessings, created automatically (git-ignored)
```

<!-- 【需要你填写】如果同事新增了文件（例如 blessings.js、blessings.css、图片），请在上面的结构里补充 -->

## Front-end API (`window.GroveLogic`)

Load `config.js` before `grove-api.js`:

```html
<script src="config.js"></script>
<script src="grove-api.js"></script>
```

On page load, call `init()` before rendering:

```js
await GroveLogic.init();
renderGrove(GroveLogic.getState());
```

| Method | Description |
|---|---|
| `init()` | Loads the logged-in user's saved progress. Redirects to the login page if not logged in. Call it once before rendering |
| `getState()` | Returns `{ starlightDew, notes }`. Use `starlightDew` for the points display; for the Memory Tree use `loadBlessings()` instead of `notes` |
| `addDew(amount)` | Adds points and saves them. Returns the new total |
| `addNote(text, author?)` | **Deprecated.** Local-only note, private to the account. Use `hangBlessing()` |
| `resetState()` | Resets progress to the defaults |
| `analyzeWithFallback(file)` | Analyzes a file with Gemini. Returns `{ result, usedFallback, error? }` and falls back to sample questions if Gemini or the network fails. It **throws** for problems the user can fix: unsupported file type, file over 15 MB, or not logged in. Supported files: PDF, PNG, JPG, WEBP, and text (`.txt`, `.md`, `.csv`) |
| `analyzeFileAndGenerateQuiz(file)` | Same as above, but throws on error instead of falling back |
| `getFallbackQuiz()` | Returns the built-in sample quiz |
| `getCurrentUser()` | Returns `{ username }` or `null` |
| `logout(redirectTo?)` | Saves progress and logs out, then goes to `/login.html`. Pass `null` to stay on the current page |
| `markMilestone(key)` | Remembers a celebrated milestone (saved with the account). Returns `true` the first time, `false` if already recorded |

Progress is saved to the server automatically after `addDew` and `hangBlessing`; no extra save call is needed.

### How the UI is wired

`script.js` holds all visuals and sound. `grove-ui.js` loads after it and replaces only the parts that touch data (login, quiz, Memory Tree, and stats) with calls to `GroveLogic`. Script order in `index.html`:

```html
<script src="config.js"></script>
<script src="grove-api.js"></script>
<script src="script.js"></script>
<script src="grove-ui.js"></script>
```

If you rename `boot`, `go`, `notes`, or the click handlers of `#loginForm`, `#logout`, `#gen`, `#next`, `#infuse`, `#hang`, and `#polish` in `script.js`, update `grove-ui.js` to match. Everything else in `script.js` can be changed freely.

Progress saved per account: Starlight Dew, concepts mastered, blessings hung, and celebrated milestones.

### Quiz session (combo and Mist Forest)

Pass the `result` from `analyzeWithFallback()` to `GroveLogic.quiz.start()`. Dew is awarded automatically.

| Method | Description |
|---|---|
| `quiz.start(result)` | Starts a session and returns the first question |
| `quiz.getCurrent()` | The question to show now, or `null` when finished. Fields: `id`, `question`, `options`, `phase` (`"main"` or `"mist"`), `number`, `total`, `streak`, `multiplier`, `pointsIfCorrect`, `mistRemaining`. The correct answer is not included |
| `quiz.answer(optionIndex)` | Submits an answer. Returns `{ correct, correctIndex, pointsAwarded, multiplier, streak, bestStreak, dewTotal, phase, enteringMist, finished, mistRemaining }` |
| `quiz.skipMist()` | Gives up on the remaining Mist Forest questions and finishes the session |
| `quiz.getSummary()` | `{ totalQuestions, correctFirstTry, accuracy, conceptsMastered, bestStreak, mistCleared, earned, finished }` |
| `quiz.reset()` | Discards the current session |

How it works:

- **Round 1:** every question once, in random order with shuffled options. Consecutive correct answers build a combo: x1.5 from a streak of 3, x2 from a streak of 5. A wrong answer resets the streak and sends the question to the Mist Forest.
- **Round 2 (Mist Forest):** missed questions return with reshuffled options until each is answered correctly. No combo here, and points are halved.
- Tune the numbers with `COMBO_TIERS`, `MIST_POINTS_RATIO`, and `HANG_BLESSING_COST` at the top of `grove-api.js`.

```js
let q = GroveLogic.quiz.start(result);
while (q) {
  const r = GroveLogic.quiz.answer(chosenIndex); // chosenIndex comes from the UI
  if (r.enteringMist) showMistForestIntro();
  q = GroveLogic.quiz.getCurrent();
}
showSummary(GroveLogic.quiz.getSummary());
```

### Memory Tree (shared blessings)

| Method | Description |
|---|---|
| `loadBlessings()` | All blessings on the tree: `[{ id, author, content, fruitType, position, likes, likedByMe, createdAt }]`. `fruitType` is `gold`, `blue`, or `green`; `position.x` and `position.y` are percentages |
| `getRandomBlessing()` | One random blessing ("read a whisper") |
| `hangBlessing(text)` | Hangs your own blessing (max 280 characters). Costs Starlight Dew and throws a readable error if you cannot afford it. The author is always the logged-in user |
| `getBlessingCost()` | The cost in Starlight Dew |
| `infuseEnergy(noteId)` | Likes a blessing (call again to take the like back). Returns the updated blessing with the new `likes` and `likedByMe`. You cannot like your own blessing |
| `getMyBlessingStats()` | `{ blessings, energyReceived }`: how many blessings you hung and how many likes they received (for the forest summary) |
| `enchantWish(text, discipline?)` | "Polish with Magic". Rewrites a message as fantasy-style prose. Returns `{ paraphrase, prose, runeType? }`. `runeType` is one of `wisdom`, `courage`, `rest`, `hope`, `focus` and may be missing. Pass `paraphrase` to `hangBlessing()` if the user accepts it |


Example:

```js
const { result, usedFallback } = await GroveLogic.analyzeWithFallback(file);
console.log(result.analysis.summary);
result.quiz.questions.forEach((q) => console.log(q.question, q.options, q.answerIndex));
```

> When rendering user-written text such as blessings, use `textContent`, not `innerHTML`, to prevent script injection.

## Server endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create an account and log in |
| POST | `/api/auth/login` | No | Log in |
| POST | `/api/auth/logout` | No | Log out |
| GET | `/api/auth/me` | Yes | Current user |
| GET | `/api/state` | Yes | Load the user's progress |
| PUT | `/api/state` | Yes | Save the user's progress |
| GET | `/api/notes` | Yes | All blessings on the Memory Tree |
| GET | `/api/notes/random` | Yes | One random blessing |
| POST | `/api/notes` | Yes | Hang a blessing (author is taken from the session) |
| POST | `/api/notes/:id/like` | Yes | Infuse Energy: toggle your like on a blessing |
| POST | `/api/enchant` | Yes | Polish with Magic: body `{ wish, discipline? }`, returns `{ paraphrase, prose, runeType? }` |
| POST | `/api/gemini` | Yes | Gemini proxy (the key never leaves the server) |
| GET | `/health` | No | Server status |

### Adding new front-end files

The server only serves files listed in the `PUBLIC_FILES` array in `server.js`. If you add a new CSS, JS, image, or font file, add its name to that array and restart the server, otherwise the browser gets a 404.

## Security notes

- The Gemini API key lives only in `.env` on the server. It is never sent to the browser or committed to git.
- Passwords are hashed with bcrypt. Sessions use httpOnly, SameSite cookies.
- `/api/gemini` requires login, so strangers cannot use your key.
- Login attempts are rate limited per IP.
- `.env`, `config.js`, `users.json`, and `notes.json` are listed in `.gitignore`. Never commit them.
- This is a hackathon prototype: accounts are stored in a local JSON file and sessions live in server memory (restarting the server logs everyone out). For production, use a real database and session store, and serve over HTTPS.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm: command not found` | Install Node.js from [nodejs.org](https://nodejs.org), then open a new terminal |
| `Cannot find module ...` | Run `npm install` |
| `Missing GEMINI_API_KEY` | Create the `.env` file (step 2) and restart the server |
| Gemini error `404` about the model | The model name is outdated. Update `GEMINI_MODEL` in `.env` and `model` in `config.js`, then restart |
| Gemini error `403` or `400` | The API key is invalid or restricted. Check it in Google AI Studio |
| Gemini error `429` | Quota reached. Wait a moment and try again |
| "Please log in first." | Your session expired. Log in again |
| Login shows "Server error" | Restart the server (`Ctrl + C`, then `npm start`) and check the terminal for errors |
| Page loads without styles or scripts | The file is not in `PUBLIC_FILES` in `server.js`, or you opened the HTML file directly instead of using `http://localhost:3000` |
| Changes to server files have no effect | Node does not hot-reload. Restart the server |

## Demo tips

- Create a demo account beforehand and test the full flow: sign up, upload, quiz, points, refresh, log out, and log back in.
- Use small files (a one-page PDF or image) so Gemini responds quickly.
- Keep the terminal running `npm start` open, and keep the laptop plugged in with sleep disabled.

## Team

| Member | Role | Focus |
|---|---|---|
| **Hannah** | Data, API and state | Repository setup, Gemini API calls, state management (points, combo, quiz questions), and note storage |
| **Peer 2** <!-- 【需要你填写】换成真实名字 --> | Interface and animation | Memory Tree screen, glowing fruit components, modals, quiz card layout, firefly background, and sound controls |
| **Samiyah H** | AI prompting, content and pitch | Gemini quiz prompts (strict JSON), the poetic-prose prompt, seeding the Memory Tree with sample notes, demo content, slides, and presentation |

## License

<!-- 【需要你填写】例如 MIT；不需要的话可以删掉这一节 -->
