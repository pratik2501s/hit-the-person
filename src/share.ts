import { MEMES } from "./data";
import type {
  Accessory,
  BodyType,
  CategoryId,
  CharData,
  Expression,
  FaceShape,
  HairStyle,
  MemeId,
  SceneId,
  ShoeStyle,
  Vibe,
} from "./types";

/** Compact foe + score payload for URL hash challenges (no backend). */
export interface ChallengePayload {
  v: 1;
  from: string;
  foe: CharData;
  category: CategoryId;
  meme: MemeId;
  scene: SceneId;
  hits: number;
  combo: number;
  rage: number;
  secs: number;
  daily?: string; // YYYY-MM-DD when from daily challenge
}

export interface IncomingChallenge {
  payload: ChallengePayload;
  url: string;
}

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(raw: string): string {
  const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function clampStr(s: unknown, max: number, fallback: string): string {
  if (typeof s !== "string") return fallback;
  return s.trim().slice(0, max) || fallback;
}

function clampHex(s: unknown, fallback: string): string {
  if (typeof s !== "string") return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

function oneOf<T extends string>(s: unknown, allowed: readonly T[], fallback: T): T {
  return typeof s === "string" && (allowed as readonly string[]).includes(s)
    ? (s as T)
    : fallback;
}

function sanitizeChar(raw: unknown): CharData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    name: clampStr(o.name, 18, "Target"),
    skin: clampHex(o.skin, "#c9956c"),
    hair: clampHex(o.hair, "#111111"),
    shirt: clampHex(o.shirt, "#c0392b"),
    hairStyle: oneOf(
      o.hairStyle,
      ["short", "messy", "long", "buzz", "bun"] as const,
      "short",
    ) as HairStyle,
    body: oneOf(o.body, ["avg", "slim", "stocky"] as const, "avg") as BodyType,
    vibe: oneOf(o.vibe, ["smug", "angry", "nerdy", "fancy"] as const, "smug") as Vibe,
    face: oneOf(o.face, ["round", "soft", "square"] as const, "round") as FaceShape,
    accessory: oneOf(
      o.accessory,
      ["none", "glasses", "hat", "headphones"] as const,
      "none",
    ) as Accessory,
    shoes: oneOf(
      o.shoes,
      ["sneakers", "boots", "slippers"] as const,
      "sneakers",
    ) as ShoeStyle,
    expression: oneOf(
      o.expression,
      ["calm", "smirk", "frown", "wink"] as const,
      "smirk",
    ) as Expression,
  };
}

export function buildChallengePayload(input: {
  from: string;
  foe: CharData;
  category: CategoryId;
  meme: MemeId;
  scene: SceneId;
  hits: number;
  combo: number;
  rage: number;
  secs: number;
  daily?: string;
}): ChallengePayload {
  return {
    v: 1,
    from: clampStr(input.from, 18, "Someone"),
    foe: sanitizeChar(input.foe),
    category: oneOf(
      input.category,
      [
        "boss",
        "ex",
        "friend",
        "teacher",
        "politician",
        "influencer",
        "coworker",
        "family",
        "fictional",
        "custom",
      ] as const,
      "custom",
    ),
    meme: oneOf(
      input.meme,
      ["none", "monday", "wifi", "exams", "traffic", "salary", "internet"] as const,
      "none",
    ),
    scene: oneOf(
      input.scene,
      ["office", "classroom", "street", "bedroom"] as const,
      "office",
    ),
    hits: Math.max(0, Math.round(input.hits)),
    combo: Math.max(0, Math.round(input.combo)),
    rage: Math.max(0, Math.min(100, Math.round(input.rage))),
    secs: Math.max(0, Math.round(input.secs * 10) / 10),
    daily: input.daily,
  };
}

export function encodeChallenge(payload: ChallengePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeChallenge(token: string): ChallengePayload | null {
  try {
    const data = JSON.parse(fromBase64Url(token)) as Record<string, unknown>;
    if (data.v !== 1) return null;
    return buildChallengePayload({
      from: clampStr(data.from, 18, "Someone"),
      foe: sanitizeChar(data.foe),
      category: data.category as CategoryId,
      meme: data.meme as MemeId,
      scene: data.scene as SceneId,
      hits: Number(data.hits) || 0,
      combo: Number(data.combo) || 0,
      rage: Number(data.rage) || 0,
      secs: Number(data.secs) || 0,
      daily: typeof data.daily === "string" ? data.daily : undefined,
    });
  } catch {
    return null;
  }
}

export function challengeShareUrl(payload: ChallengePayload): string {
  const origin = window.location.origin + window.location.pathname;
  return `${origin}#c=${encodeChallenge(payload)}`;
}

export function readChallengeFromLocation(): ChallengePayload | null {
  const hash = window.location.hash.replace(/^#/, "");
  let token: string | null = null;
  if (hash.startsWith("c=")) {
    token = decodeURIComponent(hash.slice(2));
  } else {
    token = new URLSearchParams(window.location.search).get("c");
  }
  if (!token) return null;
  return decodeChallenge(token);
}

export function clearChallengeFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("c");
  url.hash = "";
  history.replaceState(null, "", url.pathname + url.search);
}

export function challengeBlurb(p: ChallengePayload): string {
  return `${p.from} challenged you on VENTHIT — beat ${p.hits} hits / ${p.combo} combo / ${p.rage}% rage vs ${p.foe.name}. ${challengeShareUrl(p)}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function nativeShare(opts: {
  title: string;
  text: string;
  url: string;
}): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(`${opts.text}\n${opts.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

/** YYYY-MM-DD in local time */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashDay(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Date-seeded meme enemy — same for everyone on that day. */
export function dailyMemeId(day = todayKey()): MemeId {
  const pool = MEMES.filter((m) => m.id !== "none");
  if (!pool.length) return "monday";
  const idx = hashDay(day) % pool.length;
  return pool[idx]!.id;
}

export function dailyChallengeLabel(day = todayKey()): string {
  const id = dailyMemeId(day);
  const meme = MEMES.find((m) => m.id === id);
  return meme ? `Destroy ${meme.name}` : "Daily Rage";
}

export function beatChallenge(
  payload: ChallengePayload,
  yours: { hits: number; combo: number; rage: number },
): boolean {
  // Prefer peak rage, then combo, then hits
  if (yours.rage !== payload.rage) return yours.rage > payload.rage;
  if (yours.combo !== payload.combo) return yours.combo > payload.combo;
  return yours.hits > payload.hits;
}
