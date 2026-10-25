"use client";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import adapterResults from "@/data/adapter-results.json";
import evalResults from "@/data/eval-results.json";
import { PageHeader, PageShell } from "@/components/PageHeader";
import { isCorrection } from "@/lib/corrections";
import { getDb } from "@/lib/firebase";
import type { Correction } from "@/lib/types";

type CorrectionRow = Correction & { id: string };

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function ms(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n)} ms`;
}

type EvalRun = {
  mode: "plain" | "notes" | "rules";
  ranAt: string;
  n: number;
  exact: number;
  accuracy: { overall: number };
  medianLatencyMs: number;
  avgNotes: number;
};

type AdapterRun = {
  label: string;
  base?: string;
  exact: number | null;
  accuracy: number | null;
  medianLatencyMs: number | null;
  /** Mubit's own grade (how closely it matches GPT), copied from the console. */
  grade?: { quality: number; target: number; testCases: number; status: string };
};

/** The held-out set built around the venue's house rules. */
const EVAL_SET = "test-house";

const EVAL_ROWS: { mode: EvalRun["mode"]; label: string; hint: string }[] = [
  { mode: "plain", label: "GPT, no corrections", hint: "frozen prompt, email only" },
  { mode: "notes", label: "GPT + coordinator corrections", hint: "what the app sends today" },
  { mode: "rules", label: "GPT + rules written in the prompt", hint: "baseline: someone writes the rules down" },
];

const evalRuns =
  (evalResults as { sets: Record<string, Partial<Record<EvalRun["mode"], EvalRun>>> })
    .sets[EVAL_SET] ?? {};
const adapterRuns = adapterResults as AdapterRun[];

function NotTested() {
  return (
    <span className="font-mono text-[11px] text-[color:var(--muted)]">not tried yet</span>
  );
}

/** Mubit's grade bar, like the console's: quality vs the pass mark. */
function AdapterGrade({ grade }: { grade: NonNullable<AdapterRun["grade"]> }) {
  const passed = grade.quality >= grade.target;
  return (
    <span className="mt-2 block max-w-md font-normal">
      <span className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
        <span>
          Mubit grade{" "}
          <span className="font-sans text-base font-bold">{pct(grade.quality)}</span>{" "}
          matches GPT on {grade.testCases} test cases
        </span>
        <span className="text-[color:var(--muted)]">pass {pct(grade.target)}</span>
      </span>
      <span className="relative mt-1 block h-2.5 rounded-full border-2 border-[color:var(--ink)] bg-[color:var(--panel-snow)]">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${grade.quality * 100}%`,
            background: passed ? "var(--fits)" : "var(--warning)",
          }}
        />
        <span
          className="absolute -inset-y-1 w-0.5 bg-[color:var(--ink)]"
          style={{ left: `${grade.target * 100}%` }}
        />
      </span>
      <span
        className="mt-1 block font-mono text-[11px]"
        style={{ color: passed ? "var(--fits)" : "var(--warning)" }}
      >
        {grade.status}
      </span>
    </span>
  );
}

function fmtVal(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.join(", ") || "∅";
  if (v == null) return "—";
  return String(v);
}

