"use client";

import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

const cache = new Map<string, CanvasTexture>();

function make2d(size: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c.getContext("2d");
}

/** 2×2 checker (one repeat = 2 m) with grout lines and subtle tile variation. */
export function checkerTexture(
  light: string,
  dark: string,
  grout: string,
): CanvasTexture | null {
  const key = `checker:${light}:${dark}:${grout}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 512;
  const ctx = make2d(size);
  if (!ctx) return null;
  const tile = size / 2;
  const g = Math.max(2, Math.round(size * 0.012));
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, size, size);
  for (let ix = 0; ix < 2; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      const alt = (ix + iz) % 2 === 0;
      ctx.fillStyle = alt ? light : dark;
      ctx.fillRect(ix * tile + g / 2, iz * tile + g / 2, tile - g, tile - g);
      // Soft sheen gradient per tile
      const grad = ctx.createLinearGradient(
        ix * tile,
        iz * tile,
        ix * tile + tile,
        iz * tile + tile,
      );
      grad.addColorStop(0, "rgba(255,255,255,0.10)");
      grad.addColorStop(0.5, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.08)");
      ctx.fillStyle = grad;
      ctx.fillRect(ix * tile + g / 2, iz * tile + g / 2, tile - g, tile - g);
    }
  }
  const tex = new CanvasTexture(ctx.canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Roughness map matching the checker: tiles glossy, grout matte. */
export function checkerRoughness(): CanvasTexture | null {
  const key = "checker:rough";
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const ctx = make2d(size);
  if (!ctx) return null;
  const tile = size / 2;
  const g = Math.max(2, Math.round(size * 0.012));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  for (let ix = 0; ix < 2; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      ctx.fillStyle = "#b8b8b8";
      ctx.fillRect(ix * tile + g / 2, iz * tile + g / 2, tile - g, tile - g);
    }
  }
  const tex = new CanvasTexture(ctx.canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

/** Soft radial glow for light pools on the floor. */
export function glowTexture(): CanvasTexture | null {
  const key = "glow";
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const ctx = make2d(size);
  if (!ctx) return null;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(ctx.canvas);
  tex.colorSpace = SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/** Paving slabs for the apron around the room. */
export function pavingTexture(base: string, line: string): CanvasTexture | null {
  const key = `paving:${base}:${line}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const ctx = make2d(size);
  if (!ctx) return null;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  const n = 2;
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  const tex = new CanvasTexture(ctx.canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
