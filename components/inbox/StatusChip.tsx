import { isTight } from "@/lib/feasibility";
import type { FeasibilityStatus } from "@/lib/types";

const LABEL: Record<FeasibilityStatus, string> = {
  fits: "Fits",
  warning: "Needs a change",
  cannot: "Can't host",
};

const CHIP: Record<FeasibilityStatus, string> = {
  fits: "nb-chip nb-chip-teal",
  warning: "nb-chip nb-chip-yellow",
  cannot: "nb-chip nb-chip-red",
};

type Props = {
  status?: FeasibilityStatus;
  used?: number;
  capacity?: number;
};

export function StatusChip({ status, used, capacity }: Props) {
  if (!status) {
    return (
      <span className="nb-chip text-[color:var(--muted)]">Not processed</span>
    );
  }

  const tight =
    status === "fits" &&
    used != null &&
    capacity != null &&
    isTight(used, capacity);

  return (
    <span className={CHIP[status]}>
      {LABEL[status]}
      {tight && <span aria-label="near capacity">· tight</span>}
    </span>
  );
}
