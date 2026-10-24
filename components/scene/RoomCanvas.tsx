"use client";

import { Environment, Html, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ACESFilmicToneMapping,
  MathUtils,
  OrthographicCamera as ThreeOrthoCamera,
  Vector3,
} from "three";
import type { LayoutItem, Room } from "@/lib/types";
import { BUILD_DURATION_S } from "./buildAnim";
import { Items } from "./Items";
import { RoomShell, WALL_H } from "./RoomShell";
import { SceneHud, type SceneHudProps } from "./SceneHud";
import { palette } from "./palette";

const ISO_YAW = Math.PI / 4;
const ISO_POLAR = MathUtils.degToRad(55); // ~35° from horizontal
const PLAN_POLAR = 0.001;
const CAM_DIST = 60;
const FIT_FRAC = 0.9;
/** Orbit feel (Lagos Life / london_life style): px of drag per quarter turn and per radian of tilt. */
const DRAG_PER_QUARTER_PX = 300;
const DRAG_PER_RADIAN_PX = 320;
/** Tilt range: 20° (near top-down) to 72° (low, cinematic) from vertical. */
const POLAR_MIN = MathUtils.degToRad(20);
const POLAR_MAX = MathUtils.degToRad(72);
const QUARTER = Math.PI / 2;

type Props = {
  room: Room;
  items: LayoutItem[];
  planView?: boolean;
  onPlanViewChange?: (plan: boolean) => void;
  /** Show in-canvas loading label (shell still renders immediately). */
  loading?: boolean;
  hud?: SceneHudProps;
  children?: ReactNode;
  className?: string;
};

export function RoomCanvas({
  room,
  items,
  planView = false,
  onPlanViewChange,
  loading = false,
  hud,
  children,
  className,
}: Props) {
  const [yaw, setYaw] = useState(ISO_YAW);
  const [fitNonce, setFitNonce] = useState(0);

  const rotate = useCallback((dir: 1 | -1) => {
    setYaw((y) => {
      const next = y + dir * (Math.PI / 2);
      return ((next % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    });
  }, []);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: `linear-gradient(180deg, ${palette.skyTop} 0%, ${palette.skyBottom} 55%, ${palette.sceneBg} 100%)`,
      }}
    >
      <Canvas
        orthographic
        shadows
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        style={{ position: "absolute", inset: 0, touchAction: "none" }}
        camera={{
          position: [
            Math.sin(ISO_YAW) * Math.sin(ISO_POLAR) * CAM_DIST,
            Math.cos(ISO_POLAR) * CAM_DIST,
            Math.cos(ISO_YAW) * Math.sin(ISO_POLAR) * CAM_DIST,
          ],
          zoom: 18,
          near: 0.1,
          far: 400,
        }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0.4, 0);
        }}
      >
        <Lighting room={room} />
        <SceneBody
          room={room}
          items={items}
          planView={planView}
          loading={loading}
          yaw={yaw}
          fitNonce={fitNonce}
        />
        {children}
      </Canvas>

      <SceneHud
        {...hud}
        room={room}
        planView={planView}
        onPlanViewChange={onPlanViewChange}
        onRotate={rotate}
        onFit={() => setFitNonce((n) => n + 1)}
      />
    </div>
  );
}

function Lighting({ room }: { room: Room }) {
  const span = Math.max(room.widthM, room.lengthM);
  const s = span * 0.8;
  return (
    <>
      <hemisphereLight
        args={["#dfe9f3", "#b9a98f", 0.85]}
        position={[0, 20, 0]}
      />
      <ambientLight intensity={0.35} color="#fff2e2" />
      <directionalLight
        castShadow
        intensity={1.7}
        color="#fff4e4"
        position={[span * 0.6, span * 1.1, span * 0.45]}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-camera-near={1}
        shadow-camera-far={span * 4}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
      />
      {/* Warm fill from the interior */}
      <pointLight
        intensity={span * 1.6}
        distance={span * 1.6}
        decay={2}
        color="#ffe2b8"
        position={[0, WALL_H - 0.4, 0]}
      />
      {/* Studio-style reflections without any network fetch */}
      <Environment resolution={128} frames={1}>
        <Lightformer
          intensity={1.4}
          rotation-x={Math.PI / 2}
          position={[0, 6, 0]}
          scale={[12, 12, 1]}
          color="#fff6e8"
        />
        <Lightformer
          intensity={0.6}
          rotation-y={Math.PI / 2}
          position={[-8, 2, 0]}
          scale={[8, 3, 1]}
          color="#dbe7f3"
        />
        <Lightformer
          intensity={0.5}
          rotation-y={-Math.PI / 2}
          position={[8, 2, 0]}
          scale={[8, 3, 1]}
          color="#f6e7d2"
        />
      </Environment>
    </>
  );
}

