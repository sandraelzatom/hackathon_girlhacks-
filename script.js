// ---------- Firefly Background ----------
const canvas = document.getElementById("fireflyCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const fireflies = Array.from({ length: 40 }).map(() => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 2 + 1,
  dx: (Math.random() - 0.5) * 0.4,
  dy: (Math.random() - 0.5) * 0.4,
}));

function animateFireflies() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fireflies.forEach((f) => {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,200,0.8)";
    ctx.fill();

    f.x += f.dx;
    f.y += f.dy;

    if (f.x < 0) f.x = canvas.width;
    if (f.x > canvas.width) f.x = 0;
    if (f.y < 0) f.y = canvas.height;
    if (f.y > canvas.height) f.y = 0;
  });
  requestAnimationFrame(animateFireflies);
}
animateFireflies();

// ---------- Quiz System ----------
const quizData = {
  courseTitle: "Introductory Psychology - Chapter 4",
  totalQuestions: 3,
  questions: [
    {
      id: "q-101",
      question:
        "Which brain structure acts as the primary relay station for sensory information?",
      options: ["Hippocampus", "Thalamus", "Amygdala", "Cerebellum"],
      answerIndex: 1,
      explanation:
        "The thalamus routes sensory signals (except smell) to the appropriate areas of the cerebral cortex.",
      pointsAwarded: 100,
    },
    {
      id: "q-102",
      question:
        "True or False: Neuroplasticity only occurs during early childhood development.",
      options: ["True", "False"],
      answerIndex: 1,
      explanation:
        "Neuroplasticity continues throughout adulthood, allowing the brain to reorganize in response to learning.",
      pointsAwarded: 100,
    },
    {
      id: "q-103",
      question:
        "Which lobe of the brain is primarily responsible for visual processing?",
      options: ["Frontal", "Parietal", "Occipital", "Temporal"],
      answerIndex: 2,
      explanation:
        "The occipital lobe is mainly responsible for visual processing.",
      pointsAwarded: 100,
    },
  ],
};

let currentQuestionIndex = 0;
let starlightDew = 0;

const quizContainer = document.getElementById("quizContainer");
const quizScore = document.getElementById("quizScore");

function renderQuestion() {
  const q = quizData.questions[currentQuestionIndex];
  if (!q) {
    quizContainer.innerHTML =
      "<p>You have completed the Grove of Trials. The forest remembers your light.</p>";
    return;
  }

  let html = `<h3>${q.question}</h3>`;
  q.options.forEach((opt, i) => {
    html += `<button data-index="${i}">${opt}</button>`;
  });

  quizContainer.innerHTML = html;

  Array.from(quizContainer.querySelectorAll("button")).forEach((btn) => {
    btn.addEventListener("click", () => {
      const chosenIndex = Number(btn.getAttribute("data-index"));
      const isCorrect = chosenIndex === q.answerIndex;

      if (isCorrect) {
        starlightDew += q.pointsAwarded;
        quizScore.textContent = `Starlight Dew: ${starlightDew}`;
        btn.style.background = "rgba(80, 200, 120, 0.9)";
      } else {
        btn.style.background = "rgba(180, 60, 60, 0.9)";
      }

      setTimeout(() => {
        currentQuestionIndex++;
        renderQuestion();
      }, 700);
    });
  });
}

renderQuestion();

// ---------- Memory Tree ----------
const fruitContainer = document.getElementById("fruitContainer");
const noteInput = document.getElementById("noteInput");
const addNoteBtn = document.getElementById("addNoteBtn");
const noteModal = document.getElementById("noteModal");
const modalText = document.getElementById("modalText");
const closeModalBtn = document.getElementById("closeModalBtn");

let notes = [
  {
    id: "note-001",
    author: "Moonlit Badger",
    content:
      "Your hard work tonight will blossom into clarity tomorrow. Keep going!",
    fruitType: "blue",
    position: { x: 28, y: 38 },
  },
  {
    id: "note-002",
    author: "Starfall Fox",
    content:
      "Remember to breathe. You are far more prepared than your anxiety tells you.",
    fruitType: "gold",
    position: { x: 62, y: 45 },
  },
];

function renderFruits() {
  fruitContainer.innerHTML = "";
  notes.forEach((note) => {
    const fruit = document.createElement("div");
    fruit.className = `fruit ${note.fruitType}`;
    fruit.style.left = `${note.position.x}%`;
    fruit.style.top = `${note.position.y}%`;

    fruit.addEventListener("click", () => {
      modalText.textContent = `${note.content} — ${note.author}`;
      noteModal.classList.remove("hidden");
    });

    fruitContainer.appendChild(fruit);
  });
}

renderFruits();

addNoteBtn.addEventListener("click", () => {
  const text = noteInput.value.trim();
  if (!text) return;

  const newNote = {
    id: `note-${Date.now()}`,
    author: "Anonymous Owl",
    content: text,
    fruitType: "green",
    position: {
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 50,
    },
  };

  notes.push(newNote);
  renderFruits();
  noteInput.value = "";
});

closeModalBtn.addEventListener("click", () => {
  noteModal.classList.add("hidden");
});
