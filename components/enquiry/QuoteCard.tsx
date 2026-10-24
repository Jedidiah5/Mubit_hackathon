"use client";

import { formatGbp, type Quote } from "@/lib/quote";

type Props = {
  quote: Quote;
  roomName: string;
};

export function QuoteCard({ quote, roomName }: Props) {
  return (
    <div className="space-y-3 border border-[color:var(--line)] bg-[color:var(--panel)] p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Quote · {roomName}
      </p>

      <ul className="space-y-1.5 font-mono text-[12px]">
        {quote.lines.map((line) => (
          <li
            key={line.label}
            className="flex items-baseline justify-between gap-3 text-[color:var(--ink)]"
          >
            <span className="min-w-0 truncate text-[color:var(--muted)]">
              {line.label}
            </span>
            <span className="shrink-0 tabular-nums">{formatGbp(line.amount)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-[color:var(--line)] pt-2 font-mono text-[12px]">
        <div className="flex justify-between gap-3 text-[color:var(--muted)]">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatGbp(quote.subtotal)}</span>
        </div>
        <div className="flex justify-between gap-3 text-[color:var(--muted)]">
          <span>VAT (20%)</span>
          <span className="tabular-nums">{formatGbp(quote.vat)}</span>
        </div>
        <div className="flex justify-between gap-3 pt-1 font-sans text-base font-semibold text-[color:var(--ink)]">
          <span>Total</span>
          <span className="tabular-nums">{formatGbp(quote.total)}</span>
        </div>
      </div>

      {quote.belowMinSpend && (
        <p className="font-mono text-[11px] text-[color:var(--warning)]">
          Includes {formatGbp(quote.minSpendTopUp)} minimum-spend top-up
        </p>
      )}
    </div>
  );
}
