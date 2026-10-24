import { NextResponse } from "next/server";
import { mubit } from "@/lib/mubit";
import { PARSE_MODEL, PARSE_SYSTEM_PROMPT, trimEnquiry } from "@/lib/parse";
import { SpecSchema } from "@/lib/schema";
import type { Spec } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULT_SPEC: Spec = {
  style: "banquet",
  guests: 50,
  stage: "none",
  bar: "none",
  extras: [],
  accessible: false,
};

type ParseBody = {
  text?: unknown;
  enquiryId?: unknown;
};

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function parseSpec(raw: string): { spec: Spec; error?: string } {
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

export async function POST(request: Request) {
  let body: ParseBody;
  try {
    body = (await request.json()) as ParseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json(
      { error: "text must be a non-empty string" },
      { status: 400 },
    );
  }

  if (
    body.enquiryId !== undefined &&
    typeof body.enquiryId !== "string"
  ) {
    return NextResponse.json(
      { error: "enquiryId must be a string when provided" },
      { status: 400 },
    );
  }

  const trimmed = trimEnquiry(body.text);
  const started = performance.now();

  const { data, response } = await mubit.chat.completions
    .create({
      model: PARSE_MODEL,
      messages: [
        { role: "system", content: PARSE_SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
    })
    .withResponse();

  const latencyMs = Math.round(performance.now() - started);
  const requestId = response.headers.get("x-middleware-request-id");
  const raw = data.choices[0]?.message?.content ?? "";
  const { spec, error } = parseSpec(raw);

  return NextResponse.json({
    spec,
    requestId,
    latencyMs,
    model: PARSE_MODEL,
    raw,
    ...(error ? { error } : {}),
  });
}
