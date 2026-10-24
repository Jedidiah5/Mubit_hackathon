import "server-only";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { isCorrection } from "./corrections";
import { getDb } from "./firebase";
import type { Correction } from "./types";

/** Recent corrections in the current shape. Empty if Firestore is unreachable. */
export async function loadCorrections(): Promise<Correction[]> {
  try {
    const snap = await getDocs(
      query(collection(getDb(), "corrections"), orderBy("at", "desc"), limit(200)),
    );
    return snap.docs.map((d) => d.data()).filter(isCorrection);
  } catch {
    return [];
  }
}
