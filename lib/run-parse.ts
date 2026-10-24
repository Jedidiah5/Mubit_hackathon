import "server-only";
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
  error?: string;
};

/** Single LLM call path — used by /api/parse and /api/inbound. */
export async function runParse(text: string): Promise<ParseResult> {
  const trimmed = trimEnquiry(text);
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
    ...(error ? { error } : {}),
  };
}
