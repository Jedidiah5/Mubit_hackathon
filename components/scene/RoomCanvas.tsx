"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MathUtils,
  OrthographicCamera as ThreeOrthoCamera,
  Vector3,
} from "three";
import type { LayoutItem, Room } from "@/lib/types";
import { Items } from "./Items";
import { RoomShell } from "./RoomShell";
import { palette } from "./palette";

const ISO_YAW = Math.PI / 4;
const ISO_POLAR = MathUtils.degToRad(55); // ~35° from horizontal
const PLAN_POLAR = 0.001;
const CAM_DIST = 40;

type Props = {
  room: Room;
  items: LayoutItem[];
  planView?: boolean;
  className?: string;
};

export function RoomCanvas({
  room,
  items,
  planView = false,
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

        <CameraRig
          room={room}
          planView={planView}
          yaw={yaw}
          onYawChange={setYaw}
        />
        <RoomShell room={room} yaw={yaw} />
        <Items items={items} />
        <ContactShadows
          position={[0, 0.015, 0]}
          opacity={0.38}
          scale={Math.max(room.widthM, room.lengthM) * 1.4}
          blur={2.4}
          far={12}
          color={palette.shadow}
        />
      </Canvas>
    </div>
  );
}

type RigProps = {
  room: Room;
  planView: boolean;
  yaw: number;
  onYawChange: (yaw: number) => void;
};

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
    const span = Math.hypot(room.widthM, room.lengthM) * 1.15;
    const view = Math.min(size.width, size.height);
    return Math.max(4, view / span);
  }, [room.widthM, room.lengthM, size.width, size.height]);

  useEffect(() => {
    const fit = fitZoom();
    zoomRef.current = MathUtils.clamp(zoomRef.current, fit * 0.65, fit);
    const cam = camera as ThreeOrthoCamera;
    cam.zoom = zoomRef.current;
    cam.updateProjectionMatrix();
  }, [fitZoom, camera]);

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
      // Snap to nearest 90°
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
      const minZ = fit * 0.65;
      const maxZ = fit;
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
      // Top-down: keep north (−z) pointing up on screen.
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
