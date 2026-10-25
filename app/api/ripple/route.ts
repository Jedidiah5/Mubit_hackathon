import { NextResponse } from "next/server";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { isCorrection } from "@/lib/corrections";
import { loadCorrections } from "@/lib/corrections-store";
import { parseEnquiry } from "@/lib/enquiry-process";
import { getDb } from "@/lib/firebase";
import {
  pickRippleTargets,
  keepCorrected,
  rippleChanges,
  type RippleCandidate,
  type RippleFix,
  type RippleResponse,
} from "@/lib/ripple";
import type { Correction, FixedBy, Spec } from "@/lib/types";

/** Up to MAX_TARGETS parse calls, two at a time. */
export const maxDuration = 60;

const CONCURRENCY = 2;

type RippleBody = {
  enquiryId?: unknown;
  /** Only list the targets (no LLM calls), so the page can say "checking 3…". */
  dryRun?: unknown;
  /** From the dry run: re-parse only these, so the count shown stays true. */
  ids?: unknown;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The page writes corrections/{id} on each edit without awaiting it, so an
 * approve straight after the last edit can arrive first. One retry covers it.
 */
async function loadCorrection(id: string): Promise<Correction | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const snap = await getDoc(doc(getDb(), "corrections", id));
    const data = snap.exists() ? snap.data() : null;
    if (isCorrection(data) && data.changes.length > 0) return data;
    if (attempt === 0) await sleep(1500);
  }
  return null;
}

async function loadCandidates(): Promise<RippleCandidate[]> {
  const snap = await getDocs(collection(getDb(), "enquiries"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      subject: String(data.subject ?? ""),
      body: String(data.body ?? ""),
      parsed: data.parsed as Spec | undefined,
      final: data.final as Spec | undefined,
      approvedAt: data.approvedAt as string | null | undefined,
      roomOverride: data.roomOverride as string | null | undefined,
    };
  });
}

/**
 * "Teach once, fixes everywhere": after a corrected enquiry is approved,
 * re-parse the waiting enquiries with the same cue so they get the fix as a
 * note, and tag the ones it changed (enquiries/{id}.fixedBy).
 */
export async function POST(request: Request) {
  let body: RippleBody;
  try {
    body = (await request.json()) as RippleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.enquiryId !== "string" || !body.enquiryId) {
    return NextResponse.json(
      { error: "enquiryId must be a non-empty string" },
      { status: 400 },
    );
  }
  const enquiryId = body.enquiryId;
  const only = Array.isArray(body.ids)
    ? new Set(body.ids.filter((x): x is string => typeof x === "string"))
    : null;

  try {
    const correction = await loadCorrection(enquiryId);
    const empty: RippleResponse = { targets: [], checked: 0, fixed: [], failed: 0 };
    if (!correction) return NextResponse.json(empty);

    const [source, candidates, corrections] = await Promise.all([
      getDoc(doc(getDb(), "enquiries", enquiryId)),
      loadCandidates(),
      loadCorrections(),
    ]);
    const sourceSubject = String(source.data()?.subject ?? "");
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const targets = pickRippleTargets(
      correction,
      candidates,
      corrections,
      sourceSubject,
    )
      .filter((t) => !only || only.has(t.id))
      .map((t) => byId.get(t.id)!);
    const listed = targets.map((t) => ({ id: t.id, subject: t.subject }));

    if (body.dryRun === true) {
      return NextResponse.json({ ...empty, targets: listed });
    }

    const fixed: RippleFix[] = [];
    let failed = 0;
    const at = new Date().toISOString();

    const run = async (target: RippleCandidate) => {
      try {
        const before = target.parsed!;
        const result = await parseEnquiry(target.id, target.body, (fresh) =>
          keepCorrected(correction, before, fresh),
        );
        if (!result.spec) {
          failed += 1;
          return;
        }
        const changes = rippleChanges(correction, before, result.spec);
        if (changes.length === 0) return;
        const fixedBy: FixedBy = {
          enquiryId,
          subject: sourceSubject,
          at,
          changes,
        };
        await updateDoc(doc(getDb(), "enquiries", target.id), { fixedBy });
        fixed.push({ id: target.id, subject: target.subject, changes });
      } catch {
        failed += 1;
      }
    };

    const queue = [...targets];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let t = queue.shift(); t; t = queue.shift()) await run(t);
      }),
    );

    const order = new Map(targets.map((t, i) => [t.id, i]));
    fixed.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    const response: RippleResponse = {
      targets: listed,
      checked: targets.length,
      fixed,
      failed,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ripple failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
