"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import type { LayoutItem } from "@/lib/types";
import { unitNoise } from "./buildAnim";
import { AnimatedInstance, Pool } from "./instancing";
import { palette } from "./palette";
import {
  PEOPLE_MODELS,
  type BakedPart,
  type RiggedModel,
  type Slot,
  bakeBody,
} from "./bakePeople";

type GuestKind = "guest_seated" | "guest_standing" | "guest_overflow";

const HAIR = ["#1a1512", "#2a211c", "#3b2a1f", "#5a3b22", "#111111", "#6b4a2a"] as const;
const SHOES = ["#1e1b19", "#2a2420", "#3a2e26", "#111111"] as const;

/** Chair seat top in Items.tsx (seat box centre 0.46 + half its 0.06 thickness). */
const SEAT_TOP_M = 0.49;
/** Hip bone sits this far above the surface it rests on (pelvis depth). */
const PELVIS_M = 0.08;
/** Hips a touch behind the seat centre so the thighs run out over the seat front. */
const SEAT_BACK_M = 0.04;

type Props = {
  items: LayoutItem[];
  time: () => number;
  kind: GuestKind;
};

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(unitNoise(seed) * arr.length) % arr.length]!;
}

/** Deterministic look per guest: body model + colours for each slot. */
function lookFor(it: LayoutItem, i: number, overflow: boolean) {
  const s = i * 31 + Math.round(it.x * 10) * 7 + Math.round(it.z * 10) * 3;
  return {
    body: Math.floor(unitNoise(s + 1) * PEOPLE_MODELS.length) % PEOPLE_MODELS.length,
    skin: pick(palette.skin, s + 2),
    hair: pick(HAIR, s + 3),
    top: overflow ? palette.overflow : pick(palette.shirt, s + 4),
    bottom: pick(palette.trousers, s + 5),
    shoes: pick(SHOES, s + 6),
    // Slight height variety (±4%).
    scale: 0.96 + unitNoise(s + 7) * 0.08,
  };
}

type Look = ReturnType<typeof lookFor>;

function colourFor(look: Look, slot: Slot, fixed: string): string {
  switch (slot) {
    case "skin":
      return look.skin;
    case "hair":
      return look.hair;
    case "top":
      return look.top;
    case "bottom":
      return look.bottom;
    case "shoes":
      return look.shoes;
    default:
      return fixed;
  }
}

export function People({ items, time, kind }: Props) {
  const gltfs = useGLTF([...PEOPLE_MODELS]) as unknown as RiggedModel[];
  const bodies = useMemo(() => gltfs.map((g) => bakeBody(g)), [gltfs]);
  const seated = kind === "guest_seated";
  const overflow = kind === "guest_overflow";

  // Group guests by body model so each baked part is one instanced draw.
  const groups = useMemo(() => {
    const out: { it: LayoutItem; i: number; look: Look }[][] = PEOPLE_MODELS.map(() => []);
    items.forEach((it, i) => {
      const look = lookFor(it, i, overflow);
      out[look.body]!.push({ it, i, look });
    });
    return out;
  }, [items, overflow]);

  if (items.length === 0) return null;

  return (
    <>
      {bodies.map((body, b) => {
        const guests = groups[b]!;
        if (guests.length === 0) return null;
        const parts: BakedPart[] = seated ? body.sit : body.stand;
        return parts.map((part, p) => (
          <Pool
            key={`${kind}-${b}-${p}`}
            count={guests.length}
            castShadow
            receiveShadow
            frustumCulled={false}
          >
            <primitive object={part.geometry} attach="geometry" />
            <meshStandardMaterial
              color={part.slot === "fixed" ? part.color : "#ffffff"}
              roughness={0.85}
              flatShading
            />
            {guests.map(({ it, i, look }) => {
              const back = seated ? SEAT_BACK_M : 0;
              const x = it.x - Math.sin(it.rotY) * back;
              const z = it.z - Math.cos(it.rotY) * back;
              // Seated: lift so the pelvis rests on the seat (feet may hover a few cm).
              const lift = seated
                ? Math.max(0, SEAT_TOP_M + PELVIS_M - body.sitHipY * look.scale)
                : 0;
              return (
                <AnimatedInstance
                  key={`${kind}-${i}`}
                  kind={kind}
                  index={i}
                  time={time}
                  position={[x, lift, z]}
                  rotation={[0, it.rotY, 0]}
                  color={part.slot === "fixed" ? undefined : colourFor(look, part.slot, part.color)}
                  scale={look.scale}
                />
              );
            })}
          </Pool>
        ));
      })}
    </>
  );
}

for (const url of PEOPLE_MODELS) useGLTF.preload(url);
