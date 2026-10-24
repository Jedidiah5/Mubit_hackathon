import { MISSING_LABEL, needsInfo, type MissingDetail } from "@/lib/missing";
import type { Verdict } from "@/lib/types";

type Props = {
  approvedAt: string | null;
  verdict: Verdict | null;
  missing: MissingDetail[];
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tells the coordinator the spec is an AI draft until they approve it. */
export function ReviewBanner({ approvedAt, verdict, missing }: Props) {
  if (approvedAt) {
    return (
      <div className="border border-[color:var(--fits)]/30 bg-[color:var(--fits)]/8 px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fits)]">
          Approved by coordinator · {formatWhen(approvedAt)}
        </p>
        <p className="mt-1 text-xs text-[color:var(--muted)]">
          {verdict === "corrected"
            ? "Your fixes are saved and shape future drafts."
            : "Approved as drafted."}{" "}
          Any edit puts it back into review.
        </p>
      </div>
    );
  }

  if (needsInfo(missing)) {
    return (
      <div className="border border-[color:var(--cannot)]/30 bg-[color:var(--cannot)]/6 px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--cannot)]">
          Needs info · ask the client
        </p>
        <ul className="mt-1.5 space-y-0.5 text-xs text-[color:var(--ink)]">
          {missing.map((m) => (
            <li key={m}>· {MISSING_LABEL[m]}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-[color:var(--muted)]">
          The email doesn&apos;t say, so the fields below are a best guess.
          Send a follow-up before quoting.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[color:var(--warning)]/35 bg-[color:var(--warning)]/8 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--warning)]">
        Needs review · AI draft
      </p>
      <p className="mt-1 text-xs text-[color:var(--muted)]">
        Drafted from the email. Check each field before approving. Every fix
        teaches the next draft.
      </p>
      {missing.includes("date") && (
        <p className="mt-1 text-xs text-[color:var(--ink)]">
          Not in the email: date. The reply will ask for it.
        </p>
      )}
    </div>
  );
}
