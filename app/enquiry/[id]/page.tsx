import { Suspense } from "react";
import { EnquiryClient } from "./EnquiryClient";

export default function EnquiryPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#f4efe6]">
          <p className="font-mono text-sm text-[#f4efe6]/50">Loading enquiry…</p>
        </main>
      }
    >
      <EnquiryClient />
    </Suspense>
  );
}
