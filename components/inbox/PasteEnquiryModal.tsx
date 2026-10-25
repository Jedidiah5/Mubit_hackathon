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
        className="nb-frame w-full max-w-xl p-5 sm:p-6"
      >
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2
            id={titleId}
            className="font-sans text-xl font-bold tracking-tight text-[color:var(--ink)]"
          >
            Paste new enquiry
          </h2>
          <button type="button" onClick={onClose} className="nb-chip">
            Close
          </button>
        </div>

        <label className="mb-4 block">
          <span className="nb-label">From</span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Name <email@example.com>"
            className="nb-input"
          />
        </label>

        <label className="mb-4 block">
          <span className="nb-label">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Event enquiry"
            className="nb-input"
          />
        </label>

        <label className="mb-5 block">
          <span className="nb-label">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            required
            placeholder="Paste the email body here…"
            className="nb-input resize-y leading-relaxed"
          />
        </label>

        {error && (
          <p className="nb-banner nb-banner-bad mb-4 font-mono text-xs font-bold text-[color:var(--cannot)]">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="nb-btn">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="nb-btn nb-btn-ink"
          >
            {saving ? "Saving…" : "Add to inbox"}
          </button>
        </div>
      </form>
    </div>
  );
}
