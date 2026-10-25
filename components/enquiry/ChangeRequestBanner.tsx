"use client";

import { useState } from "react";
import type { ChangeRequest, Extra, Spec, SpecChange } from "@/lib/types";

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
  onDismiss: (replyNote: string) => void;
  busy?: boolean;
};

function formatVal(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "none";
    return value
      .map((v) => (typeof v === "string" ? (EXTRA_LABEL[v as Extra] ?? v) : String(v)))
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function formatDiffLine(c: SpecChange): string {
  return `${c.field}: ${formatVal(c.from)} → ${formatVal(c.to)}`;
}

function fallbackDiff(req: Spec, current: Spec): string[] {
  const bits: string[] = [];
  if (req.style !== current.style) {
    bits.push(`style: ${current.style} → ${req.style}`);
  }
  if (req.guests !== current.guests) {
    bits.push(`guests: ${current.guests} → ${req.guests}`);
  }
  if (req.stage !== current.stage) {
    bits.push(`stage: ${current.stage} → ${req.stage}`);
  }
  if (req.bar !== current.bar) {
    bits.push(`bar: ${current.bar} → ${req.bar}`);
  }
  if (req.accessible !== current.accessible) {
    bits.push(
      `accessible: ${current.accessible ? "yes" : "no"} → ${req.accessible ? "yes" : "no"}`,
    );
  }
  const fromEx = [...current.extras].sort().join(",");
  const toEx = [...req.extras].sort().join(",");
  if (fromEx !== toEx) {
    bits.push(
      `extras: ${formatVal(current.extras)} → ${formatVal(req.extras)}`,
    );
  }
  return bits;
}

export function ChangeRequestBanner({
  changeRequest,
  current,
  onAccept,
  onDismiss,
  busy,
}: Props) {
  const [dismissOpen, setDismissOpen] = useState(false);
  const [replyNote, setReplyNote] = useState("");

  if (changeRequest.status !== "pending") return null;

  const bits =
    changeRequest.diff && changeRequest.diff.length > 0
      ? changeRequest.diff.map(formatDiffLine)
      : fallbackDiff(changeRequest.spec, current);

  const movedIds = Object.keys(changeRequest.overrides ?? {}).sort();

  return (
    <div className="nb-banner nb-banner-warn border-[3px] shadow-[4px_4px_0_0_#151515]">
      <p className="font-sans text-sm font-extrabold tracking-tight text-[color:var(--warning)] sm:text-base">
        {changeRequest.source === "ask"
          ? "Client asked the venue"
          : "Client requested changes"}
      </p>

      {bits.length > 0 && (
        <ul className="mt-2 space-y-1 font-mono text-[12px] font-bold text-[color:var(--ink)]">
          {bits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      {movedIds.length > 0 && (
        <p className="mt-2 font-mono text-[12px] font-bold text-[color:var(--ink)]">
          moved: {movedIds.join(", ")}
        </p>
      )}

      {changeRequest.note?.trim() && (
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-[color:var(--ink)]">
          Note: “{changeRequest.note.trim()}”
        </p>
      )}

      {!dismissOpen ? (
        <div className="mt-3 flex flex-wrap gap-2 [&>button]:grow">
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
            onClick={() => setDismissOpen(true)}
            className="nb-btn"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="nb-label">Optional reply to the client</span>
            <textarea
              rows={2}
              className="nb-input resize-y"
              placeholder="e.g. We can keep the stage on the north wall…"
              value={replyNote}
              onChange={(e) => setReplyNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 [&>button]:grow">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDismiss(replyNote.trim())}
              className="nb-btn nb-btn-red"
            >
              Confirm dismiss
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDismissOpen(false);
                setReplyNote("");
              }}
              className="nb-btn"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
