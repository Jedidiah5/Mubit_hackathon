import { NextResponse } from "next/server";
import { persistParseToEnquiry } from "@/lib/persist-parse";
import { runParse } from "@/lib/run-parse";

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

  try {
    const enquiryId =
      typeof body.enquiryId === "string" ? body.enquiryId : undefined;
    const result = await runParse(body.text, { enquiryId });
    if (enquiryId) {
      await persistParseToEnquiry(enquiryId, result);
    }
    return NextResponse.json(result);
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
