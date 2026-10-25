import "server-only";
import {
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
import type { ParseResult } from "./run-parse";
import type { Room } from "./types";

async function loadRooms(): Promise<Room[]> {
  try {
    const snap = await getDocs(
      query(collection(getDb(), "rooms"), where("venueId", "==", DEMO_VENUE_ID)),
    );
    if (!snap.empty) return snap.docs.map((d) => d.data() as Room);
  } catch {
    /* fall through */
  }
  return DEMO_ROOMS;
}

/**
 * Write parse result onto an enquiry. Keeps pipeline status as "received"
 * (does not overwrite proposed / confirmed / client_changes).
 */
export async function persistParseToEnquiry(
  enquiryId: string,
  parsed: ParseResult,
): Promise<void> {
  const rooms = await loadRooms();
  const feasibility = evaluateRooms(rooms, parsed.spec, null);
  await updateDoc(doc(getDb(), "enquiries", enquiryId), {
    parsed: parsed.spec,
    final: parsed.spec,
    requestId: parsed.requestId ?? "",
    latencyMs: parsed.latencyMs,
    model: parsed.model,
    notesUsed: parsed.notesUsed,
    feasibility: firestoreFeasibility(feasibility),
    roomOverride: null,
    // Pipeline status is owned by the organiser journey — do not overwrite.
  });
}
