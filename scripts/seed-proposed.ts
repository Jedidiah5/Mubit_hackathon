/**
 * Seeds one demo enquiry already in "proposed" state so /p/enq-demo-proposed works.
 * Usage: npx tsx --env-file=.env.local scripts/seed-proposed.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";

const root = resolve(import.meta.dirname, "..");
const row = JSON.parse(
  readFileSync(resolve(root, "data/demo-proposed.json"), "utf8"),
) as { id: string } & Record<string, unknown>;

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

if (!apiKey || !authDomain || !projectId || !appId) {
  console.error(
    "Missing NEXT_PUBLIC_FIREBASE_* env. Run with --env-file=.env.local",
  );
  process.exit(1);
}

const app = initializeApp({ apiKey, authDomain, projectId, appId });
const db = getFirestore(app);

async function main() {
  const { id, ...data } = row;
  await setDoc(doc(db, "enquiries", id), data);
  console.log(`wrote enquiries/${id} (status: proposed)`);
  console.log(`Open /p/${id} or /e/${id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
