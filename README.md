🌳 Enchanted Grove

Welcome to the Grove of Trials. Nourish the forest with knowledge, and illuminate each other with warmth.

Enchanted Grove is a study companion set in an enchanted forest. Upload your course notes, let AI turn them into quizzes, earn Starlight Dew for every right answer, and spend it to leave words of encouragement on a glowing Memory Tree that other students can read.

![alt text](<Screenshot 2026-10-03 at 8.36.55 PM.png>)
Features
1. Immersive entrance

Deep emerald and twilight backdrop, floating bioluminescent firefly particles, and optional ambient forest sounds.

2. The Grove of Trials (AI quiz and gamification)
AI knowledge extraction: upload course notes or PDFs, and Gemini turns the key concepts into multiple-choice questions plus a short summary.
Interactive gameplay: parchment and glowing-rune UI. Correct answers trigger light-burst animations and award Starlight Dew (points).
Streaks and the Mist Forest: consecutive correct answers build a combo multiplier, and missed questions are routed to the Mist Forest for targeted re-testing.
3. The Memory Tree (community and encouragement)
Read a whisper: click a glowing fruit to read an encouraging message left by another student, and "Infuse Energy" to make it shine brighter.
Hang a blessing: spend a little Starlight Dew to hang your own message on the tree.
Polish with Magic: an AI button rewrites a plain message into fantasy-style poetic prose.
4. Forest awakening

Your total points, concepts mastered, and energy boosts received are shown in a summary. As points grow, the fog retreats and the forest becomes brighter.

5. Accounts

Log in with your own account so your progress follows you across browsers and devices.

Current status
<!-- 【需要你填写】按实际进度更新下面的表格（Done / In progress / Planned） -->
Area	Status
Accounts, login, and per-user progress saving	Done
Gemini proxy (API key stays on the server)	Done
AI summary and multiple-choice quiz from an uploaded file	Done
Starlight Dew points and blessing storage	Done
Shared Memory Tree visible to all students	Planned (notes are currently private to each account)
Infuse Energy (likes)	Planned
Polish with Magic (AI message enchantment)	Planned
Combo multiplier and Mist Forest re-testing	In progress (front end)
Animations, fireflies, and ambient sound	In progress (front end)
Tech stack
Front end: HTML, CSS, JavaScript <!-- 【需要你改】如果用了 Framer Motion、Tailwind 等，请在这里补充 -->
Back end: Node.js + Express
AI: Google Gemini API (called from the server, so the key is never exposed to the browser)
Auth: express-session (httpOnly cookies) + bcryptjs password hashing
Storage: local users.json file (accounts and per-user progress)
Getting started
Prerequisites
Node.js 20.6 or newer (check with node -v)
A Gemini API key from Google AI Studio
1. Install dependencies
bash
npm install
2. Create your .env file

Create a file named .env in the project root (it is git-ignored, so your key stays private):

bash
cat > .env << EOF
GEMINI_API_KEY=paste_your_key_here
GEMINI_MODEL=gemini-3.8-flash
PORT=3000
SESSION_SECRET=$(openssl rand -hex 32)
EOF

Then open .env and replace paste_your_key_here with your real key (no quotes, no spaces).

Variable	Required	Description
GEMINI_API_KEY	Yes	Your Gemini API key
GEMINI_MODEL	No	Model name. If you get a 404 error, the model name is outdated; check the model list
PORT	No	Server port (default 3000)
SESSION_SECRET	Recommended	Random string used to sign login cookies. Without it, everyone is logged out whenever the server restarts
3. Create config.js

config.js is git-ignored, so create it locally:

bash
cat > config.js << 'EOF'
window.APP_CONFIG = {
  geminiApiKey: "",
  model: "gemini-3.8-flash",
  proxyUrl: "/api/gemini"
};
EOF

The API key stays empty on purpose: requests go through the server proxy, which adds the key.

4. Start the server
bash
npm start

Open http://localhost:3000 in your browser. You will be redirected to the login page; click Sign up to create an account (username 3-20 characters, password at least 8).

⚠️ Always open the app through http://localhost:3000. Double-clicking an HTML file will not work, because login and Gemini both need the server.

Project structure
.
├── index.html        # Main app page (requires login)
├── login.html        # Log in / sign up page
├── test.html         # Developer test page for login, progress, and Gemini
├── style.css         # Styles
├── logic.js          # Front-end logic: state, progress sync, Gemini calls (window.GroveLogic)
├── server.js         # Express server: static files, auth routes, Gemini proxy
├── auth.js           # Login, sessions, and per-user progress routes
├── package.json
├── config.js         # Local front-end config (git-ignored)
├── .env              # Secrets (git-ignored)
└── users.json        # Accounts and progress, created automatically (git-ignored)
<!-- 【需要你填写】如果同事新增了文件（例如 blessings.js、blessings.css、图片），请在上面的结构里补充 -->
Front-end API (window.GroveLogic)

