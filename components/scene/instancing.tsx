"use client";

import { Instance, Instances } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ComponentProps, useRef } from "react";
import type { Object3D } from "three";
import type { LayoutKind } from "@/lib/types";
import { popScale, unitNoise } from "./buildAnim";

/** Round up to a power-of-two bucket (min 32) so buffers rarely need to grow. */
export function bucket(n: number): number {
  let b = 32;
  while (b < n) b *= 2;
  return b;
}

/**
 * drei `Instances` allocates its buffers from `limit` on mount; growing the
 * item count later (e.g. switching from 120 to 180 chairs) silently drops the
 * extra instances. Remount whenever the size bucket changes.
 */
export function Pool({
  count,
  ...rest
}: Omit<ComponentProps<typeof Instances>, "limit"> & { count: number }) {
  const limit = bucket(count);
  return <Instances key={limit} limit={limit} {...rest} />;
}

export function seedFor(kind: LayoutKind, index: number, x: number, z: number): number {
  return (
    index * 97 +
    kind.length * 13 +
    Math.round(x * 10) * 3 +
    Math.round(z * 10) * 7
  );
}

/** One instance that pops in on the build timeline and can idle-breathe. */
export function AnimatedInstance({
  kind,
  index,
  time,
  color,
  position,
  rotation,
  breathe = false,
  scale = 1,
}: {
  kind: LayoutKind;
  index: number;
  time: () => number;
  color?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  breathe?: boolean;
  scale?: number;
}) {
  const ref = useRef<Object3D>(null);
  const seed = seedFor(kind, index, position[0], position[2]);
  const phase = unitNoise(seed + 11) * Math.PI * 2;
  const rate = 1.6 + unitNoise(seed + 23) * 0.9;
  useFrame(() => {
    const t = time();
    let s = popScale(kind, seed, t) * scale;
    if (breathe && s > 0.5) s *= 1 + 0.018 * Math.sin(t * rate + phase);
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
