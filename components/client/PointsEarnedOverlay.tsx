"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";

const TOTAL_DURATION_MS = 2800;
const EXIT_DURATION_MS = 220;

export default function PointsEarnedOverlay({
  open,
  points,
  onDone,
}: {
  open: boolean;
  points: number;
  onDone?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || points <= 0) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timeout = window.setTimeout(dismiss, TOTAL_DURATION_MS - EXIT_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [dismiss, open, points]);

  if (!mounted || points <= 0) return null;

  const motionTransition = reducedMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.82 };

  return createPortal(
    <AnimatePresence onExitComplete={onDone}>
      {visible ? (
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="points-earned-title"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: EXIT_DURATION_MS / 1000, ease: "easeIn" }}
          className="fixed inset-0 z-[120] flex min-h-[100dvh] flex-col overflow-hidden bg-[#121212] px-5 pb-5 pt-[max(env(safe-area-inset-top),20px)] text-white"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 border-b border-white/[0.04]" />

          <header className="relative z-10 flex items-center justify-between">
            <span className="font-barlow-condensed text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
              STRYVR
            </span>
            <span className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
              Progression
            </span>
          </header>

          <main className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72, rotate: -14, y: 20 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0, y: 0 }}
          transition={motionTransition}
          className="relative flex h-36 w-36 items-center justify-center sm:h-40 sm:w-40"
        >
          <motion.div
            aria-hidden="true"
            animate={reducedMotion ? undefined : { scale: [0.88, 1.12, 1], opacity: [0, 0.42, 0] }}
            transition={reducedMotion ? undefined : { duration: 1.05, ease: "easeOut" }}
            className="absolute inset-2 rounded-full border border-[#e7c96d]/70"
          />
          <motion.div
            animate={reducedMotion ? undefined : { rotateY: [0, 12, 0], y: [0, -5, 0] }}
            transition={reducedMotion ? undefined : { duration: 1.25, ease: "easeInOut" }}
            className="relative h-full w-full drop-shadow-[0_18px_28px_rgba(198,180,139,0.2)]"
          >
            <Image
              src="/images/currency/stryvr-token.png"
              alt="Jeton STRYVR"
              fill
              sizes="(max-width: 640px) 144px, 160px"
              className="object-contain"
              priority
            />
          </motion.div>
        </motion.div>

        <motion.p
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 0.32, delay: 0.1, ease: "easeOut" }}
          className="mt-5 font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.2em] text-[#dbe4df]/55"
        >
          Action validée
        </motion.p>

        <motion.h1
          id="points-earned-title"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 0.46, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 font-barlow text-[104px] font-semibold leading-[0.76] tracking-[-0.08em] tabular-nums text-white sm:text-[128px]"
        >
          +{points}
        </motion.h1>

        <motion.p
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reducedMotion ? { duration: 0.01 } : { duration: 0.32, delay: 0.24, ease: "easeOut" }}
          className="mt-6 font-barlow-condensed text-[16px] font-bold uppercase tracking-[0.18em] text-white/70"
        >
          solde STRYVR crédité
        </motion.p>
          </main>

        </motion.section>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
