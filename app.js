(() => {
  "use strict";

  /* ───────── state ───────── */
  const state = {
    you: {
      name: "Me",
      skin: "#d4a574",
      hair: "#1c1410",
      shirt: "#2dd4a8",
      hairStyle: "short",
      body: "avg",
      vibe: "smug",
    },
    foe: {
      name: "Boss",
      skin: "#c9956c",
      hair: "#111111",
      shirt: "#c0392b",
      hairStyle: "short",
      body: "avg",
      vibe: "smug",
    },
    rage: 0,
    combo: 0,
    comboTimer: null,
    busy: false,
    calmed: false,
  };

  const BAM = {
    punch: ["POW!", "BAM!", "WHAM!", "THUD!"],
    slap: ["SLAP!", "WHACK!", "SMACK!", "CLAP!"],
    kick: ["BOOT!", "YEET!", "THWACK!", "KAPOW!"],
    mud: ["SPLAT!", "EW!", "GROSS!", "BLEH!"],
    water: ["SPLASH!", "GLUG!", "SOAKED!", "WHOOSH!"],
    pie: ["PIE!", "CREAM!", "FACE!", "HA!"],
    shake: ["RATTLE!", "SHAKE!", "WOAH!", "STOP!"],
    tomato: ["SPLAT!", "JUICY!", "RED!", "TOSS!"],
    uppercut: ["UPPER!", "SKY!", "BOOM!", "LAUNCH!"],
    taunt: ["HAHA!", "COME ON!", "THAT ALL?", "WEAK!"],
  };

  const FOE_LINES = {
    punch: ["Oof!", "Hey!", "Ow!", "Not the face!"],
    slap: ["How dare you!", "My cheek!", "Rude!", "Watch it!"],
    kick: ["My shin!", "Unfair!", "Owwww!", "I'll sue!"],
    mud: ["My shirt!", "Disgusting!", "You'll pay!", "Mud?!"],
    water: ["I'm drowning!", "Cold!", "Help!", "Blub blub!"],
    pie: ["Cream…", "My dignity!", "Not again!", "Tastes… weird"],
    shake: ["Put me down!", "Dizzy!", "Stop shaking!", "Bleh—"],
    tomato: ["Tomato juice!", "My suit!", "Gross!", "Farm attack?!"],
    uppercut: ["Flying…!", "Gravity?!", "Aaaah!", "Sky is fake!"],
    taunt: ["You're pathetic.", "Is that it?", "Weak.", "Cute."],
  };

  const HINTS = {
    punch: "Straight punch — clean and mean.",
    slap: "Open-hand slap. Instant karma.",
    kick: "Boot to the midsection. They fly.",
    mud: "Mud ball. Fashion disaster.",
    water: "Full dunk in the tub.",
    pie: "Classic cream pie to the face.",
    shake: "Grab and rattle like a soda can.",
    tomato: "Market special — ripe and messy.",
    uppercut: "From the floor to the ceiling.",
    taunt: "Talk smack. Fuel the fire.",
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ───────── audio (procedural) ───────── */
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur, type = "square", gain = 0.08, slide = 0) {
    const ctx = ensureAudio();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur = 0.12, gain = 0.1) {
    const ctx = ensureAudio();
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 800;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    n.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    n.start();
  }

  const SFX = {
    punch() { tone(90, 0.1, "square", 0.12, -40); noiseBurst(0.08, 0.12); },
    slap() { noiseBurst(0.06, 0.15); tone(220, 0.06, "sawtooth", 0.06, -100); },
    kick() { tone(70, 0.16, "sine", 0.15, -30); noiseBurst(0.1, 0.1); },
    mud() { noiseBurst(0.15, 0.1); tone(120, 0.12, "triangle", 0.05, -60); },
    water() { noiseBurst(0.25, 0.12); tone(180, 0.2, "sine", 0.05, 80); tone(90, 0.3, "sine", 0.04); },
    pie() { noiseBurst(0.12, 0.1); tone(300, 0.08, "triangle", 0.06, -150); },
    shake() {
      for (let i = 0; i < 6; i++) setTimeout(() => tone(140 + i * 20, 0.04, "square", 0.04), i * 80);
    },
    tomato() { noiseBurst(0.1, 0.11); tone(160, 0.1, "sawtooth", 0.05, -80); },
    uppercut() { tone(60, 0.08, "sine", 0.12); tone(180, 0.2, "square", 0.08, 220); noiseBurst(0.12, 0.1); },
    taunt() { tone(400, 0.08, "square", 0.05); tone(500, 0.1, "square", 0.05); },
    whoosh() { noiseBurst(0.1, 0.05); tone(400, 0.1, "sine", 0.03, -200); },
    ui() { tone(520, 0.05, "sine", 0.04); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => tone(f, 0.18, "triangle", 0.07), i * 90)
      );
    },
  };

  /* ───────── SVG character ───────── */
  function shade(hex, amt) {
    const n = hex.replace("#", "");
    const num = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0xff) + amt;
    let b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  function hairPaths(style) {
    const paths = {
      short: `<path d="M28 38 C28 18, 52 12, 72 18 C88 22, 96 36, 96 48 C90 36, 78 30, 62 28 C48 26, 34 32, 28 42 Z"/>`,
      messy: `<path d="M26 44 L30 16 L40 34 L48 10 L58 32 L66 8 L76 30 L88 12 L98 40 C92 28, 70 24, 50 26 C38 28, 30 36, 26 44 Z"/>`,
      long: `<path d="M24 40 C26 16, 50 10, 74 14 C96 18, 102 40, 100 52 L104 95 C100 88, 96 70, 94 55 C90 38, 78 30, 62 28 C46 26, 32 34, 28 48 L22 92 C22 80, 22 55, 24 40 Z"/>`,
      buzz: `<ellipse cx="62" cy="36" rx="34" ry="18" opacity="0.55"/>`,
      bun: `<path d="M30 42 C32 22, 52 16, 74 20 C92 24, 98 40, 96 50 C88 36, 72 30, 58 30 C44 30, 34 36, 30 42 Z"/><circle cx="62" cy="14" r="14"/>`,
    };
    return paths[style] || paths.short;
  }

  function faceFeatures(mood) {
    const moods = {
      smug: {
        brows: `<path d="M40 48 Q48 44 54 48" stroke-width="2.5" fill="none"/><path d="M70 48 Q76 44 84 48" stroke-width="2.5" fill="none"/>`,
        eyes: `<ellipse cx="47" cy="56" rx="5" ry="6"/><ellipse cx="77" cy="56" rx="5" ry="6"/><circle cx="48.5" cy="54" r="1.6" fill="#fff"/><circle cx="78.5" cy="54" r="1.6" fill="#fff"/>`,
        mouth: `<path d="M52 72 Q62 80 72 72" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      },
      annoyed: {
        brows: `<path d="M38 50 L54 46" stroke-width="2.8" fill="none"/><path d="M70 46 L86 50" stroke-width="2.8" fill="none"/>`,
        eyes: `<ellipse cx="47" cy="56" rx="5" ry="5.5"/><ellipse cx="77" cy="56" rx="5" ry="5.5"/><circle cx="48.5" cy="54" r="1.5" fill="#fff"/><circle cx="78.5" cy="54" r="1.5" fill="#fff"/>`,
        mouth: `<path d="M54 74 L70 74" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      },
      angry: {
        brows: `<path d="M38 52 L54 44" stroke-width="3" fill="none"/><path d="M70 44 L86 52" stroke-width="3" fill="none"/>`,
        eyes: `<ellipse cx="47" cy="56" rx="5.5" ry="5"/><ellipse cx="77" cy="56" rx="5.5" ry="5"/><circle cx="49" cy="54.5" r="1.5" fill="#fff"/><circle cx="79" cy="54.5" r="1.5" fill="#fff"/>`,
        mouth: `<path d="M52 76 Q62 70 72 76" stroke-width="2.5" fill="none"/>`,
      },
      ready: {
        brows: `<path d="M40 48 Q48 46 54 48" stroke-width="2.5" fill="none"/><path d="M70 48 Q76 46 84 48" stroke-width="2.5" fill="none"/>`,
        eyes: `<ellipse cx="47" cy="56" rx="5" ry="6.5"/><ellipse cx="77" cy="56" rx="5" ry="6.5"/><circle cx="48.5" cy="54" r="1.6" fill="#fff"/><circle cx="78.5" cy="54" r="1.6" fill="#fff"/>`,
        mouth: `<path d="M54 72 Q62 78 70 72" stroke-width="2.5" fill="none"/>`,
      },
      hurt: {
        brows: `<path d="M40 46 Q48 50 54 46" stroke-width="2.5" fill="none"/><path d="M70 46 Q76 50 84 46" stroke-width="2.5" fill="none"/>`,
        eyes: `<path d="M42 56 L52 56" stroke-width="3" fill="none"/><path d="M72 56 L82 56" stroke-width="3" fill="none"/>`,
        mouth: `<ellipse cx="62" cy="76" rx="8" ry="7" fill="#4a1010" stroke="none"/>`,
      },
      shocked: {
        brows: `<path d="M40 44 Q48 40 54 44" stroke-width="2.5" fill="none"/><path d="M70 44 Q76 40 84 44" stroke-width="2.5" fill="none"/>`,
        eyes: `<circle cx="47" cy="56" r="7"/><circle cx="77" cy="56" r="7"/><circle cx="47" cy="56" r="3" fill="#fff"/><circle cx="77" cy="56" r="3" fill="#fff"/>`,
        mouth: `<ellipse cx="62" cy="76" rx="6" ry="8" fill="#4a1010" stroke="none"/>`,
      },
      dizzy: {
        brows: `<path d="M40 48 Q48 44 54 50" stroke-width="2.5" fill="none"/><path d="M70 50 Q76 44 84 48" stroke-width="2.5" fill="none"/>`,
        eyes: `<text x="42" y="60" font-size="14" fill="#1a1008">✕</text><text x="72" y="60" font-size="14" fill="#1a1008">✕</text>`,
        mouth: `<path d="M52 74 Q58 70 62 74 Q66 78 72 74" stroke-width="2.5" fill="none"/>`,
      },
      nerdy: {
        brows: `<path d="M40 48 Q48 46 54 48" stroke-width="2" fill="none"/><path d="M70 48 Q76 46 84 48" stroke-width="2" fill="none"/>`,
        eyes: `<circle cx="47" cy="56" r="9" fill="none" stroke="#222" stroke-width="2"/><circle cx="77" cy="56" r="9" fill="none" stroke="#222" stroke-width="2"/><line x1="56" y1="56" x2="68" y2="56" stroke="#222" stroke-width="2"/><ellipse cx="47" cy="56" rx="4" ry="5"/><ellipse cx="77" cy="56" rx="4" ry="5"/>`,
        mouth: `<path d="M56 74 L68 74" stroke-width="2.2" fill="none"/>`,
      },
      fancy: {
        brows: `<path d="M40 48 Q48 44 54 48" stroke-width="2.5" fill="none"/><path d="M70 48 Q76 44 84 48" stroke-width="2.5" fill="none"/>`,
        eyes: `<ellipse cx="47" cy="56" rx="5" ry="6"/><ellipse cx="77" cy="56" rx="5" ry="6"/><circle cx="48.5" cy="54" r="1.6" fill="#fff"/><circle cx="78.5" cy="54" r="1.6" fill="#fff"/>`,
        mouth: `<path d="M54 72 Q62 78 70 72" stroke-width="2.5" fill="none"/><rect x="48" y="88" width="28" height="6" rx="1" fill="#c9a227"/>`,
      },
    };
    return moods[mood] || moods.annoyed;
  }

  function buildCharSVG(data, mood) {
    const skin = data.skin;
    const skinD = shade(skin, -28);
    const hair = data.hair;
    const shirt = data.shirt;
    const shirtD = shade(shirt, -35);
    const pants = "#2c3e50";
    const shoes = "#1a1a1a";
    const face = faceFeatures(mood || (data.vibe === "smug" ? "annoyed" : data.vibe) || "annoyed");
    const bodyScale = data.body === "slim" ? 0.92 : data.body === "stocky" ? 1.1 : 1;
    const torsoW = 36 * bodyScale;
    const hairStroke = shade(hair, 20);

    const accessory =
      data.vibe === "fancy"
        ? `<rect x="44" y="108" width="36" height="8" rx="1" fill="#111"/><path d="M62 116 L62 145" stroke="#c9a227" stroke-width="3"/>`
        : data.vibe === "nerdy"
          ? `<rect x="40" y="118" width="44" height="28" rx="2" fill="#5b7cfa" opacity="0.35"/>`
          : "";

    return `
<svg viewBox="0 0 124 220" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="foot-shadow" cx="62" cy="210" rx="32" ry="7" fill="rgba(0,0,0,0.35)"/>
  <g class="leg-l">
    <path d="M48 145 L44 200" stroke="${pants}" stroke-width="14" stroke-linecap="round"/>
    <ellipse cx="42" cy="204" rx="12" ry="5" fill="${shoes}"/>
  </g>
  <g class="leg-r">
    <path d="M76 145 L80 200" stroke="${pants}" stroke-width="14" stroke-linecap="round"/>
    <ellipse cx="82" cy="204" rx="12" ry="5" fill="${shoes}"/>
  </g>
  <g class="torso-g">
    <path d="M${62 - torsoW / 2} 108 Q${62 - torsoW / 2 - 2} 145 ${62 - torsoW / 2 + 4} 152
             L${62 + torsoW / 2 - 4} 152 Q${62 + torsoW / 2 + 2} 145 ${62 + torsoW / 2} 108
             Q62 102 ${62 - torsoW / 2} 108 Z" fill="${shirt}"/>
    <path d="M${62 - torsoW / 2 + 4} 110 Q62 106 ${62 + torsoW / 2 - 4} 110
             L${62 + torsoW / 2 - 6} 128 Q62 124 ${62 - torsoW / 2 + 6} 128 Z" fill="${shirtD}" opacity="0.35"/>
    ${accessory}
  </g>
  <g class="arm-l">
    <path d="M${62 - torsoW / 2 + 4} 112 Q30 130 28 158" stroke="${skin}" stroke-width="11" stroke-linecap="round" fill="none"/>
    <circle cx="28" cy="162" r="8" fill="${skin}"/>
  </g>
  <g class="arm-r">
    <path d="M${62 + torsoW / 2 - 4} 112 Q94 130 96 158" stroke="${skin}" stroke-width="11" stroke-linecap="round" fill="none"/>
    <circle cx="96" cy="162" r="8" fill="${skin}"/>
  </g>
  <g class="head-g">
    <ellipse cx="62" cy="58" rx="34" ry="38" fill="${skin}"/>
    <ellipse cx="48" cy="68" rx="8" ry="5" fill="${skinD}" opacity="0.25"/>
    <ellipse cx="76" cy="68" rx="8" ry="5" fill="${skinD}" opacity="0.25"/>
    <g fill="${hair}" stroke="${hairStroke}" stroke-width="0.5">${hairPaths(data.hairStyle)}</g>
    <g stroke="${hair}" fill="${hair}">${face.brows}</g>
    <g fill="#1a1008">${face.eyes}</g>
    <g stroke="#5c3a2a" fill="none">${face.mouth}</g>
    <ellipse cx="36" cy="66" rx="5" ry="3.5" fill="#e07a6a" opacity="0.35"/>
    <ellipse cx="88" cy="66" rx="5" ry="3.5" fill="#e07a6a" opacity="0.35"/>
  </g>
</svg>
<div class="overlay-splat mud" data-fx="mud"></div>
<div class="overlay-splat cream" data-fx="cream"></div>
<div class="overlay-splat tomato" data-fx="tomato"></div>
<div class="water-drops" data-fx="water"></div>`;
  }

  function renderChar(el, data, mood) {
    if (!el) return;
    el.dataset.body = data.body || "avg";
    el.dataset.mood = mood || el.dataset.mood || "annoyed";
    el.innerHTML = buildCharSVG(data, mood || el.dataset.mood);
  }

  function setMood(el, mood) {
    const role = el.id.includes("you") ? "you" : "foe";
    const data = role === "you" ? state.you : state.foe;
    // preserve overlays
    const overlays = {
      mud: el.querySelector('[data-fx="mud"]')?.classList.contains("on"),
      cream: el.querySelector('[data-fx="cream"]')?.classList.contains("on"),
      tomato: el.querySelector('[data-fx="tomato"]')?.classList.contains("on"),
      water: el.querySelector('[data-fx="water"]')?.classList.contains("on"),
    };
    renderChar(el, data, mood);
    Object.entries(overlays).forEach(([k, on]) => {
      if (on) el.querySelector(`[data-fx="${k}"]`)?.classList.add("on");
    });
  }

  /* ───────── forms / navigation ───────── */
  function readForm(formId, target) {
    const form = $(formId);
    const name = form.querySelector('[name="name"]').value.trim();
    target.name = name || target.name;
    target.skin = form.querySelector('[name="skin"]').value;
    target.hair = form.querySelector('[name="hair"]').value;
    target.shirt = form.querySelector('[name="shirt"]').value;
  }

  function bindChips(formId, target, onChange) {
    $$(`${formId} .chip-row`).forEach((row) => {
      const field = row.dataset.field;
      row.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          row.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
          chip.classList.add("on");
          target[field] = chip.dataset.v;
          SFX.ui();
          onChange();
        });
      });
    });
  }

  function bindForm(formId, key, previewId) {
    const form = $(formId);
    const refresh = () => {
      readForm(formId, state[key]);
      const mood =
        key === "you"
          ? "smug"
          : state.foe.vibe === "smug"
            ? "annoyed"
            : state.foe.vibe;
      renderChar($(previewId), state[key], mood);
    };
    form.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", refresh);
    });
    bindChips(formId, state[key], refresh);
    refresh();
  }

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  function showPanel(which) {
    $("#panel-you").classList.toggle("on", which === "you");
    $("#panel-foe").classList.toggle("on", which === "foe");
    $$(".step").forEach((s) => s.classList.toggle("on", s.dataset.go === which));
  }

  /* ───────── arena helpers ───────── */
  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function updateRage(add = 0) {
    state.rage = Math.min(100, state.rage + add);
    $("#rage-fill").style.width = `${state.rage}%`;
    $("#rage-pct").textContent = `${Math.round(state.rage)}%`;
    if (state.rage >= 100 && !state.calmed) {
      state.calmed = true;
      SFX.win();
      $("#hint").textContent = "Fully vented. You can breathe again.";
      showToast("ALL CLEAR ✨");
      burst(window.innerWidth / 2, window.innerHeight * 0.35, 36, true);
    }
  }

  function bumpCombo() {
    state.combo += 1;
    clearTimeout(state.comboTimer);
    const box = $("#combo-box");
    box.hidden = false;
    $("#combo-num").textContent = state.combo;
    box.style.animation = "none";
    void box.offsetWidth;
    box.style.animation = "";
    state.comboTimer = setTimeout(() => {
      state.combo = 0;
      box.hidden = true;
    }, 2200);
  }

  function setBusy(on) {
    state.busy = on;
    $$(".move").forEach((b) => {
      b.disabled = on;
    });
  }

  function arenaRect() {
    return $("#arena").getBoundingClientRect();
  }

  function foeHead() {
    const r = $("#fighter-foe").getBoundingClientRect();
    const a = arenaRect();
    return {
      x: r.left + r.width / 2 - a.left,
      y: r.top + r.height * 0.22 - a.top,
      absX: r.left + r.width / 2,
      absY: r.top + r.height * 0.22,
    };
  }

  function youHand() {
    const r = $("#fighter-you").getBoundingClientRect();
    const a = arenaRect();
    return {
      x: r.right - a.left - 20,
      y: r.top + r.height * 0.35 - a.top,
    };
  }

  function showBam(text, x, y) {
    const el = $("#bam");
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  function showSpeech(text) {
    const el = $("#speech");
    el.hidden = false;
    el.textContent = text;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.hidden = true;
    }, 1400);
  }

  function showToast(text) {
    const el = $("#toast");
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2000);
  }

  function flash() {
    const f = $("#flash");
    f.classList.remove("bang");
    void f.offsetWidth;
    f.classList.add("bang");
  }

  function shake(hard = false) {
    const a = $("#arena");
    a.classList.remove("shake", "shake-hard");
    void a.offsetWidth;
    a.classList.add(hard ? "shake-hard" : "shake");
  }

  async function hitStop(ms = 55) {
    document.body.classList.add("hit-freeze");
    await wait(ms);
    document.body.classList.remove("hit-freeze");
  }

  function burst(x, y, n = 14, rainbow = false) {
    const layer = $("#fx-layer");
    const colors = rainbow
      ? ["#ff4d1a", "#ffb020", "#2dd4a8", "#fb7185", "#60a5fa"]
      : ["#ff4d1a", "#ffb020", "#fff", "#e11d48", "#fbbf24"];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "spark";
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 50 + Math.random() * 90;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      if (Math.random() > 0.5) p.style.borderRadius = "50%";
      layer.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  function ringAt(x, y) {
    const a = $("#arena");
    const r = document.createElement("div");
    r.className = "ring";
    r.style.left = `${x - 10}px`;
    r.style.top = `${y - 10}px`;
    a.appendChild(r);
    setTimeout(() => r.remove(), 400);
  }

  function launchProjectile(emoji, from, to, cls = "") {
    return new Promise((resolve) => {
      const a = $("#arena");
      const p = document.createElement("div");
      p.className = `projectile arc ${cls}`;
      if (emoji) p.textContent = emoji;
      p.style.left = `${from.x}px`;
      p.style.top = `${from.y}px`;
      p.style.setProperty("--tx", `${to.x - from.x}px`);
      p.style.setProperty("--ty", `${to.y - from.y}px`);
      p.style.setProperty("--rot", `${200 + Math.random() * 200}deg`);
      a.appendChild(p);
      setTimeout(() => {
        p.remove();
        resolve();
      }, 550);
    });
  }

  function contactBurstAt(x, y) {
    const a = $("#arena");
    const b = document.createElement("div");
    b.className = "contact-burst go";
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    a.appendChild(b);
    setTimeout(() => b.remove(), 450);
  }

  function midContact() {
    const you = $("#fighter-you").getBoundingClientRect();
    const foe = $("#fighter-foe").getBoundingClientRect();
    const a = arenaRect();
    return {
      x: (you.right + foe.left) / 2 - a.left,
      y: (you.top + foe.top) / 2 + Math.min(you.height, foe.height) * 0.2 - a.top,
      absX: (you.right + foe.left) / 2,
      absY: (you.top + foe.top) / 2 + Math.min(you.height, foe.height) * 0.2,
    };
  }

  async function closeIn(youF, foeF) {
    youF.classList.add("closing");
    foeF.classList.add("bracing");
    await wait(280);
  }

  async function openOut(youF, foeF) {
    youF.classList.remove("closing");
    foeF.classList.remove("bracing");
    await wait(200);
  }

  function clearFighterClasses(el, list) {
    list.forEach((c) => el.classList.remove(c));
  }

  const YOU_ACTS = [
    "act-punch", "act-slap", "act-kick", "act-throw",
    "act-upper", "act-grab", "act-taunt", "act-dunk", "closing",
  ];
  const FOE_ACTS = [
    "hit", "launch", "spin", "shake", "dunk", "upper", "bracing",
  ];

  /* ───────── activities ───────── */
  async function runAct(act) {
    if (state.busy) return;
    ensureAudio();
    setBusy(true);

    const youF = $("#fighter-you");
    const foeF = $("#fighter-foe");
    const youC = $("#char-you");
    const foeC = $("#char-foe");

    $("#hint").textContent = HINTS[act];
    youF.classList.remove("idle");
    foeF.classList.remove("idle");

    try {
      switch (act) {
        case "punch":
          await actPunch(youF, foeF, foeC);
          break;
        case "slap":
          await actSlap(youF, foeF, foeC);
          break;
        case "kick":
          await actKick(youF, foeF, foeC);
          break;
        case "mud":
          await actThrow(youF, foeF, foeC, "", "mud-ball", "mud", "mud");
          break;
        case "water":
          await actWater(youF, foeF, foeC);
          break;
        case "pie":
          await actThrow(youF, foeF, foeC, "🥧", "", "pie", "cream");
          break;
        case "shake":
          await actShake(youF, foeF, foeC);
          break;
        case "tomato":
          await actThrow(youF, foeF, foeC, "🍅", "", "tomato", "tomato");
          break;
        case "uppercut":
          await actUpper(youF, foeF, foeC);
          break;
        case "taunt":
          await actTaunt(youF, youC, foeC);
          break;
      }
      bumpCombo();
      const bonus = Math.min(8, state.combo);
      updateRage((act === "taunt" ? 4 : 11) + bonus + Math.random() * 4);
    } finally {
      clearFighterClasses(youF, YOU_ACTS);
      clearFighterClasses(foeF, FOE_ACTS);
      setMood(youC, "ready");
      setMood(foeC, state.foe.vibe === "smug" ? "annoyed" : state.foe.vibe);
      youF.classList.add("idle");
      foeF.classList.add("idle");
      if (state.rage < 100) {
        $("#hint").textContent = `Keep going — ${state.foe.name} can take more.`;
      }
      setBusy(false);
    }
  }

  async function impact(foeC, point, wordKey, hard = false) {
    SFX[wordKey]?.();
    flash();
    shake(hard);
    contactBurstAt(point.x, point.y);
    await hitStop(hard ? 75 : 55);
    showBam(pick(BAM[wordKey]), point.x - 30, point.y - 50);
    showSpeech(pick(FOE_LINES[wordKey]));
    ringAt(point.x, point.y);
    burst(point.absX, point.absY, hard ? 22 : 14);
    setMood(foeC, hard ? "shocked" : "hurt");
  }

  async function actPunch(youF, foeF, foeC) {
    await closeIn(youF, foeF);
    SFX.whoosh();
    youF.classList.add("act-punch");
    await wait(220);
    const c = midContact();
    foeF.classList.add("hit");
    await impact(foeC, c, "punch");
    await wait(320);
    await openOut(youF, foeF);
  }

  async function actSlap(youF, foeF, foeC) {
    await closeIn(youF, foeF);
    SFX.whoosh();
    youF.classList.add("act-slap");
    await wait(200);
    const c = midContact();
    foeF.classList.add("spin");
    await impact(foeC, c, "slap");
    await wait(380);
    await openOut(youF, foeF);
  }

  async function actKick(youF, foeF, foeC) {
    await closeIn(youF, foeF);
    SFX.whoosh();
    youF.classList.add("act-kick");
    await wait(260);
    const c = midContact();
    c.y += 35;
    c.absY += 35;
    foeF.classList.add("launch");
    await impact(foeC, c, "kick", true);
    await wait(520);
    await openOut(youF, foeF);
  }

  async function actThrow(youF, foeF, foeC, emoji, cls, wordKey, fxKey) {
    SFX.whoosh();
    youF.classList.add("act-throw");
    await wait(250);
    const from = youHand();
    const to = foeHead();
    await launchProjectile(emoji, from, to, cls);
    foeF.classList.add("hit");
    if (fxKey) foeC.querySelector(`[data-fx="${fxKey}"]`)?.classList.add("on");
    await impact(foeC, to, wordKey);
    await wait(280);
  }

  async function actWater(youF, foeF, foeC) {
    const pool = $("#pool");
    pool.hidden = false;
    await closeIn(youF, foeF);
    youF.classList.add("act-dunk");
    foeF.classList.add("dunk");
    await wait(450);
    const c = midContact();
    c.x += 50;
    c.y += 40;
    c.absX += 50;
    c.absY += 40;
    await impact(foeC, c, "water", true);
    foeC.querySelector('[data-fx="water"]')?.classList.add("on");
    await wait(750);
    await openOut(youF, foeF);
    setTimeout(() => {
      pool.hidden = true;
    }, 400);
  }

  async function actShake(youF, foeF, foeC) {
    await closeIn(youF, foeF);
    youF.classList.add("act-grab");
    await wait(180);
    foeF.classList.add("shake");
    setMood(foeC, "dizzy");
    SFX.shake();
    const c = midContact();
    showBam(pick(BAM.shake), c.x - 20, c.y - 50);
    showSpeech(pick(FOE_LINES.shake));
    shake();
    burst(c.absX, c.absY, 10);
    await wait(780);
    await openOut(youF, foeF);
  }

  async function actUpper(youF, foeF, foeC) {
    await closeIn(youF, foeF);
    SFX.whoosh();
    youF.classList.add("act-upper");
    await wait(280);
    const c = midContact();
    foeF.classList.add("upper");
    await impact(foeC, c, "uppercut", true);
    await wait(520);
    await openOut(youF, foeF);
  }

  async function actTaunt(youF, youC, foeC) {
    SFX.taunt();
    youF.classList.add("act-taunt");
    setMood(youC, "smug");
    setMood(foeC, "angry");
    const h = foeHead();
    showSpeech(pick(FOE_LINES.taunt));
    showBam(pick(BAM.taunt), h.x - 40, h.y - 60);
    await wait(900);
  }

  /* ───────── landing canvas dust ───────── */
  function initLandingCanvas() {
    const c = $("#landing-canvas");
    if (!c) return;
    const ctx = c.getContext("2d");
    let w, h, particles, raf;

    function resize() {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
      particles = Array.from({ length: 40 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.5,
        vx: -0.3 + Math.random() * 0.6,
        vy: -0.4 - Math.random() * 0.6,
        a: 0.15 + Math.random() * 0.35,
      }));
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,176,32,${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    frame();
    window.addEventListener("resize", resize);
    const obs = new MutationObserver(() => {
      if (!$("#screen-landing").classList.contains("active")) {
        cancelAnimationFrame(raf);
      } else {
        cancelAnimationFrame(raf);
        frame();
      }
    });
    obs.observe($("#screen-landing"), { attributes: true, attributeFilter: ["class"] });
  }

  /* ───────── enter arena ───────── */
  function enterArena() {
    readForm("#form-you", state.you);
    readForm("#form-foe", state.foe);
    state.rage = 0;
    state.combo = 0;
    state.calmed = false;
    updateRage(0);
    $("#combo-box").hidden = true;

    const youMood = "ready";
    const foeMood = state.foe.vibe === "smug" ? "annoyed" : state.foe.vibe;

    renderChar($("#char-you"), state.you, youMood);
    renderChar($("#char-foe"), state.foe, foeMood);
    $("#tag-you").textContent = state.you.name;
    $("#tag-foe").textContent = state.foe.name;

    $("#pool").hidden = true;
    $("#speech").hidden = true;
    $("#hint").textContent = `${state.foe.name} is waiting. Keys 1–0 work too.`;

    $("#fighter-you").classList.add("idle");
    $("#fighter-foe").classList.add("idle");

    showScreen("#screen-arena");
    SFX.ui();
  }

  /* ───────── wire up ───────── */
  $("#btn-start").addEventListener("click", () => {
    ensureAudio();
    SFX.ui();
    showScreen("#screen-setup");
    showPanel("you");
  });

  $("#btn-next-foe").addEventListener("click", () => {
    readForm("#form-you", state.you);
    SFX.ui();
    showPanel("foe");
  });

  $("#btn-back-you").addEventListener("click", () => {
    SFX.ui();
    showPanel("you");
  });

  $("#btn-arena").addEventListener("click", enterArena);
  $("#btn-reset").addEventListener("click", () => {
    showScreen("#screen-setup");
    showPanel("you");
  });

  $$(".step").forEach((s) => {
    s.addEventListener("click", () => showPanel(s.dataset.go));
  });

  $$(".move").forEach((btn) => {
    btn.addEventListener("click", () => runAct(btn.dataset.act));
  });

  const keyMap = {
    Digit1: "punch",
    Digit2: "slap",
    Digit3: "kick",
    Digit4: "mud",
    Digit5: "water",
    Digit6: "pie",
    Digit7: "shake",
    Digit8: "tomato",
    Digit9: "uppercut",
    Digit0: "taunt",
  };

  window.addEventListener("keydown", (e) => {
    if (!$("#screen-arena").classList.contains("active")) return;
    const act = keyMap[e.code];
    if (act) {
      e.preventDefault();
      runAct(act);
    }
  });

  $("#fighter-foe").addEventListener("click", () => {
    if ($("#screen-arena").classList.contains("active")) runAct("punch");
  });

  bindForm("#form-you", "you", "#char-you-preview");
  bindForm("#form-foe", "foe", "#char-foe-preview");
  initLandingCanvas();
})();
