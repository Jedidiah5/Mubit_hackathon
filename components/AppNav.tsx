import Link from "next/link";

const LINKS = [
  { href: "/", label: "Inbox" },
  { href: "/setup", label: "Setup" },
  { href: "/stats", label: "Stats" },
  { href: "/dev/scene", label: "Scene" },
] as const;

type Props = { current?: string };

export function AppNav({ current }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.16em]">
      <Link href="/" className="font-bold text-[color:var(--ink)]">
        BriefToFloor
      </Link>
      <span className="text-[color:var(--line)]">/</span>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            current === link.href
              ? "text-[color:var(--ink)]"
              : "text-[color:var(--muted)] hover:text-[color:var(--ink)]"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
