import "server-only";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { DEMO_ROOMS, DEMO_VENUE_ID } from "./data/venue";
import { evaluateRooms } from "./evaluate";
import { firestoreFeasibility } from "./feasibility-serialize";
import { getDb } from "./firebase";
import { runParse } from "./run-parse";
import type { Room, Spec } from "./types";

export { firestoreFeasibility };

async function loadRooms(): Promise<Room[]> {
  try {
    const snap = await getDocs(
      query(collection(getDb(), "rooms"), where("venueId", "==", DEMO_VENUE_ID)),
    );
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as Room);
    }
  } catch {
    /* fall through */
  }
  return DEMO_ROOMS;
}

/**
 * Create enquiry doc, parse via Mubit, write feasibility.
 * A failed parse still keeps the doc (spec: null) — it waits in the inbox for
 * "Process all", and the sender isn't told to retry, which would duplicate it.
 */
export async function createAndParseEnquiry(input: {
  from: string;
  subject: string;
  body: string;
}): Promise<
  | { id: string; spec: Spec; requestId: string | null; error?: undefined }
  | { id: string; spec: null; requestId: null; error: string }
> {
  const db = getDb();
  const ref = await addDoc(collection(db, "enquiries"), {
    from: input.from,
    subject: input.subject,
    body: input.body,
    receivedAt: new Date().toISOString(),
    source: "inbound",
  });

  let parsed: Awaited<ReturnType<typeof runParse>>;
  try {
    parsed = await runParse(input.body, { enquiryId: ref.id });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Parse failed";
    return { id: ref.id, spec: null, requestId: null, error };
  }
  const rooms = await loadRooms();
  const feasibility = evaluateRooms(rooms, parsed.spec, null);

  await updateDoc(doc(db, "enquiries", ref.id), {
    parsed: parsed.spec,
    final: parsed.spec,
    requestId: parsed.requestId ?? "",
    latencyMs: parsed.latencyMs,
    model: parsed.model,
    notesUsed: parsed.notesUsed,
    feasibility: firestoreFeasibility(feasibility),
    status: feasibility.status,
    roomOverride: null,
  });

  return { id: ref.id, spec: parsed.spec, requestId: parsed.requestId };
}