Load config.js before logic.js:

html
<script src="config.js"></script>
<script src="logic.js"></script>

On page load, call init() before rendering:

js
await GroveLogic.init();
renderGrove(GroveLogic.getState());
Method	Description
init()	Loads the logged-in user's saved progress. Redirects to the login page if not logged in. Call it once before rendering
getState()	Returns { starlightDew, notes }. Each note has id, author, content, fruitType (gold / blue / green), and position (x, y as percentages)
addDew(amount)	Adds points and saves them. Returns the new total
addNote(text, author?)	Adds a blessing to the tree. Returns the new note
resetState()	Resets progress to the defaults
analyzeWithFallback(file)	Analyzes a file with Gemini. Returns { result, usedFallback, error? } and falls back to sample questions if Gemini fails
analyzeFileAndGenerateQuiz(file)	Same as above, but throws on error instead of falling back
getFallbackQuiz()	Returns the built-in sample quiz
getCurrentUser()	Returns { username } or null
logout()	Saves progress, logs out, and goes to the login page

Progress is saved to the server automatically after addDew and addNote; no extra save call is needed.

Example:

js
const { result, usedFallback } = await GroveLogic.analyzeWithFallback(file);
console.log(result.analysis.summary);
result.quiz.questions.forEach((q) => console.log(q.question, q.options, q.answerIndex));

When rendering user-written text such as blessings, use textContent, not innerHTML, to prevent script injection.

Server endpoints
Method	Path	Auth	Description
POST	/api/auth/register	No	Create an account and log in
POST	/api/auth/login	No	Log in
POST	/api/auth/logout	No	Log out
GET	/api/auth/me	Yes	Current user
GET	/api/state	Yes	Load the user's progress
PUT	/api/state	Yes	Save the user's progress
POST	/api/gemini	Yes	Gemini proxy (the key never leaves the server)
GET	/health	No	Server status
Adding new front-end files

The server only serves files listed in the PUBLIC_FILES array in server.js. If you add a new CSS, JS, image, or font file, add its name to that array and restart the server, otherwise the browser gets a 404.

Security notes
The Gemini API key lives only in .env on the server. It is never sent to the browser or committed to git.
Passwords are hashed with bcrypt. Sessions use httpOnly, SameSite cookies.
/api/gemini requires login, so strangers cannot use your key.
Login attempts are rate limited per IP.
.env, config.js, and users.json are listed in .gitignore. Never commit them.
This is a hackathon prototype: accounts are stored in a local JSON file and sessions live in server memory (restarting the server logs everyone out). For production, use a real database and session store, and serve over HTTPS.
Troubleshooting
Problem	Fix
npm: command not found	Install Node.js from nodejs.org, then open a new terminal
Cannot find module ...	Run npm install
Missing GEMINI_API_KEY	Create the .env file (step 2) and restart the server
Gemini error 404 about the model	The model name is outdated. Update GEMINI_MODEL in .env and model in config.js, then restart
Gemini error 403 or 400	The API key is invalid or restricted. Check it in Google AI Studio
Gemini error 429	Quota reached. Wait a moment and try again
"Please log in first."	Your session expired. Log in again
Login shows "Server error"	Restart the server (Ctrl + C, then npm start) and check the terminal for errors
Page loads without styles or scripts	The file is not in PUBLIC_FILES in server.js, or you opened the HTML file directly instead of using http://localhost:3000
Changes to server files have no effect	Node does not hot-reload. Restart the server
Demo tips
Create a demo account beforehand and test the full flow: sign up, upload, quiz, points, refresh, log out, and log back in.
Use small files (a one-page PDF or image) so Gemini responds quickly.
Keep the terminal running npm start open, and keep the laptop plugged in with sleep disabled.
Team
Member	Role	Focus
Zihan Liu:	Data, API and state	Repository setup, Gemini API calls, state management (points, combo, quiz questions), and note storage
Sandra Thomas:	Interface and animation	Memory Tree screen, glowing fruit components, modals, quiz card layout, firefly background, and sound controls
Samiyah Harrison:	AI prompting, content and pitch	Gemini quiz prompts (strict JSON), the poetic-prose prompt, seeding the Memory Tree with sample notes, demo content, slides, and presentation
License