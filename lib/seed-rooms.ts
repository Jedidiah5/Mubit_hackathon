import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
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

/** If `rooms` is empty for the demo venue, seed venue + rooms from lib/data/venue.ts. */
export async function ensureDemoRoomsSeeded(
  db: Firestore,
): Promise<RoomDoc[]> {
  const snap = await getDocs(
    query(collection(db, "rooms"), where("venueId", "==", DEMO_VENUE_ID)),
  );

  if (!snap.empty) {
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Room) }));
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
