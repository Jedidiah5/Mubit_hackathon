"use client";

import { useState } from "react";

const inputClass =
  "w-full border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-2.5 font-sans text-sm text-[color:var(--ink)] outline-none placeholder:text-[color:var(--ink)]/30 focus:border-[color:var(--ink)]";
const labelClass =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink)]/55";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Something went wrong (${res.status})`);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-10 border border-[color:var(--line)] bg-[color:var(--panel)] p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--fits)]">
          ✓ Enquiry sent
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          Thanks{name ? `, ${name.split(" ")[0]}` : ""}. Our events team will
          reply to <span className="font-mono">{email}</span> shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMessage("");
          }}
          className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--muted)] underline-offset-4 hover:underline"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
            autoComplete="email"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>About your event</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={5000}
          rows={8}
          placeholder="What's the occasion, roughly how many guests, and when? Anything we should plan for: speeches, dancing, a bar, step-free access…"
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </label>

      {/* Honeypot: off-screen for people, tempting for bots. */}
      <label className="absolute -left-[9999px]" aria-hidden="true">
        Website
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      {error && (
        <p className="font-mono text-xs text-[color:var(--cannot)]">{error}</p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full bg-[color:var(--ink)] px-4 py-3 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)] transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
      >
        {sending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
