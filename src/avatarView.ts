import { OVERLAY_LAYERS, renderChar, setHandWeapon, setMood } from "./character";
import type { Avatar3D, Avatar3DOptions, SplatKind, Weapon3D } from "./avatar3d";
import type { CharData, Mood } from "./types";

export type { Avatar3DOptions, SplatKind, Weapon3D } from "./avatar3d";

/**
 * One seam for every character on screen — builder previews and arena fighters.
 *
 * three.js is loaded lazily so the landing screen doesn't pay for it: the SVG
 * character renders immediately, then upgrades to WebGL once the chunk arrives.
 * Anything that fails along the way just stays on SVG, which is also why every
 * call here has a working SVG branch.
 */

interface Host {
  avatar: Avatar3D | null;
  opts: Avatar3DOptions;
  data: CharData;
  mood: Mood;
  weapon: Weapon3D;
  pending: boolean;
  failed: boolean;
}

const hosts = new WeakMap<HTMLElement, Host>();
/** Bumped on release so queued upgrades for that element are ignored. */
const hostGeneration = new WeakMap<HTMLElement, number>();

let modPromise: Promise<typeof import("./avatar3d")> | null = null;

/** One mount at a time — creating several WebGL contexts at once often fails. */
let upgradeQueue: Promise<void> = Promise.resolve();

function wantsWebGL(opts: Avatar3DOptions): boolean {
  return opts.framing === "arena";
}

function loadAvatarModule(): Promise<typeof import("./avatar3d")> {
  if (!modPromise) modPromise = import("./avatar3d");
  return modPromise;
}

let webglOk: boolean | null = null;

/** Local WebGL probe so an unsupported browser never downloads three.js. */
function supportsWebGL(): boolean {
  if (webglOk !== null) return webglOk;
  try {
    const canvas = document.createElement("canvas");
    webglOk = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    webglOk = false;
  }
  return webglOk;
}

function accentFor(el: HTMLElement): string {
  const foe = el.closest(".stage-preview")?.classList.contains("foe-glow") || el.closest(".foe-side");
  return foe ? "#e11d48" : "#ffb020";
}

function bindPointer(el: HTMLElement, avatar: Avatar3D): void {
  const surface = (el.closest(".stage-preview") as HTMLElement | null) ?? el;
  surface.addEventListener("pointermove", (e) => {
    const r = surface.getBoundingClientRect();
    avatar.setPointer(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      ((e.clientY - r.top) / r.height) * 2 - 1,
    );
  });
  surface.addEventListener("pointerleave", () => avatar.setPointer(0, 0));
}

function fallback(el: HTMLElement, h: Host): void {
  h.failed = true;
  h.pending = false;
  h.avatar = null;
  el.classList.remove("is-3d");
  renderChar(el, h.data, h.mood);
  if (h.weapon) setHandWeapon(el, h.weapon);
}

function upgrade(el: HTMLElement, h: Host, generation: number): void {
  upgradeQueue = upgradeQueue.then(() =>
    loadAvatarModule()
      .then((mod) => {
        if ((hostGeneration.get(el) ?? 0) !== generation) return;
        if (!mod.isWebGLAvailable()) {
          fallback(el, h);
          return;
        }
        el.innerHTML = "";
        const created = mod.mountAvatar3D(el, { accent: accentFor(el), ...h.opts });
        if ((hostGeneration.get(el) ?? 0) !== generation) {
          created?.dispose();
          return;
        }
        if (!created) {
          fallback(el, h);
          return;
        }
        // Splats and bruises are DOM layers, so they ride on top of the canvas.
        el.insertAdjacentHTML("beforeend", OVERLAY_LAYERS);
        h.avatar = created;
        h.pending = false;
        el.classList.add("is-3d");
        if (h.opts.pointerTracking !== false) bindPointer(el, created);
        created.update(h.data, h.mood);
        created.setWeapon(h.weapon);
      })
      .catch(() => {
        if ((hostGeneration.get(el) ?? 0) === generation) fallback(el, h);
      }),
  );
}

