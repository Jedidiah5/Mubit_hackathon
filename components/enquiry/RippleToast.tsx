"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  describeChange,
  type RippleFix,
  type RippleResponse,
} from "@/lib/ripple";

type Target = { id: string; subject: string };

export type RippleState =
  | { phase: "idle" }
  | { phase: "finding" }
  | { phase: "running"; targets: Target[] }
  | { phase: "done"; checked: number; fixed: RippleFix[]; failed: number }
  | { phase: "error"; message: string };

async function callRipple(payload: object): Promise<RippleResponse> {
  const res = await fetch("/api/ripple", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as RippleResponse & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Ripple failed (${res.status})`);
  return data;
}

/**
 * "Teach once, fixes everywhere": after approving a corrected enquiry, list
 * the similar waiting ones (no LLM), then re-parse them with the new note.
 */
export function useRipple(enquiryId: string) {
  const [state, setState] = useState<RippleState>({ phase: "idle" });

  const start = useCallback(async () => {
    setState({ phase: "finding" });
    try {
      const preview = await callRipple({ enquiryId, dryRun: true });
      if (preview.targets.length === 0) {
        setState({ phase: "done", checked: 0, fixed: [], failed: 0 });
        return;
      }
      setState({ phase: "running", targets: preview.targets });
      const result = await callRipple({
        enquiryId,
        ids: preview.targets.map((t) => t.id),
      });
      setState({ phase: "done", ...result });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Ripple failed",
      });
    }
  }, [enquiryId]);

  const dismiss = useCallback(() => setState({ phase: "idle" }), []);

  return { state, start, dismiss };
}

/** Bottom-left, above the draft reply modal, so the coordinator sees it land. */
export function RippleToast({
  state,
  onDismiss,
}: {
  state: RippleState;
  onDismiss: () => void;
}) {
  const quiet = state.phase === "done" && state.checked === 0;

  // Nothing similar waiting: say so briefly, then get out of the way.
  useEffect(() => {
    if (!quiet) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [quiet, onDismiss]);

  if (state.phase === "idle") return null;

  let title: string;
  let body: ReactNode = null;
  let tone = "text-[color:var(--warning)]";

  if (state.phase === "finding") {
    title = "Looking for similar waiting enquiries…";
  } else if (state.phase === "running") {
    const n = state.targets.length;
    title = `Checking ${n} similar enquir${n === 1 ? "y" : "ies"} with your fix…`;
    body = (
      <ul className="mt-2 space-y-1">
        {state.targets.map((t) => (
          <li key={t.id} className="animate-pulse truncate text-xs text-[color:var(--muted)]">
            · {t.subject}
          </li>
        ))}
      </ul>
    );
  } else if (state.phase === "error") {
    title = "Couldn't check similar enquiries";
    body = <p className="mt-1 text-xs text-[color:var(--muted)]">{state.message}</p>;
    tone = "text-[color:var(--cannot)]";
  } else if (state.checked === 0) {
    title = "No similar enquiries waiting";
    tone = "text-[color:var(--muted)]";
  } else {
    const n = state.fixed.length;
    const rest = state.checked - n - state.failed;
    tone = n > 0 ? "text-[color:var(--fits)]" : "text-[color:var(--muted)]";
    title =
      n > 0
        ? `Your fix updated ${n} waiting enquir${n === 1 ? "y" : "ies"}`
        : rest > 0
          ? `Checked ${state.checked} similar · already matched your fix`
          : "Couldn't re-check similar enquiries";
    body = (
      <>
        {n > 0 && (
          <ul className="mt-2 space-y-1.5">
            {state.fixed.map((f) => (
              <li key={f.id} className="text-xs">
                <Link
                  href={`/enquiry/${f.id}`}
                  className="block truncate text-[color:var(--ink)] underline-offset-2 hover:underline"
                >
                  {f.subject}
                </Link>
                <span className="block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--fits)]">
                  {f.changes.map(describeChange).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(rest > 0 || state.failed > 0) && n > 0 && (
          <p className="mt-2 font-mono text-[10px] text-[color:var(--muted)]">
            {rest > 0 ? `${rest} already matched` : ""}
            {rest > 0 && state.failed > 0 ? " · " : ""}
            {state.failed > 0 ? `${state.failed} failed` : ""}
          </p>
        )}
        {n === 0 && state.failed > 0 && (
          <p className="mt-1 font-mono text-[10px] text-[color:var(--muted)]">
            {state.failed} failed
          </p>
        )}
      </>
    );
  }

  return (
    <div
      role="status"
      className="btf-pop fixed bottom-4 left-4 z-[60] w-[min(22rem,calc(100vw-2rem))] border border-[color:var(--line)] bg-[color:var(--panel-2)] px-4 py-3 shadow-[0_12px_40px_rgba(29,36,51,0.18)]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${tone}`}>
          {title}
        </p>
        {(state.phase === "done" || state.phase === "error") && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="font-mono text-xs text-[color:var(--muted)] hover:text-[color:var(--ink)]"
          >
            ×
          </button>
        )}
      </div>
      {body}
    </div>
  );
}
