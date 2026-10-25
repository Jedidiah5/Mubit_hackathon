"use client";

import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import {
  CanvasTexture,
  DoubleSide,
  type Group,
  LinearFilter,
  SRGBColorSpace,
} from "three";
import { accessibleRouteRects, stageWidth } from "@/lib/layout/shared";
import type { LayoutItem, LayoutKind, Room, Spec, Wall } from "@/lib/types";
import { popScale, unitNoise } from "./buildAnim";
import { AnimatedInstance, Pool, seedFor } from "./instancing";
import { palette } from "./palette";
import { People } from "./People";

type Props = {
  items: LayoutItem[];
  time: () => number;
  room: Room;
  spec?: Spec;
  /** Hide guests while Edit layout is on (clears the floor for picking). */
  hidePeople?: boolean;
};

const GUEST_KINDS = ["guest_seated", "guest_standing", "guest_overflow"] as const;

export function Items({ items, time, room, spec, hidePeople = false }: Props) {
  const byKind = useMemo(() => {
    const map = new Map<LayoutKind, LayoutItem[]>();
    for (const it of items) {
      const list = map.get(it.kind) ?? [];
      list.push(it);
      map.set(it.kind, list);
    }
    return map;
  }, [items]);

  return (
    <group>
      {spec?.accessible && <AccessibleRoute room={room} spec={spec} />}
      <RoundTables items={byKind.get("table_round") ?? []} time={time} />
      <HighTables items={byKind.get("high_table") ?? []} time={time} />
      <Chairs items={byKind.get("chair") ?? []} time={time} />
      {!hidePeople &&
        GUEST_KINDS.map((kind) => {
          const guests = byKind.get(kind) ?? [];
          return (
            // Rigged characters once the models are in; capsule stand-ins meanwhile.
            <Suspense
              key={kind}
              fallback={<Guests items={guests} time={time} kind={kind} />}
            >
              <People items={guests} time={time} kind={kind} />
            </Suspense>
          );
        })}

      {(byKind.get("stage") ?? []).map((it, i) => (
        <FeatureStage
          key={`stage-${i}`}
          item={it}
          index={i}
          time={time}
          width={stageWidth(room, wallFromRot(it.rotY))}
        />
      ))}
      {(byKind.get("bar") ?? []).map((it, i) => (
        <FeatureBar key={`bar-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("dance_floor") ?? []).map((it, i) => (
        <FeatureDance key={`dance-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("dj_booth") ?? []).map((it, i) => (
        <FeatureDJ key={`dj-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("photo_booth") ?? []).map((it, i) => (
        <FeaturePhotoBooth key={`photo-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("buffet") ?? []).map((it, i) => (
        <FeatureBuffet key={`buffet-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("lectern") ?? []).map((it, i) => (
        <FeatureLectern
          key={`lec-${i}`}
          item={it}
          index={i}
          time={time}
          onStage={(byKind.get("stage") ?? []).length > 0}
        />
      ))}
      {(byKind.get("projector") ?? []).map((it, i) => (
        <FeatureProjector key={`proj-${i}`} item={it} index={i} time={time} />
      ))}
    </group>
  );
}

function wallFromRot(rotY: number): Wall {
  const r = ((rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (Math.abs(r) < 0.1 || Math.abs(r - Math.PI * 2) < 0.1) return "north";
  if (Math.abs(r - Math.PI) < 0.1) return "south";
  if (Math.abs(r - Math.PI / 2) < 0.1) return "west";
  return "east";
}

type Timed = { items: LayoutItem[]; time: () => number };

/* ---------------- Tables ---------------- */

const PLATE_R = 0.66;
const PLATES = 10;

function RoundTables({ items, time }: Timed) {
  const plates = useMemo(() => {
    const out: { x: number; z: number; i: number }[] = [];
    items.forEach((it, i) => {
      for (let k = 0; k < PLATES; k++) {
        const a = (k / PLATES) * Math.PI * 2 - Math.PI / 2;
        out.push({ x: it.x + Math.sin(a) * PLATE_R, z: it.z + Math.cos(a) * PLATE_R, i });
      }
    });
    return out;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <>
      {/* Tablecloth skirt */}
      <Pool count={items.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.97, 0.74, 32, 1, true]} />
        <meshStandardMaterial color={palette.cloth} roughness={0.85} side={2} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`tc-${i}`}
            kind="table_round"
            index={i}
            time={time}
            position={[it.x, 0.37, it.z]}
          />
        ))}
      </Pool>
      {/* Top */}
      <Pool count={items.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.035, 32]} />
        <meshStandardMaterial color={palette.tableTop} roughness={0.7} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`tt-${i}`}
            kind="table_round"
            index={i}
            time={time}
            position={[it.x, 0.755, it.z]}
          />
        ))}
      </Pool>
      {/* Vase + flowers */}
      <Pool count={items.length} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.26, 10]} />
        <meshStandardMaterial color={palette.vase} roughness={0.35} metalness={0.1} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`tv-${i}`}
            kind="table_round"
            index={i}
            time={time}
            position={[it.x, 0.9, it.z]}
          />
        ))}
      </Pool>
      <Pool count={items.length} castShadow>
        <sphereGeometry args={[0.17, 12, 10]} />
        <meshStandardMaterial color={palette.centrepiece} roughness={0.9} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`tf-${i}`}
            kind="table_round"
            index={i}
            time={time}
            position={[it.x, 1.1, it.z]}
            color={i % 3 === 0 ? "#b86a7a" : i % 3 === 1 ? palette.centrepiece : "#d8c48a"}
          />
        ))}
      </Pool>
      {/* Plates */}
      <Pool count={plates.length}>
        <cylinderGeometry args={[0.13, 0.13, 0.012, 16]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
        {plates.map((p, k) => (
          <AnimatedInstance
            key={`tp-${k}`}
            kind="table_round"
            index={p.i}
            time={time}
            position={[p.x, 0.78, p.z]}
          />
        ))}
      </Pool>
    </>
  );
}

function HighTables({ items, time }: Timed) {
  if (items.length === 0) return null;
  return (
    <>
      <Pool count={items.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.04, 24]} />
        <meshStandardMaterial color={palette.highTable} roughness={0.5} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`ht-${i}`}
            kind="high_table"
            index={i}
            time={time}
            position={[it.x, 1.08, it.z]}
          />
        ))}
      </Pool>
      <Pool count={items.length} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.05, 10]} />
        <meshStandardMaterial color={palette.chairFrame} roughness={0.5} metalness={0.4} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`hp-${i}`}
            kind="high_table"
            index={i}
            time={time}
            position={[it.x, 0.54, it.z]}
          />
        ))}
      </Pool>
      <Pool count={items.length} receiveShadow>
        <cylinderGeometry args={[0.26, 0.28, 0.03, 20]} />
        <meshStandardMaterial color={palette.chairFrame} roughness={0.5} metalness={0.4} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`hb-${i}`}
            kind="high_table"
            index={i}
            time={time}
            position={[it.x, 0.015, it.z]}
          />
        ))}
      </Pool>
      {/* Cloth drape over the top */}
      <Pool count={items.length} castShadow>
        <cylinderGeometry args={[0.42, 0.3, 0.55, 20, 1, true]} />
        <meshStandardMaterial color={palette.cloth} roughness={0.85} side={2} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`hc-${i}`}
            kind="high_table"
            index={i}
            time={time}
            position={[it.x, 0.82, it.z]}
          />
        ))}
      </Pool>
    </>
  );
}

/* ---------------- Chairs ---------------- */

function Chairs({ items, time }: Timed) {
  const legs = useMemo(() => {
    const out: { x: number; z: number; rot: number; i: number }[] = [];
    const off = 0.17;
    items.forEach((it, i) => {
      for (const [lx, lz] of [
        [-off, -off],
        [off, -off],
        [-off, off],
        [off, off],
      ] as const) {
        const x = it.x + lx * Math.cos(it.rotY) + lz * Math.sin(it.rotY);
        const z = it.z - lx * Math.sin(it.rotY) + lz * Math.cos(it.rotY);
        out.push({ x, z, rot: it.rotY, i });
      }
    });
    return out;
  }, [items]);

  if (items.length === 0) return null;

  return (
    <>
      {/* Seat */}
      <Pool count={items.length} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.06, 0.42]} />
        <meshStandardMaterial color={palette.chair} roughness={0.8} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`cs-${i}`}
            kind="chair"
            index={i}
            time={time}
            position={[it.x, 0.46, it.z]}
            rotation={[0, it.rotY, 0]}
          />
        ))}
      </Pool>
      {/* Back */}
      <Pool count={items.length} castShadow>
        <boxGeometry args={[0.42, 0.46, 0.045]} />
        <meshStandardMaterial color={palette.chair} roughness={0.8} />
        {items.map((it, i) => {
          const back = 0.19;
          const x = it.x - Math.sin(it.rotY) * back;
          const z = it.z - Math.cos(it.rotY) * back;
          return (
            <AnimatedInstance
              key={`cb-${i}`}
              kind="chair"
              index={i}
              time={time}
              position={[x, 0.72, z]}
              rotation={[0, it.rotY, 0]}
              color={palette.chair}
            />
          );
        })}
      </Pool>
      {/* Legs */}
      <Pool count={legs.length} castShadow>
        <boxGeometry args={[0.03, 0.44, 0.03]} />
        <meshStandardMaterial color={palette.chairFrame} roughness={0.5} metalness={0.35} />
        {legs.map((lg, k) => (
          <AnimatedInstance
            key={`cl-${k}`}
            kind="chair"
            index={lg.i}
            time={time}
            position={[lg.x, 0.22, lg.z]}
            rotation={[0, lg.rot, 0]}
          />
        ))}
      </Pool>
    </>
  );
}

/* ---------------- People ---------------- */

function Guests({
  items,
  time,
  kind,
}: Timed & { kind: "guest_seated" | "guest_standing" | "guest_overflow" }) {
  const seated = kind === "guest_seated";
  const overflow = kind === "guest_overflow";
  const legsY = seated ? 0.52 : 0.46;
  const legsLen = seated ? 0.1 : 0.42;
  const torsoY = seated ? 0.78 : 0.98;
  const torsoLen = seated ? 0.26 : 0.32;
  const headY = seated ? 1.08 : 1.38;
  const hairY = headY + 0.035;

  if (items.length === 0) return null;

  const colorAt = (arr: readonly string[], i: number, salt: number) =>
    arr[Math.floor(unitNoise(i * 7 + salt) * arr.length) % arr.length]!;

  return (
    <>
      {/* Legs / lower body */}
      <Pool count={items.length} castShadow>
        <capsuleGeometry args={[0.13, legsLen, 4, 10]} />
        <meshStandardMaterial color={palette.trousers[0]} roughness={0.85} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`gl-${i}`}
            kind={kind}
            index={i}
            time={time}
            position={[it.x, legsY, it.z]}
            rotation={[0, it.rotY, 0]}
            color={colorAt(palette.trousers, i, 3)}
          />
        ))}
      </Pool>
      {/* Torso */}
      <Pool count={items.length} castShadow>
        <capsuleGeometry args={[0.15, torsoLen, 4, 10]} />
        <meshStandardMaterial color={palette.shirt[0]} roughness={0.8} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`gt-${i}`}
            kind={kind}
            index={i}
            time={time}
            position={[it.x, torsoY, it.z]}
            rotation={[0, it.rotY, 0]}
            color={overflow ? palette.overflow : colorAt(palette.shirt, i, 5)}
            breathe
          />
        ))}
      </Pool>
      {/* Head */}
      <Pool count={items.length} castShadow>
        <sphereGeometry args={[0.125, 14, 12]} />
        <meshStandardMaterial color={palette.skin[0]} roughness={0.7} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`gh-${i}`}
            kind={kind}
            index={i}
            time={time}
            position={[it.x, headY, it.z]}
            color={colorAt(palette.skin, i, 9)}
          />
        ))}
      </Pool>
      {/* Hair cap */}
      <Pool count={items.length}>
        <sphereGeometry args={[0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color="#2a211c" roughness={0.9} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`gr-${i}`}
            kind={kind}
            index={i}
            time={time}
            position={[it.x, hairY, it.z]}
            rotation={[0, it.rotY, 0]}
            color={["#2a211c", "#1a1512", "#4a3426", "#6b4a2a", "#111"][i % 5]}
          />
        ))}
      </Pool>
    </>
  );
}

/* ---------------- Features ---------------- */

type FeatureProps = {
  item: LayoutItem;
  index: number;
  time: () => number;
};

function useFeatureScale(
  ref: React.RefObject<Group | null>,
  kind: LayoutKind,
  index: number,
  item: LayoutItem,
  time: () => number,
) {
  const seed = seedFor(kind, index, item.x, item.z);
  useFrame(() => {
    if (ref.current) {
      ref.current.scale.setScalar(popScale(kind, seed, time()));
    }
  });
}

function FeatureStage({ item, index, time, width }: FeatureProps & { width: number }) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "stage", index, item, time);
  const height = 0.6;
  const depth = 2.4;
  const w = Math.max(3, width);
  const pars = [-0.3, 0, 0.3].map((f) => f * w);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      {/* Skirt + platform */}
      <mesh position={[0, height / 2 - 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.06, height - 0.02, depth + 0.06]} />
        <meshStandardMaterial color={palette.stageSkirt} roughness={0.95} />
      </mesh>
      <mesh position={[0, height - 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.05, depth]} />
        <meshStandardMaterial color={palette.stage} roughness={0.6} />
      </mesh>
      {/* Front accent strip */}
      <mesh position={[0, height - 0.03, depth / 2 + 0.035]}>
        <boxGeometry args={[w, 0.04, 0.03]} />
        <meshStandardMaterial
          color={palette.stageEdge}
          emissive={palette.stageEdge}
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
      {/* Steps (stage-right) */}
      {[0, 1].map((i) => (
        <mesh
          key={i}
          position={[w / 2 + 0.35, 0.15 + i * 0.3, depth / 2 - 0.6 + i * 0.4]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.7, 0.3, 0.8]} />
          <meshStandardMaterial color={palette.stageSkirt} roughness={0.9} />
        </mesh>
      ))}
      {/* Backdrop drape */}
      <mesh position={[0, height + 1.0, -depth / 2 + 0.1]} castShadow>
        <boxGeometry args={[w * 0.6, 2.0, 0.08]} />
        <meshStandardMaterial color="#23242e" roughness={0.95} />
      </mesh>
      <mesh position={[0, height + 1.0, -depth / 2 + 0.15]}>
        <boxGeometry args={[w * 0.6 - 0.3, 0.05, 0.02]} />
        <meshStandardMaterial
          color={palette.stageEdge}
          emissive={palette.stageEdge}
          emissiveIntensity={0.7}
          toneMapped={false}
        />
      </mesh>
      {/* Truss */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.2), 1.75, depth / 2 - 0.2]} castShadow>
          <boxGeometry args={[0.12, 3.5, 0.12]} />
          <meshStandardMaterial color={palette.truss} roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 3.45, depth / 2 - 0.2]} castShadow>
        <boxGeometry args={[w - 0.3, 0.12, 0.12]} />
        <meshStandardMaterial color={palette.truss} roughness={0.4} metalness={0.7} />
      </mesh>
      {pars.map((px, i) => (
        <group key={i} position={[px, 3.2, depth / 2 - 0.2]} rotation={[0.6, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.1, 0.13, 0.28, 12]} />
            <meshStandardMaterial color="#222" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.02, 12]} />
            <meshStandardMaterial
              color={palette.parLight}
              emissive={palette.parLight}
              emissiveIntensity={2.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Canvas texture for the door marker — avoids drei Html (unmount race in R3F). */
function accessMarkerTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fill();
  ctx.strokeStyle = "rgba(29,36,51,0.18)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.font = "bold 72px system-ui, Segoe UI Symbol, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1d2433";
  ctx.fillText("♿", size / 2, size / 2 + 4);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** 1.5 m step-free floor strip + ♿ marker at the south door. */
function AccessibleRoute({ room, spec }: { room: Room; spec: Spec }) {
  const rects = useMemo(() => accessibleRouteRects(room, spec), [room, spec]);
  const marker = useMemo(() => accessMarkerTexture(), []);
  if (rects.length === 0) return null;
  const hz = room.lengthM / 2;
  return (
    <group>
      {rects.map((r, i) => {
        const w = r.maxX - r.minX;
        const d = r.maxZ - r.minZ;
        const cx = (r.minX + r.maxX) / 2;
        const cz = (r.minZ + r.maxZ) / 2;
        return (
          <mesh
            key={i}
            position={[cx, 0.014, cz]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial
              color={palette.accessRoute}
              roughness={0.85}
              transparent
              opacity={0.72}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      {/* Edge lines so the strip reads at a glance */}
      {rects.map((r, i) => {
        const w = r.maxX - r.minX;
        const d = r.maxZ - r.minZ;
        const cx = (r.minX + r.maxX) / 2;
        const cz = (r.minZ + r.maxZ) / 2;
        return (
          <mesh
            key={`e-${i}`}
            position={[cx, 0.016, cz]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[Math.max(0.04, w - 0.12), Math.max(0.04, d - 0.12)]} />
            <meshStandardMaterial
              color={palette.accessRouteInner}
              roughness={0.9}
              transparent
              opacity={0.55}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      {marker && (
        <mesh
          position={[0, 0.04, hz - 0.35]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={2}
        >
          <planeGeometry args={[0.55, 0.55]} />
          <meshBasicMaterial
            map={marker}
            transparent
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

/** Long clothed buffet table with chafing dishes, bowls and a plate stack. */
function FeatureBuffet({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "buffet", index, item, time);
  const W = 4.8;
  const D = 0.9;
  const H = 0.76;
  const dishes = [-1.7, -0.95, -0.2, 0.55];
  const bowls = [1.25, 1.65];
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      {/* Table + floor-length cloth */}
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={palette.cloth} roughness={0.9} />
      </mesh>
      {/* Top cloth overhang */}
      <mesh position={[0, H + 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.12, 0.03, D + 0.12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.85} />
      </mesh>
      {/* Front skirt pleat line */}
      <mesh position={[0, H - 0.1, D / 2 + 0.002]}>
        <boxGeometry args={[W, 0.02, 0.004]} />
        <meshStandardMaterial color="#d8cfbf" roughness={0.9} />
      </mesh>
      {/* Chafing dishes */}
      {dishes.map((x, i) => (
        <group key={`dish-${i}`} position={[x, H + 0.03, 0.05]}>
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[0.56, 0.12, 0.36]} />
            <meshStandardMaterial color="#c9ccd1" roughness={0.25} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.17, 0]} castShadow>
            <sphereGeometry args={[0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#d7dade" roughness={0.2} metalness={0.95} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <sphereGeometry args={[0.025, 8, 6]} />
            <meshStandardMaterial color="#2a2724" roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Serving bowls */}
      {bowls.map((x, i) => (
        <group key={`bowl-${i}`} position={[x, H + 0.03, i === 0 ? -0.15 : 0.15]}>
          <mesh position={[0, 0.06, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.11, 0.12, 16]} />
            <meshStandardMaterial color="#f4efe6" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.125, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
            <meshStandardMaterial color={i === 0 ? "#6f9a3a" : "#c7543a"} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Plate stack */}
      <mesh position={[2.05, H + 0.03 + 0.07, 0.1]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.14, 18]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </mesh>
      {/* Cutlery roll tray */}
      <mesh position={[2.05, H + 0.03 + 0.02, -0.22]} castShadow>
        <boxGeometry args={[0.36, 0.04, 0.22]} />
        <meshStandardMaterial color="#8a6a44" roughness={0.7} />
      </mesh>
      {/* Menu card */}
      <mesh position={[-2.1, H + 0.03 + 0.1, -0.2]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[0.16, 0.2, 0.01]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </mesh>
    </group>
  );
}

function FeatureBar({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "bar", index, item, time);
  const bottles = useMemo(() => {
    const out: { x: number; y: number; c: string; h: number }[] = [];
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 9; i++) {
        const x = -1.4 + (i / 8) * 2.8;
        out.push({
          x,
          y: 1.25 + s * 0.5,
          c: palette.bottle[(i + s) % palette.bottle.length]!,
          h: 0.22 + unitNoise(i * 3 + s) * 0.1,
        });
      }
    }
    return out;
  }, []);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      {/* Counter */}
      <mesh position={[0, 0.55, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.1, 0.7]} />
        <meshStandardMaterial color={palette.bar} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.12, 0.15]} castShadow>
        <boxGeometry args={[3.56, 0.06, 0.86]} />
        <meshStandardMaterial color={palette.barTop} roughness={0.25} metalness={0.15} />
      </mesh>
      {/* Foot rail */}
      <mesh position={[0, 0.18, 0.56]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 3.3, 8]} />
        <meshStandardMaterial color="#b89a5a" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Back bar */}
      <mesh position={[0, 1.0, -0.35]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 2.0, 0.28]} />
        <meshStandardMaterial color={palette.barBack} roughness={0.8} />
      </mesh>
      {[1.1, 1.6].map((y) => (
        <mesh key={y} position={[0, y, -0.22]} castShadow>
          <boxGeometry args={[3.0, 0.03, 0.24]} />
          <meshStandardMaterial color={palette.wallCap} roughness={0.5} />
        </mesh>
      ))}
      {/* Shelf glow */}
      {[1.12, 1.62].map((y) => (
        <mesh key={`g-${y}`} position={[0, y, -0.12]}>
          <boxGeometry args={[3.0, 0.01, 0.02]} />
          <meshStandardMaterial
            color={palette.downlight}
            emissive={palette.downlight}
            emissiveIntensity={1.8}
            toneMapped={false}
          />
        </mesh>
      ))}
      {bottles.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2, -0.2]} castShadow>
          <cylinderGeometry args={[0.035, 0.04, b.h, 8]} />
          <meshStandardMaterial color={b.c} roughness={0.2} metalness={0.1} transparent opacity={0.9} />
        </mesh>
      ))}
      {/* Stools */}
      {[-1.0, 0, 1.0].map((x) => (
        <group key={x} position={[x, 0, 0.95]}>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 14]} />
            <meshStandardMaterial color={palette.chairFrame} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
            <meshStandardMaterial color="#8a8a8a" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[0.17, 0.19, 0.03, 14]} />
            <meshStandardMaterial color="#8a8a8a" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FeatureDance({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "dance_floor", index, item, time);
  const tiles = useMemo(() => {
    const out: { x: number; z: number; alt: boolean }[] = [];
    for (let ix = 0; ix < 6; ix++) {
      for (let iz = 0; iz < 6; iz++) {
        out.push({ x: ix - 2.5, z: iz - 2.5, alt: (ix + iz) % 2 === 0 });
      }
    }
    return out;
  }, []);
  const ballRef = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ballRef.current) ballRef.current.rotation.y += dt * 0.6;
  });

  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      {/* Raised deck */}
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[6.2, 0.06, 6.2]} />
        <meshStandardMaterial color={palette.dance} roughness={0.4} />
      </mesh>
      {tiles.map((tile) => (
        <mesh
          key={`${tile.x}-${tile.z}`}
          position={[tile.x, 0.065, tile.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.96, 0.96]} />
          <meshStandardMaterial
            color={tile.alt ? palette.danceGloss : palette.dance}
            roughness={0.12}
            metalness={0.3}
            envMapIntensity={1.4}
          />
        </mesh>
      ))}
      {/* LED edge */}
      {[
        [0, 3.12, 6.3, 0.05] as const,
        [0, -3.12, 6.3, 0.05] as const,
        [3.12, 0, 0.05, 6.3] as const,
        [-3.12, 0, 0.05, 6.3] as const,
      ].map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.05, z]}>
          <boxGeometry args={[w, 0.03, d]} />
          <meshStandardMaterial
            color={palette.danceEdge}
            emissive={palette.danceEdge}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Mirror ball */}
      <group ref={ballRef} position={[0, 2.75, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.28, 18, 14]} />
          <meshStandardMaterial color="#e8e8e8" roughness={0.08} metalness={1} envMapIntensity={2} flatShading />
        </mesh>
      </group>
      <mesh position={[0, 3.0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
        <meshStandardMaterial color="#777" roughness={0.4} metalness={0.8} />
      </mesh>
    </group>
  );
}

function FeatureDJ({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "dj_booth", index, item, time);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.0, 0.7]} />
        <meshStandardMaterial color={palette.booth} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[1.7, 0.05, 0.8]} />
        <meshStandardMaterial color={palette.barTop} roughness={0.3} />
      </mesh>
      {/* LED strip */}
      <mesh position={[0, 0.65, 0.36]}>
        <boxGeometry args={[1.5, 0.03, 0.01]} />
        <meshStandardMaterial
          color={palette.danceEdge}
          emissive={palette.danceEdge}
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>
      {/* Laptop + decks */}
      <mesh position={[0.35, 1.08, -0.1]} rotation={[-0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.22, 0.02]} />
        <meshStandardMaterial color="#1e1e1e" roughness={0.4} />
      </mesh>
      {[-0.45, 0].map((x) => (
        <mesh key={x} position={[x, 1.07, 0.1]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.03, 16]} />
          <meshStandardMaterial color="#111" roughness={0.3} metalness={0.4} />
        </mesh>
      ))}
      {/* Speakers */}
      {[-1.2, 1.2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 1.3, 0.5]} />
            <meshStandardMaterial color={palette.speaker} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.9, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.17, 0.17, 0.02, 16]} />
            <meshStandardMaterial color="#333" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.4, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
            <meshStandardMaterial color="#333" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FeaturePhotoBooth({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "photo_booth", index, item, time);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 1.05, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 2.1, 1.0]} />
        <meshStandardMaterial color={palette.booth} roughness={0.7} />
      </mesh>
      {/* Curtain */}
      <mesh position={[0.38, 1.0, 0.32]} castShadow>
        <boxGeometry args={[0.72, 1.9, 0.06]} />
        <meshStandardMaterial color={palette.curtain} roughness={0.95} />
      </mesh>
      {/* Ring light */}
      <mesh position={[-0.35, 1.3, 0.32]}>
        <torusGeometry args={[0.22, 0.03, 10, 24]} />
        <meshStandardMaterial
          color="#fff"
          emissive="#fff6e0"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
      {/* Sign */}
      <mesh position={[0, 2.25, 0.1]} castShadow>
        <boxGeometry args={[1.2, 0.28, 0.06]} />
        <meshStandardMaterial
          color={palette.chairAccent}
          emissive={palette.chairAccent}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function FeatureLectern({
  item,
  index,
  time,
  onStage,
}: FeatureProps & { onStage: boolean }) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "lectern", index, item, time);
  return (
    <group
      ref={ref}
      position={[item.x, onStage ? 0.6 : 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.55, 1.1, 0.4]} />
        <meshStandardMaterial color={palette.lectern} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.15, 0.05]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.6, 0.06, 0.45]} />
        <meshStandardMaterial color={palette.tableTop} roughness={0.5} />
      </mesh>
      <mesh position={[0.18, 1.45, 0.1]} rotation={[0.3, 0, -0.2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.5, 6]} />
        <meshStandardMaterial color="#222" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

function FeatureProjector({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "projector", index, item, time);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 1.9, 0.12]} castShadow>
        <boxGeometry args={[2.4, 1.5, 0.06]} />
        <meshStandardMaterial color={palette.projector} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.9, 0.16]}>
        <boxGeometry args={[2.2, 1.3, 0.01]} />
        <meshStandardMaterial
          color={palette.screen}
          emissive={palette.screen}
          emissiveIntensity={0.35}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}
