// grove-ui.js

async function initGrove() {
  await GroveLogic.init();

  renderWelcome();
  renderGrove(GroveLogic.getState());
  await updateForestSummary();
}

function renderWelcome() {
  const el = document.getElementById("welcomeMessage");
  const name =
    window.groveUserName ||
    window.GROVE_USER_NAME ||
    "Friend of the Grove";

  el.textContent = `welcome) ${name}`;
}

function renderGrove(state) {
  const { starlightDew, notes } = state;

  document.getElementById("starlightDewValue").textContent = starlightDew;

  const list = document.getElementById("blessingsList");
  list.innerHTML = "";

  notes.forEach((note) => {
    const card = document.createElement("div");
    card.className = "grove-blessing-card";

    const text = document.createElement("div");
    text.className = "grove-blessing-text";
    text.textContent = note.text;

    const author = document.createElement("div");
    author.className = "grove-blessing-author";
    author.textContent = `By ${note.author}`;

    const likeRow = document.createElement("div");
    likeRow.className = "grove-like-row";

    const likeInfo = document.createElement("span");
    likeInfo.textContent = `Glow: ${note.likes}`;

    const likeBtn = document.createElement("button");
    likeBtn.className = "grove-button grove-like-button";
    likeBtn.textContent = note.likedByMe ? "Energy Infused 💖" : "Infuse Energy ✨";

    if (note.likedByMe) likeBtn.classList.add("liked");

    likeBtn.onclick = () => handleInfuseEnergy(note.id, likeBtn, likeInfo);

    likeRow.append(likeInfo, likeBtn);
    card.append(text, author, likeRow);
    list.appendChild(card);
  });
}

async function handleAddBlessing() {
  const text = document.getElementById("blessingText").value.trim();
  const author = document.getElementById("blessingAuthor").value.trim();

  if (!text) return;

  await GroveLogic.addNote(text, author || "Anonymous");
  GroveLogic.addDew(5);

  renderGrove(GroveLogic.getState());
  await updateForestSummary();

  document.getElementById("blessingText").value = "";
}

async function handleInfuseEnergy(id, btn, info) {
  const updated = await GroveLogic.infuseEnergy(id);

  info.textContent = `Glow: ${updated.likes}`;
  btn.textContent = updated.likedByMe ? "Energy Infused 💖" : "Infuse Energy ✨";

  btn.classList.toggle("liked", updated.likedByMe);

  renderGrove(GroveLogic.getState());
  await updateForestSummary();
}

async function updateForestSummary() {
  const { blessings, energyReceived } = await GroveLogic.getMyBlessingStats();

  document.getElementById("summaryBlessings").textContent = blessings;
  document.getElementById("summaryEnergy").textContent = energyReceived;
}

async function handleFileUpload() {
  const file = document.getElementById("fileInput").files[0];
  const status = document.getElementById("uploadStatus");
  const summary = document.getElementById("analysisSummary");
  const quiz = document.getElementById("quizContainer");

  if (!file) {
    status.textContent = "Choose a file first.";
    return;
  }

  status.textContent = "Summoning Gemini… 🌌";
  summary.textContent = "";
  quiz.innerHTML = "";

  try {
    const { result, usedFallback, error } = await GroveLogic.analyzeWithFallback(file);

    summary.textContent = result.analysis.summary;

    const list = document.createElement("ol");
    result.quiz.questions.forEach((q) => {
      const li = document.createElement("li");
      li.textContent = q.prompt;
      list.appendChild(li);
    });
    quiz.appendChild(list);

    status.textContent = usedFallback
      ? "Using sample questions (Gemini fallback)."
      : "Quiz generated successfully 🌱";

    if (error) status.textContent += ` | ${error}`;
  } catch (err) {
    status.textContent = err.message;
  }
}

window.addEventListener("DOMContentLoaded", initGrove);
