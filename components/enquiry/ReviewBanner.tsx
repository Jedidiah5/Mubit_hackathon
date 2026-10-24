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

export function ReviewBanner({ approvedAt, verdict, missing }: Props) {
  if (approvedAt) {
    return (
      <div className="nb-banner nb-banner-ok">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--fits)]">
          Approved · {formatWhen(approvedAt)}
        </p>
        <p className="mt-1 text-xs text-[color:var(--ink)]">
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
      <div className="nb-banner nb-banner-bad">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--cannot)]">
          Needs info · ask the client
        </p>
        <ul className="mt-1.5 space-y-0.5 text-xs font-medium text-[color:var(--ink)]">
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
    <div className="nb-banner nb-banner-warn">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--warning)]">
        Needs review · AI draft
      </p>
      <p className="mt-1 text-xs text-[color:var(--ink)]">
        Drafted from the email. Check each field before approving. Every fix
        teaches the next draft.
      </p>
      {missing.includes("date") && (
        <p className="mt-1 text-xs font-medium text-[color:var(--ink)]">
          Not in the email: date. The reply will ask for it.
        </p>
      )}
    </div>
  );
}
