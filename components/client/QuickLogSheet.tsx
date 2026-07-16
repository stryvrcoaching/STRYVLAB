"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Drop, ForkKnife, Lightning, Coffee } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { CycleState } from "@/lib/cycle/cycleEngine";
import useBodyScrollLock from "@/components/client/useBodyScrollLock";
import { useClientT } from "@/components/client/ClientI18nProvider";

const QuickWaterModal = dynamic(
  () => import("@/components/client/QuickWaterModal"),
  { ssr: false },
);
const QuickCaffeineModal = dynamic(
  () => import("@/components/client/QuickCaffeineModal"),
  { ssr: false },
);
const FreeActivitySheet = dynamic(
  () => import("@/components/client/smart/FreeActivitySheet"),
  { ssr: false },
);
const LogPeriodSheet = dynamic(
  () => import("@/components/client/cycle/LogPeriodSheet"),
  { ssr: false },
);

interface Props {
  open: boolean;
  onClose: () => void;
}

type SubSheet =
  | "water"
  | "caffeine"
  | "activity"
  | "cycle"
  | null;

const BASE_ACTIONS = [
  { key: "water" as const, Icon: Drop, labelKey: "quick.water" },
  { key: "caffeine" as const, Icon: Coffee, labelKey: "quick.caffeineTea" },
  { key: "meal" as const, Icon: ForkKnife, labelKey: "quick.meal" },
  { key: "activity" as const, Icon: Lightning, labelKey: "quick.activity" },
];

export default function QuickLogSheet({ open, onClose }: Props) {
  useBodyScrollLock(open);
  const router = useRouter();
  const { t } = useClientT();

  const [sub, setSub] = useState<SubSheet>(null);
  const [cycleState, setCycleState] = useState<CycleState | null>(null);

  useEffect(() => {
    fetch("/api/client/cycle/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.cycleState) setCycleState(data.cycleState);
      })
      .catch(() => {});
  }, []);

  function handleClose() {
    setSub(null);
    onClose();
  }

  function handleAction(key: string) {
    if (key === "water") {
      setSub("water");
      return;
    }
    if (key === "caffeine") {
      setSub("caffeine");
      return;
    }
    if (key === "activity") {
      setSub("activity");
      return;
    }
    if (key === "cycle") {
      setSub("cycle");
      return;
    }
    if (key === "meal") {
      handleClose();
      router.push("/client/nutrition/log");
      return;
    }
  }

  const actions = [
    ...BASE_ACTIONS,
    ...(cycleState?.hasActiveCycle
      ? [
          {
            key: "cycle" as const,
            Icon: Drop,
            labelKey: cycleState.isPeriodStartExpected
              ? "cycle.action.confirm_start"
              : "nutrition.cycleSync",
          },
        ]
      : []),
  ];

  if (typeof document === "undefined") return null;

  return createPortal(
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
              className="client-native-bottom-sheet fixed left-0 right-0 bottom-0 z-[70] rounded-t-[28px]"
              style={{
                background: "#0d0d0d",
                maxHeight: "88dvh",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "var(--client-modal-bottom-padding)",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="relative flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />

                <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                  {t("quick.add")}
                </p>

                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
                  aria-label={t("ui.close")}
                >
                  <X size={15} />
                </button>
              </div>

              <div className="px-4 pb-4 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  {actions
                    .filter(
                      (action) =>
                        action.key === "water" || action.key === "caffeine",
                    )
                    .map(({ key, Icon, labelKey }) => (
                      <button
                        key={key}
                        onClick={() => handleAction(key)}
                        className="flex items-center gap-3 px-3 h-[64px] rounded-xl bg-white/[0.03] active:bg-white/[0.06] transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.06]">
                          <Icon size={20} className="text-white/70" />
                        </div>

                        <span className="text-[13px] font-barlow font-semibold text-[#e0e0e0] leading-tight truncate">
                          {t(labelKey as never)}
                        </span>
                      </button>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                  {actions
                    .filter(
                      (action) =>
                        action.key !== "water" && action.key !== "caffeine",
                    )
                    .map(({ key, Icon, labelKey }) => (
                      <button
                        key={key}
                        onClick={() => handleAction(key)}
                        className="flex items-center gap-4 px-4 h-[60px] rounded-xl bg-white/[0.03] active:bg-white/[0.06] transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white/[0.06]">
                          <Icon size={18} className="text-white/70" />
                        </div>

                        <span className="text-[14px] font-barlow font-semibold text-[#e0e0e0] leading-tight truncate">
                          {t(labelKey as never)}
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
        onClose={() => {
          setSub(null);
          onClose();
        }}
      />

      <QuickCaffeineModal
        open={sub === "caffeine"}
        onClose={() => {
          setSub(null);
          onClose();
        }}
      />

      <FreeActivitySheet
        open={sub === "activity"}
        onClose={() => {
          setSub(null);
          onClose();
        }}
        onSaved={() => {
          setSub(null);
          onClose();
        }}
      />

      <LogPeriodSheet
        open={sub === "cycle"}
        cycleState={cycleState}
        onClose={() => {
          setSub(null);
          onClose();
        }}
        onUpdated={(newState) => {
          setCycleState(newState);
          setSub(null);
          onClose();
        }}
      />

    </>,
    document.body,
  );
}
