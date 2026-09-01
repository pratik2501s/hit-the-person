import * as THREE from "three";
import type { Accessory, CharData, FaceShape, HairStyle, Mood, ShoeStyle, Vibe } from "./types";

/**
 * WebGL avatar renderer.
 *
 * The figure is generated in code rather than loaded from a GLB: every body part
 * is its own mesh so the builder's colour/style chips can each drive something,
 * which a single baked character mesh could not support.
 *
 * Bones use Mixamo's naming convention so a real rigged GLB can be swapped in
 * later and reuse the same pose code.
 */

const BONE = {
  hips: "mixamorig:Hips",
  spine: "mixamorig:Spine",
  spine1: "mixamorig:Spine1",
  spine2: "mixamorig:Spine2",
  neck: "mixamorig:Neck",
  head: "mixamorig:Head",
  lShoulder: "mixamorig:LeftShoulder",
  lArm: "mixamorig:LeftArm",
  lForeArm: "mixamorig:LeftForeArm",
  lHand: "mixamorig:LeftHand",
  rShoulder: "mixamorig:RightShoulder",
  rArm: "mixamorig:RightArm",
  rForeArm: "mixamorig:RightForeArm",
  rHand: "mixamorig:RightHand",
  lUpLeg: "mixamorig:LeftUpLeg",
  lLeg: "mixamorig:LeftLeg",
  lFoot: "mixamorig:LeftFoot",
  rUpLeg: "mixamorig:RightUpLeg",
  rLeg: "mixamorig:RightLeg",
  rFoot: "mixamorig:RightFoot",
} as const;

type BoneMap = Record<string, THREE.Object3D>;

// Proportions target a slightly stylised adult: hip height ~53% of stature,
// which is what keeps the silhouette from reading as stilt-legged.
const HIP_Y = 0.78;
const HEAD_R = 0.143;
const SEG = {
  spine: 0.1,
  spine1: 0.11,
  spine2: 0.11,
  neck: 0.13,
  headUp: 0.115,
  upperArm: 0.22,
  foreArm: 0.2,
  upLeg: 0.34,
  lowLeg: 0.32,
};

function shade(hex: string, amt: number): string {
  const n = hex.replace("#", "");
  const full =
    n.length === 3
      ? n
          .split("")
          .map((c) => c + c)
          .join("")
      : n;
  const num = parseInt(full, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function skinMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.62,
    metalness: 0,
  });
}

function clothMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.82,
    metalness: 0,
  });
}

function hairMat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.45,
    metalness: 0.05,
  });
}

/** Capsule hanging downward from a joint at the local origin. */
function limb(radius: number, length: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(radius, length, 4, 16);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  return mesh;
}

function bone(name: string, parent: THREE.Object3D, y: number, x = 0, z = 0): THREE.Object3D {
  const b = new THREE.Object3D();
  b.name = name;
  b.position.set(x, y, z);
  parent.add(b);
  return b;
}

const SHOE_COLORS: Record<ShoeStyle, { main: string; sole: string; accent: string }> = {
  sneakers: { main: "#f5f5f5", sole: "#dddddd", accent: "#e11d48" },
  boots: { main: "#1a1a1a", sole: "#0d0d0d", accent: "#3a3a3a" },
  slippers: { main: "#f5a3c7", sole: "#e07fa8", accent: "#ffd0e3" },
};

interface MoodPose {
  browAngle: number;
  browY: number;
  eyeOpen: number;
  mouth: "smile" | "frown" | "flat" | "open" | "round" | "wave";
  headTilt: number;
  tears?: boolean;
}

const MOOD_POSES: Record<Mood, MoodPose> = {
  smug: { browAngle: 0.28, browY: 0.004, eyeOpen: 0.7, mouth: "smile", headTilt: 0.08 },
  annoyed: { browAngle: -0.3, browY: -0.004, eyeOpen: 0.72, mouth: "flat", headTilt: 0 },
  angry: { browAngle: -0.55, browY: -0.008, eyeOpen: 0.85, mouth: "frown", headTilt: -0.05 },
  ready: { browAngle: 0.05, browY: 0.002, eyeOpen: 1, mouth: "smile", headTilt: 0 },
  hurt: { browAngle: 0.4, browY: -0.002, eyeOpen: 0.12, mouth: "open", headTilt: -0.12 },
  shocked: { browAngle: 0.2, browY: 0.012, eyeOpen: 1.35, mouth: "round", headTilt: 0.04 },
  dizzy: { browAngle: 0.1, browY: 0.002, eyeOpen: 0.2, mouth: "wave", headTilt: 0.18 },
  scared: { browAngle: 0.45, browY: 0.01, eyeOpen: 1.3, mouth: "round", headTilt: -0.08 },
  crying: { browAngle: 0.5, browY: -0.004, eyeOpen: 0.14, mouth: "frown", headTilt: -0.14, tears: true },
  laughing: { browAngle: 0.22, browY: 0.006, eyeOpen: 0.1, mouth: "open", headTilt: 0.1 },
  nerdy: { browAngle: 0.02, browY: 0, eyeOpen: 0.9, mouth: "flat", headTilt: 0.03 },
  fancy: { browAngle: 0.18, browY: 0.004, eyeOpen: 0.8, mouth: "smile", headTilt: 0.06 },
};

interface FaceRefs {
  browL: THREE.Mesh;
  browR: THREE.Mesh;
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  lidL: THREE.Mesh;
  lidR: THREE.Mesh;
  mouth: THREE.Mesh;
  tears: THREE.Group;
}

interface Rig {
  root: THREE.Group;
  bones: BoneMap;
  face: FaceRefs;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
}

function headScaleFor(face: FaceShape): THREE.Vector3 {
  if (face === "square") return new THREE.Vector3(1.06, 1.08, 0.93);
  if (face === "soft") return new THREE.Vector3(1.13, 0.94, 1.03);
  return new THREE.Vector3(0.99, 1.07, 0.97);
}

/** Jaw block: this is what actually sells round vs soft vs square. */
function jawShapeFor(face: FaceShape): { scale: THREE.Vector3; y: number } {
  if (face === "square") return { scale: new THREE.Vector3(1.62, 0.92, 1.04), y: -0.082 };
  if (face === "soft") return { scale: new THREE.Vector3(1.2, 0.6, 0.98), y: -0.094 };
  return { scale: new THREE.Vector3(1.32, 0.72, 1.0), y: -0.088 };
}

