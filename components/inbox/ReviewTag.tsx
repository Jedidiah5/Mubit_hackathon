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
    return <span className="nb-chip">✓ Approved</span>;
  }
  return needsInfo ? (
    <span className="nb-chip nb-chip-red">Needs info</span>
  ) : (
    <span className="nb-chip nb-chip-orange">Needs review</span>
  );
}
