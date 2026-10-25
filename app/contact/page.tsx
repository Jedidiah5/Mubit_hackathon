import type { Metadata } from "next";
import { DEMO_VENUE } from "@/lib/data/venue";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: `Enquire · ${DEMO_VENUE.name}`,
  description: `Plan your event at ${DEMO_VENUE.name}.`,
};

/** Customer-facing: no coordinator nav, just the venue and the form. */
export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] text-[color:var(--ink)]">
      <div className="mx-auto flex w-full max-w-xl flex-col px-5 py-12 sm:px-8 sm:py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
          {DEMO_VENUE.name}
        </p>
        <h1 className="mt-3 font-sans text-3xl tracking-tight sm:text-4xl">
          Plan your event with us
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--muted)]">
          Weddings, parties, conferences, dinners. Tell us what you have in mind
          and our events team will come back to you with a room and a quote.
        </p>
        <ContactForm />
      </div>
    </main>
  );
}