function buildHair(style: HairStyle, color: string, hasHat: boolean, track: Rig): THREE.Group {
  const g = new THREE.Group();
  const mat = hairMat(color);
  track.materials.push(mat);
  const R = HEAD_R;

  // The cap is tilted back so the hairline sits above the brows in front while
  // still covering the back of the skull — a straight cap reads as a bowl cut.
  if (style === "buzz") {
    const geo = new THREE.SphereGeometry(R * 1.03, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const cap = new THREE.Mesh(geo, mat);
    cap.rotation.x = -0.18;
    cap.castShadow = true;
    g.add(cap);
    track.geometries.push(geo);
    return g;
  }

  // Every other style shares a cap; a hat replaces the volume with a fringe only.
  const capGeo = new THREE.SphereGeometry(
    R * 1.07,
    24,
    18,
    0,
    Math.PI * 2,
    0,
    hasHat ? Math.PI * 0.3 : Math.PI * 0.42,
  );
  const cap = new THREE.Mesh(capGeo, mat);
  cap.castShadow = true;
  cap.rotation.x = -0.18;
  cap.position.y = hasHat ? 0.012 : 0.004;
  g.add(cap);
  track.geometries.push(capGeo);
  if (hasHat) return g;

  if (style === "messy") {
    for (let i = 0; i < 7; i++) {
      const tuftGeo = new THREE.ConeGeometry(0.026, 0.075, 8);
      const tuft = new THREE.Mesh(tuftGeo, mat);
      const a = (i / 7) * Math.PI * 1.5 - Math.PI * 0.75;
      tuft.position.set(Math.sin(a) * R * 0.72, R * 0.82, Math.cos(a) * R * 0.5);
      tuft.rotation.set(0.35 * Math.cos(a), 0, -0.4 * Math.sin(a));
      tuft.castShadow = true;
      g.add(tuft);
      track.geometries.push(tuftGeo);
    }
  }

  if (style === "long") {
    for (const sx of [-1, 1]) {
      const slabGeo = new THREE.CapsuleGeometry(0.045, 0.2, 4, 12);
      const slab = new THREE.Mesh(slabGeo, mat);
      slab.position.set(sx * R * 0.82, -R * 0.62, -0.01);
      slab.scale.set(1, 1, 0.72);
      slab.castShadow = true;
      g.add(slab);
      track.geometries.push(slabGeo);
    }
    const backGeo = new THREE.CapsuleGeometry(0.075, 0.16, 4, 14);
    const back = new THREE.Mesh(backGeo, mat);
    back.position.set(0, -R * 0.5, -R * 0.6);
    back.scale.set(1.1, 1, 0.6);
    back.castShadow = true;
    g.add(back);
    track.geometries.push(backGeo);
  }

  if (style === "bun") {
    const bunGeo = new THREE.SphereGeometry(0.058, 18, 14);
    const bun = new THREE.Mesh(bunGeo, mat);
    bun.position.set(0, R * 0.92, -R * 0.5);
    bun.castShadow = true;
    g.add(bun);
    track.geometries.push(bunGeo);
  }

  return g;
}

function buildAccessory(acc: Accessory, track: Rig): THREE.Group {
  const g = new THREE.Group();
  if (acc === "none") return g;
  const R = HEAD_R;

  if (acc === "glasses") {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.35,
      metalness: 0.6,
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xaad4ff,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
    });
    track.materials.push(frameMat, lensMat);
    for (const sx of [-1, 1]) {
      const ringGeo = new THREE.TorusGeometry(0.04, 0.0075, 8, 24);
      const ring = new THREE.Mesh(ringGeo, frameMat);
      ring.position.set(sx * 0.046, 0.015, R * 0.87);
      g.add(ring);
      const lensGeo = new THREE.CircleGeometry(0.038, 24);
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(sx * 0.046, 0.015, R * 0.865);
      g.add(lens);
      const armGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.1, 8);
      const arm = new THREE.Mesh(armGeo, frameMat);
      arm.position.set(sx * 0.086, 0.015, R * 0.45);
      arm.rotation.set(Math.PI / 2, 0, 0);
      g.add(arm);
      track.geometries.push(ringGeo, lensGeo, armGeo);
    }
    const bridgeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.022, 8);
    const bridge = new THREE.Mesh(bridgeGeo, frameMat);
    bridge.position.set(0, 0.015, R * 0.87);
    bridge.rotation.z = Math.PI / 2;
    g.add(bridge);
    track.geometries.push(bridgeGeo);
  }

  if (acc === "hat") {
    const feltMat = clothMat("#3a2418");
    const bandMat = clothMat("#c0392b");
    track.materials.push(feltMat, bandMat);
    const brimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.012, 32);
    const brim = new THREE.Mesh(brimGeo, feltMat);
    brim.position.y = R * 0.72;
    brim.castShadow = true;
    g.add(brim);
    const crownGeo = new THREE.CylinderGeometry(0.115, 0.125, 0.13, 28);
    const crown = new THREE.Mesh(crownGeo, feltMat);
    crown.position.y = R * 0.72 + 0.065;
    crown.castShadow = true;
    g.add(crown);
    const bandGeo = new THREE.CylinderGeometry(0.127, 0.127, 0.026, 28);
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.y = R * 0.72 + 0.018;
    g.add(band);
    track.geometries.push(brimGeo, crownGeo, bandGeo);
  }

  if (acc === "headphones") {
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.4,
      metalness: 0.35,
    });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
    track.materials.push(shellMat, padMat);
    const bandGeo = new THREE.TorusGeometry(R * 1.04, 0.014, 8, 28, Math.PI);
    const band = new THREE.Mesh(bandGeo, shellMat);
    band.castShadow = true;
    g.add(band);
    track.geometries.push(bandGeo);
    for (const sx of [-1, 1]) {
      const cupGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.032, 20);
      const cup = new THREE.Mesh(cupGeo, shellMat);
      cup.position.set(sx * R * 1.03, 0.005, 0);
      cup.rotation.z = Math.PI / 2;
      cup.castShadow = true;
      g.add(cup);
      const padGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.036, 20);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(sx * R * 0.97, 0.005, 0);
      pad.rotation.z = Math.PI / 2;
      g.add(pad);
      track.geometries.push(cupGeo, padGeo);
    }
  }

  return g;
}

/**
 * Shoe anchored so its sole rests on y=0 in world space. `ankleY` is how far
 * the foot bone sits above the floor, since the mesh is built in bone space.
 */
function buildShoe(style: ShoeStyle, ankleY: number, track: Rig): THREE.Group {
  const g = new THREE.Group();
  const c = SHOE_COLORS[style];
  const mainMat = clothMat(c.main);
  const soleMat = clothMat(c.sole);
  const accentMat = clothMat(c.accent);
  track.materials.push(mainMat, soleMat, accentMat);

  const floor = -ankleY;
  const soleH = 0.026;
  const soleGeo = new THREE.BoxGeometry(0.092, soleH, 0.2);
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.set(0, floor + soleH / 2, 0.03);
  sole.castShadow = true;
  g.add(sole);

  const bodyH = style === "boots" ? 0.15 : 0.072;
  const bodyGeo = new THREE.BoxGeometry(0.086, bodyH, 0.19);
  const body = new THREE.Mesh(bodyGeo, mainMat);
  body.position.set(0, floor + soleH + bodyH / 2, 0.03);
  body.castShadow = true;
  g.add(body);

  const stripeGeo = new THREE.BoxGeometry(0.094, 0.014, 0.1);
  const stripe = new THREE.Mesh(stripeGeo, accentMat);
  stripe.position.set(0, floor + soleH + bodyH * 0.45, 0.048);
  g.add(stripe);

  track.geometries.push(bodyGeo, soleGeo, stripeGeo);
  return g;
}

function buildVibeAccent(vibe: Vibe, track: Rig): THREE.Group {
  const g = new THREE.Group();
  if (vibe === "fancy") {
    const tieMat = clothMat("#c9a227");
    const knotMat = clothMat("#111111");
    track.materials.push(tieMat, knotMat);
    const knotGeo = new THREE.BoxGeometry(0.05, 0.03, 0.02);
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.position.set(0, 0.1, 0.115);
    g.add(knot);
    const tieGeo = new THREE.BoxGeometry(0.045, 0.17, 0.016);
    const tie = new THREE.Mesh(tieGeo, tieMat);
    tie.position.set(0, 0.0, 0.115);
    g.add(tie);
    track.geometries.push(knotGeo, tieGeo);
  }
  if (vibe === "nerdy") {
    const badgeMat = clothMat("#5b7cfa");
    track.materials.push(badgeMat);
    const badgeGeo = new THREE.BoxGeometry(0.07, 0.05, 0.014);
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(-0.07, 0.06, 0.115);
    g.add(badge);
    track.geometries.push(badgeGeo);
  }
  return g;
}

