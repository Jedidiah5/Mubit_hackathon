"use client";

import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group, Object3D } from "three";
import type { LayoutItem, LayoutKind } from "@/lib/types";
import { popScale } from "./buildAnim";
import { palette } from "./palette";

type Props = { items: LayoutItem[]; time: () => number };

export function Items({ items, time }: Props) {
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
      <RoundTables items={byKind.get("table_round") ?? []} time={time} />
      <HighTables items={byKind.get("high_table") ?? []} time={time} />
      <Chairs items={byKind.get("chair") ?? []} time={time} />
      <Guests
        items={byKind.get("guest_seated") ?? []}
        time={time}
        kind="guest_seated"
      />
      <Guests
        items={byKind.get("guest_standing") ?? []}
        time={time}
        kind="guest_standing"
      />
      <Guests
        items={byKind.get("guest_overflow") ?? []}
        time={time}
        kind="guest_overflow"
      />

      {(byKind.get("stage") ?? []).map((it, i) => (
        <FeatureStage key={`stage-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("bar") ?? []).map((it, i) => (
        <FeatureBar key={`bar-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("dance_floor") ?? []).map((it, i) => (
        <FeatureDance key={`dance-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("dj_booth") ?? []).map((it, i) => (
        <FeatureBooth
          key={`dj-${i}`}
          item={it}
          index={i}
          time={time}
          kind="dj_booth"
        />
      ))}
      {(byKind.get("photo_booth") ?? []).map((it, i) => (
        <FeatureBooth
          key={`photo-${i}`}
          item={it}
          index={i}
          time={time}
          kind="photo_booth"
        />
      ))}
      {(byKind.get("lectern") ?? []).map((it, i) => (
        <FeatureLectern key={`lec-${i}`} item={it} index={i} time={time} />
      ))}
      {(byKind.get("projector") ?? []).map((it, i) => (
        <FeatureProjector key={`proj-${i}`} item={it} index={i} time={time} />
      ))}
    </group>
  );
}

type Timed = { items: LayoutItem[]; time: () => number };

function seedFor(kind: LayoutKind, index: number, x: number, z: number): number {
  return (
    index * 97 +
    kind.length * 13 +
    Math.round(x * 10) * 3 +
    Math.round(z * 10) * 7
  );
}

function AnimatedInstance({
  kind,
  index,
  time,
  color,
  position,
  rotation,
}: {
  kind: LayoutKind;
  index: number;
  time: () => number;
  color?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const ref = useRef<Object3D>(null);
  const seed = seedFor(kind, index, position[0], position[2]);
  useFrame(() => {
    const s = popScale(kind, seed, time());
    if (ref.current) ref.current.scale.setScalar(s);
  });
  return (
    <Instance
      ref={ref}
      position={position}
      rotation={rotation}
      color={color}
      scale={0.001}
    />
  );
}

function RoundTables({ items, time }: Timed) {
  if (items.length === 0) return null;
  return (
    <>
      <Instances limit={items.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.06, 24]} />
        <meshStandardMaterial color={palette.table} roughness={0.55} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`tt-${i}`}
            kind="table_round"
            index={i}
            time={time}
            position={[it.x, 0.75, it.z]}
            rotation={[0, it.rotY, 0]}
          />
        ))}
      </Instances>
      <Instances limit={items.length} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 0.72, 12]} />
        <meshStandardMaterial color={palette.tableBase} roughness={0.7} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`tb-${i}`}
            kind="table_round"
            index={i}
            time={time}
            position={[it.x, 0.36, it.z]}
            rotation={[0, it.rotY, 0]}
          />
        ))}
      </Instances>
    </>
  );
}

function HighTables({ items, time }: Timed) {
  if (items.length === 0) return null;
  return (
    <>
      <Instances limit={items.length} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.05, 20]} />
        <meshStandardMaterial color={palette.highTable} roughness={0.5} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`ht-${i}`}
            kind="high_table"
            index={i}
            time={time}
            position={[it.x, 1.05, it.z]}
          />
        ))}
      </Instances>
      <Instances limit={items.length} castShadow>
        <cylinderGeometry args={[0.08, 0.14, 1.0, 10]} />
        <meshStandardMaterial color={palette.tableBase} roughness={0.7} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`hb-${i}`}
            kind="high_table"
            index={i}
            time={time}
            position={[it.x, 0.5, it.z]}
          />
        ))}
      </Instances>
    </>
  );
}

function Chairs({ items, time }: Timed) {
  if (items.length === 0) return null;
  return (
    <>
      <Instances limit={items.length} castShadow>
        <boxGeometry args={[0.4, 0.06, 0.4]} />
        <meshStandardMaterial color={palette.chair} roughness={0.75} />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`cs-${i}`}
            kind="chair"
            index={i}
            time={time}
            position={[it.x, 0.45, it.z]}
            rotation={[0, it.rotY, 0]}
          />
        ))}
      </Instances>
      <Instances limit={items.length} castShadow>
        <boxGeometry args={[0.4, 0.42, 0.05]} />
        <meshStandardMaterial color={palette.chair} roughness={0.7} />
        {items.map((it, i) => {
          const back = 0.18;
          const x = it.x - Math.sin(it.rotY) * back;
          const z = it.z - Math.cos(it.rotY) * back;
          return (
            <AnimatedInstance
              key={`cb-${i}`}
              kind="chair"
              index={i}
              time={time}
              position={[x, 0.66, z]}
              rotation={[0, it.rotY, 0]}
              color={i % 17 === 0 ? palette.chairAccent : palette.chair}
            />
          );
        })}
      </Instances>
    </>
  );
}

function Guests({
  items,
  time,
  kind,
}: Timed & { kind: "guest_seated" | "guest_standing" | "guest_overflow" }) {
  const standing = kind !== "guest_seated";
  const overflow = kind === "guest_overflow";
  const bodyY = standing ? 0.55 : 0.42;
  const headY = standing ? 1.15 : 0.95;
  const bodyLen = standing ? 0.35 : 0.22;

  if (items.length === 0) return null;

  return (
    <>
      <Instances limit={items.length} castShadow>
        <capsuleGeometry args={[0.12, bodyLen, 4, 8]} />
        <meshStandardMaterial
          color={overflow ? palette.overflow : palette.guest[0]}
          roughness={0.8}
        />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`gb-${i}`}
            kind={kind}
            index={i}
            time={time}
            position={[it.x, bodyY, it.z]}
            rotation={[0, it.rotY, 0]}
            color={
              overflow
                ? palette.overflow
                : palette.guest[i % palette.guest.length]
            }
          />
        ))}
      </Instances>
      <Instances limit={items.length} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial
          color={overflow ? palette.overflow : palette.guest[0]}
          roughness={0.75}
        />
        {items.map((it, i) => (
          <AnimatedInstance
            key={`gh-${i}`}
            kind={kind}
            index={i}
            time={time}
            position={[it.x, headY, it.z]}
            color={
              overflow
                ? palette.overflow
                : palette.guest[i % palette.guest.length]
            }
          />
        ))}
      </Instances>
    </>
  );
}

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

function FeatureStage({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "stage", index, item, time);
  const height = 0.6;
  const depth = 2.4;
  const width = 6;
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={palette.stage} roughness={0.75} />
      </mesh>
      <mesh position={[0, height / 2, depth / 2 + 0.02]} castShadow>
        <boxGeometry args={[width, height, 0.06]} />
        <meshStandardMaterial
          color={palette.stageEdge}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

function FeatureBar({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "bar", index, item, time);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.1, 0.9]} />
        <meshStandardMaterial color={palette.bar} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <boxGeometry args={[3.5, 0.08, 1.0]} />
        <meshStandardMaterial color={palette.table} roughness={0.4} />
      </mesh>
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
        out.push({
          x: ix - 2.5,
          z: iz - 2.5,
          alt: (ix + iz) % 2 === 0,
        });
      }
    }
    return out;
  }, []);

  return (
    <group
      ref={ref}
      position={[item.x, 0.03, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      {tiles.map((tile) => (
        <mesh
          key={`${tile.x}-${tile.z}`}
          position={[tile.x, 0, tile.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[0.96, 0.96]} />
          <meshStandardMaterial
            color={tile.alt ? palette.danceGloss : palette.dance}
            roughness={0.18}
            metalness={0.22}
          />
        </mesh>
      ))}
    </group>
  );
}

function FeatureBooth({
  item,
  index,
  time,
  kind,
}: FeatureProps & { kind: "dj_booth" | "photo_booth" }) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, kind, index, item, time);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[1.4, 1.4, 1.2]} />
        <meshStandardMaterial color={palette.booth} roughness={0.7} />
      </mesh>
      {kind === "photo_booth" && (
        <mesh position={[0, 1.5, 0.2]}>
          <boxGeometry args={[0.9, 0.5, 0.08]} />
          <meshStandardMaterial color={palette.screen} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

function FeatureLectern({ item, index, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "lectern", index, item, time);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.55, 1.1, 0.4]} />
        <meshStandardMaterial color={palette.lectern} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.15, 0.05]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.6, 0.06, 0.45]} />
        <meshStandardMaterial color={palette.table} roughness={0.5} />
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
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[2.2, 1.4, 0.08]} />
        <meshStandardMaterial color={palette.projector} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.8, 0.02]}>
        <boxGeometry args={[2.0, 1.2, 0.02]} />
        <meshStandardMaterial color={palette.screen} roughness={0.9} />
      </mesh>
    </group>
  );
}
