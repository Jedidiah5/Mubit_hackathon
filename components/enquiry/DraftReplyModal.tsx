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
        className="flex max-h-[90vh] w-full max-w-xl flex-col border border-[color:var(--line)] bg-[color:var(--panel-2)] p-6 shadow-[0_12px_40px_rgba(29,36,51,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id={titleId}
            className="font-sans text-xl tracking-tight text-[color:var(--ink)]"
          >
            Draft reply
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--ink)]/50 hover:text-[color:var(--ink)]"
          >
            Close
          </button>
        </div>

        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/40">
          Template only · no LLM
        </p>

        <pre className="mb-5 flex-1 overflow-auto whitespace-pre-wrap border border-[color:var(--line)] bg-[color:var(--panel)] p-4 font-mono text-sm leading-relaxed text-[color:var(--ink)]">
          {body}
        </pre>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={copy}
            className="border border-[color:var(--ink)] px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--ink)]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={mailto}
            className="bg-[color:var(--ink)] px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)]"
          >
            Open in mail
          </a>
        </div>
      </div>
    </div>
  );
}
