"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavDropdown } from "./NavDropdown";
import type { NavRowAItem } from "./useNavConfig";

function isItemActive(item: NavRowAItem, pathname: string): boolean {
  if (item.href) {
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }
  if (item.dropdown) {
    return item.dropdown.some(
      (d) => pathname === d.href || pathname.startsWith(d.href + "/")
    );
  }
  return false;
}

function RowAButton({ item }: { item: NavRowAItem }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = isItemActive(item, pathname);

  const buttonClass = cn(
    "flex h-7 items-center gap-1 rounded-lg px-3 text-[11px] font-medium transition-all duration-150",
    active
      ? "bg-[#1f8a65]/10 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20"
      : "text-white/40 hover:bg-white/[0.05] hover:text-white/70"
  );

  if (item.href) {
    return (
      <Link href={item.href} className={buttonClass}>
        {item.label}
      </Link>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={buttonClass}>
        {item.label}
        <ChevronDown
          size={10}
          strokeWidth={2}
          className={cn("transition-transform duration-150", open ? "rotate-180" : "")}
        />
      </button>

      <NavDropdown
        open={open}
        onClose={() => setOpen(false)}
        align="center"
        items={item.dropdown!.map((d) => ({ id: d.id, label: d.label, href: d.href }))}
      />
    </div>
  );
}

interface NavRowAProps {
  items: NavRowAItem[];
}

export function NavRowA({ items }: NavRowAProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border-[0.3px] border-white/[0.06] bg-[#121212] px-2 py-1">
      {items.map((item) => (
        <RowAButton key={item.id} item={item} />
      ))}
    </div>
  );
}
