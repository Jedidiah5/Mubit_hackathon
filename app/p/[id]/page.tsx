import { Suspense } from "react";
import { PlanClient } from "./PlanClient";

export default function PublicPlanPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[color:var(--background)] text-[color:var(--ink)]">
          <p className="font-mono text-sm text-[color:var(--muted)]">
            Loading floor plan…
          </p>
        </main>
      }
    >
      <PlanClient />
    </Suspense>
  );
}
