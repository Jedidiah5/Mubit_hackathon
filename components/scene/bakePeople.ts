"use client";

/**
 * Bakes rigged Quaternius characters (CC0, see public/models/CREDITS.txt)
 * into static posed geometry so hundreds of guests can be drawn with a
 * handful of instanced meshes instead of hundreds of skinned ones.
 *
 * For each body × pose we play a frame of the Idle clip, optionally fold the
 * legs into a sitting pose (same bone trick as a Sims-style rig), then push
 * every vertex through the skeleton once on the CPU.
 */

import {
  type AnimationClip,
  AnimationMixer,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  type Object3D,
  Quaternion,
  type SkinnedMesh,
  Vector3,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export const PEOPLE_MODELS = [
  "/models/people/m_suit.glb",
  "/models/people/f_formal.glb",
  "/models/people/m_casual.glb",
  "/models/people/f_casual.glb",
] as const;

/** Target standing height in metres (source rigs are ~1.8 m). */
const HEIGHT_M = 1.72;
/** Frame of the Idle clip to freeze on. */
const IDLE_T = 0.4;
/**
 * Seated leg bends (radians about the body's left-right axis), solved against
 * the Idle frame so the thigh runs ~3° down to the knee and the shin is vertical.
 * The Idle thigh already leans slightly back, so this is less than a right angle.
 */
const THIGH_BEND = -1.23;
const SHIN_BEND = 0.975;

/** Just what we need from a loaded RiggedModel (structural, so drei's bundled three types fit). */
export type RiggedModel = { scene: Object3D; animations: AnimationClip[] };

export type Pose = "stand" | "sit";
/** Which palette a baked part is coloured from. */
export type Slot = "skin" | "hair" | "top" | "bottom" | "shoes" | "fixed";
type Part = "head" | "body" | "legs" | "feet";

export type BakedPart = {
  geometry: BufferGeometry;
  slot: Slot;
  /** Original material colour, used for `fixed` parts (eyes, ties, trims). */
  color: string;
};

export type BakedBody = {
  stand: BakedPart[];
  sit: BakedPart[];
  /**
   * Hip-bone height of the seated pose with the soles at y = 0 (metres).
   * The seated geometry is centred on the hips in x/z, so an instance placed at
   * a chair's centre sits on it; raise it by (seatTop + pelvis depth − sitHipY).
   */
  sitHipY: number;
};

function partOf(node: Object3D): Part | null {
  for (let cur: Object3D | null = node; cur; cur = cur.parent) {
    if (/_Head$/.test(cur.name)) return "head";
    if (/_Body$/.test(cur.name)) return "body";
    if (/_(Legs|Pants)$/.test(cur.name)) return "legs";
    if (/_Feet$/.test(cur.name)) return "feet";
  }
  return null;
}

const turn = new Quaternion();
const parentTurn = new Quaternion();
const axis = new Vector3();
const spot = new Vector3();

/** Rotate a bone about the body's left-right axis on top of the clip pose. */
function bend(bone: Object3D | undefined, angle: number) {
  if (!bone?.parent) return;
  bone.parent.getWorldQuaternion(parentTurn).invert();
  axis.set(1, 0, 0).applyQuaternion(parentTurn);
  bone.quaternion.premultiply(turn.setFromAxisAngle(axis, angle));
}

/** The rig's feet hang off the root, so after bending the shins move them to the shin end. */
function plant(shinEnd: Object3D | undefined, foot: Object3D | undefined) {
  if (!shinEnd || !foot?.parent) return;
  shinEnd.getWorldPosition(spot);
  foot.parent.updateWorldMatrix(true, false);
  foot.position.copy(foot.parent.worldToLocal(spot));
}

function skinnedMeshes(root: Object3D): SkinnedMesh[] {
  const out: SkinnedMesh[] = [];
  root.traverse((n) => {
    if ((n as SkinnedMesh).isSkinnedMesh) out.push(n as SkinnedMesh);
  });
  return out;
}

/** Push every vertex of a skinned mesh through its current skeleton. */
function bakeMesh(mesh: SkinnedMesh, scale: number): BufferGeometry {
  mesh.skeleton.update();
  const src = mesh.geometry;
  const pos = src.getAttribute("position");
  const n = pos.count;
  const out = new Float32Array(n * 3);
  const v = new Vector3();
  const world = new Matrix4().copy(mesh.matrixWorld);
  for (let i = 0; i < n; i++) {
    // applyBoneTransform reads the input position from the vector passed in.
    v.fromBufferAttribute(pos, i);
    mesh.applyBoneTransform(i, v);
    v.applyMatrix4(world).multiplyScalar(scale);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(out, 3));
  if (src.index) geo.setIndex(src.index.clone());
  geo.computeVertexNormals();
  return geo;
}

type Prim = { mesh: SkinnedMesh; part: Part | null; matName: string; count: number };

function classify(prims: Prim[]): Map<SkinnedMesh, Slot> {
  const slots = new Map<SkinnedMesh, Slot>();
  // Biggest non-skin primitive per clothing part is the garment; the rest are trims.
  const main = new Map<Part, Prim>();
  for (const p of prims) {
    if (!p.part || p.part === "head") continue;
    if (/^Skin/.test(p.matName)) continue;
    const cur = main.get(p.part);
    if (!cur || p.count > cur.count) main.set(p.part, p);
  }
  for (const p of prims) {
    const m = p.matName;
    if (/^Skin/.test(m)) slots.set(p.mesh, "skin");
    else if (m === "Eye" || m === "Earrings") slots.set(p.mesh, "fixed");
    else if (p.part === "head" || /^Hair|^Eyebrows|^Moustache/.test(m)) slots.set(p.mesh, "hair");
    else if (p.part && main.get(p.part) === p)
      slots.set(p.mesh, p.part === "body" ? "top" : p.part === "legs" ? "bottom" : "shoes");
    else slots.set(p.mesh, "fixed");
  }
  return slots;
}

function poseRoot(RiggedModel: RiggedModel, pose: Pose): Object3D {
  const root = cloneSkinned(RiggedModel.scene);
  const idle = RiggedModel.animations.find((c) => c.name === "Idle") ?? RiggedModel.animations[0];
  if (idle) {
    const mixer = new AnimationMixer(root);
    mixer.clipAction(idle).play();
    mixer.update(IDLE_T);
  }
  root.updateMatrixWorld(true);
  if (pose === "sit") {
    const b = (name: string) => root.getObjectByName(name);
    bend(b("UpperLegL"), THIGH_BEND);
    bend(b("UpperLegR"), THIGH_BEND);
    bend(b("LowerLegL"), SHIN_BEND);
    bend(b("LowerLegR"), SHIN_BEND);
    root.updateMatrixWorld(true);
    plant(b("LowerLegL_end"), b("FootL"));
    plant(b("LowerLegR_end"), b("FootR"));
    root.updateMatrixWorld(true);
  }
  return root;
}

const bakeCache = new WeakMap<RiggedModel, BakedBody>();

export function bakeBody(RiggedModel: RiggedModel): BakedBody {
  const hit = bakeCache.get(RiggedModel);
  if (hit) return hit;

  const bakePose = (pose: Pose, scale: number) => {
    const root = poseRoot(RiggedModel, pose);
    const meshes = skinnedMeshes(root);
    const prims: Prim[] = meshes.map((mesh) => ({
      mesh,
      part: partOf(mesh),
      matName: (mesh.material as { name?: string }).name ?? "",
      count: mesh.geometry.getAttribute("position").count,
    }));
    const slots = classify(prims);
    const parts: BakedPart[] = prims.map((p) => {
      const mat = p.mesh.material as { color?: Color };
      return {
        geometry: bakeMesh(p.mesh, scale),
        slot: slots.get(p.mesh) ?? "fixed",
        color: mat.color ? `#${mat.color.getHexString()}` : "#888888",
      };
    });
    const hips = root.getObjectByName("Hips");
    const hip = hips ? hips.getWorldPosition(new Vector3()).multiplyScalar(scale) : new Vector3();
    return { parts, hip };
  };

  // Scale from the standing pose so both poses share proportions.
  const probe = poseRoot(RiggedModel, "stand");
  const box = new Box3().setFromObject(probe);
  const scale = HEIGHT_M / Math.max(0.1, box.max.y - box.min.y);

  const stand = bakePose("stand", scale);
  const sit = bakePose("sit", scale);

  // Ground each pose (soles at y = 0). Standing is centred on its footprint;
  // seated is centred on the hips so the knees stick out past the origin.
  const ground = (parts: BakedPart[], centre?: Vector3) => {
    const all = new Box3();
    for (const p of parts) {
      p.geometry.computeBoundingBox();
      all.union(p.geometry.boundingBox!);
    }
    const dx = centre ? -centre.x : -(all.min.x + all.max.x) / 2;
    const dz = centre ? -centre.z : -(all.min.z + all.max.z) / 2;
    const dy = -all.min.y;
    for (const p of parts) {
      p.geometry.translate(dx, dy, dz);
      p.geometry.computeBoundingBox();
      p.geometry.computeBoundingSphere();
    }
    return dy;
  };
  ground(stand.parts);
  const sitShift = ground(sit.parts, sit.hip);

  const baked: BakedBody = {
    stand: stand.parts,
    sit: sit.parts,
    sitHipY: sit.hip.y + sitShift,
  };
  bakeCache.set(RiggedModel, baked);
  return baked;
}
