import { SpecSchema } from "./schema";
import type { Spec } from "./types";

export const DEFAULT_SPEC: Spec = {
  style: "banquet",
  guests: 50,
  stage: "none",
  bar: "none",
  extras: [],
  accessible: false,
};

export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/** Validate model JSON into a Spec; on failure return DEFAULT_SPEC + error. */
export function parseModelSpec(raw: string): { spec: Spec; error?: string } {
  try {
    const parsed: unknown = JSON.parse(stripJsonFences(raw));
    const result = SpecSchema.safeParse(parsed);
    if (result.success) return { spec: result.data };
    return { spec: DEFAULT_SPEC, error: result.error.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid JSON";
    return { spec: DEFAULT_SPEC, error: message };
  }
}
