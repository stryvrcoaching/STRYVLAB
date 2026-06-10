import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function CoachDocLinkButton({
  href,
  label = "Documentation",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/80"
      aria-label={label}
      title={label}
    >
      <BookOpen size={12} />
      <span>{label}</span>
    </Link>
  );
}