function buildFace(head: THREE.Object3D, skin: string, hair: string, track: Rig): FaceRefs {
  const R = HEAD_R;
  const browMat = hairMat(shade(hair, -10));
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.2 });
  const lidMat = skinMat(skin);
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x5c2b28, roughness: 0.5 });
  const tearMat = new THREE.MeshStandardMaterial({
    color: 0x5b9fff,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  track.materials.push(browMat, whiteMat, irisMat, lidMat, mouthMat, tearMat);

  const eye = (sx: number) => {
    const grp = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(0.026, 18, 14);
    const ball = new THREE.Mesh(ballGeo, whiteMat);
    grp.add(ball);
    const irisGeo = new THREE.SphereGeometry(0.013, 14, 12);
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0.018;
    grp.add(iris);
    track.geometries.push(ballGeo, irisGeo);
    grp.position.set(sx * 0.045, 0.015, R * 0.8);
    head.add(grp);
    return grp;
  };

  const lid = (sx: number) => {
    const geo = new THREE.SphereGeometry(0.029, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const m = new THREE.Mesh(geo, lidMat);
    m.position.set(sx * 0.045, 0.015, R * 0.8);
    track.geometries.push(geo);
    head.add(m);
    return m;
  };

  // Brows must clear the hairline, which sits near y=0.06 on the forehead.
  const brow = (sx: number) => {
    const geo = new THREE.BoxGeometry(0.054, 0.013, 0.016);
    const m = new THREE.Mesh(geo, browMat);
    m.position.set(sx * 0.046, 0.044, R * 0.82);
    track.geometries.push(geo);
    head.add(m);
    return m;
  };

  const noseGeo = new THREE.ConeGeometry(0.017, 0.04, 10);
  const nose = new THREE.Mesh(noseGeo, lidMat);
  nose.position.set(0, -0.012, R * 0.9);
  nose.rotation.x = Math.PI / 2;
  head.add(nose);
  track.geometries.push(noseGeo);

  const mouthGeo = new THREE.TorusGeometry(0.032, 0.008, 8, 20, Math.PI);
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, -0.062, R * 0.78);
  track.geometries.push(mouthGeo);
  head.add(mouth);

  const tears = new THREE.Group();
  for (const sx of [-1, 1]) {
    const tGeo = new THREE.CapsuleGeometry(0.008, 0.05, 4, 8);
    const t = new THREE.Mesh(tGeo, tearMat);
    t.position.set(sx * 0.045, -0.04, R * 0.78);
    tears.add(t);
    track.geometries.push(tGeo);
  }
  tears.visible = false;
  head.add(tears);

  for (const sx of [-1, 1]) {
    const earGeo = new THREE.SphereGeometry(0.028, 14, 12);
    const ear = new THREE.Mesh(earGeo, lidMat);
    ear.position.set(sx * R * 0.96, 0.0, 0);
    ear.scale.set(0.5, 1, 0.75);
    ear.castShadow = true;
    head.add(ear);
    track.geometries.push(earGeo);
  }

  return {
    browL: brow(-1),
    browR: brow(1),
    eyeL: eye(-1),
    eyeR: eye(1),
    lidL: lid(-1),
    lidR: lid(1),
    mouth,
    tears,
  };
}

export function buildRig(data: CharData): Rig {
  const root = new THREE.Group();
  const track: Rig = {
    root,
    bones: {},
    face: null as unknown as FaceRefs,
    materials: [],
    geometries: [],
  };

  const skin = data.skin || "#d4a574";
  const shirt = data.shirt || "#2dd4a8";
  const hair = data.hair || "#1c1410";
  const pants = "#2c3e50";
  const body = data.body || "avg";
  const girth = body === "slim" ? 0.86 : body === "stocky" ? 1.2 : 1;
  const limbGirth = body === "slim" ? 0.88 : body === "stocky" ? 1.14 : 1;

  const mSkin = skinMat(skin);
  const mShirt = clothMat(shirt);
  const mPants = clothMat(pants);
  track.materials.push(mSkin, mShirt, mPants);

  const b = track.bones;
  b[BONE.hips] = bone(BONE.hips, root, HIP_Y);
  b[BONE.spine] = bone(BONE.spine, b[BONE.hips], SEG.spine);
  b[BONE.spine1] = bone(BONE.spine1, b[BONE.spine], SEG.spine1);
  b[BONE.spine2] = bone(BONE.spine2, b[BONE.spine1], SEG.spine2);
  b[BONE.neck] = bone(BONE.neck, b[BONE.spine2], SEG.neck);
  b[BONE.head] = bone(BONE.head, b[BONE.neck], SEG.headUp);

  // Pelvis + torso
  const pelvisGeo = new THREE.CapsuleGeometry(0.098 * girth, 0.05, 4, 18);
  const pelvis = new THREE.Mesh(pelvisGeo, mPants);
  pelvis.scale.set(1.14, 1, 0.8);
  pelvis.position.y = -0.005;
  pelvis.castShadow = true;
  b[BONE.hips].add(pelvis);
  track.geometries.push(pelvisGeo);

  // Torso as a tapered cylinder: a capsule's rounded bottom produced a
  // scalloped, faceted shirt hem.
  const chestGeo = new THREE.CylinderGeometry(0.118 * girth, 0.1 * girth, 0.34, 28, 1);
  const chest = new THREE.Mesh(chestGeo, mShirt);
  chest.scale.set(1.18, 1, 0.72);
  chest.castShadow = true;
  b[BONE.spine1].add(chest);
  track.geometries.push(chestGeo);
  b[BONE.spine1].add(buildVibeAccent(data.vibe || "smug", track));

  // Rounds off the shoulder line where the cylinder would otherwise end flat.
  const shoulderCapGeo = new THREE.SphereGeometry(0.118 * girth, 24, 16);
  const shoulderCap = new THREE.Mesh(shoulderCapGeo, mShirt);
  shoulderCap.scale.set(1.18, 0.72, 0.72);
  shoulderCap.position.y = 0.035;
  shoulderCap.castShadow = true;
  b[BONE.spine2].add(shoulderCap);
  track.geometries.push(shoulderCapGeo);

  const neckGeo = new THREE.CylinderGeometry(0.043, 0.052, 0.12, 16);
  const neck = new THREE.Mesh(neckGeo, mSkin);
  neck.position.y = 0.015;
  neck.castShadow = true;
  b[BONE.neck].add(neck);
  track.geometries.push(neckGeo);

  // Head. Face shape scales a wrapper so hair and features stay aligned with
  // the skull surface instead of sinking into it.
  const headScale = headScaleFor(data.face || "round");
  const headGroup = new THREE.Group();
  headGroup.scale.copy(headScale);
  b[BONE.head].add(headGroup);

  const headGeo = new THREE.SphereGeometry(HEAD_R, 32, 24);
  const headMesh = new THREE.Mesh(headGeo, mSkin);
  headMesh.castShadow = true;
  headGroup.add(headMesh);
  track.geometries.push(headGeo);

  const jawShape = jawShapeFor(data.face || "round");
  const jawGeo = new THREE.CapsuleGeometry(0.062, 0.03, 4, 16);
  const jaw = new THREE.Mesh(jawGeo, mSkin);
  jaw.position.set(0, jawShape.y, 0.028);
  jaw.scale.copy(jawShape.scale);
  headGroup.add(jaw);
  track.geometries.push(jawGeo);

  track.face = buildFace(headGroup, skin, hair, track);
  headGroup.add(
    buildHair(data.hairStyle || "short", hair, (data.accessory || "none") === "hat", track),
  );
  headGroup.add(buildAccessory(data.accessory || "none", track));

  // Arms
  const shoulderX = 0.152 * girth;
  for (const side of [-1, 1] as const) {
    const isLeft = side < 0;
    const shoulder = bone(
      isLeft ? BONE.lShoulder : BONE.rShoulder,
      b[BONE.spine2],
      0.015,
      side * shoulderX * 0.5,
    );
    b[shoulder.name] = shoulder;

    const arm = bone(isLeft ? BONE.lArm : BONE.rArm, shoulder, 0, side * shoulderX * 0.5);
    b[arm.name] = arm;
    arm.add(limb(0.047 * limbGirth, SEG.upperArm, mSkin));

    // Sleeve cap; sized to overlap the chest so the joint never shows a seam.
    const deltoidGeo = new THREE.SphereGeometry(0.065 * limbGirth, 18, 14);
    const deltoid = new THREE.Mesh(deltoidGeo, mShirt);
    deltoid.scale.set(1, 1.15, 1);
    deltoid.castShadow = true;
    arm.add(deltoid);
    track.geometries.push(deltoidGeo);

    const fore = bone(isLeft ? BONE.lForeArm : BONE.rForeArm, arm, -SEG.upperArm);
    b[fore.name] = fore;
    fore.add(limb(0.04 * limbGirth, SEG.foreArm, mSkin));

    const elbowGeo = new THREE.SphereGeometry(0.043 * limbGirth, 14, 12);
    const elbow = new THREE.Mesh(elbowGeo, mSkin);
    fore.add(elbow);
    track.geometries.push(elbowGeo);

    const hand = bone(isLeft ? BONE.lHand : BONE.rHand, fore, -SEG.foreArm);
    b[hand.name] = hand;
    const fistGeo = new THREE.SphereGeometry(0.043 * limbGirth, 16, 14);
    const fist = new THREE.Mesh(fistGeo, mSkin);
    fist.position.y = -0.028;
    fist.scale.set(0.9, 1.1, 0.9);
    fist.castShadow = true;
    hand.add(fist);
    track.geometries.push(fistGeo);

    // Arms rest slightly away from the body.
    arm.rotation.z = side * 0.12;
    arm.rotation.x = 0.06;
    fore.rotation.x = 0.18;
  }

  // Legs
  const hipX = 0.072 * girth;
  for (const side of [-1, 1] as const) {
    const isLeft = side < 0;
    const upLeg = bone(isLeft ? BONE.lUpLeg : BONE.rUpLeg, b[BONE.hips], -0.03, side * hipX);
    b[upLeg.name] = upLeg;
    upLeg.add(limb(0.057 * limbGirth, SEG.upLeg, mPants));

    const lowLeg = bone(isLeft ? BONE.lLeg : BONE.rLeg, upLeg, -SEG.upLeg);
    b[lowLeg.name] = lowLeg;
    lowLeg.add(limb(0.045 * limbGirth, SEG.lowLeg, mPants));

    const kneeGeo = new THREE.SphereGeometry(0.05 * limbGirth, 14, 12);
    const knee = new THREE.Mesh(kneeGeo, mPants);
    lowLeg.add(knee);
    track.geometries.push(kneeGeo);

    const foot = bone(isLeft ? BONE.lFoot : BONE.rFoot, lowLeg, -SEG.lowLeg);
    b[foot.name] = foot;
    const ankleY = HIP_Y - 0.03 - SEG.upLeg - SEG.lowLeg;
    foot.add(buildShoe(data.shoes || "sneakers", ankleY, track));

    upLeg.rotation.z = side * 0.03;
  }

  return track;
}

/** Applies a mood to the generated face. */
function applyMood(rig: Rig, mood: Mood): void {
  const p = MOOD_POSES[mood] ?? MOOD_POSES.annoyed;
  const f = rig.face;

  f.browL.rotation.z = -p.browAngle;
  f.browR.rotation.z = p.browAngle;
  f.browL.position.y = 0.044 + p.browY;
  f.browR.position.y = 0.044 + p.browY;

  const open = Math.max(0.02, Math.min(1.4, p.eyeOpen));
  f.eyeL.scale.y = open;
  f.eyeR.scale.y = open;
  // Lids drop as the eyes close.
  const lidDrop = 1 - Math.min(1, open);
  f.lidL.rotation.x = -lidDrop * Math.PI * 0.52;
  f.lidR.rotation.x = -lidDrop * Math.PI * 0.52;

  const m = f.mouth;
  m.rotation.set(0, 0, 0);
  m.scale.set(1, 1, 1);
  m.position.y = -0.062;
  switch (p.mouth) {
    case "smile":
      m.rotation.z = Math.PI;
      m.scale.set(1, 0.7, 1);
      break;
    case "frown":
      m.scale.set(1, 0.75, 1);
      break;
    case "flat":
      m.rotation.z = Math.PI;
      m.scale.set(0.9, 0.12, 1);
      break;
    case "open":
      m.rotation.z = Math.PI;
      m.scale.set(0.85, 1.5, 1);
      break;
    case "round":
      m.rotation.z = Math.PI;
      m.scale.set(0.5, 1.6, 1);
      break;
    case "wave":
      m.rotation.z = Math.PI;
      m.scale.set(0.8, 0.3, 1);
      break;
  }

  f.tears.visible = !!p.tears;
  rig.bones[BONE.head].rotation.z = p.headTilt;
}

/* ————————————————— combat animation ————————————————— */

type Axis = "x" | "y" | "z";
type Pose = Record<string, Partial<Record<Axis, number>>>;

interface ClipFrame {
  pose: Pose;
  /** Root offsets in the character's own space: +z steps toward the opponent. */
  root?: { x?: number; y?: number; z?: number; pitch?: number; yaw?: number; roll?: number };
  /** Hip height relative to the neutral stance — crouches and hops. */
  hipY?: number;
}

interface Clip {
  dur: number;
  frame: (t: number) => ClipFrame;
}

/** Stretches every combat clip so a punch reads as a swing, not a twitch. */
const CLIP_TIME_SCALE = 1.75;

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** Smoothstep-interpolated keyframe track. */
function key(t: number, points: Array<[number, number]>): number {
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, v0] = points[i - 1];
      const [t1, v1] = points[i];
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return lerp(v0, v1, k * k * (3 - 2 * k));
    }
  }
  return points[points.length - 1][1];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Rest values the idle pass writes, so clips can blend back to a real stance.
