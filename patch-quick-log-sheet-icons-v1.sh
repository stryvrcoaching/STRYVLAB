#!/usr/bin/env bash
set -euo pipefail

FILE="components/client/QuickLogSheet.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ Fichier introuvable: $FILE"
  exit 1
fi

cp "$FILE" "$FILE.bak-icons-v1-$(date +%Y%m%d-%H%M%S)"

cat > "$FILE" <<'TSX'
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Drop, ForkKnife, Lightning } from "@phosphor-icons/react";
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
type ActionKey = "water" | "caffeine" | "meal" | "activity" | "cycle";

const BASE_ACTIONS: Array<{ key: ActionKey; label: string }> = [
  { key: "water", label: "Eau" },
  { key: "caffeine", label: "Café & thé" },
  { key: "meal", label: "Repas" },
  { key: "activity", label: "Activité" },
];

function CupIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M5.5 8.25h10.2l-.8 7.05A3 3 0 0 1 11.95 18H8.75a3 3 0 0 1-2.95-2.7L5.5 8.25Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M15.8 10h1.35c2.05 0 3.2 1.1 3 2.8-.22 1.62-1.55 2.55-3.45 2.55h-1.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M7.1 7.2c-.45-.85.45-1.35 0-2.2M10.4 7.2c-.45-.85.45-1.35 0-2.2M13.7 7.2c-.45-.85.45-1.35 0-2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

function ActionIcon({ actionKey }: { actionKey: ActionKey }) {
  if (actionKey === "water") return <Drop size={22} className="text-white/70" />;
  if (actionKey === "caffeine") return <CupIcon className="h-[23px] w-[23px] text-white/70" />;
  if (actionKey === "meal") return <ForkKnife size={22} className="text-white/70" />;
  if (actionKey === "activity") return <Lightning size={22} className="text-white/70" />;
  return <Drop size={22} className="text-white/70" />;
}

function QuickActionCard({
  actionKey,
  label,
  compact = false,
  onClick,
}: {
  actionKey: ActionKey
  label: string
  compact?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center text-left bg-white/[0.035] active:bg-white/[0.065] transition-colors",
        "rounded-2xl",
        compact ? "h-[72px] gap-3 px-3" : "h-[74px] gap-4 px-4",
      ].join(" ")}
    >
      <div className={[
        "flex shrink-0 items-center justify-center bg-white/[0.06]",
        compact ? "h-11 w-11 rounded-2xl" : "h-11 w-11 rounded-2xl",
      ].join(" ")}>
        <ActionIcon actionKey={actionKey} />
      </div>

      <span className={[
        "min-w-0 truncate font-barlow text-[#e8e8e8]",
        compact ? "text-[15px] font-semibold" : "text-[16px] font-semibold",
      ].join(" ")}>
        {label}
      </span>
    </button>
  );
}

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

  function handleAction(key: ActionKey) {
    if (key === "water")    { setSub("water"); return; }
    if (key === "caffeine") { setSub("caffeine"); return; }
    if (key === "activity") { setSub("activity"); return; }
    if (key === "cycle")    { setSub("cycle"); return; }
    if (key === "meal")     { setSub("meal"); return; }
  }

  const actions: Array<{ key: ActionKey; label: string }> = [
    ...BASE_ACTIONS,
    ...(cycleState?.hasActiveCycle ? [{ key: "cycle" as const, label: "Cycle" }] : []),
  ];

  const topActions = actions.filter(action => action.key === "water" || action.key === "caffeine");
  const lowerActions = actions.filter(action => action.key !== "water" && action.key !== "caffeine");

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
              className="fixed left-0 right-0 bottom-0 z-[70] rounded-t-[28px]"
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
                <div className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/[0.10]" />

                <p className="font-barlow-condensed text-[21px] font-black uppercase tracking-[0.18em] text-white">
                  Logger
                </p>

                <button
                  onClick={handleClose}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] text-white/45 active:bg-white/[0.09]"
                  aria-label="Fermer"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="flex flex-col gap-2 px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  {topActions.map(({ key, label }) => (
                    <QuickActionCard
                      key={key}
                      actionKey={key}
                      label={label}
                      compact
                      onClick={() => handleAction(key)}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  {lowerActions.map(({ key, label }) => (
                    <QuickActionCard
                      key={key}
                      actionKey={key}
                      label={label}
                      onClick={() => handleAction(key)}
                    />
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
TSX

echo "✅ QuickLogSheet aligné."
echo ""
echo "Contrôle TypeScript rapide :"
npx tsc --noEmit --pretty false || true
