import { NextResponse } from "next/server";
import { mubit } from "@/lib/mubit";
import { PARSE_MODEL, PARSE_SYSTEM_PROMPT, trimEnquiry } from "@/lib/parse";
import { parseModelSpec } from "@/lib/parse-response";

type ParseBody = {
  text?: unknown;
  enquiryId?: unknown;
};

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

  if (body.enquiryId !== undefined && typeof body.enquiryId !== "string") {
    return NextResponse.json(
      { error: "enquiryId must be a string when provided" },
      { status: 400 },
    );
  }

  const trimmed = trimEnquiry(body.text);
  const started = performance.now();

  try {
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

    return NextResponse.json({
      spec,
      requestId,
      latencyMs,
      model: PARSE_MODEL,
      raw,
      ...(error ? { error } : {}),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Mubit request failed";
    const status =
      err &&
      typeof err === "object" &&
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
