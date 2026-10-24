"use client";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { DEMO_ROOMS, DEMO_VENUE_ID } from "./data/venue";
import { getDb } from "./firebase";
import { ensureDemoRoomsSeeded } from "./seed-rooms";
import type { Room } from "./types";

/** Live rooms from Firestore; falls back to DEMO_ROOMS until seeded. */
export function useVenueRooms(): Room[] {
  const [rooms, setRooms] = useState<Room[]>(DEMO_ROOMS);

  useEffect(() => {
    let unsub = () => {};
    void (async () => {
      try {
        const db = getDb();
        await ensureDemoRoomsSeeded(db);
        unsub = onSnapshot(
          query(collection(db, "rooms"), where("venueId", "==", DEMO_VENUE_ID)),
          (snap) => {
            if (snap.empty) return;
            const next = snap.docs.map((d) => d.data() as Room);
            next.sort((a, b) => b.widthM * b.lengthM - a.widthM * a.lengthM);
            setRooms(next);
          },
        );
      } catch {
        /* keep DEMO_ROOMS */
      }
    })();
    return () => unsub();
  }, []);

  return rooms;
}
