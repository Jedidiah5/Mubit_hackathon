"use client";

import { ContactShadows, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MathUtils,
  OrthographicCamera as ThreeOrthoCamera,
  Vector3,
} from "three";
import type { LayoutItem, Room } from "@/lib/types";
import { BUILD_DURATION_S } from "./buildAnim";
import { Items } from "./Items";
import { RoomShell } from "./RoomShell";
import { palette } from "./palette";

const ISO_YAW = Math.PI / 4;
const ISO_POLAR = MathUtils.degToRad(55); // ~35° from horizontal
const PLAN_POLAR = 0.001;
const CAM_DIST = 40;
const WALL_H = 3.2;
const FIT_FRAC = 0.9;

type Props = {
  room: Room;
  items: LayoutItem[];
  planView?: boolean;
  /** Show in-canvas loading label (shell still renders immediately). */
  loading?: boolean;
  className?: string;
};

export function RoomCanvas({
  room,
  items,
  planView = false,
  loading = false,
  className,
}: Props) {
  const [yaw, setYaw] = useState(ISO_YAW);

  return (
    <div className={className} style={{ width: "100%", height: "100%" }}>
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        camera={{
          position: [
            Math.sin(ISO_YAW) * Math.sin(ISO_POLAR) * CAM_DIST,
            Math.cos(ISO_POLAR) * CAM_DIST,
            Math.cos(ISO_YAW) * Math.sin(ISO_POLAR) * CAM_DIST,
          ],
          zoom: 18,
          near: 0.1,
          far: 200,
        }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0.4, 0);
        }}
      >
        <color attach="background" args={[palette.sceneBg]} />
        <ambientLight intensity={0.62} />
        <directionalLight
          castShadow
          intensity={1.15}
          position={[10, 18, 8]}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={60}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
        />

        <SceneBody
          room={room}
          items={items}
          planView={planView}
          loading={loading}
          yaw={yaw}
          onYawChange={setYaw}
        />
      </Canvas>
    </div>
  );
}

function SceneBody({
  room,
  items,
  planView,
  loading,
  yaw,
  onYawChange,
}: {
  room: Room;
  items: LayoutItem[];
  planView: boolean;
  loading: boolean;
  yaw: number;
  onYawChange: (yaw: number) => void;
}) {
  const clock = useRef(0);
  const itemKey = useMemo(
    () =>
      `${room.name}:${room.widthM}x${room.lengthM}|` +
      items
        .map((i) => `${i.kind}:${i.x.toFixed(2)}:${i.z.toFixed(2)}`)
        .join("|"),
    [items, room.name, room.widthM, room.lengthM],
  );

  useEffect(() => {
    clock.current = 0;
  }, [itemKey]);

  useFrame((_, dt) => {
    clock.current = Math.min(BUILD_DURATION_S + 0.05, clock.current + dt);
  });

  const time = () => clock.current;
  const showLoading = loading || items.length === 0;

  return (
    <>
      <CameraRig
        room={room}
        planView={planView}
        yaw={yaw}
        onYawChange={onYawChange}
      />
      <RoomShell room={room} yaw={yaw} />
      <Items items={items} time={time} />
      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={0.38}
        scale={Math.max(room.widthM, room.lengthM) * 1.4}
        blur={2.4}
        far={12}
        color={palette.shadow}
      />
      {showLoading && (
        <Html center style={{ pointerEvents: "none" }}>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#0a0a0a",
              background: "rgba(244,239,230,0.88)",
              border: "1px solid rgba(10,10,10,0.15)",
              padding: "10px 16px",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Building layout…" : "Preparing room…"}
          </div>
        </Html>
      )}
    </>
  );
}

type RigProps = {
  room: Room;
  planView: boolean;
  yaw: number;
  onYawChange: (yaw: number) => void;
};

/**
 * Ortho zoom from the room's projected AABB in the current iso/plan view so
 * the bbox fills 90% of the tighter canvas axis.
 */