function waitForAvatar(el: HTMLElement): Promise<boolean> {
  return new Promise((resolve) => {
    const tick = () => {
      const h = hosts.get(el);
      if (h?.avatar) {
        resolve(true);
        return;
      }
      if (h?.failed) {
        resolve(false);
        return;
      }
      if (!h?.pending) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Renders a character, upgrading it to WebGL when the browser allows. */
export function renderAvatar(
  el: HTMLElement,
  data: CharData,
  mood: Mood,
  opts: Avatar3DOptions = {},
): void {
  el.dataset.body = data.body || "avg";
  el.dataset.mood = mood;

  const existing = hosts.get(el);
  const h: Host = existing ?? {
    avatar: null,
    opts,
    data,
    mood,
    weapon: null,
    pending: false,
    failed: false,
  };
  h.data = { ...data };
  h.mood = mood;
  h.opts = opts;
  hosts.set(el, h);

  if (h.avatar) {
    h.avatar.update(data, mood);
    return;
  }

  // Builder previews stay SVG so arena fighters get the only WebGL slots.
  if (!wantsWebGL(opts)) {
    h.pending = false;
    h.failed = false;
    renderChar(el, data, mood);
    return;
  }

  if (h.failed || !supportsWebGL()) {
    renderChar(el, data, mood);
    return;
  }

  if (!h.pending) {
    h.pending = true;
    const generation = (hostGeneration.get(el) ?? 0) + 1;
    hostGeneration.set(el, generation);
    // SVG placeholder until the WebGL chunk resolves.
    renderChar(el, data, mood);
    upgrade(el, h, generation);
  }
}

/**
 * Mounts both arena fighters to WebGL one after another. The foe was often
 * stuck on SVG when both tried to create a context at the same time.
 */
export async function mountArenaFighters(
  youEl: HTMLElement,
  youData: CharData,
  youMood: Mood,
  youOpts: Avatar3DOptions,
  foeEl: HTMLElement,
  foeData: CharData,
  foeMood: Mood,
  foeOpts: Avatar3DOptions,
): Promise<void> {
  // Let the arena layout settle so canvas sizing is non-zero.
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  releaseAvatar(youEl);
  releaseAvatar(foeEl);
  renderAvatar(youEl, youData, youMood, youOpts);
  const youOk = await waitForAvatar(youEl);
  if (!youOk) {
    releaseAvatar(youEl);
    renderAvatar(youEl, youData, youMood, youOpts);
    await waitForAvatar(youEl);
  }
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  renderAvatar(foeEl, foeData, foeMood, foeOpts);
  let foeOk = await waitForAvatar(foeEl);
  if (!foeOk) {
    releaseAvatar(foeEl);
    await new Promise<void>((r) => setTimeout(r, 80));
    renderAvatar(foeEl, foeData, foeMood, foeOpts);
    foeOk = await waitForAvatar(foeEl);
  }
  if (!foeOk) {
    console.warn("[venthit] foe WebGL mount failed — staying on SVG");
  }
}

/** Changes expression without rebuilding the character or losing its splats. */
export function setAvatarMood(el: HTMLElement, data: CharData, mood: Mood): void {
  el.dataset.mood = mood;
  const h = hosts.get(el);
  if (h) {
    h.data = { ...data };
    h.mood = mood;
  }
  if (h?.avatar) {
    h.avatar.update(data, mood);
    return;
  }
  // Don't stomp a WebGL upgrade in progress — renderChar would leave SVG stuck on.
  if (h?.pending) return;
  setMood(el, data, mood);
}

export function playAttack(el: HTMLElement, act: string): void {
  hosts.get(el)?.avatar?.attack(act);
}

/** Stops a looping clip (walk) so idle pose resumes. */
export function stopAttack(el: HTMLElement): void {
  hosts.get(el)?.avatar?.stopClip();
}

export function playReaction(el: HTMLElement, anim: string): void {
  hosts.get(el)?.avatar?.react(anim);
}

export function setAvatarWeapon(el: HTMLElement, kind: Weapon3D): void {
  const h = hosts.get(el);
  if (h) h.weapon = kind;
  if (h?.avatar) {
    h.avatar.setWeapon(kind);
    return;
  }
  setHandWeapon(el, kind);
}

export function addAvatarSplat(el: HTMLElement, kind: SplatKind): void {
  const h = hosts.get(el);
  if (h?.avatar) {
    h.avatar.addSplat(kind);
    return;
  }
  el.querySelector(`[data-fx="${kind}"]`)?.classList.add("on");
}

/** Frees a WebGL slot and clears mount state so the element can upgrade again. */
export function releaseAvatar(el: HTMLElement): void {
  hostGeneration.set(el, (hostGeneration.get(el) ?? 0) + 1);
  const h = hosts.get(el);
  if (!h) return;
  if (h.avatar) {
    h.avatar.dispose();
    h.avatar = null;
  }
  h.pending = false;
  h.failed = false;
  h.weapon = null;
  el.classList.remove("is-3d");
}

export function disposeAvatar(el: HTMLElement): void {
  releaseAvatar(el);
}
