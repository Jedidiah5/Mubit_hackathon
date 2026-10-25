import { doc, getDoc, updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import { diffSpec } from "@/lib/corrections";
import { getDb } from "@/lib/firebase";
import { runParse } from "@/lib/run-parse";
import type { Enquiry, Spec } from "@/lib/types";

type AskBody = {
  enquiryId?: unknown;
  question?: unknown;
};

function asSpec(s: Spec): Spec {
  return {
    style: s.style,
    guests: s.guests,
    stage: s.stage,
    bar: s.bar,
    extras: [...s.extras],
    accessible: s.accessible,
  };
}

/**
 * Client "Ask the venue": runParse on a composed enquiry-shaped message,
 * then open a pending changeRequest. Never writes final / parsed.
 */
export async function POST(request: Request) {
  let body: AskBody;
  try {
    body = (await request.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.enquiryId !== "string" || !body.enquiryId.trim()) {
    return NextResponse.json(
      { error: "enquiryId must be a non-empty string" },
      { status: 400 },
    );
  }
  if (typeof body.question !== "string" || !body.question.trim()) {
    return NextResponse.json(
      { error: "question must be a non-empty string" },
      { status: 400 },
    );
  }

  const enquiryId = body.enquiryId.trim();
  const question = body.question.trim();

  try {
    const snap = await getDoc(doc(getDb(), "enquiries", enquiryId));
    if (!snap.exists()) {
      return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
    }
    const enquiry = snap.data() as Enquiry;

    if (enquiry.confirmedAt || enquiry.status === "confirmed") {
      return NextResponse.json(
        { error: "Booking already confirmed" },
        { status: 409 },
      );
    }
    if (enquiry.changeRequest?.status === "pending") {
      return NextResponse.json(
        { error: "A change request is already pending" },
        { status: 409 },
      );
    }

    const current = enquiry.final ?? enquiry.parsed;
    if (!current) {
      return NextResponse.json(
        { error: "No approved plan to update yet" },
        { status: 400 },
      );
    }

    const composed = [
      "Original enquiry:",
      enquiry.body.trim(),
      "",
      "Update from the client:",
      question,
    ].join("\n");

    const parsed = await runParse(composed, { enquiryId });
    if (parsed.error || !parsed.spec) {
      return NextResponse.json(
        { error: parsed.error ?? "Could not parse a spec from the answer" },
        { status: 422 },
      );
    }

    const baseline = asSpec(current);
    const next = asSpec(parsed.spec);
    const diff = diffSpec(baseline, next);

    if (diff.length === 0) {
      return NextResponse.json({
        ok: true,
        unchanged: true,
        message: "Nothing in the plan needed to change.",
        spec: next,
        diff: [],
      });
    }

    // Pending request only — never auto-apply to final.
    await updateDoc(doc(getDb(), "enquiries", enquiryId), {
      changeRequest: {
        status: "pending",
        spec: next,
        note: question,
        diff,
        source: "ask",
        at: new Date().toISOString(),
      },
      status: "client_changes",
    });

    return NextResponse.json({
      ok: true,
      unchanged: false,
      spec: next,
      diff,
      requestId: parsed.requestId,
      latencyMs: parsed.latencyMs,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ask the venue failed";
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
