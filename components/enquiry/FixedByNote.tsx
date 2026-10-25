import Link from "next/link";
import { describeChange } from "@/lib/ripple";
import type { FixedBy } from "@/lib/types";

/** On a draft that /api/ripple re-parsed: which correction changed it. */
export function FixedByNote({ fixedBy }: { fixedBy: FixedBy }) {
  return (
    <div className="nb-banner nb-banner-ok backdrop-blur-md">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--fits)]">
        ↻ Updated by your correction
      </p>
      <p className="mt-1 text-xs text-[color:var(--ink)]">
        Re-drafted after you fixed{" "}
        <Link
          href={`/enquiry/${fixedBy.enquiryId}`}
          className="font-bold underline underline-offset-2"
        >
          {fixedBy.subject || "a similar enquiry"}
        </Link>
        :
      </p>
      <p className="mt-1 font-mono text-[11px] font-bold text-[color:var(--ink)]">
        {fixedBy.changes.map(describeChange).join(" · ")}
      </p>
    </div>
  );
}
