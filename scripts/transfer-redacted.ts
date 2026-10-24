import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import OpenAI from "openai";
import { diffSpec } from "../lib/corrections";
import { getDb } from "../lib/firebase";
import { enquiryText, missingDetails, needsInfo } from "../lib/missing";
import { PARSE_MODEL, PARSE_SYSTEM_PROMPT, trimEnquiry } from "../lib/parse";
import { parseModelSpec } from "../lib/parse-response";
import type { Spec } from "../lib/types";

type Row = {
  id: string;
  subject: string;
  body: string;
  from?: string;
  receivedAt: string;
  final?: Spec;
  approvedAt?: string | null;
  requestId?: string;
};

const dry = !process.argv.includes("--send");
const skipPrefixes = new Set(["01a16eee"]); // Exact call already present in destination.
const apiKey = process.env.MUBIT_API_KEY?.trim();
const baseURL = process.env.MUBIT_BASE_URL?.trim();
if (!apiKey || !baseURL) throw new Error("Missing Mubit API configuration");

const mubit = new OpenAI({
  baseURL,
  apiKey,
  defaultHeaders: { Authorization: `Bearer ${apiKey}` },
});

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactedBody(row: Row): { text: string; removedEmail: number; removedPhone: number } {
  let text = trimEnquiry(row.body);
  const fromName = (row.from ?? "").split(/\s*<|\s*\(/, 1)[0]!.replace(/^"|"$/g, "").trim();
  if (fromName && !fromName.includes("@") && fromName.split(/\s+/).length <= 5) {
    text = text.replace(new RegExp(escapeRegExp(fromName), "gi"), "");
  }
  let removedEmail = 0;
  text = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, () => { removedEmail++; return "[contact removed]"; });
  text = text.replace(/\b(?:e-?mail|phone|mobile|telephone|tel|contact|address|postcode)\s*[:=]\s*[^,;]+/gi, "[contact removed]");
  text = text.replace(/https?:\/\/\S+/gi, "[link removed]");
  let removedPhone = 0;
  text = text.replace(/\+?\d[\d\s()./-]{7,}\d/g, (match) => {
    if ((match.match(/\d/g) ?? []).length >= 9) {
      removedPhone++;
      return "[contact removed]";
    }
    return match;
  });
  text = text.replace(/\s+/g, " ").trim();
  if (/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(text)) throw new Error(`Email redaction failed for ${row.id}`);
  if (/(?:\+?\d[\d\s()./-]{7,}\d)/.test(text)) throw new Error(`Phone redaction needs review for ${row.id}`);
  return { text, removedEmail, removedPhone };
}

async function main() {
  const db = getDb();
  const rows = (await getDocs(collection(db, "enquiries"))).docs
    .map((d) => ({ id: d.id, ...d.data() }) as Row)
    .filter((r) => r.approvedAt && r.final)
    .filter((r) => !needsInfo(missingDetails(enquiryText(r))))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  const candidates = rows.filter((r) => !skipPrefixes.has((r.requestId ?? "").replace(/^mreq_/, "").slice(0, 8)));
  const preview = candidates.map((r) => ({
    id: r.id,
    subject: r.subject,
    requestPrefix: (r.requestId ?? "").replace(/^mreq_/, "").slice(0, 8),
    ...redactedBody(r),
  }));
  const remainingPIIPatterns = preview.filter(({ text }) =>
    /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\d\s()./-]{7,}\d)/.test(text),
  ).length;
  console.log(JSON.stringify({ approvedNonVague: rows.length, duplicateSkipped: rows.length - candidates.length, toTransfer: candidates.length, remainingPIIPatterns, redactedEmailCount: preview.reduce((n, x) => n + x.removedEmail, 0), redactedPhoneCount: preview.reduce((n, x) => n + x.removedPhone, 0), dry }));
  if (dry || remainingPIIPatterns) return;

  const result: Array<{ prefix: string; time: string; good: boolean; changed: string[]; error?: string }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i]!;
    const { text } = preview[i]!;
    const startedAt = new Date().toISOString();
    try {
      const { data, response } = await mubit.chat.completions.create({
        model: PARSE_MODEL,
        messages: [
          { role: "system", content: PARSE_SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }).withResponse();
      const requestId = response.headers.get("x-middleware-request-id") ?? response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? "";
      const { spec, error } = parseModelSpec(data.choices[0]?.message?.content ?? "");
      const changes = error ? ["unparseable"] : diffSpec(spec, row.final!);
      const prefix = requestId.replace(/^mreq_/, "").slice(0, 8);
      result.push({ prefix, time: startedAt, good: !error && changes.length === 0, changed: changes.map((c) => c.field), ...(error ? { error } : {}) });
      console.log(JSON.stringify({ index: i + 1, total: candidates.length, prefix, good: !error && changes.length === 0, changed: changes.map((c) => c.field) }));
    } catch (error) {
      result.push({ prefix: "", time: startedAt, good: false, changed: [], error: error instanceof Error ? error.message : String(error) });
      console.error(JSON.stringify({ index: i + 1, total: candidates.length, error: error instanceof Error ? error.message : String(error) }));
      break;
    }
    if (i < candidates.length - 1) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile("/private/tmp/mubit-transfer-map.json", JSON.stringify(result, null, 2), { mode: 0o600 }),
  );
  console.log(JSON.stringify({ sent: result.length, good: result.filter((r) => r.good).length, bad: result.filter((r) => !r.good).length, map: "/private/tmp/mubit-transfer-map.json" }));
}

main().catch((error) => { console.error(error); process.exit(1); });