const REST_ARM_X = 0.06;
const REST_FORE_X = 0.18;

/**
 * Windup/strike/recover on a single track: negative is the windup, +1 is full
 * extension. Every striking clip is shaped from one of these.
 *
 * Full extension sits near t=0.37 because the game fires its impact — the
 * flash, the sound, the foe's reaction — roughly that far into the clip. A
 * swing that peaks at the midpoint lands visibly after its own thud.
 */
const SWING = {
  punch: [
    [0, 0],
    [0.22, -0.5],
    [0.37, 1],
    [0.56, 0.85],
    [1, 0],
  ] as Array<[number, number]>,
  heavy: [
    [0, 0],
    [0.24, -1],
    [0.4, 1],
    [0.6, 0.85],
    [1, 0],
  ] as Array<[number, number]>,
};

/** Arms pinned in a loose guard — used by the leg and torso attacks. */
function guard(amount: number): Pose {
  return {
    [BONE.lArm]: { x: REST_ARM_X - 0.55 * amount, z: -0.12 - 0.32 * amount },
    [BONE.rArm]: { x: REST_ARM_X - 0.45 * amount, z: 0.12 + 0.3 * amount },
    [BONE.lForeArm]: { x: REST_FORE_X + 1.15 * amount },
    [BONE.rForeArm]: { x: REST_FORE_X + 1.05 * amount },
  };
}

