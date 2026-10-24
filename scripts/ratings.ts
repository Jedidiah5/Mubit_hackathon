/**
 * What to click in Mubit's Requests page for each approved enquiry.
 * Mubit keeps GPT's raw reply, so a reply the coordinator corrected is Bad.
 * Read-only: Mubit has no rating API, so this only prints.
 *
 * Usage: npm run ratings
 */
import { collection, getDocs } from "firebase/firestore";
import { diffSpec } from "../lib/corrections";
import { getDb } from "../lib/firebase";
import type { Spec } from "../lib/types";

type Row = {
  subject: string;
  requestId?: string;
  parsed?: Spec;
  final?: Spec;
  approvedAt?: string | null;
};

/**
 * The console's request id is a different id made a moment later, so only
 * its first 8 hex characters and its time (UUIDv7 ms prefix) line up.
 */
function consoleHint(requestId: string): string {
  const h = requestId.replace(/^mreq_/, "");
  const at = new Date(parseInt(h.slice(0, 12), 16)).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
  });
  return `${at}  ${h.slice(0, 8)}…`;
}

async function main() {
  const snap = await getDocs(collection(getDb(), "enquiries"));
  const rows = snap.docs
    .map((d) => d.data() as Row)
    .filter((r) => r.parsed && r.requestId)
    // Request ids are time-ordered, so this matches the console's order.
    .sort((a, b) => b.requestId!.localeCompare(a.requestId!));

  const counts = { Good: 0, Bad: 0, "not approved": 0 };
  console.log(
    "Newest first. Find each in the console by time and ID start, then check the email.\n",
  );
  for (const r of rows) {
    const changes = r.final ? diffSpec(r.parsed!, r.final) : [];
    const rating = !r.approvedAt ? "not approved" : changes.length ? "Bad" : "Good";
    counts[rating] += 1;
    console.log(
      `${rating.padEnd(13)} ${r.subject.slice(0, 36).padEnd(37)} ${consoleHint(r.requestId!)}` +
        // The console truncates the request, but the reply is shown in full.
        `  reply: ${r.parsed!.style}, ${r.parsed!.guests}` +
        (changes.length ? `  fixed: ${changes.map((c) => c.field).join(", ")}` : ""),
    );
  }
  console.log(
    `\n${counts.Good} Good · ${counts.Bad} Bad · ${counts["not approved"]} not approved yet`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
