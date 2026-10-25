"use client";

import { formatGbp, type Quote } from "@/lib/quote";

type Props = {
  quote: Quote;
  roomName: string;
  compact?: boolean;
};

export function QuoteCard({ quote, roomName, compact = false }: Props) {
  if (compact) {
    return (
      <div className="nb-panel space-y-1.5 bg-[color:var(--panel-snow)]/92 p-3 backdrop-blur-md">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">
          Quote · {roomName}
        </p>
        <div className="flex items-baseline justify-between gap-2 rounded-[12px] bg-[color:var(--accent-3)] px-2.5 py-2">
          <span className="font-sans text-sm font-extrabold">Total</span>
          <span className="font-sans text-base font-extrabold tabular-nums">
            {formatGbp(quote.total)}
          </span>
        </div>
        <p className="font-mono text-[10px] text-[color:var(--muted)]">
          inc. VAT
          {quote.belowMinSpend
            ? ` · +${formatGbp(quote.minSpendTopUp)} min spend`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="nb-panel space-y-3 bg-[color:var(--panel-snow)]/92 p-4 backdrop-blur-md">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
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
            <span className="shrink-0 tabular-nums font-bold">
              {formatGbp(line.amount)}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t-2 border-[color:var(--ink)] pt-2 font-mono text-[12px]">
        <div className="flex justify-between gap-3 text-[color:var(--muted)]">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatGbp(quote.subtotal)}</span>
        </div>
        <div className="flex justify-between gap-3 text-[color:var(--muted)]">
          <span>VAT (20%)</span>
          <span className="tabular-nums">{formatGbp(quote.vat)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3 rounded-[var(--radius-sm)] bg-[color:var(--accent-3)] px-2.5 py-2 font-sans text-base font-bold text-[color:var(--ink)]">
          <span>Total</span>
          <span className="tabular-nums">{formatGbp(quote.total)}</span>
        </div>
      </div>

      {quote.belowMinSpend && (
        <p className="font-mono text-[11px] font-bold text-[color:var(--warning)]">
          Includes {formatGbp(quote.minSpendTopUp)} minimum-spend top-up
        </p>
      )}
    </div>
  );
}