const ATTACK_CLIPS: Record<string, Clip> = {
  /** Covers the CSS slide into contact range, which would otherwise skate. */
  walk: {
    dur: 400,
    frame(t) {
      const hold = key(t, [
        [0, 0],
        [0.15, 1],
        [0.8, 1],
        [1, 0],
      ]);
      const c = t * Math.PI * 2 * 1.5;
      const s = Math.sin(c) * hold;
      const s2 = Math.sin(c + Math.PI) * hold;
      return {
        pose: {
          [BONE.lUpLeg]: { x: s * 0.6 },
          [BONE.rUpLeg]: { x: s2 * 0.6 },
          [BONE.lLeg]: { x: clamp01(-s) * 0.9 },
          [BONE.rLeg]: { x: clamp01(-s2) * 0.9 },
          [BONE.lArm]: { x: REST_ARM_X + s2 * 0.45 },
          [BONE.rArm]: { x: REST_ARM_X + s * 0.45 },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.5 * hold },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.5 * hold },
          [BONE.spine]: { x: 0.08 * hold },
        },
        hipY: Math.abs(Math.sin(c)) * 0.02 * hold,
      };
    },
  },

  punch: {
    dur: 560,
    frame(t) {
      const e = key(t, SWING.punch);
      const out = clamp01(e);
      const back = clamp01(-e);
      return {
        pose: {
          // Angled slightly up so the fist arrives at head height, where the
          // game places the impact burst.
          [BONE.rArm]: { x: REST_ARM_X - 1.95 * e, z: 0.12 - 0.1 * out },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.95 * (1 - out) + 1.3 * back - 0.18 },
          [BONE.rShoulder]: { y: -0.3 * e },
          [BONE.lArm]: { x: REST_ARM_X + 0.5 * e, z: -0.12 - 0.2 * out },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.2 * out },
          [BONE.spine1]: { y: -0.4 * e },
          [BONE.spine2]: { y: -0.22 * e },
          [BONE.hips]: { y: -0.2 * e },
          [BONE.head]: { y: -0.12 * e },
          [BONE.rUpLeg]: { x: -0.22 * out },
          [BONE.lLeg]: { x: 0.25 * out },
        },
        root: { z: 0.16 * out },
      };
    },
  },

  slap: {
    dur: 620,
    frame(t) {
      const raise = key(t, [
        [0, 0],
        [0.18, 1],
        [0.7, 1],
        [1, 0],
      ]);
      const sweep = key(t, [
        [0, 0],
        [0.2, -1],
        [0.36, 1],
        [0.6, 0.75],
        [1, 0],
      ]);
      // The shoulder yaw carries the swing: cocked out to the side on the
      // windup, ending aimed at the target rather than swinging past it.
      return {
        pose: {
          [BONE.rArm]: { x: REST_ARM_X - 1.9 * raise, z: 0.12 + 0.3 * raise },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.25 * raise },
          [BONE.rShoulder]: { y: 0.375 - 0.475 * sweep },
          [BONE.lArm]: { x: REST_ARM_X - 0.5 * raise },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.1 * raise },
          [BONE.spine1]: { y: -0.45 * sweep },
          [BONE.spine2]: { y: -0.2 * sweep },
          [BONE.head]: { y: -0.25 * sweep },
          [BONE.hips]: { y: -0.18 * sweep },
        },
        root: { z: 0.14 * clamp01(sweep) },
      };
    },
  },

  kick: {
    dur: 660,
    frame(t) {
      const e = key(t, [
        [0, 0],
        [0.2, -0.35],
        [0.36, 1],
        [0.56, 0.8],
        [1, 0],
      ]);
      const out = clamp01(e);
      const back = clamp01(-e);
      return {
        pose: {
          ...guard(out * 0.6),
          [BONE.rUpLeg]: { x: -1.55 * e },
          [BONE.rLeg]: { x: 1.15 * (1 - out) + 1.0 * back - 0.05 },
          [BONE.rFoot]: { x: -0.55 * out },
          [BONE.lLeg]: { x: 0.3 * out },
          [BONE.spine]: { x: 0.4 * out - 0.15 * back },
          [BONE.spine1]: { x: 0.12 * out },
          [BONE.lArm]: { x: REST_ARM_X + 0.9 * out, z: -0.12 - 0.5 * out },
          [BONE.rArm]: { x: REST_ARM_X - 0.6 * out, z: 0.12 + 0.35 * out },
        },
        hipY: -0.05 * out,
        root: { z: 0.06 * out, pitch: -0.1 * out },
      };
    },
  },

  hammer: {
    dur: 700,
    frame(t) {
      const e = key(t, SWING.heavy);
      const out = clamp01(e);
      const back = clamp01(-e);
      // The head of the weapon hangs below the fist, so the swing ends with the
      // arm forward and the wrist snapped over — that is what puts the hammer
      // out in front at head height instead of buried in the floor.
      const armX = e < 0 ? lerp(REST_ARM_X, -2.5, back) : lerp(REST_ARM_X, -1.5, out);
      const foreX = e < 0 ? lerp(REST_FORE_X, 0.45, back) : lerp(REST_FORE_X, 0.05, out);
      const wristX = e < 0 ? 0.5 * back : -1.4 * out;
      return {
        pose: {
          [BONE.rArm]: { x: armX, z: 0.12 + 0.18 * back },
          [BONE.rForeArm]: { x: foreX },
          [BONE.rHand]: { x: wristX },
          [BONE.lArm]: { x: lerp(REST_ARM_X, -1.9, back * 0.7) + 0.3 * out },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.0 * back + 0.5 * out },
          [BONE.spine]: { x: -0.24 * back + 0.3 * out },
          [BONE.spine1]: { x: -0.1 * back + 0.14 * out, y: -0.18 * e },
          [BONE.head]: { x: -0.22 * back + 0.2 * out },
          [BONE.lLeg]: { x: 0.3 * out },
        },
        hipY: -0.06 * out,
        root: { z: 0.1 * out },
      };
    },
  },

  uppercut: {
    dur: 720,
    frame(t) {
      const e = key(t, [
        [0, 0],
        [0.24, -1],
        [0.39, 1],
        [0.6, 0.85],
        [1, 0],
      ]);
      const out = clamp01(e);
      const back = clamp01(-e);
      return {
        pose: {
          // Elbow leads and the forearm whips upward, so the fist rises in
          // front of the chest rather than alongside the ear.
          [BONE.rArm]: {
            x: e < 0 ? lerp(REST_ARM_X, 0.85, back) : lerp(REST_ARM_X, -1.25, out),
            z: 0.12 + 0.15 * out,
          },
          [BONE.rForeArm]: {
            x: e < 0 ? lerp(REST_FORE_X, 1.4, back) : lerp(REST_FORE_X, -1.3, out),
          },
          [BONE.rShoulder]: { y: -0.2 * out },
          [BONE.lArm]: { x: REST_ARM_X - 0.5 * out },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.25 * out },
          [BONE.spine]: { x: 0.32 * back - 0.3 * out },
          [BONE.spine1]: { y: -0.3 * e },
          [BONE.lUpLeg]: { x: 0.5 * back },
          [BONE.rUpLeg]: { x: 0.5 * back },
          [BONE.lLeg]: { x: -0.7 * back },
          [BONE.rLeg]: { x: -0.7 * back },
          [BONE.head]: { x: -0.25 * out },
        },
        hipY: -0.14 * back + 0.07 * out,
        root: { z: 0.22 * out },
      };
    },
  },

  headbutt: {
    dur: 560,
    frame(t) {
      const e = key(t, [
        [0, 0],
        [0.22, -0.6],
        [0.39, 1],
        [0.58, 0.8],
        [1, 0],
      ]);
      const out = clamp01(e);
      return {
        pose: {
          ...guard(out * 0.8),
          [BONE.spine]: { x: 0.34 * e },
          [BONE.spine1]: { x: 0.3 * e },
          [BONE.neck]: { x: 0.4 * e },
          [BONE.head]: { x: 0.34 * e },
          [BONE.lLeg]: { x: 0.3 * out },
        },
        root: { z: 0.26 * out },
      };
    },
  },

  push: {
    dur: 540,
    frame(t) {
      const e = key(t, [
        [0, 0],
        [0.22, -0.45],
        [0.37, 1],
        [0.58, 0.9],
        [1, 0],
      ]);
      const out = clamp01(e);
      return {
        pose: {
          [BONE.lArm]: { x: REST_ARM_X - 1.6 * e, z: -0.12 - 0.12 * out },
          [BONE.rArm]: { x: REST_ARM_X - 1.6 * e, z: 0.12 + 0.12 * out },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.0 * (1 - out) - 0.15 },
          [BONE.rForeArm]: { x: REST_FORE_X + 1.0 * (1 - out) - 0.15 },
          [BONE.spine1]: { x: 0.24 * out },
          [BONE.lLeg]: { x: 0.28 * out },
        },
        root: { z: 0.13 * out },
      };
    },
  },

  throw: {
    dur: 520,
    frame(t) {
      const e = key(t, [
        [0, 0],
        [0.26, -1],
        [0.48, 1],
        [0.74, 0.45],
        [1, 0],
      ]);
      const out = clamp01(e);
      const back = clamp01(-e);
      return {
        pose: {
          [BONE.rArm]: { x: e < 0 ? lerp(REST_ARM_X, -2.4, back) : lerp(REST_ARM_X, -1.15, out) },
          [BONE.rForeArm]: { x: REST_FORE_X + 1.5 * back + 0.05 * out },
          [BONE.rShoulder]: { y: -0.25 * e },
          [BONE.lArm]: { x: REST_ARM_X - 0.8 * out, z: -0.12 - 0.3 * out },
          [BONE.spine1]: { y: -0.38 * e },
          [BONE.spine]: { x: -0.15 * back + 0.2 * out },
          [BONE.head]: { y: -0.14 * e },
        },
      };
    },
  },

  grab: {
    dur: 900,
    frame(t) {
      const hold = key(t, [
        [0, 0],
        [0.16, 1],
        [0.8, 1],
        [1, 0],
      ]);
      const rattle = Math.sin(t * Math.PI * 18) * hold;
      return {
        pose: {
          [BONE.lArm]: { x: REST_ARM_X - 1.5 * hold, z: -0.12 - 0.3 * hold },
          [BONE.rArm]: { x: REST_ARM_X - 1.5 * hold, z: 0.12 + 0.3 * hold },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.3 * hold },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.3 * hold },
          [BONE.spine1]: { y: rattle * 0.12 },
          [BONE.head]: { y: rattle * 0.1 },
        },
        root: { z: 0.12 * hold, yaw: rattle * 0.06 },
      };
    },
  },

  dunk: {
    dur: 1350,
    frame(t) {
      const lift = key(t, [
        [0, 0],
        [0.14, 1],
        [0.28, 1],
        [0.4, 0],
        [1, 0],
      ]);
      const slam = key(t, [
        [0, 0],
        [0.28, 0],
        [0.4, 1],
        [0.72, 0.5],
        [1, 0],
      ]);
      return {
        pose: {
          [BONE.lArm]: { x: REST_ARM_X - 2.2 * lift - 0.4 * slam, z: -0.12 - 0.25 * lift },
          [BONE.rArm]: { x: REST_ARM_X - 2.2 * lift - 0.4 * slam, z: 0.12 + 0.25 * lift },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.9 * lift },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.9 * lift },
          [BONE.spine]: { x: -0.2 * lift + 0.45 * slam },
          [BONE.head]: { x: -0.25 * lift + 0.35 * slam },
        },
        hipY: -0.06 * lift - 0.1 * slam,
        root: { z: 0.14 * lift },
      };
    },
  },

  taunt: {
    dur: 900,
    frame(t) {
      const hold = key(t, [
        [0, 0],
        [0.2, 1],
        [0.78, 1],
        [1, 0],
      ]);
      const sway = Math.sin(t * Math.PI * 4) * hold;
      return {
        pose: {
          [BONE.lArm]: { x: REST_ARM_X + 0.5 * hold, z: -0.12 - 0.62 * hold },
          [BONE.rArm]: { x: REST_ARM_X + 0.5 * hold, z: 0.12 + 0.62 * hold },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.5 * hold },
          [BONE.rForeArm]: { x: REST_FORE_X + 1.5 * hold },
          [BONE.spine1]: { y: sway * 0.18, x: -0.12 * hold },
          [BONE.hips]: { y: -sway * 0.14, z: sway * 0.05 },
          [BONE.head]: { x: -0.16 * hold, z: sway * 0.12 },
        },
      };
    },
  },

  ultimate: {
    dur: 780,
    frame(t) {
      const e = key(t, [
        [0, 0],
        [0.24, -1],
        [0.41, 1],
        [0.62, 0.85],
        [1, 0],
      ]);
      const out = clamp01(e);
      const back = clamp01(-e);
      const armX = e < 0 ? lerp(REST_ARM_X, -2.9, back) : lerp(REST_ARM_X, -0.35, out);
      return {
        pose: {
          [BONE.lArm]: { x: armX, z: -0.12 - 0.3 * back },
          [BONE.rArm]: { x: armX, z: 0.12 + 0.3 * back },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.2 * back },
          [BONE.rForeArm]: { x: REST_FORE_X + 1.2 * back },
          [BONE.spine]: { x: -0.35 * back + 0.55 * out },
          [BONE.spine1]: { x: -0.15 * back + 0.25 * out },
          [BONE.head]: { x: -0.35 * back + 0.4 * out },
          [BONE.lLeg]: { x: 0.4 * out },
          [BONE.rLeg]: { x: 0.4 * out },
        },
        hipY: 0.08 * back - 0.14 * out,
        root: { z: 0.12 * out },
      };
    },
  },
};

/** Attacks that reuse another clip's motion. */
const ATTACK_ALIAS: Record<string, string> = {
  fryingpan: "hammer",
  foambat: "hammer",
  slipper: "slap",
  mud: "throw",
  pie: "throw",
  tomato: "throw",
  banana: "throw",
  watergun: "throw",
  water: "dunk",
  shake: "grab",
};

