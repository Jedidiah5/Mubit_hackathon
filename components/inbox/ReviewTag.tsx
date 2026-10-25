type Props = {
  parsed: boolean;
  approvedAt?: string | null;
  /** The email is missing details a quote needs (lib/missing). */
  needsInfo?: boolean;
};

/** Second line under the status chip: has a person signed this draft off? */
export function ReviewTag({ parsed, approvedAt, needsInfo }: Props) {
  if (!parsed) return null;
  if (approvedAt) {
    return (
      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted)]">
        ✓ Approved
      </span>
    );
  }
  return needsInfo ? (
    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--cannot)]">
      Needs info
    </span>
  ) : (
    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--warning)]">
      Needs review
    </span>
  );
}
