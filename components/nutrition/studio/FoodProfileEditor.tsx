"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Loader2, ShieldAlert, SlidersHorizontal, X } from "lucide-react"
import FoodPreferencesField from "@/components/assessments/form/FoodPreferencesField"
import type { FoodPreferenceAssessmentValue } from "@/lib/nutrition/food-preferences"

type Props = {
  clientId: string
  onSaved?: () => void
}

const EMPTY: FoodPreferenceAssessmentValue = {
  allergy_status: "none",
  allergies: [],
  intolerances: [],
  frameworks: [],
  preferences: [],
}

export default function FoodProfileEditor({ clientId, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<"unknown" | "none" | "declared">("unknown")
  const [value, setValue] = useState<FoodPreferenceAssessmentValue>(EMPTY)
  const initialValueRef = useRef<FoodPreferenceAssessmentValue>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [allergyRemovalConfirmationOpen, setAllergyRemovalConfirmationOpen] = useState(false)
  const activeRuleCount = value.frameworks.length + value.preferences.length + value.intolerances.length + value.allergies.length

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/clients/${clientId}/food-profile`, { cache: "no-store" })
      const payload = response.ok ? await response.json() : null
      setStatus(payload?.status ?? "unknown")
      if (payload?.value) {
        setValue(payload.value)
        initialValueRef.current = payload.value
      } else {
        setValue(EMPTY)
        initialValueRef.current = EMPTY
      }
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  function removesAnAllergy() {
    const allergyKey = (entry: FoodPreferenceAssessmentValue["allergies"][number]) =>
      `${entry.target_type}:${entry.food_item_id ?? entry.taxonomy_key ?? entry.label.toLowerCase()}`
    const nextAllergies = new Set(value.allergies.map(allergyKey))
    return initialValueRef.current.allergies.some(
      (entry) => !nextAllergies.has(allergyKey(entry)),
    )
  }

  async function persist(confirmAllergyRemoval: boolean) {
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/clients/${clientId}/food-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value,
          confirm_allergy_removal: confirmAllergyRemoval,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(payload?.error ?? "Impossible d’enregistrer le profil")
        return
      }
      setStatus(value.allergy_status)
      initialValueRef.current = value
      setOpen(false)
      window.dispatchEvent(
        new CustomEvent("stryv:food-profile-updated", {
          detail: { clientId, status: value.allergy_status },
        }),
      )
      onSaved?.()
    } catch {
      setError("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  function save() {
    if (removesAnAllergy()) {
      setAllergyRemovalConfirmationOpen(true)
      return
    }
    void persist(false)
  }

  function closeEditor() {
    setValue(initialValueRef.current)
    setError("")
    setOpen(false)
  }

  return (
    <>
      {status === "unknown" || loading ? (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border-[0.3px] border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {loading ? (
              <Loader2 size={13} className="animate-spin text-white/40" />
            ) : (
              <ShieldAlert size={14} className="text-white/60" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold text-white/75">Allergies non renseignées</p>
              <p className="truncate text-[9px] text-white/35">À confirmer avant le partage du protocole</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 text-[9px] font-bold text-white/65 hover:text-white"
          >
            <SlidersHorizontal size={11} />
            Compléter
          </button>
        </div>
      ) : (
        <div className="mx-4 mt-2 flex h-8 items-center gap-2 rounded-lg px-1.5 text-white/45">
          <Check size={12} className="shrink-0 text-[#1f8a65]" />
          <p className="min-w-0 flex-1 truncate text-[9px] font-medium">
            Profil alimentaire actif
            <span className="ml-1.5 text-white/28">
              · {status === "declared" ? "contraintes appliquées" : activeRuleCount > 0 ? `${activeRuleCount} préférence${activeRuleCount > 1 ? "s" : ""}` : "aucune allergie"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Modifier le profil alimentaire"
            aria-label="Modifier le profil alimentaire"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/75"
          >
            <SlidersHorizontal size={12} />
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3">
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-[0.3px] border-white/[0.08] bg-[#181818]">
            <header className="flex shrink-0 items-center justify-between border-b-[0.3px] border-white/[0.06] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1f8a65]">
                  Nutrition Studio
                </p>
                <h2 className="mt-1 text-[16px] font-semibold text-white">Profil alimentaire du client</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={closeEditor}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-white/45 hover:text-white"
              >
                <X size={15} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <FoodPreferencesField
                value={value}
                onChange={setValue}
                catalogEndpoint={`/api/clients/${clientId}/food-items`}
              />
              {error && (
                <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-[11px] text-red-300">{error}</p>
              )}
            </div>

            <footer className="flex shrink-0 justify-end gap-2 border-t-[0.3px] border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg px-4 py-2.5 text-[11px] font-semibold text-white/50 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="flex items-center gap-2 rounded-lg bg-[#1f8a65] px-4 py-2.5 text-[11px] font-bold text-white disabled:opacity-50"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                Enregistrer
              </button>
            </footer>
          </div>
        </div>
      )}

      {allergyRemovalConfirmationOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/72 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={() => setAllergyRemovalConfirmationOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="food-profile-allergy-removal-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border-[0.3px] border-white/[0.1] bg-[#181818] shadow-2xl shadow-black/40"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b-[0.3px] border-white/[0.06] px-5 py-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7fe2bf]">Profil alimentaire</p>
                <h2 id="food-profile-allergy-removal-title" className="mt-1.5 text-[16px] font-semibold text-white">Retirer une allergie ?</h2>
              </div>
              <button
                type="button"
                onClick={() => setAllergyRemovalConfirmationOpen(false)}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <X size={15} />
              </button>
            </header>
            <div className="flex gap-3 px-5 py-4">
              <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-300" />
              <p className="text-[12px] leading-relaxed text-white/65">
                Cette modification sera inscrite dans l&apos;historique de sécurité du client. Vérifie que l&apos;information est bien à jour avant de confirmer.
              </p>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t-[0.3px] border-white/[0.06] px-5 py-4">
              <button
                type="button"
                onClick={() => setAllergyRemovalConfirmationOpen(false)}
                className="h-9 rounded-lg px-3 text-[10px] font-semibold text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setAllergyRemovalConfirmationOpen(false)
                  void persist(true)
                }}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f8a65] px-3.5 text-[10px] font-bold text-white transition-colors hover:bg-[#217356] disabled:opacity-50"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                Confirmer la suppression
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
