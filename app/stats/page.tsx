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
import { AppNav } from "@/components/AppNav";
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

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${n.toFixed(2)}`;
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

  const providerAcc = evalResults.accuracy?.overall ?? null;
  const providerLatency = evalResults.medianLatencyMs ?? null;
  const providerCost = evalResults.costPer1000 ?? null;

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8">
        <header className="mb-10 space-y-4 border-b border-[color:var(--line)] pb-6">
          <AppNav current="/stats" />
          <div>
            <h1 className="font-sans text-3xl tracking-tight">Stats</h1>
            <p className="mt-2 font-mono text-xs text-[color:var(--ink)]/45">
              Track 2 · provider vs adapter
              {evalResults.ranAt
                ? ` · eval ${new Date(evalResults.ranAt).toLocaleString("en-GB")}`
                : " · run npm run eval"}
            </p>
          </div>
        </header>

        {error && (
          <p className="mb-6 border border-[color:var(--cannot)]/40 bg-[color:var(--cannot)]/10 px-4 py-3 font-mono text-xs text-[color:var(--cannot)]">
            {error}
          </p>
        )}

        <section className="mb-12 overflow-x-auto">
          <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink)]">
            Track 2 proof
          </h2>
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--line)] font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink)]/40">
                <th className="py-2 pr-4 font-normal">Metric</th>
                <th className="py-2 pr-4 font-normal">
                  Provider ({evalResults.model ?? "gpt-6-luna"})
                </th>
                <th className="py-2 font-normal">
                  {adapterResults.label ?? "Our adapter"}
                </th>
              </tr>
            </thead>
            <tbody className="font-sans">
              <tr className="border-b border-[color:var(--line)]">
                <td className="py-3 pr-4 font-mono text-xs text-[color:var(--ink)]/55">
                  Accuracy on the test set
                </td>
                <td className="py-3 pr-4 tabular-nums">{pct(providerAcc)}</td>
                <td className="py-3 tabular-nums">
                  {pct(adapterResults.accuracy)}
                </td>
              </tr>
              <tr className="border-b border-[color:var(--line)]">
                <td className="py-3 pr-4 font-mono text-xs text-[color:var(--ink)]/55">
                  Median latency
                </td>
                <td className="py-3 pr-4 tabular-nums">
                  {ms(providerLatency)}
                </td>
                <td className="py-3 tabular-nums">
                  {ms(adapterResults.medianLatencyMs)}
                </td>
              </tr>
              <tr className="border-b border-[color:var(--line)]">
                <td className="py-3 pr-4 font-mono text-xs text-[color:var(--ink)]/55">
                  Cost per 1,000 enquiries
                </td>
                <td className="py-3 pr-4 tabular-nums">
                  {money(providerCost)}
                </td>
                <td className="py-3 tabular-nums">
                  {money(adapterResults.costPer1000)}
                </td>
              </tr>
            </tbody>
          </table>

          {evalResults.accuracy && evalResults.n > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] text-[color:var(--ink)]/45 sm:grid-cols-3 md:grid-cols-6">
              {(
                [
                  ["style", evalResults.accuracy.style],
                  ["stage", evalResults.accuracy.stage],
                  ["bar", evalResults.accuracy.bar],
                  ["access", evalResults.accuracy.accessible],
                  ["guests", evalResults.accuracy.guests],
                  ["extras", evalResults.accuracy.extras],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="border border-[color:var(--line)] px-2 py-2">
                  <div className="uppercase tracking-[0.12em]">{k}</div>
                  <div className="mt-1 text-[color:var(--ink)]">{pct(v)}</div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 font-mono text-[11px] text-[color:var(--ink)]/35">
            n={evalResults.n ?? 0}
            {evalResults.totalTokens != null
              ? ` · ${evalResults.totalTokens} tokens`
              : ""}
            {" · "}
            adapter values from data/adapter-results.json
          </p>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink)]">
              Corrections
            </h2>
            <p className="font-mono text-xs text-[color:var(--ink)]/45">
              {count == null ? "…" : `${count} enquiries corrected`} · latest 20
            </p>
          </div>

          {corrections.length === 0 ? (
            <p className="font-mono text-sm text-[color:var(--ink)]/40">
              No corrections yet. Edit a spec on an enquiry to log one.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--line)] border-y border-[color:var(--line)]">
              {corrections.map((c) => (
                <li
                  key={c.id}
                  className="grid gap-1 px-1 py-3 font-mono text-xs sm:grid-cols-[1fr_auto]"
                >
                  <span className="min-w-0 text-[color:var(--ink)]/70">
                    <span className="mb-1 block truncate font-sans text-[13px] text-[color:var(--ink)]">
                      {c.email}
                    </span>
                    {c.changes.map((ch) => (
                      <span key={ch.field} className="block">
                        <span className="inline-block w-24 text-[color:var(--ink)]">
                          {ch.field}
                        </span>
                        <span className="text-[color:var(--cannot)]">{fmtVal(ch.from)}</span>
                        {" → "}
                        <span className="text-[#4ade80]">{fmtVal(ch.to)}</span>
                      </span>
                    ))}
                    <span className="mt-0.5 block text-[10px] text-[color:var(--ink)]/35">
                      {c.enquiryId}
                      {c.requestId ? ` · ${c.requestId}` : ""}
                    </span>
                  </span>
                  <span className="text-[color:var(--ink)]/35 sm:text-right">
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
      </div>
    </main>
  );
}
