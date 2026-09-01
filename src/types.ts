export type HairStyle = "short" | "messy" | "long" | "buzz" | "bun";
export type BodyType = "avg" | "slim" | "stocky";
export type Vibe = "smug" | "angry" | "nerdy" | "fancy";
export type FaceShape = "round" | "soft" | "square";
export type Accessory = "none" | "glasses" | "hat" | "headphones";
export type ShoeStyle = "sneakers" | "boots" | "slippers";
export type Expression = "calm" | "smirk" | "frown" | "wink";

export type Mood =
  | "smug"
  | "annoyed"
  | "angry"
  | "ready"
  | "hurt"
  | "shocked"
  | "dizzy"
  | "scared"
  | "crying"
  | "laughing"
  | "nerdy"
  | "fancy";

export type SceneId = "office" | "classroom" | "street" | "bedroom";

export type CategoryId =
  | "boss"
  | "ex"
  | "friend"
  | "teacher"
  | "politician"
  | "influencer"
  | "coworker"
  | "family"
  | "fictional"
  | "custom";

export type MemeId =
  | "none"
  | "monday"
  | "wifi"
  | "exams"
  | "traffic"
  | "salary"
  | "internet";

export type RageLevel = "calm" | "annoyed" | "angry" | "furious" | "nuclear";

export type ActId =
  | "punch"
  | "slap"
  | "kick"
  | "mud"
  | "water"
  | "pie"
  | "shake"
  | "tomato"
  | "uppercut"
  | "taunt"
  | "headbutt"
  | "push"
  | "hammer"
  | "ultimate"
  | "fryingpan"
  | "slipper"
  | "foambat"
  | "banana"
  | "watergun";

export type FoeAnim =
  | "hit"
  | "spin"
  | "launch"
  | "shake"
  | "dunk"
  | "upper"
  | "fall"
  | "run"
  | "cry";

export type SetupPanel = "you" | "foe" | "scene";

export interface CharData {
  name: string;
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: HairStyle;
  body: BodyType;
  vibe: Vibe;
  face: FaceShape;
  accessory: Accessory;
  shoes: ShoeStyle;
  expression: Expression;
}

export interface CategoryPreset {
  id: CategoryId;
  label: string;
  name: string;
  shirt: string;
  hair: string;
  skin: string;
  vibe: Vibe;
  hairStyle: HairStyle;
  body: BodyType;
  scene: SceneId;
}

export interface SceneInfo {
  id: SceneId;
  label: string;
  blurb: string;
}

export interface MemePreset {
  id: MemeId;
  label: string;
  blurb: string;
  name: string;
  shirt: string;
  hair: string;
  skin: string;
  vibe: Vibe;
  hairStyle: HairStyle;
  body: BodyType;
  face: FaceShape;
  accessory: Accessory;
  shoes: ShoeStyle;
  expression: Expression;
  scene: SceneId;
  lines: string[];
}

export interface MoveDef {
  act: ActId;
  ico: string;
  name: string;
  key: string;
  unlockAt: number;
}

export interface ActReaction {
  mood: Mood;
  anim: FoeAnim;
  hard?: boolean;
}

/** Incoming friend/daily challenge loaded from URL. */
export interface IncomingChallengeState {
  from: string;
  hits: number;
  combo: number;
  rage: number;
  secs: number;
  daily?: string;
  beat: boolean | null;
}

export interface GameState {
  you: CharData;
  foe: CharData;
  category: CategoryId;
  meme: MemeId;
  scene: SceneId;
  rage: number;
  peakRage: number;
  combo: number;
  maxCombo: number;
  hits: number;
  startedAt: number;
  endedAt: number;
  comboTimer: ReturnType<typeof setTimeout> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  challengeTimer: ReturnType<typeof setInterval> | null;
  busy: boolean;
  calmed: boolean;
  sessionOver: boolean;
  challengeMode: boolean;
  challengeSeconds: number;
  challengeLeft: number;
  challengeWon: boolean | null;
  ultimateCharge: number;
  memeLines: string[] | null;
  incoming: IncomingChallengeState | null;
}
