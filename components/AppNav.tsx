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
    <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Link
        href="/"
        className="nb-chip nb-chip-red !normal-case tracking-tight"
        style={{ fontFamily: "var(--font-sans)", fontSize: "12px" }}
      >
        BriefToFloor
      </Link>
      <div className="nb-tablist !shadow-none sm:!shadow-[var(--shadow-sm)]">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nb-tab no-underline ${
              current === link.href ? "is-active" : ""
            }`}
            aria-current={current === link.href ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
