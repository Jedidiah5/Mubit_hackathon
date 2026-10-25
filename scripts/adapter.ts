/**
 * Scores a Mubit adapter by hand: the app can't call an adapter, so the
 * held-out emails are pasted into the console's Try models page one by one.
 *
 *   npm run adapter -- sheet [--n 15]     write data/adapter-sheet.md
 *   npm run adapter -- score [label]      score it into data/adapter-results.json
 *
 * The sheet has the frozen system prompt and, per email, the exact user
 * message the app sends with no notes (trimmed, like /api/parse). Paste each
 * reply under "answer:" (and the latency under "ms:" if the console shows it),
 * then run score. Rows left blank are skipped, so a partial run still scores.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PARSE_MODEL, PARSE_SYSTEM_PROMPT, trimEnquiry } from "../lib/parse";
import { parseModelSpec } from "../lib/parse-response";
import {
  mean,
  median,
  overallFromFields,
  scoreSpec,
  type FieldScores,
} from "../lib/score";
import type { Spec } from "../lib/types";

type TestRow = { text: string; label: Spec };

type AdapterRun = {
  label: string;
  exact: number | null;
  accuracy: number | null;
  medianLatencyMs: number | null;
  n?: number;
  fields?: Record<keyof FieldScores, number>;
  ranAt?: string;
  notes?: string;
};

const root = resolve(import.meta.dirname, "..");
const setPath = resolve(root, "data/test-house.json");
const sheetPath = resolve(root, "data/adapter-sheet.md");
const resultsPath = resolve(root, "data/adapter-results.json");

const [command = "sheet", ...rest] = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

function loadRows(): TestRow[] {
  return JSON.parse(readFileSync(setPath, "utf8")) as TestRow[];
}

function writeSheet() {
  const rows = loadRows();
  const n = Math.min(Number(flag("--n") ?? rows.length) || rows.length, rows.length);
  if (existsSync(sheetPath) && !rest.includes("--force")) {
    console.error(`${sheetPath} exists (it may hold pasted answers). Pass --force to overwrite.`);
    process.exit(1);
  }
  const parts = [
    `# Adapter sheet · ${n} held-out emails · model ${PARSE_MODEL}`,
    "",
    "In Try models: system prompt below (if it asks), user message = the quoted email exactly. Paste each reply after `answer:`; `ms:` is optional.",
    "",
    "## System prompt",
    "",
    "```",
    PARSE_SYSTEM_PROMPT,
    "```",
  ];
  rows.slice(0, n).forEach((row, i) => {
    parts.push(
      "",
      `## ${i + 1}`,
      "",
      "```",
      trimEnquiry(row.text),
      "```",
      "",
      "answer:",
      "",
      "ms:",
    );
  });
  writeFileSync(sheetPath, parts.join("\n") + "\n");
  console.log(`Wrote ${sheetPath} (${n} emails)`);
}

type Answer = { index: number; raw: string; ms: number | null };

/** "## 3" sections: text between "answer:" and "ms:", plus the ms number. */
function readAnswers(): Answer[] {
  if (!existsSync(sheetPath)) {
    console.error(`No ${sheetPath}. Run: npm run adapter -- sheet`);
    process.exit(1);
  }
  const text = readFileSync(sheetPath, "utf8");
  const answers: Answer[] = [];
  for (const section of text.split(/^## (?=\d+\s*$)/m).slice(1)) {
    const index = Number(section.match(/^\d+/)?.[0]);
    const answer = section.match(/^answer:\s*([\s\S]*?)^ms:/m)?.[1]?.trim() ?? "";
    const ms = section.match(/^ms:\s*([\d.]+)/m)?.[1];
    if (!answer) continue;
    answers.push({ index, raw: answer, ms: ms ? Number(ms) : null });
  }
  return answers;
}

function score() {
  const label = rest.find((a) => !a.startsWith("--")) ?? "Mubit adapter v1";
  const rows = loadRows();
  const answers = readAnswers();
  if (answers.length === 0) {
    console.error("No answers pasted yet.");
    process.exit(1);
  }

  const buckets: Record<keyof FieldScores, number[]> = {
    style: [],
    stage: [],
    bar: [],
    accessible: [],
    guests: [],
    extras: [],
  };
  const overalls: number[] = [];
  let exact = 0;
  let malformed = 0;

  for (const a of answers) {
    const row = rows[a.index - 1];
    if (!row) continue;
    const { spec, error } = parseModelSpec(a.raw);
    // A malformed reply scores zero, not the default spec's lucky matches.
    const fields: FieldScores = error
      ? { style: 0, stage: 0, bar: 0, accessible: 0, guests: 0, extras: 0 }
      : scoreSpec(spec, row.label);
    if (error) malformed += 1;
    for (const key of Object.keys(fields) as (keyof FieldScores)[]) {
      buckets[key].push(fields[key]);
    }
    const overall = overallFromFields(fields);
    overalls.push(overall);
    if (overall === 1) exact += 1;
    const misses = (Object.keys(fields) as (keyof FieldScores)[])
      .filter((k) => fields[k] < 1)
      .map((k) => `${k}: ${JSON.stringify(spec[k])} ≠ ${JSON.stringify(row.label[k])}`);
    console.log(
      `[${a.index}] ${Math.round(overall * 100)}%` +
        (error ? ` · malformed: ${error.slice(0, 60)}` : misses.length ? ` · ${misses.join(" · ")}` : ""),
    );
  }

  const latencies = answers.flatMap((a) => (a.ms == null ? [] : [a.ms]));
  const run: AdapterRun = {
    label,
    exact: exact / answers.length,
    accuracy: mean(overalls),
    medianLatencyMs: latencies.length ? median(latencies) : null,
    n: answers.length,
    fields: Object.fromEntries(
      Object.entries(buckets).map(([k, v]) => [k, mean(v)]),
    ) as Record<keyof FieldScores, number>,
    ranAt: new Date().toISOString(),
    ...(malformed ? { notes: `${malformed} malformed replies` } : {}),
  };

  const existing = existsSync(resultsPath)
    ? (JSON.parse(readFileSync(resultsPath, "utf8")) as AdapterRun[])
    : [];
  // Keep what the score doesn't measure (base model, Mubit's grade).
  const previous = existing.find((r) => r.label === label);
  const next = [...existing.filter((r) => r.label !== label), { ...previous, ...run }];
  writeFileSync(resultsPath, JSON.stringify(next, null, 2) + "\n");

  console.log(
    `\n${label}: n=${run.n} exact=${(run.exact! * 100).toFixed(0)}% fields=${(run.accuracy! * 100).toFixed(1)}%` +
      (run.medianLatencyMs != null ? ` median=${run.medianLatencyMs}ms` : "") +
      (malformed ? ` · ${malformed} malformed` : ""),
  );
  console.log(`Wrote ${resultsPath}`);
}

if (command === "sheet") writeSheet();
else if (command === "score") score();
else {
  console.error("Usage: npm run adapter -- sheet [--n 15] | score [label]");
  process.exit(1);
}
