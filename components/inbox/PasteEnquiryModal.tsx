"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useId, useState } from "react";
import { getDb } from "@/lib/firebase";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PasteEnquiryModal({ open, onClose }: Props) {
  const titleId = useId();
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("Paste the enquiry body.");
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(getDb(), "enquiries"), {
        from: from.trim() || "Unknown sender",
        subject: subject.trim() || "(no subject)",
        body: body.trim(),
        receivedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
        source: "paste",
        status: "received",
      });
      setFrom("");
      setSubject("");
      setBody("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-xl border border-[color:var(--line)] bg-[color:var(--panel-2)] p-6 shadow-[0_12px_40px_rgba(29,36,51,0.12)]"
      >
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2
            id={titleId}
            className="font-sans text-xl tracking-tight text-[color:var(--ink)]"
          >
            Paste new enquiry
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--ink)]/50 hover:text-[color:var(--ink)]"
          >
            Close
          </button>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/45">
            From
          </span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Name <email@example.com>"
            className="w-full border border-[color:var(--line)] bg-transparent px-3 py-2 font-sans text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink)]/25 focus:border-[color:var(--ink)]"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/45">
            Subject
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Event enquiry"
            className="w-full border border-[color:var(--line)] bg-transparent px-3 py-2 font-sans text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink)]/25 focus:border-[color:var(--ink)]"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/45">
            Body
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            required
            placeholder="Paste the email body here…"
            className="w-full resize-y border border-[color:var(--line)] bg-transparent px-3 py-2 font-mono text-sm leading-relaxed text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink)]/25 focus:border-[color:var(--ink)]"
          />
        </label>

        {error && (
          <p className="mb-4 font-mono text-xs text-[color:var(--cannot)]">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--ink)]/55 hover:text-[color:var(--ink)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-[color:var(--ink)] px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add to inbox"}
          </button>
        </div>
      </form>
    </div>
  );
}
