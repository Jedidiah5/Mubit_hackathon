import Link from "next/link";
import { describeChange } from "@/lib/ripple";
import type { FixedBy } from "@/lib/types";

/** On a draft that /api/ripple re-parsed: which correction changed it. */
export function FixedByNote({ fixedBy }: { fixedBy: FixedBy }) {
  return (
    <div className="border border-[color:var(--fits)]/30 bg-[color:var(--fits)]/8 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fits)]">
        ↻ Updated by your correction
      </p>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Re-drafted after you fixed{" "}
        <Link
          href={`/enquiry/${fixedBy.enquiryId}`}
          className="text-[color:var(--ink)] underline-offset-2 hover:underline"
        >
          {fixedBy.subject || "a similar enquiry"}
        </Link>
        : {fixedBy.changes.map(describeChange).join(" · ")}.
      </p>
    </div>
  );
}
