"use client";

import { addDoc, collection } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getDb } from "@/lib/firebase";

const EVENT_TYPES = [
  "Wedding",
  "Corporate",
  "Birthday",
  "Awards",
  "Workshop",
  "Networking",
  "Other",
] as const;

const fieldClass =
  "w-full border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-3 font-mono text-sm text-[color:var(--ink)] outline-none focus:border-[color:var(--ink)]";
const labelClass =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]";

export default function EnquirePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] =
    useState<(typeof EVENT_TYPES)[number]>("Wedding");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("");
  const [about, setAbout] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedAbout = about.trim();
    if (!trimmedAbout) {
      setError("Tell us about your event — a few sentences is enough.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const guestN = Number.parseInt(guests, 10);
    const guestLine = Number.isFinite(guestN)
      ? `Approx guests: ${guestN}`
      : guests.trim()
        ? `Approx guests: ${guests.trim()}`
        : "Approx guests: not specified";
    const dateLine = date ? `Preferred date: ${date}` : "Preferred date: flexible";
    const body = [
      `Event type: ${eventType}`,
      dateLine,
      guestLine,
      "",
      trimmedAbout,
      "",
      `— ${name.trim()} <${email.trim()}>`,
    ].join("\n");

    try {
      const ref = await addDoc(collection(getDb(), "enquiries"), {
        from: `${name.trim()} <${email.trim()}>`,
        email: email.trim(),
        subject: `${eventType} enquiry`,
        body,
        eventType,
        eventDate: date || null,
        receivedAt: new Date().toISOString(),
        source: "form",
        status: "received",
      });

      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body, enquiryId: ref.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        // Doc exists — still send them to the status page; venue can re-parse.
        console.warn("Parse failed:", data.error ?? res.status);
      }

      router.push(`/e/${ref.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit enquiry");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto w-full max-w-lg px-5 py-10 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
          The Wharf Rooms
        </p>
        <h1 className="mt-2 font-sans text-3xl tracking-tight">
          Enquire about a date
        </h1>
        <p className="mt-2 font-mono text-xs leading-relaxed text-[color:var(--muted)]">
          Tell us what you&apos;re planning. We&apos;ll check rooms and send a
          proposal — usually within a day.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-5">
          <label className="block">
            <span className={labelClass}>Your name</span>
            <input
              required
              autoComplete="name"
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Event type</span>
            <select
              className={fieldClass}
              value={eventType}
              onChange={(e) =>
                setEventType(e.target.value as (typeof EVENT_TYPES)[number])
              }
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Date</span>
              <input
                type="date"
                className={fieldClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Approx guests</span>
              <input
                type="number"
                min={1}
                max={1000}
                inputMode="numeric"
                placeholder="e.g. 80"
                className={fieldClass}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Tell us about your event</span>
            <textarea
              required
              rows={5}
              placeholder="Sit-down dinner, dancing after, wheelchair access…"
              className={`${fieldClass} resize-y leading-relaxed`}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
            />
          </label>

          {error && (
            <p className="border border-[color:var(--cannot)]/40 bg-[color:var(--cannot)]/10 px-3 py-2 font-mono text-xs text-[color:var(--cannot)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[color:var(--ink)] px-4 py-3.5 font-mono text-xs uppercase tracking-[0.16em] text-[color:var(--panel-2)] transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send enquiry"}
          </button>
        </form>

        <p className="mt-8 text-center font-mono text-[11px] text-[color:var(--muted)]">
          <Link href="/" className="underline-offset-4 hover:underline">
            Venue staff? Open the inbox
          </Link>
        </p>
      </div>
    </main>
  );
}