export default function StatsPage() {
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    // Same window as the parse call reads; legacy per-keystroke rows are skipped.
    const unsub = onSnapshot(
      query(collection(db, "corrections"), orderBy("at", "desc"), limit(200)),
      (snap) => {
        const rows = snap.docs.flatMap((d) => {
          const data = d.data();
          return isCorrection(data) && data.changes.length > 0
            ? [{ id: d.id, ...data }]
            : [];
        });
        setCount(rows.length);
        setCorrections(rows.slice(0, 20));
      },
      (err) => setError(err.message),
    );
    return unsub;
  }, []);

  const lastRun = Object.values(evalRuns)
    .map((r) => r.ranAt)
    .sort()
    .at(-1);

  return (
    <PageShell>
        <PageHeader
          current="/stats"
          title="Stats"
          subtitle={
            <>
              Does correcting the drafts make them right?
              {lastRun
                ? ` · eval ${new Date(lastRun).toLocaleString("en-GB")}`
                : " · run npm run eval"}
            </>
          }
        />

        {error && (
          <p className="nb-banner nb-banner-bad mb-6 font-mono text-xs font-bold text-[color:var(--cannot)]">
            {error}
          </p>
        )}

        <section className="nb-panel mb-8 overflow-x-auto p-4 sm:p-5">
          <h2 className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Held-out emails that depend on house rules
          </h2>
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[color:var(--ink)] font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <th className="py-2 pr-4 font-normal">Setup</th>
                <th className="py-2 pr-4 text-right font-normal">All fields right</th>
                <th className="py-2 pr-4 text-right font-normal">Field accuracy</th>
                <th className="py-2 text-right font-normal">Median latency</th>
              </tr>
            </thead>
            <tbody className="font-sans">
              {EVAL_ROWS.map(({ mode, label, hint }) => {
                const run = evalRuns[mode];
                return (
                  <tr key={mode} className="border-b border-[color:var(--ink)]/20">
                    <td className="py-3 pr-4 font-bold">
                      {label}
                      <span className="block font-mono text-[11px] font-normal text-[color:var(--muted)]">
                        {hint}
                        {run && mode === "notes"
                          ? ` · ${run.avgNotes.toFixed(1)} notes per email`
                          : ""}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{pct(run?.exact)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums">
                      {pct(run?.accuracy.overall)}
                    </td>
                    <td className="py-3 text-right tabular-nums">{ms(run?.medianLatencyMs)}</td>
                  </tr>
                );
              })}
              {adapterRuns.map((a) => (
                <tr key={a.label} className="border-b border-[color:var(--ink)]/20">
                  <td className="py-3 pr-4 font-bold">
                    {a.label}
                    {a.base ? ` · ${a.base}` : ""}
                    <span className="block font-mono text-[11px] font-normal text-[color:var(--muted)]">
                      trained by Mubit on the kept answers · no notes
                    </span>
                    {a.grade && <AdapterGrade grade={a.grade} />}
                  </td>
                  <td className="py-3 pr-4 text-right align-top tabular-nums">
                    {a.exact == null ? <NotTested /> : pct(a.exact)}
                  </td>
                  <td className="py-3 pr-4 text-right align-top tabular-nums">
                    {a.accuracy == null ? <NotTested /> : pct(a.accuracy)}
                  </td>
                  <td className="py-3 text-right align-top tabular-nums">{ms(a.medianLatencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3 font-mono text-[11px] text-[color:var(--muted)]">
            n={Object.values(evalRuns)[0]?.n ?? 0} · guests within ±5% · eval
            calls are never recorded as training data · adapter rows from
            data/adapter-results.json
          </p>
        </section>

        <section className="nb-panel p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Corrections
            </h2>
            <p className="font-mono text-xs text-[color:var(--muted)]">
              {count == null ? "…" : `${count} enquiries corrected`} · latest 20
            </p>
          </div>

          {corrections.length === 0 ? (
            <p className="font-mono text-sm text-[color:var(--muted)]">
              No corrections yet. Edit a spec on an enquiry to log one.
            </p>
          ) : (
            <ul className="divide-y-2 divide-[color:var(--ink)] border-y-2 border-[color:var(--ink)]">
              {corrections.map((c) => (
                <li
                  key={c.id}
                  className="grid gap-1 px-1 py-3 font-mono text-xs sm:grid-cols-[1fr_auto]"
                >
                  <span className="min-w-0 text-[color:var(--ink)]/70">
                    <span className="mb-1 block truncate font-sans text-[13px] font-bold text-[color:var(--ink)]">
                      {c.email}
                    </span>
                    {c.changes.map((ch) => (
                      <span key={ch.field} className="block">
                        <span className="inline-block w-24 text-[color:var(--ink)]">
                          {ch.field}
                        </span>
                        <span className="text-[color:var(--cannot)]">{fmtVal(ch.from)}</span>
                        {" → "}
                        <span className="text-[color:var(--fits)]">{fmtVal(ch.to)}</span>
                      </span>
                    ))}
                    <span className="mt-0.5 block text-[10px] text-[color:var(--muted)]">
                      {c.enquiryId}
                      {c.requestId ? ` · ${c.requestId}` : ""}
                    </span>
                  </span>
                  <span className="text-[color:var(--muted)] sm:text-right">
                    {c.at
                      ? new Date(c.at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
    </PageShell>
  );
}
