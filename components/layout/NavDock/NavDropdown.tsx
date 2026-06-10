"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type DropdownItem =
  | { id: string; label: string; href: string; actionKey?: never }
  | { id: string; label: string; actionKey: string; href?: never };

interface NavDropdownProps {
  open: boolean;
  onClose: () => void;
  items: DropdownItem[];
  onAction?: (actionKey: string) => void;
  align?: "left" | "center" | "right";
}

export function NavDropdown({ open, onClose, items, onAction, align = "center" }: NavDropdownProps) {
  const pathname = usePathname();

  const alignClass =
    align === "left"
      ? "left-0"
      : align === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[58]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute bottom-full mb-2 ${alignClass} z-[59] min-w-[160px] overflow-hidden rounded-xl border-[0.3px] border-white/[0.08] bg-[#181818] shadow-[0_8px_24px_rgba(0,0,0,0.5)]`}
          >
            {items.map((item) => {
              if (item.href) {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center px-4 py-2.5 text-[12px] font-medium transition-colors ${
                      active
                        ? "bg-[#1f8a65]/05 text-[#1f8a65]"
                        : "text-white/70 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onAction?.(item.actionKey!);
                    onClose();
                  }}
                  className="flex w-full items-center px-4 py-2.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