const REACT_CLIPS: Record<string, Clip> = {
  hit: {
    dur: 560,
    frame(t) {
      const k = key(t, [
        [0, 0],
        [0.18, 1],
        [0.42, -0.25],
        [0.68, 0.12],
        [1, 0],
      ]);
      return {
        pose: {
          [BONE.head]: { x: 0.6 * k },
          [BONE.neck]: { x: 0.34 * k },
          [BONE.spine1]: { x: -0.34 * k },
          [BONE.spine]: { x: -0.2 * k },
          [BONE.lArm]: { x: REST_ARM_X + 0.55 * k, z: -0.12 - 0.4 * clamp01(k) },
          [BONE.rArm]: { x: REST_ARM_X + 0.45 * k, z: 0.12 + 0.4 * clamp01(k) },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.7 * clamp01(k) },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.7 * clamp01(k) },
          [BONE.lUpLeg]: { x: 0.3 * k },
        },
        root: { z: -0.14 * clamp01(k) },
      };
    },
  },

  spin: {
    dur: 720,
    frame(t) {
      const turn = key(t, [
        [0, 0],
        [0.62, 1],
        [1, 1],
      ]);
      const k = key(t, [
        [0, 0],
        [0.18, 1],
        [0.5, 0.3],
        [1, 0],
      ]);
      return {
        pose: {
          [BONE.head]: { x: 0.5 * k, z: 0.3 * k },
          [BONE.spine1]: { x: -0.25 * k },
          [BONE.lArm]: { x: REST_ARM_X + 0.8 * k, z: -0.12 - 0.7 * k },
          [BONE.rArm]: { x: REST_ARM_X + 0.8 * k, z: 0.12 + 0.7 * k },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.5 * k },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.5 * k },
        },
        root: { yaw: turn * Math.PI * 2, z: -0.1 * k },
      };
    },
  },

  launch: {
    dur: 900,
    frame(t) {
      const k = key(t, [
        [0, 0],
        [0.26, 1],
        [0.62, 0.7],
        [1, 0],
      ]);
      return {
        pose: {
          [BONE.spine]: { x: -0.6 * k },
          [BONE.spine1]: { x: -0.3 * k },
          [BONE.head]: { x: 0.5 * k },
          [BONE.lArm]: { x: REST_ARM_X - 2.1 * k, z: -0.12 - 0.4 * k },
          [BONE.rArm]: { x: REST_ARM_X - 2.1 * k, z: 0.12 + 0.4 * k },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.6 * k },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.6 * k },
          [BONE.lUpLeg]: { x: -1.1 * k },
          [BONE.rUpLeg]: { x: -0.85 * k },
          [BONE.lLeg]: { x: 1.4 * k },
          [BONE.rLeg]: { x: 1.1 * k },
        },
        hipY: -0.05 * k,
        root: { pitch: -0.55 * k, z: -0.2 * k },
      };
    },
  },

  upper: {
    dur: 860,
    frame(t) {
      const k = key(t, [
        [0, 0],
        [0.22, 1],
        [0.6, 0.55],
        [1, 0],
      ]);
      return {
        pose: {
          [BONE.spine]: { x: -0.5 * k },
          [BONE.head]: { x: 0.7 * k },
          [BONE.neck]: { x: 0.3 * k },
          [BONE.lArm]: { x: REST_ARM_X - 2.4 * k },
          [BONE.rArm]: { x: REST_ARM_X - 2.4 * k },
          [BONE.lUpLeg]: { x: -0.5 * k },
          [BONE.rUpLeg]: { x: -0.65 * k },
          [BONE.lLeg]: { x: 0.9 * k },
          [BONE.rLeg]: { x: 1.1 * k },
        },
        root: { pitch: -0.3 * k },
      };
    },
  },

  fall: {
    dur: 720,
    frame(t) {
      const k = key(t, [
        [0, 0],
        [0.32, 1],
        [0.72, 1],
        [1, 0],
      ]);
      return {
        pose: {
          [BONE.spine]: { x: -0.3 * k },
          [BONE.head]: { x: 0.35 * k },
          [BONE.lArm]: { x: REST_ARM_X - 1.6 * k, z: -0.12 - 0.5 * k },
          [BONE.rArm]: { x: REST_ARM_X - 1.6 * k, z: 0.12 + 0.5 * k },
          [BONE.lUpLeg]: { x: -0.9 * k },
          [BONE.rUpLeg]: { x: -0.7 * k },
          [BONE.lLeg]: { x: 1.5 * k },
          [BONE.rLeg]: { x: 1.3 * k },
        },
        hipY: -0.34 * k,
        root: { pitch: -0.7 * k, z: -0.18 * k },
      };
    },
  },

  run: {
    dur: 950,
    frame(t) {
      const hold = key(t, [
        [0, 0],
        [0.12, 1],
        [0.86, 1],
        [1, 0],
      ]);
      const c = t * Math.PI * 2 * 3;
      const s = Math.sin(c) * hold;
      const s2 = Math.sin(c + Math.PI) * hold;
      return {
        pose: {
          [BONE.spine]: { x: 0.22 * hold },
          [BONE.lUpLeg]: { x: s * 0.85 },
          [BONE.rUpLeg]: { x: s2 * 0.85 },
          [BONE.lLeg]: { x: clamp01(-s) * 1.3 },
          [BONE.rLeg]: { x: clamp01(-s2) * 1.3 },
          [BONE.lArm]: { x: REST_ARM_X + s2 * 0.9, z: -0.12 - 0.2 * hold },
          [BONE.rArm]: { x: REST_ARM_X + s * 0.9, z: 0.12 + 0.2 * hold },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.1 * hold },
          [BONE.rForeArm]: { x: REST_FORE_X + 1.1 * hold },
        },
        hipY: Math.abs(Math.sin(c)) * 0.03 * hold,
      };
    },
  },

  shake: {
    dur: 860,
    frame(t) {
      const hold = key(t, [
        [0, 0],
        [0.12, 1],
        [0.82, 1],
        [1, 0],
      ]);
      const w = Math.sin(t * Math.PI * 7) * hold;
      return {
        pose: {
          [BONE.head]: { z: w * 0.42, x: 0.14 * hold },
          [BONE.neck]: { z: w * 0.16 },
          [BONE.spine1]: { z: -w * 0.12 },
          [BONE.lArm]: { x: REST_ARM_X + 0.35 * hold, z: -0.12 - w * 0.25 },
          [BONE.rArm]: { x: REST_ARM_X + 0.35 * hold, z: 0.12 - w * 0.25 },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.5 * hold },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.5 * hold },
        },
        hipY: -0.03 * hold,
        root: { roll: w * 0.06 },
      };
    },
  },

  dunk: {
    dur: 1350,
    frame(t) {
      const air = key(t, [
        [0, 0],
        [0.3, 1],
        [0.55, 1],
        [0.8, 0.2],
        [1, 0],
      ]);
      const flail = Math.sin(t * Math.PI * 14) * air;
      return {
        pose: {
          [BONE.lArm]: { x: REST_ARM_X - 2.3 * air + flail * 0.3, z: -0.12 - 0.5 * air },
          [BONE.rArm]: { x: REST_ARM_X - 2.3 * air - flail * 0.3, z: 0.12 + 0.5 * air },
          [BONE.lForeArm]: { x: REST_FORE_X + 0.7 * air },
          [BONE.rForeArm]: { x: REST_FORE_X + 0.7 * air },
          [BONE.lUpLeg]: { x: -0.8 * air + flail * 0.35 },
          [BONE.rUpLeg]: { x: -0.8 * air - flail * 0.35 },
          [BONE.lLeg]: { x: 1.0 * air },
          [BONE.rLeg]: { x: 1.0 * air },
          [BONE.spine]: { x: -0.25 * air },
          [BONE.head]: { x: 0.3 * air },
        },
        root: { pitch: -0.2 * air, roll: flail * 0.08 },
      };
    },
  },

  cry: {
    dur: 900,
    frame(t) {
      const hold = key(t, [
        [0, 0],
        [0.18, 1],
        [0.8, 1],
        [1, 0],
      ]);
      const sob = Math.sin(t * Math.PI * 8) * hold;
      return {
        pose: {
          [BONE.lArm]: { x: REST_ARM_X - 2.0 * hold, z: -0.12 + 0.3 * hold },
          [BONE.rArm]: { x: REST_ARM_X - 2.0 * hold, z: 0.12 - 0.3 * hold },
          [BONE.lForeArm]: { x: REST_FORE_X + 1.9 * hold },
          [BONE.rForeArm]: { x: REST_FORE_X + 1.9 * hold },
          [BONE.spine]: { x: 0.3 * hold + sob * 0.05 },
          [BONE.head]: { x: 0.25 * hold },
        },
        hipY: -0.06 * hold,
      };
    },
  },
};

/**
 * Left/right swap for clips. A fighter turned toward screen-right has their
 * right side away from the camera, so an unmirrored right hook would swing
 * behind the torso where nobody can see it.
 */
