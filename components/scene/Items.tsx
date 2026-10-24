"use client";

import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Object3D } from "three";
import type { LayoutItem, LayoutKind } from "@/lib/types";
import { palette } from "./palette";

const BUILD_S = 1.5;

function phaseFor(kind: LayoutKind): { start: number; end: number } {
  if (kind === "chair") return { start: 0.4, end: 1.0 };
  if (
    kind === "guest_seated" ||
    kind === "guest_standing" ||
    kind === "guest_overflow"
  ) {
    return { start: 0.85, end: 1.5 };
  }
  return { start: 0.05, end: 0.55 };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(
    1,
    Math.max(0, (x - edge0) / Math.max(1e-6, edge1 - edge0)),
  );
  return t * t * (3 - 2 * t);
}

function popScale(
  kind: LayoutKind,
  index: number,
  count: number,
  t: number,
): number {
  const { start, end } = phaseFor(kind);
  const span = Math.max(0.05, end - start);
  const stagger = count <= 1 ? 0 : (index / (count - 1)) * span * 0.85;
  const local = start + stagger;
  return Math.max(0.001, smoothstep(local, local + 0.18, t));
}

type Props = { items: LayoutItem[] };

export function Items({ items }: Props) {
  const clock = useRef(0);
  const itemKey = useMemo(
    () =>
      items
        .map((i) => `${i.kind}:${i.x.toFixed(2)}:${i.z.toFixed(2)}`)
        .join("|"),
    [items],
  );

  useEffect(() => {
    clock.current = 0;
  }, [itemKey]);

  useFrame((_, dt) => {
    clock.current = Math.min(BUILD_S + 0.35, clock.current + dt);
  });

  const byKind = useMemo(() => {
    const map = new Map<LayoutKind, LayoutItem[]>();
    for (const item of items) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    return map;
  }, [items]);

  const time = () => clock.current;

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

      {(byKind.get("stage") ?? []).map((it, i, arr) => (
        <FeatureStage
          key={`stage-${i}`}
          item={it}
          index={i}
          count={arr.length}
          time={time}
        />
      ))}
      {(byKind.get("bar") ?? []).map((it, i, arr) => (
        <FeatureBar
          key={`bar-${i}`}
          item={it}
          index={i}
          count={arr.length}
          time={time}
        />
      ))}
      {(byKind.get("dance_floor") ?? []).map((it, i, arr) => (
        <FeatureDance
          key={`dance-${i}`}
          item={it}
          index={i}
          count={arr.length}
          time={time}
        />
      ))}
      {(byKind.get("dj_booth") ?? []).map((it, i, arr) => (
        <FeatureBooth
          key={`dj-${i}`}
          item={it}
          index={i}
          count={arr.length}
          time={time}
          kind="dj_booth"
        />
      ))}
      {(byKind.get("photo_booth") ?? []).map((it, i, arr) => (
        <FeatureBooth
          key={`photo-${i}`}
          item={it}
          index={i}
          count={arr.length}
          time={time}
          kind="photo_booth"
        />
      ))}
      {(byKind.get("lectern") ?? []).map((it, i, arr) => (
        <FeatureLectern
          key={`lec-${i}`}
          item={it}
          index={i}
          count={arr.length}
          time={time}
        />
      ))}
      {(byKind.get("projector") ?? []).map((it, i, arr) => (
        <FeatureProjector
          key={`proj-${i}`}
          item={it}
          index={i}
          count={arr.length}
          time={time}
        />
      ))}
    </group>
  );
}

type Timed = { items: LayoutItem[]; time: () => number };

function AnimatedInstance({
  kind,
  index,
  count,
  time,
  color,
  position,
  rotation,
}: {
  kind: LayoutKind;
  index: number;
  count: number;
  time: () => number;
  color?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const ref = useRef<Object3D>(null);
  useFrame(() => {
    const s = popScale(kind, index, count, time());
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
            count={items.length}
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
            count={items.length}
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
            count={items.length}
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
            count={items.length}
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
            count={items.length}
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
              count={items.length}
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
            count={items.length}
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
            count={items.length}
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
  count: number;
  time: () => number;
};

function useFeatureScale(
  ref: React.RefObject<Group | null>,
  kind: LayoutKind,
  index: number,
  count: number,
  time: () => number,
) {
  useFrame(() => {
    if (ref.current) {
      ref.current.scale.setScalar(popScale(kind, index, count, time()));
    }
  });
}

function FeatureStage({ item, index, count, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "stage", index, count, time);
  return (
    <group
      ref={ref}
      position={[item.x, 0, item.z]}
      rotation={[0, item.rotY, 0]}
      scale={0.001}
    >
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.5, 2.2]} />
        <meshStandardMaterial color={palette.stage} roughness={0.85} />
      </mesh>
    </group>
  );
}

function FeatureBar({ item, index, count, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "bar", index, count, time);
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

function FeatureDance({ item, index, count, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "dance_floor", index, count, time);
  const tiles = useMemo(() => {
    const out: { x: number; z: number; alt: boolean }[] = [];
    for (let ix = 0; ix < 4; ix++) {
      for (let iz = 0; iz < 4; iz++) {
        out.push({ x: ix - 1.5, z: iz - 1.5, alt: (ix + iz) % 2 === 0 });
      }
    }
    return out;
  }, []);

  return (
    <group
      ref={ref}
      position={[item.x, 0.02, item.z]}
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
          <planeGeometry args={[0.95, 0.95]} />
          <meshStandardMaterial
            color={tile.alt ? palette.danceGloss : palette.dance}
            roughness={0.25}
            metalness={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

function FeatureBooth({
  item,
  index,
  count,
  time,
  kind,
}: FeatureProps & { kind: "dj_booth" | "photo_booth" }) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, kind, index, count, time);
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

function FeatureLectern({ item, index, count, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "lectern", index, count, time);
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

function FeatureProjector({ item, index, count, time }: FeatureProps) {
  const ref = useRef<Group>(null);
  useFeatureScale(ref, "projector", index, count, time);
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
