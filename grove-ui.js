/* grove-ui.js - Enchanted Grove: fireflies, welcome message, animated logout */
(function () {
  "use strict";
  var NAME_KEY = "groveUserName", WELCOMED = "groveWelcomed";

  var css = `
  .gu-canvas{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
  .gu-banner{position:fixed;top:18px;left:50%;transform:translate(-50%,-160%);z-index:9999;
    padding:14px 30px;border-radius:999px;color:#f4ffe8;font:600 1.2rem Georgia,serif;
    background:linear-gradient(135deg,rgba(20,70,45,.95),rgba(70,35,100,.95));
    border:1px solid rgba(190,255,170,.55);box-shadow:0 0 34px rgba(140,255,160,.5);
    transition:transform .9s cubic-bezier(.2,1.3,.3,1),opacity .8s;opacity:0;white-space:nowrap}
  .gu-banner.show{transform:translate(-50%,0);opacity:1}
  .gu-logout{position:fixed;top:18px;right:18px;z-index:9998;cursor:pointer;padding:10px 18px;
    border-radius:999px;border:1px solid rgba(200,255,180,.5);color:#eaffd9;
    font:600 .95rem Georgia,serif;background:rgba(15,45,30,.75);backdrop-filter:blur(6px);
    transition:transform .25s,box-shadow .25s}
  .gu-logout:hover{transform:translateY(-2px) scale(1.05);box-shadow:0 0 22px rgba(160,255,170,.7)}
  .gu-farewell{position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;
    align-items:center;justify-content:center;text-align:center;padding:20px;color:#eaffd9;
    font-family:Georgia,serif;background:radial-gradient(circle at 50% 40%,#215a3f,#06120c 75%);
    opacity:0;pointer-events:none;transition:opacity 1.1s}
  .gu-farewell.on{opacity:1;pointer-events:all}
  .gu-farewell h2{font-size:2rem;margin:0 0 10px;text-shadow:0 0 22px #9dffb0;
    animation:gu-float 3s ease-in-out infinite}
  .gu-farewell p{opacity:.85;margin:0}
  @keyframes gu-float{50%{transform:translateY(-8px)}}
  .grove-card{background:rgba(12,40,28,.72);backdrop-filter:blur(10px);border-radius:20px;
    border:1px solid rgba(190,255,170,.4);box-shadow:0 0 40px rgba(120,255,160,.25);color:#eaffd9}
  @media(max-width:600px){.gu-banner{top:68px;font-size:1rem;padding:12px 20px}}
  @media(prefers-reduced-motion:reduce){.gu-farewell h2{animation:none}}`;

  function injectCss() {
    if (document.getElementById("gu-style")) return;
    var s = document.createElement("style");
    s.id = "gu-style"; s.textContent = css; document.head.appendChild(s);
  }

  /* ---------- Fireflies background ---------- */
  function fireflies() {
    injectCss();
    if (document.querySelector(".gu-canvas")) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var c = document.createElement("canvas"); c.className = "gu-canvas";
    document.body.insertBefore(c, document.body.firstChild);
    var x = c.getContext("2d"), W, H, P = [];
    function size() { W = c.width = innerWidth; H = c.height = innerHeight; }
    size(); addEventListener("resize", size);
    for (var i = 0; i < 55; i++) P.push({
      x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 2.5,
      a: Math.random() * 6.28, s: .2 + Math.random() * .5, t: Math.random() * 6.28,
      h: Math.random() < .7 ? 95 : 280 });
    (function draw() {
      x.clearRect(0, 0, W, H);
      P.forEach(function (p) {
        p.a += (Math.random() - .5) * .08; p.t += .03;
        p.x += Math.cos(p.a) * p.s; p.y += Math.sin(p.a) * p.s - .15;
        if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
        var g = .35 + .65 * Math.abs(Math.sin(p.t));
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.28);
        x.fillStyle = "hsla(" + p.h + ",100%,75%," + g + ")";
        x.shadowColor = "hsl(" + p.h + ",100%,70%)"; x.shadowBlur = 16; x.fill();
      });
      requestAnimationFrame(draw);
    })();
  }

  /* ---------- Name handling ---------- */
  function rememberName(name) {
    try { localStorage.setItem(NAME_KEY, String(name || "").trim());
          sessionStorage.removeItem(WELCOMED); } catch (e) {}
  }
  function getName() {
    var n = "";
    try {
      var L = window.GroveLogic;
      if (L && typeof L.getUser === "function") {
        var u = L.getUser(); n = (u && (u.name || u.username)) || (typeof u === "string" ? u : "");
      }
      if (!n && L && L.user) n = L.user.name || L.user.username || "";
    } catch (e) {}
    if (!n) { try { n = localStorage.getItem(NAME_KEY) || ""; } catch (e) {} }
    return n || "Traveler";
  }

  /* ---------- Welcome message ---------- */
  function welcome(name) {
    injectCss();
    var b = document.createElement("div"); b.className = "gu-banner";
    b.textContent = "✨ Welcome, " + (name || getName()) + " ✨";
    document.body.appendChild(b);
    setTimeout(function () { b.classList.add("show"); }, 100);
    setTimeout(function () { b.classList.remove("show"); }, 5000);
    setTimeout(function () { b.remove(); }, 6200);
  }

  /* ---------- Logout ---------- */
  function logout() {
    var name = getName();
    var f = document.createElement("div"); f.className = "gu-farewell";
    var h = document.createElement("h2"); h.textContent = "Farewell, " + name + " 🌙";
    var p = document.createElement("p"); p.textContent = "The grove will keep your light until you return…";
    f.appendChild(h); f.appendChild(p); document.body.appendChild(f);
    requestAnimationFrame(function () { f.classList.add("on"); });
    setTimeout(function () {
      try { localStorage.removeItem(NAME_KEY); sessionStorage.removeItem(WELCOMED); } catch (e) {}
      try {
        if (window.GroveLogic && typeof GroveLogic.logout === "function") GroveLogic.logout();
        else location.href = "login.html";
      } catch (e) { location.href = "login.html"; }
      setTimeout(function () { location.href = "login.html"; }, 2500); /* safety net */
    }, 1800);
  }

  function mountLogout() {
    injectCss();
    if (document.querySelector(".gu-logout")) return;
    var btn = document.createElement("button");
    btn.className = "gu-logout"; btn.type = "button"; btn.textContent = "🍃 Leave the Grove";
    btn.addEventListener("click", logout);
    document.body.appendChild(btn);
  }

  /* ---------- Main page entry point ---------- */
  function start() {
    fireflies(); mountLogout();
    try {
      if (!sessionStorage.getItem(WELCOMED)) { sessionStorage.setItem(WELCOMED, "1"); welcome(); }
    } catch (e) { welcome(); }
  }

  window.GroveUI = { start: start, fireflies: fireflies, welcome: welcome,
    mountLogout: mountLogout, logout: logout, rememberName: rememberName, getName: getName };
})();
