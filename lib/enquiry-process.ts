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

type EnquiryInput = {
  from: string;
  subject: string;
  body: string;
  /** Where it came in: "inbound" (email webhook) or "contact" (public form). */
  source?: "inbound" | "contact";
};

type ParseOutcome =
  | { spec: Spec; requestId: string | null; error?: undefined }
  | { spec: null; requestId: null; error: string };

/** Store the raw enquiry; it shows in the inbox straight away, unparsed. */
export async function createEnquiry(input: EnquiryInput): Promise<string> {
  const ref = await addDoc(collection(getDb(), "enquiries"), {
    from: input.from,
    subject: input.subject,
    body: input.body,
    receivedAt: new Date().toISOString(),
    source: input.source ?? "inbound",
    status: "received",
  });
  return ref.id;
}

/**
 * Parse via Mubit and write feasibility onto an existing enquiry.
 * A failed parse leaves the doc unparsed so it waits for "Process all".
 */
export async function parseEnquiry(
  id: string,
  body: string,
  /** Adjust the model's spec before it is saved (the ripple keeps unfixed fields). */
  shape: (spec: Spec) => Spec = (spec) => spec,
): Promise<ParseOutcome> {
  let parsed: Awaited<ReturnType<typeof runParse>>;
  try {
    parsed = await runParse(body, { enquiryId: id });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Parse failed";
    return { spec: null, requestId: null, error };
  }
  const spec = shape(parsed.spec);
  const rooms = await loadRooms();
  const feasibility = evaluateRooms(rooms, spec, null);

  await updateDoc(doc(getDb(), "enquiries", id), {
    parsed: spec,
    final: spec,
    requestId: parsed.requestId ?? "",
    latencyMs: parsed.latencyMs,
    model: parsed.model,
    notesUsed: parsed.notesUsed,
    feasibility: firestoreFeasibility(feasibility),
    roomOverride: null,
  });

  return { spec, requestId: parsed.requestId };
}

/**
 * Create + parse in one go (email webhook). A failed parse still keeps the doc
 * (spec: null), and the sender isn't told to retry, which would duplicate it.
 */
export async function createAndParseEnquiry(
  input: EnquiryInput,
): Promise<ParseOutcome & { id: string }> {
  const id = await createEnquiry(input);
  return { id, ...(await parseEnquiry(id, input.body)) };
}
