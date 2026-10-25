"use client";

import type { ChangeRequest, Extra, Spec } from "@/lib/types";

const EXTRA_LABEL: Record<Extra, string> = {
  dance_floor: "Dance floor",
  dj_booth: "DJ booth",
  projector: "Projector",
  lectern: "Lectern",
  buffet: "Buffet",
  photo_booth: "Photo booth",
};

type Props = {
  changeRequest: ChangeRequest;
  current: Spec;
  onAccept: () => void;
  onDismiss: () => void;
  busy?: boolean;
};

function summarize(req: Spec, current: Spec): string[] {
  const bits: string[] = [];
  if (req.style !== current.style) bits.push(`Layout → ${req.style}`);
  if (req.guests !== current.guests) bits.push(`Guests → ${req.guests}`);
  if (req.stage !== current.stage) bits.push(`Stage → ${req.stage}`);
  if (req.bar !== current.bar) bits.push(`Bar → ${req.bar}`);
  if (req.accessible !== current.accessible) {
    bits.push(req.accessible ? "Accessible route on" : "Accessible route off");
  }
  const added = req.extras.filter((e) => !current.extras.includes(e));
  const removed = current.extras.filter((e) => !req.extras.includes(e));
  for (const e of added) bits.push(`+ ${EXTRA_LABEL[e] ?? e}`);
  for (const e of removed) bits.push(`− ${EXTRA_LABEL[e] ?? e}`);
  return bits;
}

export function ChangeRequestBanner({
  changeRequest,
  current,
  onAccept,
  onDismiss,
  busy,
}: Props) {
  if (changeRequest.status !== "pending") return null;

  const bits =
    changeRequest.diff && changeRequest.diff.length > 0
      ? changeRequest.diff.map((c) => {
          if (c.field === "extras") {
            return `Extras updated`;
          }
          return `${c.field}: ${String(c.from)} → ${String(c.to)}`;
        })
      : summarize(changeRequest.spec, current);
  const moved = Object.keys(changeRequest.overrides ?? {}).length;

  return (
    <div className="nb-banner nb-banner-warn">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--warning)]">
        Client change request
      </p>
      {bits.length > 0 && (
        <ul className="mt-2 space-y-0.5 font-mono text-[12px] font-bold text-[color:var(--ink)]">
          {bits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {moved > 0 && (
        <p className="mt-2 font-mono text-[12px] font-bold text-[color:var(--ink)]">
          Layout moves · {moved} piece{moved === 1 ? "" : "s"}
        </p>
      )}
      {changeRequest.note?.trim() && (
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-[color:var(--ink)]">
          “{changeRequest.note.trim()}”
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="nb-btn nb-btn-teal"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="nb-btn"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
