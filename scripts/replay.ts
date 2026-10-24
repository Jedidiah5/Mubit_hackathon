/**
 * Re-sends every approved, non-vague enquiry through Mubit, oldest first, exactly as
 * the app would (frozen prompt, past corrections as notes, minus its own).
 * Rebuilds a fresh Mubit account's examples from work already done here.
 *
 * Overwrites parsed/requestId so `npm run ratings` compares the new reply
 * with what the coordinator approved. final and approvedAt are untouched.
 *
 * Usage: npm run replay            (send)
 *        npm run replay -- --dry   (list what would be sent)
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import OpenAI from "openai";
import {
  buildUserMessage,
  diffSpec,
  isCorrection,
  pickCorrections,
} from "../lib/corrections";
import { getDb } from "../lib/firebase";
import { enquiryText, missingDetails, needsInfo } from "../lib/missing";
import { PARSE_MODEL, PARSE_SYSTEM_PROMPT, trimEnquiry } from "../lib/parse";
import { parseModelSpec } from "../lib/parse-response";
import type { Spec } from "../lib/types";

type Row = {
  id: string;
  subject: string;
  body: string;
  receivedAt: string;
  final?: Spec;
  approvedAt?: string | null;
};

const dry = process.argv.includes("--dry");

const apiKey = process.env.MUBIT_API_KEY?.trim();
const baseURL = process.env.MUBIT_BASE_URL?.trim();
if (!apiKey || !baseURL) {
  console.error("Missing MUBIT_API_KEY / MUBIT_BASE_URL (use --env-file=.env.local)");
  process.exit(1);
}

const mubit = new OpenAI({
  baseURL,
  apiKey,
  defaultHeaders: { Authorization: `Bearer ${apiKey}` },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = getDb();
  const corrections = (
    await getDocs(
      query(collection(db, "corrections"), orderBy("at", "desc"), limit(200)),
    )
  ).docs
    .map((d) => d.data())
    .filter(isCorrection);

  const rows = (await getDocs(collection(db, "enquiries"))).docs
    .map((d) => ({ id: d.id, ...d.data() }) as Row)
    .filter((r) => r.approvedAt && r.final)
    // Vague emails ("i want to host an event") teach guessing, not the venue.
    .filter((r) => !needsInfo(missingDetails(enquiryText(r))))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  console.log(
    `${rows.length} approved enquiries · ${corrections.length} corrections${dry ? " · dry run" : ""}\n`,
  );

  let good = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const trimmed = trimEnquiry(row.body);
    const notes = pickCorrections(corrections, trimmed, row.id);
    if (dry) {
      console.log(`[${i + 1}/${rows.length}] ${row.subject} · notes=${notes.length}`);
      continue;
    }

    const t0 = Date.now();
    const { data, response } = await mubit.chat.completions
      .create({
        model: PARSE_MODEL,
        messages: [
          { role: "system", content: PARSE_SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(trimmed, notes) },
        ],
      })
      .withResponse();
    const latencyMs = Date.now() - t0;
    const requestId =
      response.headers.get("x-middleware-request-id") ??
      response.headers.get("x-request-id") ??
      response.headers.get("request-id") ??
      "";
    const { spec, error } = parseModelSpec(data.choices[0]?.message?.content ?? "");
    const changes = diffSpec(spec, row.final!);
    if (!error && changes.length === 0) good += 1;

    await updateDoc(doc(db, "enquiries", row.id), {
      parsed: spec,
      requestId,
      latencyMs,
      model: PARSE_MODEL,
      notesUsed: notes.length,
      verdict: changes.length === 0 ? "good" : "corrected",
    });
    console.log(
      `[${i + 1}/${rows.length}] ${changes.length === 0 && !error ? "Good" : "Bad "} ${row.subject} · notes=${notes.length}` +
        (error ? " · unparseable" : changes.length ? ` · off: ${changes.map((c) => c.field).join(", ")}` : ""),
    );

    if (i < rows.length - 1 && latencyMs < 1000) await sleep(1000 - latencyMs);
  }

  if (!dry) {
    console.log(`\n${good}/${rows.length} right first time. Run npm run ratings for the console IDs.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
