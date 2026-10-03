// ==========================================
// 1. STATE & STORAGE MANAGEMENT 
// ==========================================
const STORAGE_KEY = "enchanted_grove_state_v3";

const defaultData = {
  starlightDew: 0,
  notes: [
    { id: "n1", author: "Moonlit Badger", content: "Hard work today blooms into clarity tomorrow.", fruitType: "blue", position: { x: 30, y: 35 } },
    { id: "n2", author: "Starfall Fox", content: "Breathe. You are prepared.", fruitType: "gold", position: { x: 65, y: 40 } }
  ]
};

//
let appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// auxiliary function: transform file to Base64 format(Gemini needs)
function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve({
      inlineData: {
        data: reader.result.split(',')[1],
        mimeType: file.type
      }
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 2. EXPOSED LOGIC API 
// ==========================================
window.GroveLogic = {
  /**
   * Retrieve the current globally saved local state
   */
  getState: () => appState,

  /**
   * increase Starlight Dew points
   * @param {number} amount 
   */
  addDew: (amount) => {
    appState.starlightDew += amount;
    saveState();
    return appState.starlightDew;
  },

  /**
   * Add the blessing fruit to the tree
   * @param {string} text 
   * @param {string} author 
   */
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

  /**
   * Core function: Gemini multimodal API parses files and generates analysis and questions
   * @param {File} file uploaded by users (PDF, PNG, JPG, TXT)
   * @param {string} apiKey Gemini API Key
   */
  analyzeFileAndGenerateQuiz: async (file, apiKey) => {
    if (!apiKey) throw new Error("API Key is missing!");
    if (!file) throw new Error("No file selected!");

    const filePart = await fileToGenerativePart(file);
    const promptText = `
      Analyze this attached study material and perform two tasks:
      1. Provide a brief 2-sentence summary of key insights.
      2. Generate 3 multiple-choice quiz questions based directly on the file.

      Respond STRICTLY with a JSON object matching this schema without markdown codeblocks:
      {
        "analysis": { "summary": "2-sentence summary here..." },
        "quiz": {
          "courseTitle": "Custom File Trial",
          "questions": [
            { "id": "q1", "question": "Question text", "options": ["A","B","C","D"], "answerIndex": 0, "pointsAwarded": 100 }
          ]
        }
      }
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [filePart, { text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    return JSON.parse(resultText); // return to UI { analysis, quiz }
  },

  /**
   * (Fallback Mock)
   */
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