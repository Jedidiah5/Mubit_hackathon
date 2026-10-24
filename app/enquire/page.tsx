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
        console.warn("Parse failed:", data.error ?? res.status);
      }

      router.push(`/e/${ref.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit enquiry");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen text-[color:var(--ink)]">
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-12">
        <div className="nb-frame p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="nb-mark" aria-hidden>
              ✦
            </span>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                The Wharf Rooms
              </p>
              <h1 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl">
                Enquire about a date
              </h1>
            </div>
          </div>
          <p className="mb-6 font-mono text-xs leading-relaxed text-[color:var(--muted)]">
            Tell us what you&apos;re planning. We&apos;ll check rooms and send a
            proposal — usually within a day.
          </p>

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <label className="block">
              <span className="nb-label">Your name</span>
              <input
                required
                autoComplete="name"
                className="nb-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="nb-label">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                className="nb-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="nb-label">Event type</span>
              <select
                className="nb-input"
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="nb-label">Date</span>
                <input
                  type="date"
                  className="nb-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="nb-label">Approx guests</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  inputMode="numeric"
                  placeholder="e.g. 80"
                  className="nb-input"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="nb-label">Tell us about your event</span>
              <textarea
                required
                rows={5}
                placeholder="Sit-down dinner, dancing after, wheelchair access…"
                className="nb-input resize-y leading-relaxed"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            </label>

            {error && (
              <p className="nb-banner nb-banner-bad font-mono text-xs font-bold text-[color:var(--cannot)]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="nb-btn nb-btn-ink w-full"
            >
              {submitting ? "Sending…" : "Send enquiry"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-[color:var(--muted)]">
          <Link href="/" className="underline-offset-4 hover:underline">
            Venue staff? Open the inbox
          </Link>
        </p>
      </div>
    </main>
  );
}
