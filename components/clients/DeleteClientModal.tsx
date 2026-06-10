"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

interface Props {
  clientId: string
  clientName: string // "Prénom Nom"
  onClose: () => void
  onSuccess: (mode: "archive" | "delete") => void
}

type Step = "choice" | "confirming_delete" | "loading"

export default function DeleteClientModal({ clientId, clientName, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>("choice")
  const [deleteInput, setDeleteInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const nameMatch = deleteInput.trim().toLowerCase() === clientName.trim().toLowerCase()

  async function handleAction(mode: "archive" | "delete") {
    setStep("loading")
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}?mode=${mode}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Une erreur est survenue")
        setStep(mode === "archive" ? "choice" : "confirming_delete")
        return
      }
      onSuccess(mode)
    } catch {
      setError("Erreur réseau")
      setStep(mode === "archive" ? "choice" : "confirming_delete")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-sm border-[0.3px] border-white/[0.06]">

        {step === "choice" && (
          <>
            <h3 className="font-bold text-white mb-1">Gérer le client</h3>
            <p className="text-[13px] text-white/55 mb-5">
              Choisissez une action pour <span className="text-white/80 font-medium">{clientName}</span>.
            </p>

            <div className="mb-3 p-4 rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06]">
              <p className="text-[13px] font-semibold text-white mb-1">Archiver</p>
              <p className="text-[12px] text-white/45 mb-3">
                Le client sera masqué de votre liste. Ses données sont conservées et récupérables.
              </p>
              <button
                onClick={() => handleAction("archive")}
                className="w-full py-2 rounded-xl bg-white/[0.04] text-[13px] text-white/70 hover:text-white/90 hover:bg-white/[0.07] transition-colors font-medium"
              >
                Archiver ce client
              </button>
            </div>

            <div className="p-4 rounded-xl bg-red-500/[0.04] border-[0.3px] border-red-500/20">
              <p className="text-[13px] font-semibold text-white mb-1">Supprimer définitivement</p>
              <p className="text-[12px] text-white/45 mb-3">
                Toutes les données seront effacées de manière irréversible, y compris les bilans et l&apos;accès client.
              </p>
              <button
                onClick={() => setStep("confirming_delete")}
                className="w-full py-2 rounded-xl bg-red-500/10 text-[13px] text-red-400/80 hover:text-red-400 hover:bg-red-500/20 transition-colors font-medium"
              >
                Procéder à la suppression…
              </button>
            </div>

            {error && (
              <p className="text-[12px] text-red-400 mt-3">{error}</p>
            )}

            <button
              onClick={onClose}
              className="mt-4 w-full py-2 rounded-xl bg-transparent text-[12px] text-white/30 hover:text-white/55 transition-colors"
            >
              Annuler
            </button>
          </>
        )}

        {step === "confirming_delete" && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <h3 className="font-bold text-white">Confirmation requise</h3>
            </div>
            <p className="text-[13px] text-white/55 mb-4">
              Cette action est <span className="text-red-400 font-medium">irréversible</span>. Tapez le nom complet du client pour confirmer :
            </p>
            <p className="text-[12px] font-mono text-white/70 bg-white/[0.04] rounded-lg px-3 py-2 mb-3 select-all">
              {clientName}
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              placeholder="Tapez le nom ici…"
              className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[44px] text-[13px] font-medium text-white placeholder:text-white/20 outline-none border-[0.3px] border-white/[0.06] focus:border-red-500/40 transition-colors mb-4"
            />

            {error && (
              <p className="text-[12px] text-red-400 mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setStep("choice"); setDeleteInput(""); setError(null) }}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
              >
                Retour
              </button>
              <button
                onClick={() => handleAction("delete")}
                disabled={!nameMatch}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-[13px] font-bold hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
            <p className="text-[13px] text-white/45">Opération en cours…</p>
          </div>
        )}

      </div>
    </div>
  )
}
