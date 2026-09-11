import { SFX } from "./audio";
import {
  playAttack,
  stopAttack,
  playReaction,
  mountArenaFighters,
  releaseAvatar,
  renderAvatar,
  setAvatarMood,
  setAvatarWeapon,
  addAvatarSplat,
  type Avatar3DOptions,
} from "./avatarView";
import {
  applyHurtMarks,
  defaultChar,
  foeIdleMood,
  youPreviewMood,
  type HandWeapon,
} from "./character";
import {
  ACT_REACTIONS,
  BAM,
  CATEGORIES,
  CATEGORY_IDLE,
  CHALLENGE_SECONDS,
  FOE_LINES,
  HINTS,
  MEMES,
  MOVES,
  ULTIMATE_NEED,
  challengePrompt,
  isMoveUnlocked,
  newlyUnlockedMoves,
  pick,
  rageLevelFor,
} from "./data";
import { $, $$, wait } from "./dom";
import { getSessions, recordSessionComplete } from "./progress";
import {
  beatChallenge,
  buildChallengePayload,
  challengeBlurb,
  challengeShareUrl,
  clearChallengeFromUrl,
  dailyChallengeLabel,
  dailyMemeId,
  nativeShare,
  readChallengeFromLocation,
  todayKey,
  whatsappShareUrl,
  type ChallengePayload,
} from "./share";
import type {
  Accessory,
  ActId,
  BodyType,
  CategoryId,
  CharData,
  Expression,
  FaceShape,
  FoeAnim,
  GameState,
  HairStyle,
  MemeId,
  Mood,
  SceneId,
  SetupPanel,
  ShoeStyle,
  Vibe,
} from "./types";

const YOU_ACTS = [
  "act-punch",
  "act-slap",
  "act-kick",
  "act-throw",
  "act-upper",
  "act-grab",
  "act-taunt",
  "act-dunk",
  "act-headbutt",
  "act-push",
  "act-hammer",
  "act-ultimate",
  "approaching",
];
// Each canvas camera sits on +Z. Positive yaw turns the local +Z (the face
// and the strike) toward screen-right, so You looks at the foe; negative
// yaw turns the foe toward You. ~55° keeps a readable three-quarter.
const YOU_FIGHTER_VIEW: Avatar3DOptions = {
  facing: 1.15,
  mirror: true,
  framing: "arena",
  pointerTracking: false,
};
const FOE_FIGHTER_VIEW: Avatar3DOptions = {
  facing: -1.15,
  mirror: false,
  framing: "arena",
  pointerTracking: false,
};

const FOE_ACTS: FoeAnim[] = [
  "hit",
  "launch",
  "spin",
  "shake",
  "dunk",
  "upper",
  "fall",
  "run",
  "cry",
];

const KEY_MAP: Record<string, ActId> = {
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
  KeyQ: "headbutt",
  KeyW: "push",
  KeyE: "hammer",
  KeyR: "fryingpan",
  KeyT: "slipper",
  KeyY: "foambat",
  KeyF: "banana",
  KeyG: "watergun",
  KeyU: "ultimate",
  Space: "ultimate",
};

function createState(): GameState {
  return {
    you: defaultChar({ name: "Me", shirt: "#2dd4a8", expression: "calm" }),
    foe: defaultChar({
      name: "Boss",
      skin: "#c9956c",
      hair: "#111111",
      shirt: "#c0392b",
      expression: "smirk",
    }),
    category: "boss",
    meme: "none",
    scene: "office",
    rage: 0,
    peakRage: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    startedAt: 0,
    endedAt: 0,
    comboTimer: null,
    idleTimer: null,
    challengeTimer: null,
    busy: false,
    calmed: false,
    sessionOver: false,
    challengeMode: false,
    challengeSeconds: CHALLENGE_SECONDS,
    challengeLeft: CHALLENGE_SECONDS,
    challengeWon: null,
    ultimateCharge: 0,
    memeLines: null,
    incoming: null,
  };
}

