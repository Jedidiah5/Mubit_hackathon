/**
 * Held-out eval through Mubit (same prompt/model/trim as /api/parse).
 * Rate-limited to 1 call/second. Never recorded as training data.
 *
 * Modes:
 *   plain  frozen prompt, email only (GPT before any corrections)
 *   notes  frozen prompt + coordinator corrections from Firestore (the app today)
 *   rules  house rules written into the system prompt (the baseline to beat)
 *
 * Usage: npm run eval -- [plain|notes|rules] [data/test-house.json]
 * Each run is merged into data/eval-results.json under its set and mode.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import OpenAI from "openai";
import {
  buildUserMessage,
  isCorrection,
  pickCorrections,
} from "../lib/corrections";
import { getDb } from "../lib/firebase";
import { PARSE_MODEL, PARSE_SYSTEM_PROMPT, trimEnquiry } from "../lib/parse";
import { parseModelSpec } from "../lib/parse-response";
import {
  mean,
  median,
  overallFromFields,
  scoreSpec,
  type FieldScores,
} from "../lib/score";
import type { Correction, Spec } from "../lib/types";

type TestRow = { text: string; label: Spec };
type Mode = "plain" | "notes" | "rules";

const MODES: Mode[] = ["plain", "notes", "rules"];

/** What a coordinator would otherwise have to write down. Eval-only. */
const HOUSE_RULES = `Venue house rules:
- Awards, prize-giving, trophy and presentation nights: cabaret, stage north, lectern.
- AGMs, shareholder and members' meetings: theatre, stage north, lectern.
- Quiz nights and tastings: cabaret, stage north.
- Christmas parties: banquet, bar east, dance_floor and dj_booth.
- Ceilidh or live band: stage north, dance_floor.
- Wakes, memorials, celebrations of life: reception with buffet.
- Mixers, launches, engagement parties: reception, bar east.
- Any mobility need (walker, crutches, scooter, stairs, unsteady): accessible true.`;

const root = resolve(import.meta.dirname, "..");
const outPath = resolve(root, "data/eval-results.json");

const mode = (process.argv[2] ?? "plain") as Mode;
if (!MODES.includes(mode)) {
  console.error(`Mode must be one of: ${MODES.join(", ")}`);
  process.exit(1);
}
const setPath = resolve(root, process.argv[3] ?? "data/test-house.json");
const setName = basename(setPath, ".json");

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

async function loadCorrections(): Promise<Correction[]> {
  const snap = await getDocs(
    query(collection(getDb(), "corrections"), orderBy("at", "desc"), limit(200)),
  );
  return snap.docs.map((d) => d.data()).filter(isCorrection);
}

async function parseOne(
  text: string,
  corrections: Correction[],
): Promise<{
  spec: Spec;
  error?: string;
  notesUsed: number;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}> {
  const trimmed = trimEnquiry(text);
  const notes = mode === "notes" ? pickCorrections(corrections, trimmed) : [];
  const system =
    mode === "rules"
      ? `${PARSE_SYSTEM_PROMPT}\n\n${HOUSE_RULES}`
      : PARSE_SYSTEM_PROMPT;
  const started = performance.now();
  const completion = await mubit.chat.completions.create(
    {
      model: PARSE_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: buildUserMessage(trimmed, notes) },
      ],
    },
    {
      // Held-out data must never become a training example.
      headers: { "x-middleware-record": "off" },
    },
  );
  const latencyMs = Math.round(performance.now() - started);
  const raw = completion.choices[0]?.message?.content ?? "";
  const { spec, error } = parseModelSpec(raw);
  const usage = completion.usage;
  return {
    spec,
    error,
    notesUsed: notes.length,
    latencyMs,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

function diffLine(pred: Spec, label: Spec): string {
  const fields = scoreSpec(pred, label);
  return (Object.keys(fields) as (keyof FieldScores)[])
    .filter((k) => fields[k] < 1)
    .map((k) => `${k}: ${JSON.stringify(pred[k])} ≠ ${JSON.stringify(label[k])}`)
    .join(" · ");
}

async function main() {
  const rows = JSON.parse(readFileSync(setPath, "utf8")) as TestRow[];
  const corrections = mode === "notes" ? await loadCorrections() : [];
  console.log(
    `Evaluating ${rows.length} rows of ${setName} · mode=${mode}` +
      (mode === "notes" ? ` · ${corrections.length} corrections` : ""),
  );

  const fieldBuckets: Record<keyof FieldScores, number[]> = {
    style: [],
    stage: [],
    bar: [],
    accessible: [],
    guests: [],
    extras: [],
  };
  const overalls: number[] = [];
  const latencies: number[] = [];
  let exact = 0;
  let notesUsed = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const t0 = Date.now();
    try {
      const result = await parseOne(row.text, corrections);
      const fields = scoreSpec(result.spec, row.label);
      for (const key of Object.keys(fields) as (keyof FieldScores)[]) {
        fieldBuckets[key].push(fields[key]);
      }
      const overall = overallFromFields(fields);
      overalls.push(overall);
      if (overall === 1) exact += 1;
      latencies.push(result.latencyMs);
      notesUsed += result.notesUsed;
      promptTokens += result.promptTokens;
      completionTokens += result.completionTokens;
      totalTokens += result.totalTokens;
      const miss = result.error
        ? `unparseable: ${result.error.slice(0, 80)}`
        : diffLine(result.spec, row.label);
      console.log(
        `[${i + 1}/${rows.length}] ${Math.round(overall * 100)}% · ${result.latencyMs}ms · notes=${result.notesUsed}${miss ? ` · ${miss}` : ""}`,
      );
    } catch (err) {
      console.error(`[${i + 1}/${rows.length}] FAIL`, err);
      for (const key of Object.keys(fieldBuckets) as (keyof FieldScores)[]) {
        fieldBuckets[key].push(0);
      }
      overalls.push(0);
    }

    const elapsed = Date.now() - t0;
    if (i < rows.length - 1 && elapsed < 1000) {
      await sleep(1000 - elapsed);
    }
  }

  const report = {
    model: PARSE_MODEL,
    mode,
    ranAt: new Date().toISOString(),
    n: rows.length,
    /** Share of rows with every field right. */
    exact: rows.length > 0 ? exact / rows.length : 0,
    accuracy: {
      overall: mean(overalls),
      style: mean(fieldBuckets.style),
      stage: mean(fieldBuckets.stage),
      bar: mean(fieldBuckets.bar),
      accessible: mean(fieldBuckets.accessible),
      guests: mean(fieldBuckets.guests),
      extras: mean(fieldBuckets.extras),
    },
    medianLatencyMs: median(latencies),
    avgNotes: rows.length > 0 ? notesUsed / rows.length : 0,
    promptTokens,
    completionTokens,
    totalTokens,
  };

  const all = existsSync(outPath)
    ? (JSON.parse(readFileSync(outPath, "utf8")) as Record<string, unknown>)
    : {};
  const sets =
    all.sets && typeof all.sets === "object"
      ? (all.sets as Record<string, Record<string, unknown>>)
      : {};
  sets[setName] = { ...sets[setName], [mode]: report };
  writeFileSync(outPath, JSON.stringify({ sets }, null, 2) + "\n");

  console.log(`\nWrote ${outPath} (${setName}.${mode})`);
  console.log(
    `exact=${(report.exact * 100).toFixed(0)}% fields=${(report.accuracy.overall * 100).toFixed(1)}% median=${report.medianLatencyMs}ms tokens=${totalTokens}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