const MIRROR: Record<string, string> = {
  [BONE.lShoulder]: BONE.rShoulder,
  [BONE.rShoulder]: BONE.lShoulder,
  [BONE.lArm]: BONE.rArm,
  [BONE.rArm]: BONE.lArm,
  [BONE.lForeArm]: BONE.rForeArm,
  [BONE.rForeArm]: BONE.lForeArm,
  [BONE.lHand]: BONE.rHand,
  [BONE.rHand]: BONE.lHand,
  [BONE.lUpLeg]: BONE.rUpLeg,
  [BONE.rUpLeg]: BONE.lUpLeg,
  [BONE.lLeg]: BONE.rLeg,
  [BONE.rLeg]: BONE.lLeg,
  [BONE.lFoot]: BONE.rFoot,
  [BONE.rFoot]: BONE.lFoot,
};

function applyClipFrame(rig: Rig, f: ClipFrame, w: number, mirror = false): void {
  // Mirroring swaps the limb and flips the axes that carry handedness; pitch
  // (rotation.x) is unchanged because it is the same in both reflections.
  const flip = mirror ? -1 : 1;

  for (const name in f.pose) {
    const b = rig.bones[mirror ? (MIRROR[name] ?? name) : name];
    if (!b) continue;
    const p = f.pose[name];
    if (p.x !== undefined) b.rotation.x = lerp(b.rotation.x, p.x, w);
    if (p.y !== undefined) b.rotation.y = lerp(b.rotation.y, p.y * flip, w);
    if (p.z !== undefined) b.rotation.z = lerp(b.rotation.z, p.z * flip, w);
  }

  if (f.hipY !== undefined) {
    const hips = rig.bones[BONE.hips];
    hips.position.y = lerp(hips.position.y, HIP_Y + f.hipY, w);
  }

  const r = f.root;
  if (!r) return;
  const root = rig.root;
  root.position.x = lerp(root.position.x, (r.x ?? 0) * flip, w);
  root.position.y = lerp(root.position.y, r.y ?? 0, w);
  root.position.z = lerp(root.position.z, r.z ?? 0, w);
  root.rotation.x = lerp(root.rotation.x, r.pitch ?? 0, w);
  root.rotation.y = lerp(root.rotation.y, (r.yaw ?? 0) * flip, w);
  root.rotation.z = lerp(root.rotation.z, (r.roll ?? 0) * flip, w);
}

/* ————————————————— hand props ————————————————— */

export type Weapon3D = "hammer" | "fryingpan" | "slipper" | "foambat" | null;
export type SplatKind = "mud" | "cream" | "tomato" | "water";

function buildWeapon(kind: Exclude<Weapon3D, null>): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.75 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.35, metalness: 0.7 });

  if (kind === "hammer") {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.3, 12), wood);
    handle.position.y = -0.19;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.14), metal);
    head.position.y = -0.36;
    head.castShadow = true;
    g.add(handle, head);
  } else if (kind === "fryingpan") {
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 12), dark);
    handle.position.y = -0.14;
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.095, 0.035, 24), metal);
    pan.position.y = -0.29;
    pan.rotation.x = Math.PI / 2;
    pan.castShadow = true;
    g.add(handle, pan);
  } else if (kind === "slipper") {
    const rubber = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.8 });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.028, 0.2), rubber);
    sole.position.y = -0.16;
    sole.castShadow = true;
    g.add(sole);
  } else {
    const foam = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.9 });
    const bat = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.26, 4, 14), foam);
    bat.position.y = -0.26;
    bat.castShadow = true;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12), wood);
    grip.position.y = -0.08;
    g.add(bat, grip);
  }

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

function disposeWeapon(g: THREE.Group): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  g.removeFromParent();
}

function splatMat(hex: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.78,
    metalness: 0,
    ...extra,
  });
}

/** Irregular blob — not a sphere, so it doesn't read as a 2D circle on the face. */
function lump(rx: number, ry: number, rz: number, mat: THREE.Material, seed: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 10, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const n = 0.72 + ((Math.sin(seed * 12.9 + i * 1.7) + 1) * 0.5) * 0.5;
    pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n, pos.getZ(i) * n);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function drip(len: number, r: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(r, len, 3, 8);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

const SPLAT_PALETTE: Record<SplatKind, { wet: number; dry: number; opacity: number }> = {
  mud: { wet: 0x5c3a1e, dry: 0x3d2410, opacity: 1 },
  cream: { wet: 0xfff4d6, dry: 0xe8c98a, opacity: 0.96 },
  tomato: { wet: 0xc41e1e, dry: 0x7a1212, opacity: 0.95 },
  water: { wet: 0x7ae7ff, dry: 0x3ec6e8, opacity: 0.55 },
};

/**
 * Face mess that rides on the head bone, so it turns and flinches with the
 * fighter instead of sitting as a flat disc over the canvas.
 */
function buildFaceSplat(kind: SplatKind): THREE.Group {
  const g = new THREE.Group();
  g.name = `splat-${kind}`;
  const pal = SPLAT_PALETTE[kind];
  const wet = splatMat(pal.wet, {
    transparent: pal.opacity < 1,
    opacity: pal.opacity,
    emissive: pal.wet,
    emissiveIntensity: 0.18,
  });
  const dry = splatMat(pal.dry, {
    transparent: pal.opacity < 1,
    opacity: pal.opacity,
    emissive: pal.dry,
    emissiveIntensity: 0.1,
  });
  const R = HEAD_R;

  const spots: Array<[number, number, number, number, number, number, THREE.Material]> = [
    [0.03, -0.02, R * 0.95, 0.09, 0.07, 0.055, wet],
    [-0.06, -0.04, R * 0.9, 0.075, 0.055, 0.045, dry],
    [0.07, -0.08, R * 0.82, 0.065, 0.05, 0.04, wet],
    [-0.01, -0.1, R * 0.85, 0.08, 0.05, 0.04, dry],
    [0.09, 0.02, R * 0.55, 0.05, 0.04, 0.035, wet],
    [-0.08, -0.06, R * 0.5, 0.048, 0.036, 0.03, dry],
  ];
  spots.forEach(([x, y, z, sx, sy, sz, mat], i) => {
    const blob = lump(sx, sy, sz, mat, i + kind.length);
    blob.position.set(x, y, z);
    g.add(blob);
  });

  if (kind !== "water") {
    for (const [x, y] of [[-0.03, -0.1], [0.04, -0.12], [0.0, -0.14]] as Array<[number, number]>) {
      const d = drip(kind === "cream" ? 0.1 : 0.08, kind === "tomato" ? 0.014 : 0.016, wet);
      d.position.set(x, y, R * 0.78);
      g.add(d);
    }
  } else {
    for (const [x, y] of [[-0.04, -0.06], [0.05, -0.09], [0.0, -0.12]] as Array<[number, number]>) {
      const drop = drip(0.06, 0.01, wet);
      drop.position.set(x, y, R * 0.85);
      g.add(drop);
    }
  }
  return g;
}

function disposeSplat(g: THREE.Group): void {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mat = o.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else (mat as THREE.Material).dispose();
    }
  });
  g.removeFromParent();
}

function disposeRig(rig: Rig): void {
  rig.geometries.forEach((g) => g.dispose());
  rig.materials.forEach((m) => m.dispose());
  rig.root.removeFromParent();
}

export interface Avatar3D {
  update(data: CharData, mood: Mood): void;
  setPointer(nx: number, ny: number): void;
  /** Plays an attacking move. Unknown ids are ignored. */
  attack(act: string): void;
  /** Plays a getting-hit reaction. Unknown ids are ignored. */
  react(anim: string): void;
  setWeapon(kind: Weapon3D): void;
  /** Sticks thrown mess onto the face. Repeated kinds are ignored. */
  addSplat(kind: SplatKind): void;
  dispose(): void;
}

export interface Avatar3DOptions {
  accent?: string;
  /** Body yaw in radians. Arena fighters turn to face each other. */
  facing?: number;
  /** Arena framing leaves headroom for kicks and overhead swings. */
  framing?: "preview" | "arena";
  /** Cursor head-tracking belongs to the builder, not the fight. */
  pointerTracking?: boolean;
}

let webglSupported: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (webglSupported !== null) return webglSupported;
  try {
    const canvas = document.createElement("canvas");
    webglSupported = !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    webglSupported = false;
  }
  return webglSupported;
}

// A single loop drives every mounted avatar so we never stack rAF callbacks.
const instances = new Set<{ tick: (dt: number) => void }>();
let rafId = 0;
let lastTime = 0;

function loop(now: number): void {
  rafId = requestAnimationFrame(loop);
  const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0.016;
  lastTime = now;
  instances.forEach((i) => i.tick(dt));
}

function ensureLoop(): void {
  if (!rafId) {
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
  }
}

