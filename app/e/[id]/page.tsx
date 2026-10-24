import { Suspense } from "react";
import { StatusClient } from "./StatusClient";

export default function OrganiserStatusPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] text-[color:var(--ink)]">
          <p className="font-mono text-sm text-[color:var(--muted)]">
            Loading your enquiry…
          </p>
        </main>
      }
    >
      <StatusClient />
    </Suspense>
  );
}
