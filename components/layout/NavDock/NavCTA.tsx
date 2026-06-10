"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { dockActionRegistry } from "./dockActionRegistry";
import type { CTAConfig } from "./useNavConfig";

interface NavCTAProps {
  cta: CTAConfig;
}

export function NavCTA({ cta }: NavCTAProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (cta.type === "hidden") return null;

  if (cta.type === "direct") {
    return (
      <button
        onClick={() => dockActionRegistry[cta.actionKey]?.()}
        className="flex h-9 items-center rounded-xl bg-[#1f8a65] px-4 text-[11px] font-bold text-white transition-all hover:bg-[#217356] active:scale-[0.97]"
      >
        {cta.label}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1f8a65] text-white transition-all hover:bg-[#217356] active:scale-[0.97]"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>

      <NavDropdown
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        align="right"
        items={cta.actions.map((a) => ({ id: a.id, label: a.label, actionKey: a.actionKey }))}
        onAction={(key) => dockActionRegistry[key]?.()}
      />
    </div>
  );
}
