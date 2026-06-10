"use client"

import { AnimatePresence, motion } from "framer-motion"
import { FileText, Keyboard, Search, Sparkles, Star, X, type LucideIcon } from "lucide-react"

export type MealMethodAction =
  | "track_voice_text"
  | "track_search"
  | "track_favorites"
  | "track_categories"
  | "compose_guide"
  | "compose_simulation"

export interface MealMethodSheetProps {
  open: boolean
  onClose: () => void
  onSelect: (action: MealMethodAction) => void
}

type Method = {
  key: MealMethodAction
  label: string
  description: string
  Icon: LucideIcon
  accent?: boolean
}

const METHODS: Method[] = [
  {
    key: "track_voice_text",
    label: "Voix ou texte",
    description: "Saisie rapide",
    Icon: Keyboard,
  },
  {
    key: "track_search",
    label: "Recherche",
    description: "Un aliment précis",
    Icon: Search,
  },
  {
    key: "track_favorites",
    label: "Favoris",
    description: "Rejouer un repas",
    Icon: Star,
  },
  {
    key: "track_categories",
    label: "Catégories",
    description: "Par familles d'aliments",
    Icon: FileText,
  },
  {
    key: "compose_guide",
    label: "Composer",
    description: "Selon ce qu'il me reste",
    Icon: Sparkles,
    accent: true,
  },
]

export default function MealMethodSheet({ open, onClose, onSelect }: MealMethodSheetProps) {
  function handleSelect(action: MealMethodAction) {
    onSelect(action)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[90] rounded-t-2xl"
            style={{ background: "#080808", maxHeight: "88vh", display: "flex", flexDirection: "column", paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.10]" />
              <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                Repas
              </p>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
              >
                <X size={15} />
              </button>
            </div>

            {/* Grid 2×2 + Composer pleine largeur */}
            <div className="px-4 pb-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {METHODS.filter(m => !m.accent).map(({ key, label, description, Icon }) => (
                  <button
                    key={key}
                    onClick={() => handleSelect(key)}
                    className="rounded-2xl bg-white/[0.04] active:scale-[0.98] transition-transform text-left p-4 flex flex-col gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/[0.06]">
                      <Icon size={18} className="text-white" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-white leading-tight">{label}</div>
                      <div className="text-[11px] mt-0.5 text-white/40 leading-snug">{description}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Composer — pleine largeur, accent indigo */}
              {METHODS.filter(m => m.accent).map(({ key, label, description, Icon }) => (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className="w-full rounded-2xl active:scale-[0.98] transition-transform text-left p-4 flex items-center gap-4"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(129,140,248,0.10) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                    backgroundColor: 'rgba(129,140,248,0.12)',
                  }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#818cf8]/14 shrink-0">
                    <Icon size={20} className="text-[#818cf8]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-white leading-tight">{label}</span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] bg-[#818cf8]/12 text-[#818cf8]">
                        <Sparkles size={9} />
                        Smart
                      </span>
                    </div>
                    <div className="text-[11px] mt-0.5 text-white/50 leading-snug">{description}</div>
                  </div>
                  <div className="text-[#818cf8]/60 text-[12px]">→</div>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
