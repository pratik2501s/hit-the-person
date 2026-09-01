import * as THREE from "three";
import { buildRig } from "../src/avatar3d.ts";
import { defaultChar } from "../src/character.ts";

const data = defaultChar();
console.log("input CharData:", JSON.stringify(data));

const rig = buildRig(data);

console.log("\n-- meshes and their material colours (as sRGB hex) --");
rig.root.traverse((o) => {
  const mesh = o as THREE.Mesh;
  if (!mesh.isMesh) return;
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const hex = mat.color ? "#" + mat.color.getHexString(THREE.SRGBColorSpace) : "n/a";
  const path: string[] = [];
  let p: THREE.Object3D | null = o.parent;
  while (p) {
    if (p.name) path.unshift(p.name);
    p = p.parent;
  }
  const pos = new THREE.Vector3();
  o.getWorldPosition(pos);
  console.log(
    `${hex}  geo=${mesh.geometry.type.padEnd(16)} y=${pos.y.toFixed(3)} under=${path.join("/") || "(root)"}`,
  );
});

const box = new THREE.Box3().setFromObject(rig.root);
console.log("\nbounding box min/max:", box.min.toArray(), box.max.toArray());
console.log("height:", (box.max.y - box.min.y).toFixed(3), " feet at y:", box.min.y.toFixed(3));
