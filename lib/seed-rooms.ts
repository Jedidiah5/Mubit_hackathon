import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import {
  DEMO_ROOM_IDS,
  DEMO_ROOMS,
  DEMO_VENUE,
  DEMO_VENUE_ID,
  type RoomDoc,
} from "./data/venue";
import type { Room } from "./types";

function hasPricing(data: Record<string, unknown>): boolean {
  const p = data.pricing;
  return (
    !!p &&
    typeof p === "object" &&
    typeof (p as { hireFee?: unknown }).hireFee === "number"
  );
}

/** If `rooms` is empty for the demo venue, seed venue + rooms from lib/data/venue.ts.
 *  If rooms already exist but lack `pricing`, patch it from the demo tariff.
 */
export async function ensureDemoRoomsSeeded(
  db: Firestore,
): Promise<RoomDoc[]> {
  const snap = await getDocs(
    query(collection(db, "rooms"), where("venueId", "==", DEMO_VENUE_ID)),
  );

  if (!snap.empty) {
    const out: RoomDoc[] = [];
    for (const d of snap.docs) {
      const data = d.data() as Room;
      if (!hasPricing(data as unknown as Record<string, unknown>)) {
        const demo =
          DEMO_ROOMS.find((r) => r.name === data.name) ??
          DEMO_ROOMS[DEMO_ROOM_IDS.indexOf(d.id as (typeof DEMO_ROOM_IDS)[number])] ??
          DEMO_ROOMS[0]!;
        await updateDoc(doc(db, "rooms", d.id), { pricing: demo.pricing });
        out.push({ id: d.id, ...data, pricing: demo.pricing });
      } else {
        out.push({ id: d.id, ...data });
      }
    }
    return out;
  }

  await setDoc(doc(db, "venues", DEMO_VENUE_ID), DEMO_VENUE);

  const seeded: RoomDoc[] = [];
  for (let i = 0; i < DEMO_ROOMS.length; i++) {
    const id = DEMO_ROOM_IDS[i]!;
    const room = DEMO_ROOMS[i]!;
    await setDoc(doc(db, "rooms", id), room);
    seeded.push({ id, ...room });
  }
  return seeded;
}
