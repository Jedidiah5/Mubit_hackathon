import "server-only";
import { buildUserMessage, pickCorrections } from "./corrections";
import { loadCorrections } from "./corrections-store";
import { mubit } from "./mubit";
import { PARSE_MODEL, PARSE_SYSTEM_PROMPT, trimEnquiry } from "./parse";
import { parseModelSpec } from "./parse-response";
import type { Spec } from "./types";

export type ParseResult = {
  spec: Spec;
  requestId: string | null;
  latencyMs: number;
  model: string;
  raw: string;
  /** Past corrections put above the email as notes. */
  notesUsed: number;
  error?: string;
};

/** Single LLM call path — used by /api/parse and /api/inbound. */
export async function runParse(
  text: string,
  opts: { enquiryId?: string } = {},
): Promise<ParseResult> {
  const trimmed = trimEnquiry(text);
  const notes = pickCorrections(
    await loadCorrections(),
    trimmed,
    opts.enquiryId,
  );
  const started = performance.now();

  const { data, response } = await mubit.chat.completions
    .create({
      model: PARSE_MODEL,
      messages: [
        { role: "system", content: PARSE_SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(trimmed, notes) },
      ],
    })
    .withResponse();

  const latencyMs = Math.round(performance.now() - started);
  const requestId =
    response.headers.get("x-middleware-request-id") ??
    response.headers.get("x-request-id") ??
    response.headers.get("request-id");
  const raw = data.choices[0]?.message?.content ?? "";
  const { spec, error } = parseModelSpec(raw);

  return {
    spec,
    requestId,
    latencyMs,
    model: PARSE_MODEL,
    raw,
    notesUsed: notes.length,
    ...(error ? { error } : {}),
  };
}
