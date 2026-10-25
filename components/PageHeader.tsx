import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

type Props = {
  /** Active nav path, e.g. "/" | "/setup" | "/stats" */
  current: string;
  title: string;
  /** Mono line under the title */
  subtitle?: ReactNode;
  /** Extra lines under the subtitle (e.g. enquiry form URL) */
  meta?: ReactNode;
  /** Right-side actions — keeps header height consistent across pages */
  actions?: ReactNode;
};

/**
 * Shared shell header for Inbox / Setup / Stats — same frame, padding, type scale.
 */
export function PageHeader({
  current,
  title,
  subtitle,
  meta,
  actions,
}: Props) {
  return (
    <header className="nb-frame nb-frame-blue mb-6 space-y-5 p-4 sm:mb-8 sm:p-6">
      <AppNav current={current} />
      <div className="flex min-h-[7.5rem] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-3">
            <span className="nb-mark" aria-hidden>
              ✦
            </span>
            <h1 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="font-mono text-xs font-bold text-[color:var(--muted)]">
              {subtitle}
            </p>
          )}
          {meta}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {actions}
          </div>
        ) : (
          /* Reserve the action column so header height matches Inbox */
          <div className="hidden min-h-[3rem] w-full sm:block sm:w-[12.5rem]" aria-hidden />
        )}
      </div>
    </header>
  );
}

type ShellProps = {
  children: ReactNode;
};

/** Shared page width + padding for Inbox / Setup / Stats. */
export function PageShell({ children }: ShellProps) {
  return (
    <main className="min-h-screen text-[color:var(--ink)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-6 sm:px-8 sm:py-10">
        {children}
      </div>
    </main>
  );
}
