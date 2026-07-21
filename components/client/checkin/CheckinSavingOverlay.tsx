"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { LoaderCircle } from "lucide-react"
import { useClientT } from "@/components/client/ClientI18nProvider"

export default function CheckinSavingOverlay({ open }: { open: boolean }) {
  const { t } = useClientT()
  const reducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.01 : 0.16 }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#121212]/94 px-8 text-center backdrop-blur-sm"
        >
          <motion.div
            animate={reducedMotion ? undefined : { scale: [0.96, 1.04, 0.96] }}
            transition={reducedMotion ? undefined : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.08]"
          >
            <LoaderCircle size={28} className="animate-spin text-white" aria-hidden="true" />
          </motion.div>
          <p className="mt-5 font-barlow-condensed text-[15px] font-bold uppercase tracking-[0.14em] text-white">
            {t("common.sending")}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
