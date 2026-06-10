"use client";

import { NavRowA } from "./NavRowA";
import { NavRowB } from "./NavRowB";
import { useNavConfig } from "./useNavConfig";

export function NavDock() {
  const { rowA, cta } = useNavConfig();

  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 flex flex-col items-center gap-1.5">
      {rowA && <NavRowA items={rowA} />}
      <NavRowB cta={cta} />
    </div>
  );
}
