import type { FeasibilityStatus } from "@/lib/types";

const LABEL: Record<FeasibilityStatus, string> = {
  fits: "Fits",
  warning: "Needs a change",
  cannot: "Can't host",
};

const COLOR: Record<FeasibilityStatus, string> = {
  fits: "#4ade80",
  warning: "#fbbf24",
  cannot: "#f87171",
};

type Props = {
  status?: FeasibilityStatus;
};

export function StatusChip({ status }: Props) {
  if (!status) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#f4efe6]/55">
        Not processed
      </span>
    );
  }

  const color = COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]"
      style={{ color }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      {LABEL[status]}
    </span>
  );
}
