/**
 * Held-out eval through Mubit (same prompt/model/trim as /api/parse).
 * Rate-limited to 1 call/second. Writes data/eval-results.json.
 *
 * Usage: npm run eval
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";
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

const root = resolve(import.meta.dirname, "..");
const testPath = resolve(root, "data/test-set.json");
const outPath = resolve(root, "data/eval-results.json");

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

async function parseOne(text: string): Promise<{
  spec: Spec;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}> {
  const trimmed = trimEnquiry(text);
  const started = performance.now();
  const completion = await mubit.chat.completions.create({
    model: PARSE_MODEL,
    messages: [
      { role: "system", content: PARSE_SYSTEM_PROMPT },
      { role: "user", content: trimmed },
    ],
  }, {
    // Held-out data must never become a training example.
    headers: { "x-middleware-record": "off" },
  });
  const latencyMs = Math.round(performance.now() - started);
  const raw = completion.choices[0]?.message?.content ?? "";
  const { spec } = parseModelSpec(raw);
  const usage = completion.usage;
  return {
    spec,
    latencyMs,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
  };
}

async function main() {
  const rows = JSON.parse(readFileSync(testPath, "utf8")) as TestRow[];
  console.log(`Evaluating ${rows.length} examples via ${PARSE_MODEL}…`);

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
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const t0 = Date.now();
    try {
      const result = await parseOne(row.text);
      const fields = scoreSpec(result.spec, row.label);
      for (const key of Object.keys(fields) as (keyof FieldScores)[]) {
        fieldBuckets[key].push(fields[key]);
      }
      overalls.push(overallFromFields(fields));
      latencies.push(result.latencyMs);
      promptTokens += result.promptTokens;
      completionTokens += result.completionTokens;
      totalTokens += result.totalTokens;
      console.log(
        `[${i + 1}/${rows.length}] ${Math.round(overallFromFields(fields) * 100)}% · ${result.latencyMs}ms · style=${fields.style} guests=${fields.guests} extras=${fields.extras.toFixed(2)}`,
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

  const avgTokensPer = rows.length > 0 ? totalTokens / rows.length : 0;
  // Placeholder until published $/token is known — leave null for manual fill.
  const costPer1000: number | null = null;

  const report = {
    model: PARSE_MODEL,
    ranAt: new Date().toISOString(),
    n: rows.length,
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
    totalTokens,
    promptTokens,
    completionTokens,
    avgTokensPerExample: avgTokensPer,
    costPer1000,
    notes:
      "Provider column on /stats. Fill costPer1000 from published token price × avgTokensPerExample × 1000.",
  };

  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nWrote ${outPath}`);
  console.log(
    `overall=${(report.accuracy.overall * 100).toFixed(1)}% median=${report.medianLatencyMs}ms tokens=${totalTokens}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
