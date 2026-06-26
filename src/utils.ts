// utils.ts — Shared drawing & math helpers
// Port of renderer.py helper functions and any general utilities.

import { ORB_OVERLAP_RATIO } from './constants';

export type RGB = readonly [number, number, number];

export function smoothstep(t: number): number {
  t = Math.max(0.0, Math.min(1.0, t));
  return t * t * (3 - 2 * t);
}

export function lerpColorArr(a: readonly [number, number, number], b: readonly [number, number, number], t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function canvasCssSize(canvas: HTMLCanvasElement): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.max(1, Math.round(rect.width || canvas.clientWidth || canvas.width)),
    Math.max(1, Math.round(rect.height || canvas.clientHeight || canvas.height)),
  ];
}

/**
 * Compute orb positions for a cell based on count, center, radius, and spin angle.
 * Port of _orb_positions from renderer.py.
 */
export function orbPositions(
  count: number,
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): [number, number][] {
  if (count <= 0) return [];
  const sep = 2 * r * ORB_OVERLAP_RATIO;
  const ang = (angleDeg * Math.PI) / 180;

  if (count === 1) return [[cx, cy]];

  let raw: [number, number][];
  if (count === 2) {
    raw = [[-sep / 2, 0], [sep / 2, 0]];
  } else {
    const h = sep * Math.sqrt(3) / 2;
    raw = [[0, -h * 2 / 3], [-sep / 2, h / 3], [sep / 2, h / 3]];
  }

  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);
  return raw.map(([ox, oy]) => [
    cx + ox * cosA - oy * sinA,
    cy + ox * sinA + oy * cosA,
  ]);
}
