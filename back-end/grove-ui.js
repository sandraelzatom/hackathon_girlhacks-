/* ==========================================================
   grove-ui.js - connects the Grove UI (script.js) to the real backend (grove-api.js).

   Load order in index.html:
     config.js -> grove-api.js -> script.js -> grove-ui.js

   script.js keeps ALL the visuals, music and animations. This file only replaces the parts
   that used to fake the data in the browser (login, quiz, memory tree, stats) so that they
   use the server instead. Do not rename the replaced functions in script.js:
   boot, go, notes, and the click handlers of #loginForm, #logout, #gen, #next, #infuse,
   #hang and #polish.
   ========================================================== */
(() => {
  const G = window.GroveLogic;

  /* ---------- helpers ---------- */

  // POST JSON and never throw: returns { ok, status, data }
  const postJson = async (url, body) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { error: { message: 'Cannot reach the grove. Is the server running?' } } };
    }
  };

  // Show a message in the existing toast (no chime, unlike celebrate())
  const flash = (msg) => {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 4500);
  };

  // Server note ids are strings; the tree visuals need a number, so derive a stable one
  const hashId = (str) => {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  };

  /* ---------- stats (S is the stats object used by script.js) ---------- */

  const syncStats = () => {
    const st = G.getState();
    S = {
      dew: st.starlightDew,
      mast: st.conceptsMastered || 0,
      bless: st.blessingsHung || 0,
      ms: st.milestones || []
    };
  };

  const MILESTONES = [
    [100, 'dew', '✨ 100 Starlight Dew: the Dewdrop Seeker'],
    [300, 'dew', '🌙 300 Dew: the Moonlight Keeper'],
    [600, 'dew', '🔮 600 Dew: the Rune Weaver'],
    [1000, 'dew', '🌟 1000 Dew: the Grove Archmage'],
    [1500, 'dew', '👑 1500 Dew: Guardian of the Enchanted Forest'],
    [1, 'mast', '📜 First concept mastered!'],
    [3, 'mast', '🧠 3 concepts mastered: Apprentice Sage'],
    [5, 'mast', '🦉 5 concepts: Wise Owl'],
    [10, 'mast', '🐉 10 concepts: Dragon Scholar']
  ];

  const checkMilestones = () => {
    MILESTONES.forEach(([value, key, text]) => {
      if (S[key] >= value && G.markMilestone(key + value)) {
        setTimeout(() => celebrate('🎉 MILESTONE · ' + text, 40), 400);
      }
    });
  };

  // Call after anything that changes points or stats
  const refreshStats = () => {
    syncStats();
    upd();
    checkMilestones();
  };

  /* ---------- login / logout ---------- */

  // Returns the username. "New wanderers are registered automatically":
  // try to log in; if the account does not exist, create it.
  const authenticate = async (name, pass) => {
    const login = await postJson('/api/auth/login', { username: name, password: pass });
    if (login.ok) return login.data.user.username;
    if (login.status !== 401) throw new Error(login.data.error?.message || 'Could not enter the grove.');

    const signup = await postJson('/api/auth/register', { username: name, password: pass });
    if (signup.ok) return signup.data.user.username;
    if (signup.status === 409) throw new Error('Wrong secret rune. Try again.'); // name exists, password differs
    throw new Error(signup.data.error?.message || 'Could not enter the grove.');
  };

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    $('#err').textContent = '';
    const name = $('#name').value.trim().replace(/\s+/g, '_'); // usernames cannot contain spaces
    try {
      me = await authenticate(name, $('#pass').value);
      $('#pass').value = '';
      await boot();
    } catch (err) {
      $('#err').textContent = err.message;
    }
  };

  $('#logout').onclick = async () => {
    G.quiz.reset();
    try { await G.logout(null); } catch (err) { /* ignore */ }
    me = null;
    S = null;
    boot();
  };

  boot = async function () {
    const logged = !!me;
    $('#nav').classList.toggle('hidden', !logged);
    if (!logged) { go('login'); showLogin(); return; }

    await G.init(); // load this account's saved progress from the server
    syncStats();
    $('#user').textContent = '🧙 ' + me;
    $('#wish').maxLength = 280;
    $('#hang').textContent = `⭐ Hang My Wish on the Tree (${G.getBlessingCost()} ✨)`;
    upd();
    go('trials');
    refreshTree();
  };

  // Already logged in from an earlier visit? Offer "Continue as ..."
  G.getCurrentUser().then((user) => {
    if (user) { me = user.username; showLogin(); }
  });

  /* ---------- page changes ---------- */

  const showEnergy = async () => {
    try {
      const stats = await G.getMyBlessingStats();
      let el = $('#sEnergy');
      if (!el) {
        const card = document.createElement('div');
        card.innerHTML = '<b id="sEnergy">0</b>Energy Boosts';
        document.querySelector('#awaken .stats').append(card);
        el = $('#sEnergy');
      }
      el.textContent = stats.energyReceived;
    } catch (err) { /* the other stats still work */ }
  };

  const originalGo = go;
  go = function (id) {
    originalGo(id);
    if (!me) return;
    if (id === 'tree') refreshTree();   // pick up blessings other students added
    if (id === 'awaken') showEnergy();
  };

  /* ---------- Grove of Trials: quiz ---------- */

  const showSummaryLine = (text) => {
    let line = $('#sumLine');
    if (!line) {
      line = document.createElement('p');
      line.id = 'sumLine';
      line.className = 'sub';
      $('#quiz').append(line);
    }
    line.textContent = text;
  };

  const showQuestion = () => {
    const q = G.quiz.getCurrent();
    if (!q) return;

    $('#qn').textContent = q.phase === 'mist'
      ? `🌫 Mist Forest · ${q.mistRemaining} left`
      : `Trial ${q.number}/${q.total}`;
    $('#combo').textContent = q.streak > 1
      ? `🔥 Combo ${q.streak}` + (q.multiplier > 1 ? ` · next x${q.multiplier}` : '')
      : '';
    $('#q').textContent = q.question;
    $('#fb').textContent = '';
    $('#next').classList.add('hidden');

    const box = $('#opts');
    box.innerHTML = '';
    q.options.forEach((text, i) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.onclick = () => choose(i, b);
      box.append(b);
    });

    // "Leave the mist" lets players give up on the Mist Forest
    let skip = $('#skipMist');
    if (!skip) {
      skip = document.createElement('button');
      skip.id = 'skipMist';
      skip.className = 'ghost hidden';
      skip.textContent = 'Leave the mist';
      skip.onclick = () => { G.quiz.skipMist(); $('#next').onclick(); };
      $('#quiz').append(skip);
    }
    skip.classList.toggle('hidden', q.phase !== 'mist');
  };

  const choose = (i, button) => {
    let r;
    try {
      r = G.quiz.answer(i);
    } catch (err) {
      flash(err.message);
      return;
    }
    $$('#opts button').forEach((x) => (x.disabled = true));

    if (r.correct) {
      button.classList.add('ok');
      $('#fb').textContent = (r.phase === 'mist' ? '🌤 The mist lifts! ' : '✨ Light burst! ') +
        `+${r.pointsAwarded} Starlight Dew` + (r.multiplier > 1 ? ` (combo x${r.multiplier})` : '');
      burst(button);
    } else {
      button.classList.add('no');
      $$('#opts button')[r.correctIndex].classList.add('ok');
      $('#fb').textContent = (r.phase === 'mist' ? '🌫 The mist lingers: ' : '🌫 Into the Mist Forest: ') +
        (r.explanation || 'this trial will return.');
    }
    if (r.enteringMist) $('#fb').textContent += ' · Next: the Mist Forest, where missed trials return.';

    $('#next').textContent = r.finished ? 'Finish ➜' : 'Next ➜';
    $('#next').classList.remove('hidden');
    refreshStats();
  };

  $('#next').onclick = () => {
    if (G.quiz.getCurrent()) { showQuestion(); return; }

    // The session is over: back to the setup card and on to the Awakening page
    $('#quiz').classList.add('hidden');
    $('#setup').classList.remove('hidden');
    const skip = $('#skipMist');
    if (skip) skip.classList.add('hidden');
    const s = G.quiz.getSummary();
    if (s) flash(`📜 ${s.correctFirstTry}/${s.totalQuestions} on the first try · +${s.earned} Starlight Dew`);
    go('awaken');
  };

  // Shared by the "Conjure" button and the file picker
  const startQuiz = async (file, button) => {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Conjuring…';
    try {
      const { result, usedFallback } = await G.analyzeWithFallback(file);
      G.quiz.start(result);
      if (usedFallback) flash('The magic is faint tonight, so a sample scroll was used.');
      showSummaryLine('📜 ' + (result.analysis.summary || ''));
      $('#setup').classList.add('hidden');
      $('#quiz').classList.remove('hidden');
      showQuestion();
    } catch (err) {
      alert(err.message); // e.g. unsupported file type or file too large
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };

  $('#gen').onclick = () => {
    const text = $('#notes').value.trim();
    if (text.split(/\s+/).length < 8) { alert('Add a few more sentences of notes.'); return; }
    startQuiz(new File([text], 'notes.txt', { type: 'text/plain' }), $('#gen'));
  };

  // File upload (PDF, image or text) next to the paste box
  (() => {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.id = 'noteFile';
    picker.accept = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv';
    picker.className = 'hidden';
    picker.onchange = () => {
      const file = picker.files[0];
      if (file) startQuiz(file, $('#gen'));
      picker.value = '';
    };
    const upload = document.createElement('button');
    upload.className = 'ghost';
    upload.textContent = '📎 Upload a scroll (PDF, image, text)';
    upload.onclick = () => picker.click();
    const row = document.querySelector('#setup .row');
    row.append(upload, picker);
  })();

  /* ---------- Memory Tree ---------- */

  let treeNotes = [];

  // Convert a server blessing into the shape renderTree() in script.js expects
  const adapt = (n) => ({
    id: hashId(n.id),
    sid: n.id, // the real server id, used for likes
    author: n.author,
    content: n.content,
    likes: n.likes,
    likedByMe: n.likedByMe,
    x: n.position.x,
    y: n.position.y
  });

  notes = () => treeNotes; // renderTree() reads the blessings through this function

  const refreshTree = async (newServerId) => {
    try {
      treeNotes = (await G.loadBlessings()).map(adapt);
    } catch (err) {
      flash(err.message);
      return;
    }
    renderTree(newServerId ? hashId(newServerId) : undefined);
  };

  $('#infuse').onclick = async () => {
    if (!cur) return;
    try {
      const updated = await G.infuseEnergy(cur.sid);
      $('#modal').classList.add('hidden');
      if (updated.likedByMe) celebrate('💛 Your energy flows into the wish!', 8);
      refreshTree();
    } catch (err) {
      flash(err.message); // e.g. you cannot boost your own blessing
    }
  };

  $('#hang').onclick = async () => {
    const text = $('#wish').value.trim();
    if (!text) return;
    const button = $('#hang');
    button.disabled = true;
    try {
      const note = await G.hangBlessing(text); // costs Starlight Dew
      $('#wish').value = '';
      refreshStats();
      await refreshTree(note.id);
      celebrate('🌟 Your wish now shines on the Banyan!', 12);
    } catch (err) {
      flash(err.message); // e.g. not enough Starlight Dew
    } finally {
      button.disabled = false;
    }
  };

  $('#polish').onclick = async () => {
    const text = $('#wish').value.trim();
    if (!text) return;
    const button = $('#polish');
    const label = button.textContent;
    button.disabled = true;
    button.textContent = '🪄 Casting…';
    try {
      const magic = await G.enchantWish(text);
      $('#wish').value = magic.paraphrase;
      if (magic.prose) flash('🧚 ' + magic.prose);
    } catch (err) {
      flash(err.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };
})();
