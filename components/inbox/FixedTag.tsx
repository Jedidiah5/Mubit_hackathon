import { describeChange } from "@/lib/ripple";
import type { FixedBy } from "@/lib/types";

/** Under the subject: this draft changed because a similar one was corrected. */
export function FixedTag({ fixedBy }: { fixedBy: FixedBy }) {
  const changes = fixedBy.changes.map(describeChange).join(" · ");
  return (
    <span
      className="btf-pop mt-1 block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--fits)]"
      title={`Re-parsed after your correction on "${fixedBy.subject}": ${changes}`}
    >
      ↻ Fixed by your correction · {changes}
    </span>
  );
}
