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
      <Link href="/" className="text-[#c8ff00]">
        BriefToFloor
      </Link>
      <span className="text-[#f4efe6]/20">/</span>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={
            current === link.href
              ? "text-[#f4efe6]"
              : "text-[#f4efe6]/45 hover:text-[#c8ff00]"
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
