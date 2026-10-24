"use client";

import { useEffect, useId, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  subject: string;
  body: string;
};

export function DraftReplyModal({ open, onClose, subject, body }: Props) {
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

  const mailto = `mailto:?subject=${encodeURIComponent(`Re: ${subject}`)}&body=${encodeURIComponent(body)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col border border-[#f4efe6]/15 bg-[#0a0a0a] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2
            id={titleId}
            className="font-sans text-xl tracking-tight text-[#f4efe6]"
          >
            Draft reply
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.16em] text-[#f4efe6]/50 hover:text-[#c8ff00]"
          >
            Close
          </button>
        </div>

        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#f4efe6]/40">
          Template only · no LLM
        </p>

        <pre className="mb-5 flex-1 overflow-auto whitespace-pre-wrap border border-[#f4efe6]/12 bg-[#111] p-4 font-mono text-sm leading-relaxed text-[#f4efe6]/90">
          {body}
        </pre>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={copy}
            className="border border-[#c8ff00] px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[#c8ff00]"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={mailto}
            className="bg-[#c8ff00] px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[#0a0a0a]"
          >
            Open in mail
          </a>
        </div>
      </div>
    </div>
  );
}
