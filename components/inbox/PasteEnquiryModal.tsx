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
        className="w-full max-w-xl border border-[#f4efe6]/15 bg-[#0a0a0a] p-6 shadow-[0_0_0_1px_#c8ff0022]"
      >
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2
            id={titleId}
            className="font-sans text-xl tracking-tight text-[#f4efe6]"
          >
            Paste new enquiry
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-[0.16em] text-[#f4efe6]/50 hover:text-[#c8ff00]"
          >
            Close
          </button>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#f4efe6]/45">
            From
          </span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Name <email@example.com>"
            className="w-full border border-[#f4efe6]/15 bg-transparent px-3 py-2 font-sans text-sm text-[#f4efe6] outline-none placeholder:text-[#f4efe6]/25 focus:border-[#c8ff00]"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#f4efe6]/45">
            Subject
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Event enquiry"
            className="w-full border border-[#f4efe6]/15 bg-transparent px-3 py-2 font-sans text-sm text-[#f4efe6] outline-none placeholder:text-[#f4efe6]/25 focus:border-[#c8ff00]"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[#f4efe6]/45">
            Body
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            required
            placeholder="Paste the email body here…"
            className="w-full resize-y border border-[#f4efe6]/15 bg-transparent px-3 py-2 font-mono text-sm leading-relaxed text-[#f4efe6] outline-none placeholder:text-[#f4efe6]/25 focus:border-[#c8ff00]"
          />
        </label>

        {error && (
          <p className="mb-4 font-mono text-xs text-[#f87171]">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[#f4efe6]/55 hover:text-[#f4efe6]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-[#c8ff00] px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[#0a0a0a] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add to inbox"}
          </button>
        </div>
      </form>
    </div>
  );
}
