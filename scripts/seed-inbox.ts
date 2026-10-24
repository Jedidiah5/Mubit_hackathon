/**
 * Writes data/inbox.json into Firestore `enquiries` (no parsing).
 * Usage: npx tsx --env-file=.env.local scripts/seed-inbox.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";

type InboxRow = {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
};

const root = resolve(import.meta.dirname, "..");
const rows = JSON.parse(
  readFileSync(resolve(root, "data/inbox.json"), "utf8"),
) as InboxRow[];

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
  for (const row of rows) {
    const { id, from, subject, body, receivedAt } = row;
    await setDoc(doc(db, "enquiries", id), {
      from,
      subject,
      body,
      receivedAt,
    });
    console.log(`wrote enquiries/${id}`);
  }
  console.log(`Seeded ${rows.length} enquiries (no parse).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
