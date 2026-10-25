import { isTight } from "@/lib/feasibility";
import type { FeasibilityStatus } from "@/lib/types";

const LABEL: Record<FeasibilityStatus, string> = {
  fits: "Fits",
  warning: "Needs a change",
  cannot: "Can't host",
};

const COLOR: Record<FeasibilityStatus, string> = {
  fits: "#0d8f6a",
  warning: "#9a6b00",
  cannot: "#c0392b",
};

type Props = {
  status?: FeasibilityStatus;
  used?: number;
  capacity?: number;
};

export function StatusChip({ status, used, capacity }: Props) {
  if (!status) {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted)]">
        Not processed
      </span>
    );
  }

  const color = COLOR[status];
  const tight =
    status === "fits" &&
    used != null &&
    capacity != null &&
    isTight(used, capacity);

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
      {tight && (
        <span style={{ color: COLOR.warning }} aria-label="near capacity">
          · tight
        </span>
      )}
    </span>
  );
}