function SceneBody({
  room,
  items,
  planView,
  loading,
  yaw,
  fitNonce,
}: {
  room: Room;
  items: LayoutItem[];
  planView: boolean;
  loading: boolean;
  yaw: number;
  fitNonce: number;
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
    clock.current = Math.min(BUILD_DURATION_S + 60, clock.current + dt);
  });

  const time = () => clock.current;
  const showLoading = loading || items.length === 0;

  return (
    <>
      <CameraRig room={room} planView={planView} yaw={yaw} fitNonce={fitNonce} />
      <RoomShell room={room} yaw={yaw} planView={planView} />
      <Items items={items} time={time} room={room} />
      {showLoading && (
        <Html center style={{ pointerEvents: "none" }}>
          <div className="btf-pill btf-pill--dark btf-shimmer">
            <span className="btf-dot" />
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
  fitNonce: number;
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

  const hx = room.widthM / 2 + 0.4;
  const hz = room.lengthM / 2 + 0.4;
  const corners: [number, number, number][] = [
    [-hx, -0.3, -hz],
    [hx, -0.3, -hz],
    [-hx, -0.3, hz],
    [hx, -0.3, hz],
    [-hx, WALL_H + 0.2, -hz],
    [hx, WALL_H + 0.2, -hz],
    [-hx, WALL_H + 0.2, hz],
    [hx, WALL_H + 0.2, hz],
  ];

  const eye = new Vector3(
    Math.sin(yaw) * Math.sin(polar) * CAM_DIST,
    Math.cos(polar) * CAM_DIST,
    Math.cos(yaw) * Math.sin(polar) * CAM_DIST,
  );
  const target = new Vector3(0, 0.4, 0);
  const probe = new ThreeOrthoCamera(-1, 1, 1, -1, 0.1, 400);
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
  const zoomX = (canvasW * FIT_FRAC) / spanX;
  const zoomY = (canvasH * FIT_FRAC) / spanY;
  return Math.max(2, Math.min(zoomX, zoomY));
}

function CameraRig({ room, planView, yaw, fitNonce }: RigProps) {
  const { camera, gl, size } = useThree();
  const targetYaw = useRef(yaw);
  const prevYawProp = useRef(yaw);
  const currentYaw = useRef(yaw);
  /** User-chosen tilt in iso mode (polar angle from vertical). */
  const tilt = useRef(ISO_POLAR);
  const currentPolar = useRef(ISO_POLAR);
  const zoomRef = useRef(18);
  const snapZoom = useRef(true);
  const drag = useRef<{ mode: "orbit" | "pan"; x: number; y: number } | null>(null);
  const pan = useRef(new Vector3(0, 0, 0));
  const look = useMemo(() => new Vector3(0, 0.4, 0), []);

  const fitZoom = useCallback(() => {
    const polar = planView ? PLAN_POLAR : ISO_POLAR;
    const fitYaw = planView ? ISO_YAW : targetYaw.current;
    return fitZoomForRoom(room, size.width, size.height, fitYaw, polar);
  }, [room, size.width, size.height, planView]);

  // Rotate buttons: step to the next quarter turn in the pressed direction,
  // measured from wherever a drag may have left the camera.
  useEffect(() => {
    let delta = yaw - prevYawProp.current;
    prevYawProp.current = yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) < 1e-6) return;
    // Yaw grid is ISO_YAW + k·90°.
    const q = (targetYaw.current - ISO_YAW) / QUARTER;
    const k = delta > 0 ? Math.floor(q + 1e-3) + 1 : Math.ceil(q - 1e-3) - 1;
    targetYaw.current = ISO_YAW + k * QUARTER;
  }, [yaw]);

  // Explicit Fit / view-mode / room change: also reset tilt and snap yaw to the grid.
  useEffect(() => {
    targetYaw.current =
      ISO_YAW + Math.round((targetYaw.current - ISO_YAW) / QUARTER) * QUARTER;
    tilt.current = ISO_POLAR;
  }, [fitNonce, planView, room.widthM, room.lengthM]);

  // Refit zoom and recentre whenever the framing inputs change.
  useEffect(() => {
    zoomRef.current = fitZoom();
    pan.current.set(0, 0, 0);
    snapZoom.current = true;
  }, [
    fitZoom,
    room.widthM,
    room.lengthM,
    size.width,
    size.height,
    planView,
    yaw,
    fitNonce,
  ]);

  useEffect(() => {
    const el = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
      // Left-drag orbits (iso only); shift/right/middle-drag pans.
      const wantsPan = planView || e.button !== 0 || e.shiftKey;
      drag.current = { mode: wantsPan ? "pan" : "orbit", x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      if (d.mode === "orbit") {
        targetYaw.current -= (dx / DRAG_PER_QUARTER_PX) * QUARTER;
        // Drag up → camera swings lower (more cinematic), drag down → towards plan.
        tilt.current = MathUtils.clamp(
          tilt.current - dy / DRAG_PER_RADIAN_PX,
          POLAR_MIN,
          POLAR_MAX,
        );
        return;
      }
      // Pan in screen space (metres per px = 1 / zoom)
      const cam = camera as ThreeOrthoCamera;
      const scale = 1 / cam.zoom;
      const right = new Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      const up = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
      pan.current.addScaledVector(right, -dx * scale);
      pan.current.addScaledVector(up, dy * scale);
      const lim = Math.max(room.widthM, room.lengthM) * 0.6;
      pan.current.clampLength(0, lim);
    };

    const onPointerUp = (e: PointerEvent) => {
      drag.current = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const fit = fitZoom();
      const minZ = fit * 0.6;
      const maxZ = fit * 2.2;
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomRef.current = MathUtils.clamp(zoomRef.current * factor, minZ, maxZ);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("contextmenu", onContextMenu);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("contextmenu", onContextMenu);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, camera, fitZoom, room.widthM, room.lengthM, planView]);

  useFrame((state, dt) => {
    // Use the frame-state camera (not the hook value) so the React compiler
    // doesn't see us mutating a hook result.
    const cam = state.camera as ThreeOrthoCamera;
    const targetPolar = planView ? PLAN_POLAR : tilt.current;

    let dy = targetYaw.current - currentYaw.current;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    currentYaw.current += dy * Math.min(1, dt * 7);
    currentPolar.current = MathUtils.damp(
      currentPolar.current,
      targetPolar,
      7,
      dt,
    );

    const y = currentYaw.current;
    const p = currentPolar.current;
    const target = look.clone().add(pan.current);
    cam.position.set(
      target.x + Math.sin(y) * Math.sin(p) * CAM_DIST,
      target.y + Math.cos(p) * CAM_DIST,
      target.z + Math.cos(y) * Math.sin(p) * CAM_DIST,
    );

    if (p < 0.08) {
      cam.up.set(0, 0, -1);
    } else {
      cam.up.set(0, 1, 0);
    }
    cam.lookAt(target);
    if (snapZoom.current) {
      // First frame after mount / room change: jump straight to the fit.
      cam.zoom = zoomRef.current;
      snapZoom.current = false;
    } else {
      cam.zoom = MathUtils.damp(cam.zoom, zoomRef.current, 9, dt);
    }
    cam.updateProjectionMatrix();
  });

  return null;
}