function maybeStopLoop(): void {
  if (rafId && instances.size === 0) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

export function mountAvatar3D(host: HTMLElement, opts: Avatar3DOptions = {}): Avatar3D | null {
  if (!isWebGLAvailable()) return null;

  const accent = opts.accent ?? "#ffb020";
  const facing = opts.facing ?? 0;
  const arena = opts.framing === "arena";
  const pointerTracking = opts.pointerTracking !== false;
  // Turned to screen-right, so the near arm is the left one.
  const mirror = facing > 0;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral tone mapping: ACES was pushing lit skin tones towards orange.
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1;

  const canvas = renderer.domElement;
  canvas.className = "avatar3d-canvas";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  // The arena frames tighter and sits the feet near the bottom edge, keeping
  // just enough headroom for an overhead swing.
  const camera = new THREE.PerspectiveCamera(arena ? 36 : 34, 1, 0.1, 50);
  camera.position.set(0, arena ? 1.05 : 0.86, arena ? 3.2 : 2.95);
  camera.lookAt(0, arena ? 0.98 : 0.78, 0);

  // Facing lives on a parent so clips can still push the body along its own
  // forward axis without having to know which way the fighter is turned.
  const anchor = new THREE.Group();
  anchor.rotation.y = facing;
  scene.add(anchor);

  const hemi = new THREE.HemisphereLight(0xffe6c0, 0x2a1c16, 0.5);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.7);
  keyLight.position.set(1.5, 2.6, 2.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 8;
  const s = 1.3;
  keyLight.shadow.camera.left = -s;
  keyLight.shadow.camera.right = s;
  keyLight.shadow.camera.top = 2.0;
  keyLight.shadow.camera.bottom = -0.3;
  keyLight.shadow.bias = -0.0015;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  // Coloured rim separates the silhouette from the dark stage background.
  const rim = new THREE.DirectionalLight(new THREE.Color(accent), 0.55);
  rim.position.set(-2.2, 1.6, -1.8);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x9ab4ff, 0.2);
  fill.position.set(-1.6, 0.7, 2.0);
  scene.add(fill);

  const groundGeo = new THREE.PlaneGeometry(6, 6);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.42 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let rig: Rig | null = null;
  let currentKey = "";
  let weapon: THREE.Group | null = null;
  let weaponKind: Weapon3D = null;
  let clip: Clip | null = null;
  let clipTime = 0;
  const splatKinds = new Set<SplatKind>();
  const splatGroups = new Map<SplatKind, THREE.Group>();
  let time = 0;
  let blinkTimer = 2 + Math.random() * 3;
  let blinking = 0;
  let eyeOpenTarget = 1;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  let moodTilt = 0;
  let visible = true;

  function resize(): void {
    const w = host.clientWidth || 168;
    const h = host.clientHeight || 272;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
    },
    { threshold: 0.01 },
  );
  io.observe(host);

  function attachWeapon(): void {
    if (weapon) {
      disposeWeapon(weapon);
      weapon = null;
    }
    if (!rig || !weaponKind) return;
    // A slipper is swung with the off hand; everything else is a right-hand
    // swing — and follows the same mirroring the clips use.
    const handBone = weaponKind === "slipper" ? BONE.lHand : BONE.rHand;
    const hand = rig.bones[mirror ? MIRROR[handBone] : handBone];
    if (!hand) return;
    weapon = buildWeapon(weaponKind);
    hand.add(weapon);
  }

  function rebuild(data: CharData): void {
    if (weapon) {
      disposeWeapon(weapon);
      weapon = null;
    }
    splatGroups.forEach((g) => disposeSplat(g));
    splatGroups.clear();
    if (rig) disposeRig(rig);
    rig = buildRig(data);
    anchor.add(rig.root);
    attachWeapon();
    splatKinds.forEach((kind) => {
      const g = buildFaceSplat(kind);
      rig!.bones[BONE.head].add(g);
      splatGroups.set(kind, g);
    });
  }

  function structureKey(d: CharData): string {
    return [d.skin, d.hair, d.shirt, d.hairStyle, d.body, d.vibe, d.face, d.accessory, d.shoes].join(
      "|",
    );
  }

  const inst = {
    tick(dt: number): void {
      if (!rig) return;
      // A clip must finish even while off-screen, or the pose freezes mid-swing.
      if (!visible || document.hidden) {
        if (!clip) return;
      }
      time += dt;

      // Idle breathing and weight shift.
      const breath = Math.sin(time * 1.7);
      const sway = Math.sin(time * 0.8);
      const b = rig.bones;
      b[BONE.spine].rotation.x = -0.02 + breath * 0.012;
      b[BONE.spine1].scale.set(1 + breath * 0.012, 1 + breath * 0.008, 1 + breath * 0.012);
      b[BONE.spine2].rotation.y = sway * 0.05;
      b[BONE.hips].position.y = HIP_Y + breath * 0.006;
      b[BONE.hips].rotation.z = sway * 0.012;

      b[BONE.lArm].rotation.x = 0.06 + Math.sin(time * 1.6 + 0.4) * 0.05;
      b[BONE.rArm].rotation.x = 0.06 + Math.sin(time * 1.6 - 0.4) * 0.05;
      b[BONE.lArm].rotation.z = -0.12 - Math.abs(sway) * 0.03;
      b[BONE.rArm].rotation.z = 0.12 + Math.abs(sway) * 0.03;

      // Head follows the cursor, with a little idle drift.
      pointerX += (targetPointerX - pointerX) * Math.min(1, dt * 6);
      pointerY += (targetPointerY - pointerY) * Math.min(1, dt * 6);
      b[BONE.head].rotation.y = pointerX * 0.45 + sway * 0.06;
      b[BONE.head].rotation.x = -pointerY * 0.25 + breath * 0.01;
      b[BONE.head].rotation.z = moodTilt;
      rig.root.position.set(0, 0, 0);
      rig.root.rotation.set(0, pointerX * 0.3, 0);

      // Blinking, unless the mood already holds the eyes shut.
      if (eyeOpenTarget > 0.5) {
        blinkTimer -= dt;
        if (blinkTimer <= 0) {
          blinking = 0.14;
          blinkTimer = 2.5 + Math.random() * 4;
        }
        if (blinking > 0) {
          blinking -= dt;
          const k = Math.max(0, blinking / 0.14);
          const shut = Math.sin(k * Math.PI);
          const open = eyeOpenTarget * (1 - shut);
          rig.face.eyeL.scale.y = Math.max(0.02, open);
          rig.face.eyeR.scale.y = Math.max(0.02, open);
          const drop = 1 - Math.min(1, open);
          rig.face.lidL.rotation.x = -drop * Math.PI * 0.52;
          rig.face.lidR.rotation.x = -drop * Math.PI * 0.52;
        }
      }

      // Combat pose is layered over the idle pass so the two never fight:
      // the clip only claims the bones it actually animates, and eases its grip
      // on and off at the edges.
      if (clip) {
        clipTime += dt;
        const t = clipTime / ((clip.dur / 1000) * CLIP_TIME_SCALE);
        if (t >= 1) {
          applyClipFrame(rig, clip.frame(1), 1, mirror);
          clip = null;
        } else {
          const w = key(t, [
            [0, 0],
            [0.07, 1],
            [0.9, 1],
            [1, 0],
          ]);
          applyClipFrame(rig, clip.frame(t), w, mirror);
        }
      }

      renderer.render(scene, camera);
    },
  };

  instances.add(inst);
  ensureLoop();

  return {
    update(data: CharData, mood: Mood): void {
      const k = structureKey(data);
      if (k !== currentKey) {
        currentKey = k;
        rebuild(data);
      }
      if (rig) {
        applyMood(rig, mood);
        eyeOpenTarget = MOOD_POSES[mood]?.eyeOpen ?? 1;
        moodTilt = MOOD_POSES[mood]?.headTilt ?? 0;
      }
    },
    setPointer(nx: number, ny: number): void {
      if (!pointerTracking) return;
      targetPointerX = Math.max(-1, Math.min(1, nx));
      targetPointerY = Math.max(-1, Math.min(1, ny));
    },
    attack(act: string): void {
      const next = ATTACK_CLIPS[ATTACK_ALIAS[act] ?? act];
      if (!next) return;
      clip = next;
      clipTime = 0;
    },
    react(anim: string): void {
      const next = REACT_CLIPS[anim];
      if (!next) return;
      clip = next;
      clipTime = 0;
    },
    setWeapon(kind: Weapon3D): void {
      if (kind === weaponKind) return;
      weaponKind = kind;
      attachWeapon();
    },
    addSplat(kind: SplatKind): void {
      if (splatKinds.has(kind) || !rig) return;
      splatKinds.add(kind);
      const g = buildFaceSplat(kind);
      rig.bones[BONE.head].add(g);
      splatGroups.set(kind, g);
    },
    dispose(): void {
      instances.delete(inst);
      maybeStopLoop();
      ro.disconnect();
      io.disconnect();
      if (weapon) disposeWeapon(weapon);
      splatGroups.forEach((g) => disposeSplat(g));
      splatGroups.clear();
      if (rig) disposeRig(rig);
      groundGeo.dispose();
      groundMat.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
