import type { Extra, Spec } from "./types";

export type FieldScores = {
  style: number;
  stage: number;
  bar: number;
  accessible: number;
  guests: number;
  extras: number;
};

/** Exact match for style/stage/bar/accessible; guests ±5%; extras F1. */
export function scoreSpec(pred: Spec, label: Spec): FieldScores {
  return {
    style: pred.style === label.style ? 1 : 0,
    stage: pred.stage === label.stage ? 1 : 0,
    bar: pred.bar === label.bar ? 1 : 0,
    accessible: pred.accessible === label.accessible ? 1 : 0,
    guests: guestsWithin(pred.guests, label.guests) ? 1 : 0,
    extras: extrasF1(pred.extras, label.extras),
  };
}

export function guestsWithin(pred: number, label: number): boolean {
  if (label === 0) return pred === 0;
  return Math.abs(pred - label) / label <= 0.05;
}

export function extrasF1(pred: Extra[], label: Extra[]): number {
  const p = new Set(pred);
  const l = new Set(label);
  if (p.size === 0 && l.size === 0) return 1;
  let tp = 0;
  for (const x of p) if (l.has(x)) tp += 1;
  if (tp === 0) return 0;
  const precision = tp / p.size;
  const recall = tp / l.size;
  return (2 * precision * recall) / (precision + recall);
}

export function overallFromFields(fields: FieldScores): number {
  const values = Object.values(fields);
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