function fitZoomForRoom(
  room: Room,
  canvasW: number,
  canvasH: number,
  yaw: number,
  polar: number,
): number {
  if (canvasW < 2 || canvasH < 2) return 18;

  const hx = room.widthM / 2;
  const hz = room.lengthM / 2;
  const corners: [number, number, number][] = [
    [-hx, 0, -hz],
    [hx, 0, -hz],
    [-hx, 0, hz],
    [hx, 0, hz],
    [-hx, WALL_H, -hz],
    [hx, WALL_H, -hz],
    [-hx, WALL_H, hz],
    [hx, WALL_H, hz],
  ];

  const eye = new Vector3(
    Math.sin(yaw) * Math.sin(polar) * CAM_DIST,
    Math.cos(polar) * CAM_DIST,
    Math.cos(yaw) * Math.sin(polar) * CAM_DIST,
  );
  const target = new Vector3(0, 0.4, 0);
  const probe = new ThreeOrthoCamera(-1, 1, 1, -1, 0.1, 200);
  probe.position.copy(eye);
  if (polar < 0.08) probe.up.set(0, 0, -1);
  else probe.up.set(0, 1, 0);
  probe.lookAt(target);
  probe.updateMatrixWorld(true);

  const v = new Vector3();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y, z] of corners) {
    v.set(x, y, z).applyMatrix4(probe.matrixWorldInverse);
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }

  const spanX = Math.max(0.01, maxX - minX);
  const spanY = Math.max(0.01, maxY - minY);
  // visibleWorld = canvas / zoom; want span = FIT_FRAC * visible → zoom = FIT_FRAC * canvas / span
  const zoomX = (canvasW * FIT_FRAC) / spanX;
  const zoomY = (canvasH * FIT_FRAC) / spanY;
  return Math.max(2, Math.min(zoomX, zoomY));
}

function CameraRig({ room, planView, yaw, onYawChange }: RigProps) {
  const { camera, gl, size } = useThree();
  const targetYaw = useRef(yaw);
  const currentYaw = useRef(yaw);
  const currentPolar = useRef(ISO_POLAR);
  const zoomRef = useRef(18);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const snappedThisDrag = useRef(false);
  const look = useMemo(() => new Vector3(0, 0.4, 0), []);

  const fitZoom = useCallback(() => {
    const polar = planView ? PLAN_POLAR : ISO_POLAR;
    // Fit against the settled iso/plan orientation (not mid-orbit yaw).
    const fitYaw = planView ? ISO_YAW : targetYaw.current;
    return fitZoomForRoom(room, size.width, size.height, fitYaw, polar);
  }, [room, size.width, size.height, planView]);

  useEffect(() => {
    const fit = fitZoom();
    zoomRef.current = fit;
    const cam = camera as ThreeOrthoCamera;
    cam.zoom = fit;
    cam.updateProjectionMatrix();
  }, [
    fitZoom,
    camera,
    room.widthM,
    room.lengthM,
    size.width,
    size.height,
    planView,
  ]);

  useEffect(() => {
    targetYaw.current = yaw;
  }, [yaw]);

  useEffect(() => {
    const el = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging.current = true;
      snappedThisDrag.current = false;
      dragStartX.current = e.clientX;
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current || snappedThisDrag.current || planView) return;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) < 48) return;
      const next = targetYaw.current + (dx > 0 ? -Math.PI / 2 : Math.PI / 2);
      const normalized = ((next % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const snapped =
        (Math.round(normalized / (Math.PI / 2)) * (Math.PI / 2)) %
        (Math.PI * 2);
      targetYaw.current = snapped;
      onYawChange(snapped);
      snappedThisDrag.current = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging.current = false;
      snappedThisDrag.current = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fit = fitZoom();
      const minZ = fit * 0.7;
      const maxZ = fit * 1.35;
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomRef.current = MathUtils.clamp(zoomRef.current * factor, minZ, maxZ);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, onYawChange, planView, fitZoom]);

  useFrame((_, dt) => {
    const cam = camera as ThreeOrthoCamera;
    const targetPolar = planView ? PLAN_POLAR : ISO_POLAR;

    let dy = targetYaw.current - currentYaw.current;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    currentYaw.current += dy * Math.min(1, dt * 8);
    currentPolar.current = MathUtils.damp(
      currentPolar.current,
      targetPolar,
      8,
      dt,
    );

    const y = currentYaw.current;
    const p = currentPolar.current;
    cam.position.set(
      Math.sin(y) * Math.sin(p) * CAM_DIST,
      Math.cos(p) * CAM_DIST,
      Math.cos(y) * Math.sin(p) * CAM_DIST,
    );

    if (p < 0.08) {
      cam.up.set(0, 0, -1);
    } else {
      cam.up.set(0, 1, 0);
    }
    cam.lookAt(look);
    cam.zoom = MathUtils.damp(cam.zoom, zoomRef.current, 10, dt);
    cam.updateProjectionMatrix();
  });

  return null;
}
