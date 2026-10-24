import type { Extra, Room, Spec } from "./types";

export const VAT_RATE = 0.2;

export type QuoteLine = {
  label: string;
  amount: number;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  vat: number;
  total: number;
  belowMinSpend: boolean;
  minSpendTopUp: number;
};

const EXTRA_LABEL: Record<Exclude<Extra, "buffet">, string> = {
  dance_floor: "Dance floor",
  dj_booth: "DJ booth",
  photo_booth: "Photo booth",
  projector: "Projector",
  lectern: "Lectern",
};

const STYLE_LABEL: Record<Spec["style"], string> = {
  banquet: "Banquet",
  cabaret: "Cabaret",
  theatre: "Theatre",
  reception: "Reception",
};

/** Round to the nearest penny. */
export function gbp(n: number): number {
  return Math.round(n * 100) / 100;
}

/** en-GB currency string, e.g. "£1,234.00". */
export function formatGbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(gbp(n));
}

/**
 * Instant quote from room tariff + spec. Pure code, no LLM.
 * Amounts are £ ex-VAT until `vat` / `total`.
 */
export function quote(room: Room, spec: Spec): Quote {
  const p = room.pricing;
  const lines: QuoteLine[] = [];

  lines.push({ label: "Room hire", amount: gbp(p.hireFee) });

  const perHead = p.perHead[spec.style];
  const catering = gbp(perHead * spec.guests);
  lines.push({
    label: `${STYLE_LABEL[spec.style]} catering × ${spec.guests} @ ${formatGbp(perHead)}`,
    amount: catering,
  });

  for (const extra of spec.extras) {
    if (extra === "buffet") {
      const rate = p.extras.buffet_per_head;
      const amount = gbp(rate * spec.guests);
      if (amount === 0) continue;
      lines.push({
        label: `Buffet × ${spec.guests} @ ${formatGbp(rate)}`,
        amount,
      });
      continue;
    }
    const amount = gbp(p.extras[extra]);
    if (amount === 0) continue;
    lines.push({ label: EXTRA_LABEL[extra], amount });
  }

  let subtotal = gbp(lines.reduce((s, l) => s + l.amount, 0));
  let minSpendTopUp = 0;
  let belowMinSpend = false;

  if (subtotal < p.minSpend) {
    belowMinSpend = true;
    minSpendTopUp = gbp(p.minSpend - subtotal);
    lines.push({ label: "Minimum spend top-up", amount: minSpendTopUp });
    subtotal = gbp(subtotal + minSpendTopUp);
  }

  const vat = gbp(subtotal * VAT_RATE);
  const total = gbp(subtotal + vat);

  return { lines, subtotal, vat, total, belowMinSpend, minSpendTopUp };
}