export function startGame(): void {
  const state = createState();

  function showScreen(id: string): void {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  function showPanel(which: SetupPanel): void {
    $("#panel-you").classList.toggle("on", which === "you");
    $("#panel-foe").classList.toggle("on", which === "foe");
    $("#panel-scene").classList.toggle("on", which === "scene");
    $$(".step").forEach((s) => s.classList.toggle("on", s.dataset.go === which));
  }

  function readForm(formId: string, target: CharData): void {
    const form = $(formId) as HTMLFormElement;
    const name = (form.querySelector('[name="name"]') as HTMLInputElement).value.trim();
    target.name = name || target.name;
    target.skin = (form.querySelector('[name="skin"]') as HTMLInputElement).value;
    target.hair = (form.querySelector('[name="hair"]') as HTMLInputElement).value;
    target.shirt = (form.querySelector('[name="shirt"]') as HTMLInputElement).value;
  }

  function syncChip(formId: string, field: string, value: string): void {
    $$(`${formId} .chip-row[data-field="${field}"] .chip`).forEach((chip) => {
      chip.classList.toggle("on", chip.dataset.v === value);
    });
  }

  function writeFoeForm(): void {
    const form = $("#form-foe") as HTMLFormElement;
    (form.querySelector('[name="name"]') as HTMLInputElement).value = state.foe.name;
    (form.querySelector('[name="skin"]') as HTMLInputElement).value = state.foe.skin;
    (form.querySelector('[name="hair"]') as HTMLInputElement).value = state.foe.hair;
    (form.querySelector('[name="shirt"]') as HTMLInputElement).value = state.foe.shirt;
    syncChip("#form-foe", "hairStyle", state.foe.hairStyle);
    syncChip("#form-foe", "body", state.foe.body);
    syncChip("#form-foe", "vibe", state.foe.vibe);
    syncChip("#form-foe", "face", state.foe.face);
    syncChip("#form-foe", "expression", state.foe.expression);
    syncChip("#form-foe", "accessory", state.foe.accessory);
    syncChip("#form-foe", "shoes", state.foe.shoes);
    $$("#cat-row .chip").forEach((c) =>
      c.classList.toggle("on", c.dataset.v === state.category),
    );
  }

  function applyCategory(id: CategoryId): void {
    const preset = CATEGORIES.find((c) => c.id === id);
    if (!preset) return;
    state.category = id;
    state.meme = "none";
    state.memeLines = null;
    state.foe.name = preset.name;
    state.foe.shirt = preset.shirt;
    state.foe.hair = preset.hair;
    state.foe.skin = preset.skin;
    state.foe.vibe = preset.vibe;
    state.foe.hairStyle = preset.hairStyle;
    state.foe.body = preset.body;
    state.scene = preset.scene;
    $$("#meme-grid .meme-card").forEach((c) =>
      c.classList.toggle("on", c.dataset.meme === "none"),
    );
    writeFoeForm();
    $$("#scene-grid .scene-card").forEach((card) =>
      card.classList.toggle("on", card.dataset.scene === state.scene),
    );
    renderAvatar($("#char-foe-preview"), state.foe, foeIdleMood(state.foe));
    updateChallengePrompt();
  }

  function applyMeme(id: MemeId): void {
    state.meme = id;
    $$("#meme-grid .meme-card").forEach((c) =>
      c.classList.toggle("on", c.dataset.meme === id),
    );
    if (id === "none") {
      state.memeLines = null;
      return;
    }
    const meme = MEMES.find((m) => m.id === id);
    if (!meme) return;
    state.foe.name = meme.name;
    state.foe.shirt = meme.shirt;
    state.foe.hair = meme.hair;
    state.foe.skin = meme.skin;
    state.foe.vibe = meme.vibe;
    state.foe.hairStyle = meme.hairStyle;
    state.foe.body = meme.body;
    state.foe.face = meme.face;
    state.foe.accessory = meme.accessory;
    state.foe.shoes = meme.shoes;
    state.foe.expression = meme.expression;
    state.scene = meme.scene;
    state.memeLines = meme.lines;
    state.category = "custom";
    writeFoeForm();
    $$("#scene-grid .scene-card").forEach((card) =>
      card.classList.toggle("on", card.dataset.scene === state.scene),
    );
    renderAvatar($("#char-foe-preview"), state.foe, foeIdleMood(state.foe));
    updateChallengePrompt();
  }

  function bindChips(formId: string, target: CharData, onChange: () => void): void {
    $$(`${formId} .chip-row[data-field]`).forEach((row) => {
      const field = row.dataset.field!;
      row.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          row.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
          chip.classList.add("on");
          const v = (chip as HTMLElement).dataset.v!;
          if (field === "hairStyle") target.hairStyle = v as HairStyle;
          else if (field === "body") target.body = v as BodyType;
          else if (field === "vibe") target.vibe = v as Vibe;
          else if (field === "face") target.face = v as FaceShape;
          else if (field === "expression") target.expression = v as Expression;
          else if (field === "accessory") target.accessory = v as Accessory;
          else if (field === "shoes") target.shoes = v as ShoeStyle;
          SFX.ui();
          onChange();
        });
      });
    });
  }

  function bindForm(formId: string, key: "you" | "foe", previewId: string): void {
    const form = $(formId);
    const refresh = () => {
      readForm(formId, state[key]);
      const mood = key === "you" ? youPreviewMood(state.you) : foeIdleMood(state.foe);
      renderAvatar($(previewId), state[key], mood);
    };
    form.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", refresh);
    });
    bindChips(formId, state[key], refresh);
    refresh();
  }

  function refreshMovesUI(): void {
    const sessions = getSessions();
    $$(".move").forEach((btn) => {
      const act = btn.dataset.act as ActId;
      const unlocked = isMoveUnlocked(act, sessions);
      btn.classList.toggle("locked", !unlocked);
      const lock = btn.querySelector(".move-lock") as HTMLElement | null;
      if (lock) lock.hidden = unlocked;
      (btn as HTMLButtonElement).disabled =
        !unlocked || state.busy || state.sessionOver;
    });
  }

  function refreshSessionPill(): void {
    const n = getSessions();
    const el = $("#session-pill");
    el.textContent =
      n === 0
        ? "Finish sessions to unlock frying pan, slipper & more"
        : `${n} session${n === 1 ? "" : "s"} cleared · keep unlocking weapons`;
  }

  function refreshUltimateUI(): void {
    const btn = $("#btn-ultimate") as HTMLButtonElement;
    const fill = $("#ult-fill");
    const ready = state.ultimateCharge >= ULTIMATE_NEED;
    fill.style.width = `${Math.min(100, state.ultimateCharge)}%`;
    btn.disabled = state.busy || state.sessionOver || !ready;
    btn.classList.toggle("ready", ready && !state.busy && !state.sessionOver);
    btn.querySelector(".ult-label")!.textContent = ready ? "RAGE NUKE" : "ULTIMATE";
  }

  function chargeUltimate(amount: number): void {
    const wasReady = state.ultimateCharge >= ULTIMATE_NEED;
    state.ultimateCharge = Math.min(ULTIMATE_NEED, state.ultimateCharge + amount);
    if (!wasReady && state.ultimateCharge >= ULTIMATE_NEED) {
      showToast("ULTIMATE READY");
    }
    refreshUltimateUI();
  }

  function updateChallengePrompt(): void {
    $("#challenge-prompt").textContent = challengePrompt(state.foe.name);
  }

  function stopIdleTalk(): void {
    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
  }

  function scheduleIdleTalk(): void {
    stopIdleTalk();
    if (state.sessionOver) return;
    state.idleTimer = setTimeout(() => {
      if (state.sessionOver || state.busy) {
        scheduleIdleTalk();
        return;
      }
      const lines =
        state.memeLines ?? CATEGORY_IDLE[state.category] ?? CATEGORY_IDLE.custom;
      showSpeech(pick(lines));
      scheduleIdleTalk();
    }, 4500 + Math.random() * 3500);
  }

  function stopChallengeTimer(): void {
    if (state.challengeTimer) {
      clearInterval(state.challengeTimer);
      state.challengeTimer = null;
    }
  }


  function updateRage(add = 0): void {
    state.rage = Math.min(100, state.rage + add);
    state.peakRage = Math.max(state.peakRage, state.rage);
    const { level, label } = rageLevelFor(state.rage);
    $("#rage-fill").style.width = `${state.rage}%`;
    $("#rage-pct").textContent = `${Math.round(state.rage)}%`;
    $("#rage-level").textContent = label;
    const arena = $("#arena");
    arena.dataset.rageLevel = level;
    if (state.rage >= 70 && state.ultimateCharge < ULTIMATE_NEED) {
      state.ultimateCharge = ULTIMATE_NEED;
      showToast("ULTIMATE READY");
    }
    refreshUltimateUI();
    if (state.rage >= 100 && !state.calmed) {
      state.calmed = true;
      if (state.challengeMode) state.challengeWon = true;
      SFX.win();
      $("#hint").textContent = "Fully vented. Hit Done whenever you're ready.";
      showToast("ALL CLEAR — hit Done when ready");
      burst(window.innerWidth / 2, window.innerHeight * 0.35, 36, true);
    }
  }

  function bumpCombo(): void {
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    if (state.comboTimer) clearTimeout(state.comboTimer);
    const box = $("#combo-box");
    box.hidden = false;
    $("#combo-num").textContent = String(state.combo);
    box.style.animation = "none";
    void box.offsetWidth;
    box.style.animation = "";
    if (state.combo >= 3) showToast(`${state.combo} HIT COMBO`);
    if (state.combo >= 8) chargeUltimate(ULTIMATE_NEED);
    state.comboTimer = setTimeout(() => {
      state.combo = 0;
      box.hidden = true;
    }, 2200);
  }

  function setBusy(on: boolean): void {
    state.busy = on;
    refreshMovesUI();
    refreshUltimateUI();
  }

  function arenaRect(): DOMRect {
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

  function showBam(text: string, x: number, y: number): void {
    const el = $("#bam");
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  }

  function showSpeech(text: string): void {
    const el = $("#speech") as HTMLElement & { _t?: ReturnType<typeof setTimeout> };
    el.hidden = false;
    el.textContent = text;
    if (el._t) clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.hidden = true;
    }, 1400);
  }

  function showToast(text: string): void {
    const el = $("#toast");
    el.textContent = text;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2000);
  }

  function flash(): void {
    const f = $("#flash");
    f.classList.remove("bang");
    void f.offsetWidth;
    f.classList.add("bang");
  }

  function shake(hard = false): void {
    const a = $("#arena");
    a.classList.remove("shake", "shake-hard");
    void a.offsetWidth;
    a.classList.add(hard ? "shake-hard" : "shake");
  }

  async function hitStop(ms = 90): Promise<void> {
    document.body.classList.add("hit-freeze");
    await wait(ms);
    document.body.classList.remove("hit-freeze");
  }

  /** Combat waits, stretched so a punch reads as a swing instead of a twitch. */
  const FIGHT_SLOW = 1.75;
  const beat = (ms: number) => wait(Math.round(ms * FIGHT_SLOW));

  function burst(x: number, y: number, n = 14, rainbow = false): void {
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
      p.style.background = colors[i % colors.length]!;
      p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
      p.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
      if (Math.random() > 0.5) p.style.borderRadius = "50%";
      layer.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  function ringAt(x: number, y: number): void {
    const a = $("#arena");
    const r = document.createElement("div");
    r.className = "ring";
    r.style.left = `${x - 10}px`;
    r.style.top = `${y - 10}px`;
    a.appendChild(r);
    setTimeout(() => r.remove(), 400);
  }

  function projectileMarkup(kind: string): string {
    if (kind === "pie") {
      return `<span class="proj-obj pie" aria-hidden="true">
        <i class="crust"></i><i class="filling"></i><i class="steam"></i>
      </span>`;
    }
    if (kind === "tomato") {
      return `<span class="proj-obj tomato" aria-hidden="true">
        <i class="body"></i><i class="leaf"></i><i class="shine"></i>
      </span>`;
    }
    if (kind === "mud") {
      return `<span class="proj-obj mud" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>`;
    }
    if (kind === "banana") {
      return `<span class="proj-obj banana" aria-hidden="true"></span>`;
    }
    if (kind === "water") {
      return `<span class="proj-obj stream" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>`;
    }
    return "";
  }

  function launchProjectile(
    kind: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): Promise<void> {
    return new Promise((resolve) => {
      const a = $("#arena");
      const p = document.createElement("div");
      p.className = `projectile arc is-${kind}`;
      p.innerHTML = projectileMarkup(kind);
      p.style.left = `${from.x}px`;
      p.style.top = `${from.y}px`;
      p.style.setProperty("--tx", `${to.x - from.x}px`);
      p.style.setProperty("--ty", `${to.y - from.y}px`);
      p.style.setProperty("--rot", `${240 + Math.random() * 160}deg`);
      a.appendChild(p);
      setTimeout(() => {
        p.remove();
        resolve();
      }, Math.round(900 * FIGHT_SLOW / 1.75));
    });
  }

  function contactBurstAt(x: number, y: number): void {
    const a = $("#arena");
    const b = document.createElement("div");
    b.className = "contact-burst go";
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    a.appendChild(b);
    setTimeout(() => b.remove(), 450);
  }

  /** Walk you into range. Distance scales with hold-power (1 tap step … 3 full steps). */
  let hitPower = 0.55;
  let approachDurMs = 280;

  function power01(): number {
    return Math.max(0.2, Math.min(1, hitPower));
  }

  async function approach(youF: HTMLElement, _foeF: HTMLElement): Promise<void> {
    const p = power01();
    // Gap between canvases is already small — don't use bounding-box overlap
    // or they "walk" in place. Always take 1–3 real steps from hold power.
    const stepPx = 70;
    const steps = 1 + p * 2;
    const travel = Math.round(stepPx * steps);
    const dur = steps * 0.26;
    approachDurMs = Math.round(dur * 1000);

    youF.style.setProperty("--approach", `${travel}px`);
    youF.style.setProperty("--approach-dur", `${dur}s`);
    youF.classList.add("approaching");
    playAttack($("#char-you"), "walk");
    await beat(approachDurMs);
    stopAttack($("#char-you"));
  }

  async function retreat(youF: HTMLElement): Promise<void> {
    youF.classList.remove("approaching");
    const dur = Math.min(0.42, approachDurMs / 1000);
    youF.style.setProperty("--approach-dur", `${dur}s`);
    if (approachDurMs > 160) playAttack($("#char-you"), "walk");
    await beat(Math.round(dur * 1000));
    youF.style.removeProperty("--approach");
    stopAttack($("#char-you"));
  }

  function resetApproach(youF: HTMLElement): void {
    youF.classList.remove("approaching");
    youF.style.removeProperty("--approach");
    stopAttack($("#char-you"));
  }

  function knockProfile(act: ActId, p: number): { x: number; y: number; r: number; dur: number; anim: FoeAnim } {
    const w = 0.35 + p * 0.65;
    const table: Record<string, { x: number; y: number; r: number; dur: number; anim: FoeAnim }> = {
      punch: { x: 96, y: -28, r: 14, dur: 0.85, anim: "hit" },
      slap: { x: 120, y: -36, r: 48, dur: 0.95, anim: p > 0.65 ? "spin" : "hit" },
      kick: { x: 168, y: -110, r: 38, dur: 1.15, anim: "launch" },
      headbutt: { x: 88, y: -22, r: 18, dur: 0.88, anim: "hit" },
      push: { x: 150, y: -40, r: 55, dur: 1.15, anim: "fall" },
      hammer: { x: 180, y: -120, r: 50, dur: 1.25, anim: "launch" },
      fryingpan: { x: 155, y: -90, r: 70, dur: 1.15, anim: "spin" },
      foambat: { x: 100, y: -32, r: 16, dur: 0.85, anim: "hit" },
      slipper: { x: 90, y: -24, r: 14, dur: 0.82, anim: "hit" },
      uppercut: { x: 40, y: -160, r: -22, dur: 1.2, anim: "upper" },
      ultimate: { x: 190, y: -80, r: 30, dur: 1.3, anim: "run" },
      shake: { x: 24, y: -8, r: 10, dur: 0.75, anim: "shake" },
      water: { x: 50, y: 56, r: 12, dur: 1.25, anim: "dunk" },
      mud: { x: 70, y: -16, r: 10, dur: 0.78, anim: "hit" },
      pie: { x: 74, y: -18, r: 12, dur: 0.8, anim: "hit" },
      tomato: { x: 70, y: -16, r: 10, dur: 0.78, anim: "hit" },
      banana: { x: 140, y: -48, r: 58, dur: 1.12, anim: "fall" },
      watergun: { x: 54, y: -12, r: 8, dur: 0.7, anim: "hit" },
      taunt: { x: 12, y: 0, r: 4, dur: 0.4, anim: "hit" },
    };
    const t = table[act] ?? table.punch;
    return {
      x: Math.round(t.x * w),
      y: Math.round(t.y * w),
      r: Math.round(t.r * (0.45 + 0.55 * p)),
      dur: t.dur * (0.75 + 0.4 * p),
      anim: p < 0.32 && t.anim !== "dunk" ? "hit" : t.anim,
    };
  }

  function playCartoonKnock(foeF: HTMLElement, act: ActId): FoeAnim {
    const k = knockProfile(act, power01());
    foeF.style.setProperty("--kx", `${k.x}px`);
    foeF.style.setProperty("--ky", `${k.y}px`);
    foeF.style.setProperty("--kr", `${k.r}deg`);
    foeF.style.setProperty("--knock-dur", `${k.dur}s`);
    foeF.classList.remove("cartoon-knock");
    void foeF.offsetWidth;
    foeF.classList.add("cartoon-knock");
    return k.anim;
  }

  function clearFighterClasses(el: HTMLElement, list: string[]): void {
    list.forEach((c) => el.classList.remove(c));
  }

  /** Fires the CSS travel animation and the WebGL bone clip on the same frame. */
  function startAct(youF: HTMLElement, cls: string, act: ActId): void {
    youF.classList.add(cls);
    playAttack($("#char-you"), act);
  }

  function weaponForAct(act: ActId): HandWeapon {
    if (act === "hammer") return "hammer";
    if (act === "fryingpan") return "fryingpan";
    if (act === "slipper") return "slipper";
    if (act === "foambat") return "foambat";
    return null;
  }

  function applyImpactMarks(foeC: HTMLElement, act: ActId): void {
    // Bruises only for now — no blood marks
    const bruise =
      act === "hammer" ||
      act === "fryingpan" ||
      act === "ultimate" ||
      act === "kick" ||
      act === "uppercut" ||
      act === "foambat" ||
      act === "slipper" ||
      act === "headbutt" ||
      act === "punch" ||
      act === "slap";
    if (bruise) applyHurtMarks(foeC, "bruise");
  }

  async function impact(
    foeC: HTMLElement,
    foeF: HTMLElement,
    point: { x: number; y: number; absX: number; absY: number },
    wordKey: ActId,
  ): Promise<void> {
    const p = power01();
    const reaction = ACT_REACTIONS[wordKey];
    const anim = playCartoonKnock(foeF, wordKey);
    const hard = (reaction.hard ?? false) || p > 0.72;
    const sfxKey =
      wordKey === "fryingpan" || wordKey === "foambat"
        ? "hammer"
        : wordKey === "slipper"
          ? "slap"
          : wordKey === "banana"
            ? "tomato"
            : wordKey === "watergun"
              ? "water"
              : wordKey;
    const sfx = SFX[sfxKey as keyof typeof SFX];
    if (typeof sfx === "function") sfx();
    flash();
    shake(hard);
    contactBurstAt(point.x, point.y);
    foeF.classList.add(anim);
    playReaction(foeC, anim);
    await hitStop(hard ? 80 + p * 80 : 50 + p * 50);
    showBam(pick(BAM[wordKey]), point.x - 30, point.y - 50);
    showSpeech(pick(FOE_LINES[wordKey]));
    ringAt(point.x, point.y);
    burst(point.absX, point.absY, Math.round((hard ? 18 : 10) * (0.6 + p)));
    setAvatarMood(foeC, state.foe, reaction.mood as Mood);
    applyImpactMarks(foeC, wordKey);
    await beat(Math.round(knockProfile(wordKey, p).dur * 520));
  }

  async function actPunch(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    await approach(youF, foeF);
    SFX.whoosh();
    startAct(youF, "act-punch", "punch");
    await beat(200);
    const c = midContact();
    await impact(foeC, foeF, c, "punch");
    await beat(300);
    await retreat(youF);
  }

  async function actSlap(
    youF: HTMLElement,
    foeF: HTMLElement,
    foeC: HTMLElement,
    act: ActId = "slap",
  ) {
    const youC = $("#char-you");
    const weapon = weaponForAct(act);
    if (weapon) setAvatarWeapon(youC, weapon);
    try {
      await approach(youF, foeF);
      SFX.whoosh();
      startAct(youF, "act-slap", act);
      await beat(220);
      const c = midContact();
      await impact(foeC, foeF, c, act);
      await beat(400);
      await retreat(youF);
    } finally {
      setAvatarWeapon(youC, null);
    }
  }

  async function actKick(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    await approach(youF, foeF);
    SFX.whoosh();
    startAct(youF, "act-kick", "kick");
    await beat(240);
    const c = midContact();
    c.y += 35;
    c.absY += 35;
    await impact(foeC, foeF, c, "kick");
    await beat(500);
    await retreat(youF);
  }

  async function actHeadbutt(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    await approach(youF, foeF);
    SFX.whoosh();
    startAct(youF, "act-headbutt", "headbutt");
    await beat(220);
    const c = midContact();
    c.y -= 20;
    c.absY -= 20;
    await impact(foeC, foeF, c, "headbutt");
    await beat(360);
    await retreat(youF);
  }

  async function actPush(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    await approach(youF, foeF);
    SFX.whoosh();
    startAct(youF, "act-push", "push");
    await beat(200);
    const c = midContact();
    await impact(foeC, foeF, c, "push");
    await beat(420);
    await retreat(youF);
  }

  async function actHammer(
    youF: HTMLElement,
    foeF: HTMLElement,
    foeC: HTMLElement,
    act: ActId = "hammer",
  ) {
    const youC = $("#char-you");
    const weapon = weaponForAct(act);
    if (weapon) setAvatarWeapon(youC, weapon);
    try {
      await approach(youF, foeF);
      SFX.whoosh();
      startAct(youF, "act-hammer", act);
      await beat(280);
      const c = midContact();
      c.y -= 10;
      c.absY -= 10;
      await impact(foeC, foeF, c, act);
      await beat(480);
      await retreat(youF);
    } finally {
      setAvatarWeapon(youC, null);
    }
  }

  async function actUltimate(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    if (state.ultimateCharge < ULTIMATE_NEED) return;
    state.ultimateCharge = 0;
    refreshUltimateUI();
    await approach(youF, foeF);
    startAct(youF, "act-ultimate", "ultimate");
    await beat(320);
    const c = midContact();
    await impact(foeC, foeF, c, "ultimate");
    burst(c.absX, c.absY, 40, true);
    showToast("RAGE NUKE");
    await beat(700);
    await retreat(youF);
  }

  async function actThrow(
    youF: HTMLElement,
    foeF: HTMLElement,
    foeC: HTMLElement,
    wordKey: ActId,
    fxKey: "mud" | "cream" | "tomato" | "water",
    projKind: string,
  ) {
    SFX.whoosh();
    startAct(youF, "act-throw", wordKey);
    await beat(250);
    const from = youHand();
    const to = foeHead();
    await launchProjectile(projKind, from, to);
    addAvatarSplat(foeC, fxKey);
    foeC.querySelector(`[data-fx="${fxKey}"]`)?.classList.add("on");
    await impact(foeC, foeF, to, wordKey);
    await beat(280);
  }

  async function actWater(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    const pool = $("#pool");
    pool.hidden = false;
    await approach(youF, foeF);
    startAct(youF, "act-dunk", "water");
    await beat(450);
    const c = midContact();
    c.x += 50;
    c.y += 40;
    c.absX += 50;
    c.absY += 40;
    await impact(foeC, foeF, c, "water");
    addAvatarSplat(foeC, "water");
    foeC.querySelector('[data-fx="water"]')?.classList.add("on");
    await beat(750);
    await retreat(youF);
    setTimeout(() => {
      pool.hidden = true;
    }, 400);
  }

  async function actShake(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    await approach(youF, foeF);
    startAct(youF, "act-grab", "shake");
    await beat(180);
    foeF.classList.add("shake");
    setAvatarMood(foeC, state.foe, "dizzy");
    SFX.shake();
    const c = midContact();
    showBam(pick(BAM.shake), c.x - 20, c.y - 50);
    showSpeech(pick(FOE_LINES.shake));
    shake();
    burst(c.absX, c.absY, 10);
    await beat(780);
    await retreat(youF);
  }

  async function actUpper(youF: HTMLElement, foeF: HTMLElement, foeC: HTMLElement) {
    await approach(youF, foeF);
    SFX.whoosh();
    startAct(youF, "act-upper", "uppercut");
    await beat(280);
    const c = midContact();
    await impact(foeC, foeF, c, "uppercut");
    await beat(520);
    await retreat(youF);
  }

  async function actTaunt(youF: HTMLElement, youC: HTMLElement, foeC: HTMLElement) {
    SFX.taunt();
    startAct(youF, "act-taunt", "taunt");
    setAvatarMood(youC, state.you, "smug");
    setAvatarMood(foeC, state.foe, "angry");
    const h = foeHead();
    showSpeech(pick(FOE_LINES.taunt));
    showBam(pick(BAM.taunt), h.x - 40, h.y - 60);
    await beat(900);
  }

  async function runAct(act: ActId, power = 0.55): Promise<void> {
    if (state.busy || state.sessionOver) return;
    if (!isMoveUnlocked(act, getSessions()) && act !== "ultimate") return;
    if (act === "ultimate" && state.ultimateCharge < ULTIMATE_NEED) return;
    SFX.ensure();
    hitPower = act === "ultimate" ? 1 : Math.max(0.2, Math.min(1, power));
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
        case "headbutt":
          await actHeadbutt(youF, foeF, foeC);
          break;
        case "push":
          await actPush(youF, foeF, foeC);
          break;
        case "hammer":
          await actHammer(youF, foeF, foeC, "hammer");
          break;
        case "fryingpan":
          await actHammer(youF, foeF, foeC, "fryingpan");
          break;
        case "foambat":
          await actHammer(youF, foeF, foeC, "foambat");
          break;
        case "slipper":
          await actSlap(youF, foeF, foeC, "slipper");
          break;
        case "banana":
          await actThrow(youF, foeF, foeC, "banana", "cream", "banana");
          break;
        case "watergun":
          await actThrow(youF, foeF, foeC, "watergun", "water", "water");
          break;
        case "ultimate":
          await actUltimate(youF, foeF, foeC);
          break;
        case "mud":
          await actThrow(youF, foeF, foeC, "mud", "mud", "mud");
          break;
        case "water":
          await actWater(youF, foeF, foeC);
          break;
        case "pie":
          await actThrow(youF, foeF, foeC, "pie", "cream", "pie");
          break;
        case "shake":
          await actShake(youF, foeF, foeC);
          break;
        case "tomato":
          await actThrow(youF, foeF, foeC, "tomato", "tomato", "tomato");
          break;
        case "uppercut":
          await actUpper(youF, foeF, foeC);
          break;
        case "taunt":
          await actTaunt(youF, youC, foeC);
          break;
      }
      state.hits += 1;
      bumpCombo();
      if (act === "ultimate") {
        updateRage(28 + Math.random() * 6);
      } else {
        chargeUltimate(act === "taunt" ? 6 : Math.round(8 + hitPower * 10));
        const bonus = Math.min(8, state.combo);
        updateRage(((act === "taunt" ? 4 : 8) + bonus) * (0.55 + hitPower * 0.7) + Math.random() * 3);
      }
    } finally {
      clearFighterClasses(youF, YOU_ACTS);
      clearFighterClasses(foeF, FOE_ACTS);
      foeF.classList.remove("cartoon-knock");
      resetApproach(youF);
      setAvatarMood(youC, state.you, "ready");
      setAvatarMood(foeC, state.foe, foeIdleMood(state.foe));
      youF.classList.add("idle");
      foeF.classList.add("idle");
      if (state.rage < 100 && !state.sessionOver) {
        $("#hint").textContent = `Keep going — ${state.foe.name} can take more.`;
      }
      setBusy(false);
    }
  }

  function sessionSeconds(): number {
    const end = state.endedAt || Date.now();
    const start = state.startedAt || end;
    return Math.max(0, (end - start) / 1000);
  }

  function currentPayload(): ChallengePayload {
    return buildChallengePayload({
      from: state.you.name,
      foe: state.foe,
      category: state.category,
      meme: state.meme,
      scene: state.scene,
      hits: state.hits,
      combo: state.maxCombo,
      rage: Math.round(state.peakRage),
      secs: sessionSeconds(),
      daily: state.incoming?.daily,
    });
  }

  function challengeText(): string {
    const p = currentPayload();
    const challengeBit = state.challengeMode
      ? state.challengeWon
        ? " Soft challenge cleared."
        : " Soft challenge attempt."
      : "";
    const beatBit =
      state.incoming?.beat === true
        ? " I beat their score!"
        : state.incoming?.beat === false
          ? " Couldn't beat their score — yet."
          : "";
    return `I just vented on ${p.foe.name} in VENTHIT — ${p.hits} hits, ${p.combo} HIT COMBO, ${p.rage}% rage in ${p.secs}s.${challengeBit}${beatBit} Beat me if you can.`;
  }

  function fillSharePanel(): void {
    const p = currentPayload();
    const url = challengeShareUrl(p);
    $("#challenge-copy").textContent = challengeText();
    ($("#share-link") as HTMLInputElement).value = url;
    const note = $("#beat-note");
    if (state.incoming && state.incoming.beat !== null) {
      note.hidden = false;
      if (state.incoming.beat) {
        note.className = "beat-note";
        note.textContent = `You beat ${state.incoming.from}'s score. Send it back.`;
      } else {
        note.className = "beat-note fail";
        note.textContent = `${state.incoming.from} still leads — rematch anytime.`;
      }
    } else {
      note.hidden = true;
    }
  }

  function applyIncomingPayload(p: ChallengePayload): void {
    state.incoming = {
      from: p.from,
      hits: p.hits,
      combo: p.combo,
      rage: p.rage,
      secs: p.secs,
      daily: p.daily,
      beat: null,
    };
    state.foe = { ...p.foe };
    state.category = p.category;
    state.meme = p.meme;
    state.scene = p.scene;
    state.memeLines =
      p.meme !== "none"
        ? (MEMES.find((m) => m.id === p.meme)?.lines ?? null)
        : null;
    writeFoeForm();
    $$("#scene-grid .scene-card").forEach((card) =>
      card.classList.toggle("on", card.dataset.scene === state.scene),
    );
    $$("#meme-grid .meme-card").forEach((c) =>
      c.classList.toggle("on", c.dataset.meme === state.meme),
    );
    renderAvatar($("#char-foe-preview"), state.foe, foeIdleMood(state.foe));
    updateChallengePrompt();
  }

  function showIncomingBanner(p: ChallengePayload): void {
    $("#incoming-banner").hidden = false;
    $("#incoming-title").textContent = p.daily
      ? `Daily · ${dailyChallengeLabel(p.daily)}`
      : `${p.from} challenged you`;
    $("#incoming-copy").textContent = `Beat ${p.hits} hits · ${p.combo} combo · ${p.rage}% rage vs ${p.foe.name}`;
  }

  function startDailyChallenge(): void {
    const day = todayKey();
    const memeId = dailyMemeId(day);
    applyMeme(memeId);
    const meme = MEMES.find((m) => m.id === memeId);
    state.incoming = {
      from: "Daily Rage",
      hits: 12,
      combo: 5,
      rage: 70,
      secs: 45,
      daily: day,
      beat: null,
    };
    showToast(dailyChallengeLabel(day));
    $("#incoming-banner").hidden = false;
    $("#incoming-title").textContent = `Daily · ${dailyChallengeLabel(day)}`;
    $("#incoming-copy").textContent = meme
      ? `Today's target: ${meme.name}. Soft goal — 70% rage / 5 combo.`
      : "Today's rage target is ready.";
    showScreen("#screen-setup");
    showPanel("foe");
    SFX.ui();
  }

  function endSession(): void {
    if (state.sessionOver) return;
    state.sessionOver = true;
    state.endedAt = Date.now();
    if (state.comboTimer) clearTimeout(state.comboTimer);
    stopChallengeTimer();
    stopIdleTalk();
    setBusy(true);

    const secs = sessionSeconds();
    const { label } = rageLevelFor(state.peakRage);
    $("#result-match").textContent = `${state.you.name} vs ${state.foe.name}`;
    $("#result-time").textContent = `${secs.toFixed(1)}s`;
    $("#result-hits").textContent = String(state.hits);
    $("#result-combo").textContent = String(state.maxCombo);
    $("#result-rage").textContent = `${Math.round(state.peakRage)}%`;
    $("#result-level").textContent = `RAGE LEVEL: ${label}`;

    if (state.incoming) {
      state.incoming.beat = beatChallenge(
        {
          v: 1,
          from: state.incoming.from,
          foe: state.foe,
          category: state.category,
          meme: state.meme,
          scene: state.scene,
          hits: state.incoming.hits,
          combo: state.incoming.combo,
          rage: state.incoming.rage,
          secs: state.incoming.secs,
          daily: state.incoming.daily,
        },
        {
          hits: state.hits,
          combo: state.maxCombo,
          rage: Math.round(state.peakRage),
        },
      );
    }

    const badge = $("#result-badge");
    if (state.incoming?.beat === true) {
      badge.hidden = false;
      badge.textContent = "SCORE BEATEN";
      badge.className = "result-badge win";
    } else if (state.incoming?.beat === false) {
      badge.hidden = false;
      badge.textContent = "SCORE STANDS";
      badge.className = "result-badge fail";
    } else if (state.challengeMode) {
      badge.hidden = false;
      if (state.challengeWon) {
        badge.textContent = "CHALLENGE CLEARED";
        badge.className = "result-badge win";
      } else if (state.challengeWon === false) {
        badge.textContent = "CHALLENGE ATTEMPTED";
        badge.className = "result-badge fail";
      } else {
        badge.textContent = "SESSION DONE";
        badge.className = "result-badge";
      }
    } else {
      badge.hidden = true;
    }

    $("#feeling-block").hidden = false;
    $("#challenge-block").hidden = true;
    $("#arena-challenge-bar").hidden = true;

    const { sessions, previous } = recordSessionComplete();
    const unlocked = newlyUnlockedMoves(previous, sessions);
    const note = $("#unlock-note");
    if (unlocked.length) {
      note.hidden = false;
      note.textContent = `Unlocked: ${unlocked.map((u) => u.name).join(", ")}`;
      showToast(`NEW: ${unlocked.map((u) => u.name).join(", ")}`);
    } else {
      note.hidden = true;
    }
    refreshSessionPill();
    refreshMovesUI();

    showScreen("#screen-result");
    SFX.ui();
  }

  function enterArena(): void {
    readForm("#form-you", state.you);
    readForm("#form-foe", state.foe);
    state.rage = 0;
    state.peakRage = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hits = 0;
    state.calmed = false;
    state.sessionOver = false;
    state.busy = false;
    state.ultimateCharge = 0;
    state.challengeWon = null;
    state.startedAt = Date.now();
    state.endedAt = 0;
    if (state.comboTimer) {
      clearTimeout(state.comboTimer);
      state.comboTimer = null;
    }
    stopChallengeTimer();
    stopIdleTalk();
    updateRage(0);
    refreshUltimateUI();
    $("#combo-box").hidden = true;

    const youF = $("#fighter-you");
    const foeF = $("#fighter-foe");
    clearFighterClasses(youF, YOU_ACTS);
    clearFighterClasses(foeF, FOE_ACTS);
    resetApproach(youF);

    $("#arena").dataset.scene = state.scene;
    // Builder previews hold two WebGL contexts — drop them so both arena
    // fighters can mount. Show the arena first so canvas sizing is non-zero.
    releaseAvatar($("#char-you-preview"));
    releaseAvatar($("#char-foe-preview"));
    showScreen("#screen-arena");
    $("#tag-you").textContent = state.you.name;
    $("#tag-foe").textContent = state.foe.name;
    $("#pool").hidden = true;
    $("#speech").hidden = true;
    $("#challenge-clock").hidden = true;
    const bar = $("#arena-challenge-bar");
    if (state.incoming) {
      bar.hidden = false;
      $("#arena-challenge-copy").textContent = `Beat ${state.incoming.from}: ${state.incoming.hits} hits · ${state.incoming.combo} combo · ${state.incoming.rage}% rage`;
    } else {
      bar.hidden = true;
    }
    if (state.incoming) {
      $("#hint").textContent = `Challenge from ${state.incoming.from}. Hit Done when you're ready to compare.`;
    } else if (state.challengeMode) {
      $("#hint").textContent = `Soft challenge on ${state.foe.name}: go hard. No timer — hit Done when finished.`;
    } else {
      $("#hint").textContent = `${state.foe.name} is waiting. Keys 1–0, Q/W/E, U work too. Hit Done when you're done.`;
    }
    youF.classList.add("idle");
    foeF.classList.add("idle");
    setBusy(false);
    void mountArenaFighters(
      $("#char-you"),
      state.you,
      "ready",
      YOU_FIGHTER_VIEW,
      $("#char-foe"),
      state.foe,
      foeIdleMood(state.foe),
      FOE_FIGHTER_VIEW,
    );
    scheduleIdleTalk();
    SFX.ui();
  }

  function initLandingCanvas(): void {
    const c = $("#landing-canvas") as HTMLCanvasElement;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let particles: Array<{ x: number; y: number; r: number; vx: number; vy: number; a: number }> =
      [];
    let raf = 0;

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
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255,176,32,${p.a})`;
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
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

  $("#btn-start").addEventListener("click", () => {
    SFX.ensure();
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

  $("#btn-next-scene").addEventListener("click", () => {
    readForm("#form-foe", state.foe);
    updateChallengePrompt();
    SFX.ui();
    showPanel("scene");
  });

  $("#btn-back-foe").addEventListener("click", () => {
    SFX.ui();
    showPanel("foe");
  });

  $("#btn-arena").addEventListener("click", enterArena);

  $("#btn-done").addEventListener("click", () => {
    if (!state.sessionOver) endSession();
  });

  $("#btn-ultimate").addEventListener("click", () => void runAct("ultimate"));

  $$("#mode-row .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$("#mode-row .chip").forEach((c) => c.classList.remove("on"));
      chip.classList.add("on");
      state.challengeMode = chip.dataset.mode === "challenge";
      SFX.ui();
    });
  });

  $("#btn-reset").addEventListener("click", () => {
    stopChallengeTimer();
    stopIdleTalk();
    showScreen("#screen-setup");
    showPanel("you");
  });

  $("#btn-feel-yes").addEventListener("click", () => {
    SFX.ui();
    $("#feeling-block").hidden = true;
    $("#challenge-block").hidden = false;
    fillSharePanel();
  });

  $("#btn-feel-no").addEventListener("click", () => {
    SFX.ui();
    showScreen("#screen-setup");
    showPanel("foe");
  });

  $("#btn-copy-challenge").addEventListener("click", async () => {
    const text = challengeText();
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied!");
    } catch {
      showToast("Copy failed — select the text");
    }
    SFX.ui();
  });

  $("#btn-copy-link").addEventListener("click", async () => {
    const url = challengeShareUrl(currentPayload());
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied");
    } catch {
      showToast("Copy failed");
    }
    SFX.ui();
  });

  $("#btn-share-native").addEventListener("click", async () => {
    const p = currentPayload();
    const url = challengeShareUrl(p);
    const result = await nativeShare({
      title: "VENTHIT challenge",
      text: challengeBlurb(p).replace(url, "").trim(),
      url,
    });
    if (result === "shared") showToast("Shared");
    else if (result === "copied") showToast("Copied to clipboard");
    else if (result === "failed") showToast("Share failed");
    SFX.ui();
  });

  $("#btn-whatsapp").addEventListener("click", () => {
    const p = currentPayload();
    window.open(whatsappShareUrl(challengeBlurb(p)), "_blank", "noopener,noreferrer");
    SFX.ui();
  });

  $("#btn-new-session").addEventListener("click", () => {
    SFX.ui();
    state.incoming = null;
    clearChallengeFromUrl();
    $("#incoming-banner").hidden = true;
    $("#arena-challenge-bar").hidden = true;
    showScreen("#screen-setup");
    showPanel("you");
  });

  $("#btn-daily").addEventListener("click", () => {
    SFX.ensure();
    startDailyChallenge();
  });

  $("#btn-accept-challenge").addEventListener("click", () => {
    SFX.ui();
    showScreen("#screen-setup");
    showPanel("scene");
  });

  $$(".step").forEach((s) => {
    s.addEventListener("click", () => showPanel(s.dataset.go as SetupPanel));
  });

  $$("#cat-row .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      applyCategory(chip.dataset.v as CategoryId);
      SFX.ui();
    });
  });

  $$("#meme-grid .meme-card").forEach((card) => {
    card.addEventListener("click", () => {
      applyMeme((card.dataset.meme || "none") as MemeId);
      SFX.ui();
    });
  });

  $$("#scene-grid .scene-card").forEach((card) => {
    card.addEventListener("click", () => {
      $$("#scene-grid .scene-card").forEach((c) => c.classList.remove("on"));
      card.classList.add("on");
      state.scene = card.dataset.scene as SceneId;
      SFX.ui();
    });
  });

  $$(".move").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      if ((btn as HTMLButtonElement).disabled) return;
      const act = btn.dataset.act as ActId;
      if (!isMoveUnlocked(act, getSessions())) return;
      e.preventDefault();
      beginCharge(act, btn, "pointer");
    });
    btn.addEventListener("click", (e) => e.preventDefault());
  });

  const CHARGE_MS = 900;
  const INSTANT_ACTS = new Set<ActId>(["taunt", "ultimate"]);
  let charge:
    | { act: ActId; started: number; btn: HTMLElement | null; raf: number; from: "pointer" | "key" }
    | null = null;

  function paintCharge(p: number, btn: HTMLElement | null): void {
    const bar = $("#hit-power");
    const fill = $("#hit-power-fill");
    const val = $("#hit-power-val");
    bar.hidden = false;
    fill.style.width = `${Math.round(p * 100)}%`;
    val.textContent = `${Math.round(p * 100)}%`;
    if (btn) btn.style.setProperty("--charge", `${Math.round(p * 100)}`);
  }

  function beginCharge(act: ActId, btn: HTMLElement | null, from: "pointer" | "key"): void {
    if (state.busy || state.sessionOver || charge) return;
    if (INSTANT_ACTS.has(act)) {
      void runAct(act, 1);
      return;
    }
    if (!isMoveUnlocked(act, getSessions()) && act !== "ultimate") {
      const need = MOVES.find((m) => m.act === act)?.unlockAt ?? 0;
      showToast(`Unlock after ${need} session${need === 1 ? "" : "s"}`);
      return;
    }
    SFX.ensure();
    charge = { act, started: performance.now(), btn, raf: 0, from };
    btn?.classList.add("charging");
    $("#hint").textContent = "Hold to charge — release to hit.";
    const tick = (): void => {
      if (!charge) return;
      const t = (performance.now() - charge.started) / CHARGE_MS;
      const p = 0.2 + 0.8 * Math.min(1, t);
      paintCharge(p, charge.btn);
      charge.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function finishCharge(): void {
    if (!charge) return;
    const { act, started, btn, raf } = charge;
    cancelAnimationFrame(raf);
    const t = (performance.now() - started) / CHARGE_MS;
    const p = 0.2 + 0.8 * Math.min(1, t);
    charge = null;
    btn?.classList.remove("charging");
    btn?.style.removeProperty("--charge");
    $("#hit-power").hidden = true;
    void runAct(act, p);
  }

  window.addEventListener("pointerup", () => {
    if (charge?.from === "pointer") finishCharge();
  });
  window.addEventListener("pointercancel", () => {
    if (charge?.from === "pointer") finishCharge();
  });

  window.addEventListener("keydown", (e) => {
    if (!$("#screen-arena").classList.contains("active")) return;
    if (e.repeat) return;
    if (e.code === "Space") e.preventDefault();
    const act = KEY_MAP[e.code];
    if (!act) return;
    e.preventDefault();
    const btn = document.querySelector(`.move[data-act="${act}"]`) as HTMLElement | null;
    beginCharge(act, btn, "key");
  });

  window.addEventListener("keyup", (e) => {
    if (!charge || charge.from !== "key") return;
    const act = KEY_MAP[e.code];
    if (act && act === charge.act) finishCharge();
  });

  $("#fighter-foe").addEventListener("click", () => {
    if ($("#screen-arena").classList.contains("active")) void runAct("punch", 0.45);
  });

  bindForm("#form-you", "you", "#char-you-preview");
  bindForm("#form-foe", "foe", "#char-foe-preview");
  $("#form-foe").querySelector('[name="name"]')?.addEventListener("input", () => {
    readForm("#form-foe", state.foe);
    updateChallengePrompt();
  });
  initLandingCanvas();
  refreshUltimateUI();
  refreshMovesUI();
  refreshSessionPill();
  updateChallengePrompt();

  const dailyBtn = $("#btn-daily");
  dailyBtn.textContent = dailyChallengeLabel();

  const incoming = readChallengeFromLocation();
  if (incoming) {
    applyIncomingPayload(incoming);
    showIncomingBanner(incoming);
  }
}
