#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickLogSheet.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-scale-v2-$(date +%Y%m%d-%H%M%S)"

python3 - <<'PY'
from pathlib import Path

p = Path("components/client/QuickLogSheet.tsx")
s = p.read_text()

# 1) Import Coffee Phosphor, remove custom caffeine glyph usage if present
s = s.replace(
    'import { X, Drop, ForkKnife, Lightning } from "@phosphor-icons/react";',
    'import { X, Drop, ForkKnife, Lightning, Coffee } from "@phosphor-icons/react";'
)
s = s.replace('import { CaffeineGlyph } from "@/components/client/CaffeineGlyph";\n', '')

# 2) Restore BASE_ACTIONS simple labels only
start = s.find('const BASE_ACTIONS')
end = s.find('];', start)
if start == -1 or end == -1:
    raise SystemExit("❌ BASE_ACTIONS introuvable")
end += 2

replacement = '''const BASE_ACTIONS = [
  { key: "water" as const, Icon: Drop, label: "Eau" },
  { key: "caffeine" as const, Icon: Coffee, label: "Café & thé" },
  { key: "meal" as const, Icon: ForkKnife, label: "Repas" },
  { key: "activity" as const, Icon: Lightning, label: "Activité" },
];'''

s = s[:start] + replacement + s[end:]

# 3) Cycle action without subtitle
s = s.replace(
'''...(cycleState?.hasActiveCycle ? [{
        key: "cycle" as const,
        Icon: Drop,
        label: "Cycle",
        sub: "Début ou fin de règles",
      }] : []),''',
'''...(cycleState?.hasActiveCycle ? [{
        key: "cycle" as const,
        Icon: Drop,
        label: "Cycle",
      }] : []),'''
)

# 4) If previous V1 full rewrite introduced custom helpers, replace whole component render area with original-scale cards
# Safer: replace from "const actions =" through before "return (" only if generated variants differ? We'll overwrite full file with a clean original-scale version.
p.write_text('''"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Drop, ForkKnife, Lightning, Coffee } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import type { CycleState } from "@/lib/cycle/cycleEngine";
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget";

const QuickWaterModal    = dynamic(() => import("@/components/client/QuickWaterModal"),         { ssr: false });
const QuickCaffeineModal = dynamic(() => import("@/components/client/QuickCaffeineModal"),      { ssr: false });
const FreeActivitySheet  = dynamic(() => import("@/components/client/smart/FreeActivitySheet"), { ssr: false });
const LogPeriodSheet     = dynamic(() => import("@/components/client/cycle/LogPeriodSheet"),    { ssr: false });
const MealLogSheet       = dynamic(() => import("@/components/client/smart/MealLogSheet"),      { ssr: false });
const VoiceLogSheet      = dynamic(() => import("@/components/client/smart/VoiceLogSheet"),     { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
}

type BalanceContext = {
  consumed: NutritionMacros
  target: NutritionMacros
}

type SubSheet = "water" | "caffeine" | "activity" | "cycle" | "meal" | "meal-voice" | null;

const BASE_ACTIONS = [
  { key: "water" as const, Icon: Drop, label: "Eau" },
  { key: "caffeine" as const, Icon: Coffee, label: "Café & thé" },
  { key: "meal" as const, Icon: ForkKnife, label: "Repas" },
  { key: "activity" as const, Icon: Lightning, label: "Activité" },
];

export default function QuickLogSheet({ open, onClose }: Props) {
  const [sub, setSub] = useState<SubSheet>(null);
  const [cycleState, setCycleState] = useState<CycleState | null>(null);
  const [balanceContext, setBalanceContext] = useState<BalanceContext | null>(null);

  useEffect(() => {
    if (!open) return;

    fetch("/api/client/cycle/status")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.cycleState) setCycleState(data.cycleState); })
      .catch(() => {});

    fetch("/api/client/nutrition/today-progress")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.target) return;
        const toMacros = (d: { calories: number; protein_g: number; carbs_g: number; fat_g: number }): NutritionMacros => ({
          kcal: d.calories,
          protein_g: d.protein_g,
          carbs_g: d.carbs_g,
          fat_g: d.fat_g,
          water_ml: 0,
        });
        setBalanceContext({ consumed: toMacros(data.consumed), target: toMacros(data.target) });
      })
      .catch(() => {});
  }, [open]);

  function handleClose() {
    setSub(null);
    onClose();
  }

  function handleAction(key: string) {
    if (key === "water")    { setSub("water"); return; }
    if (key === "caffeine") { setSub("caffeine"); return; }
    if (key === "activity") { setSub("activity"); return; }
    if (key === "cycle")    { setSub("cycle"); return; }
    if (key === "meal")     { setSub("meal"); return; }
  }

  const actions = [
    ...BASE_ACTIONS,
    ...(cycleState?.hasActiveCycle ? [{
      key: "cycle" as const,
      Icon: Drop,
      label: "Cycle",
    }] : []),
  ];

  return (
    <>
      <AnimatePresence>
        {open && sub === null && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
            />

            <motion.div
              key="sheet"
              className="fixed left-0 right-0 bottom-0 z-[70] rounded-t-2xl"
              style={{
                background: "#0d0d0d",
                maxHeight: "88vh",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="relative flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />

                <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                  Logger
                </p>

                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
                  aria-label="Fermer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="px-4 pb-4 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  {actions
                    .filter(action => action.key === "water" || action.key === "caffeine")
                    .map(({ key, Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => handleAction(key)}
                        className="flex items-center gap-3 px-3 h-[64px] rounded-xl bg-white/[0.03] active:bg-white/[0.06] transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.06]">
                          <Icon size={20} className="text-white/70" />
                        </div>

                        <span className="text-[13px] font-barlow font-semibold text-[#e0e0e0] leading-tight truncate">
                          {label}
                        </span>
                      </button>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                  {actions
                    .filter(action => action.key !== "water" && action.key !== "caffeine")
                    .map(({ key, Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => handleAction(key)}
                        className="flex items-center gap-4 px-4 h-[60px] rounded-xl bg-white/[0.03] active:bg-white/[0.06] transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white/[0.06]">
                          <Icon size={18} className="text-white/70" />
                        </div>

                        <span className="text-[14px] font-barlow font-semibold text-[#e0e0e0] leading-tight truncate">
                          {label}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <QuickWaterModal
        open={sub === "water"}
        onClose={() => { setSub(null); onClose(); }}
      />

      <QuickCaffeineModal
        open={sub === "caffeine"}
        onClose={() => { setSub(null); onClose(); }}
      />

      <FreeActivitySheet
        open={sub === "activity"}
        onClose={() => { setSub(null); onClose(); }}
        onSaved={() => { setSub(null); onClose(); }}
      />

      <LogPeriodSheet
        open={sub === "cycle"}
        cycleState={cycleState}
        onClose={() => { setSub(null); onClose(); }}
        onUpdated={(newState) => { setCycleState(newState); setSub(null); onClose(); }}
      />

      <MealLogSheet
        open={sub === "meal"}
        composerMode="standard"
        intent="track"
        balanceContext={balanceContext ?? undefined}
        onClose={() => { setSub(null); onClose(); }}
        onSuccess={() => { setSub(null); onClose(); }}
      />

      <VoiceLogSheet
        open={sub === "meal-voice"}
        onClose={() => { setSub(null); onClose(); }}
        onSuccess={() => { setSub(null); onClose(); }}
        initialInputMode="voice"
      />
    </>
  );
}
''')
PY

echo "✅ QuickLogSheet revenu à l’échelle originale + icône Coffee Phosphor."
