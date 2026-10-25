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
        className="nb-chip nb-chip-red shrink-0 !normal-case tracking-tight"
        style={{ fontFamily: "var(--font-sans)", fontSize: "12px" }}
      >
        BriefToFloor
      </Link>
      <div
        className="nb-tablist grid !w-auto shrink-0 grid-cols-4 !shadow-none sm:!shadow-[var(--shadow-sm)]"
        role="navigation"
        aria-label="Main"
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nb-tab no-underline !min-w-[4.75rem] !flex-none text-center ${
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
