"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The enquiry's From header, e.g. "Sam <sam@example.com>". */
  to: string;
  subject: string;
  body: string;
};

/** Bare address from a From header; empty if there isn't a usable one. */
function replyAddress(from: string): string {
  const email = (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : "";
}

export function DraftReplyModal({ open, onClose, to, subject, body }: Props) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  async function copy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
  }

  const mailto = `mailto:${replyAddress(to)}?subject=${encodeURIComponent(`Re: ${subject}`)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="nb-frame flex max-h-[90vh] w-full max-w-xl flex-col p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id={titleId}
            className="font-sans text-xl font-bold tracking-tight text-[color:var(--ink)]"
          >
            Draft reply
          </h2>
          <button type="button" onClick={onClose} className="nb-chip">
            Close
          </button>
        </div>

        <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Template only · no LLM
        </p>

        <pre className="nb-panel mb-5 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed text-[color:var(--ink)]">
          {body}
        </pre>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button type="button" onClick={copy} className="nb-btn">
            {copied ? "Copied" : "Copy"}
          </button>
          <a href={mailto} className="nb-btn nb-btn-ink text-center">
            Open in mail
          </a>
        </div>
      </div>
    </div>
  );
}
