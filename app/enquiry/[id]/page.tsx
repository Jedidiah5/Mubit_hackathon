import { Suspense } from "react";
import { EnquiryClient } from "./EnquiryClient";

export default function EnquiryPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] text-[color:var(--ink)]">
          <p className="font-mono text-sm text-[color:var(--ink)]/50">Loading enquiry…</p>
        </main>
      }
    >
      <EnquiryClient />
    </Suspense>
  );
}
