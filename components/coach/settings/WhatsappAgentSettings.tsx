'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'

type AgentState = {
  agent: { enabled: boolean; phone_e164: string; action_policy: 'confirm_all'; proactive_alerts_enabled: boolean } | null
  phoneConfigured: boolean
  aiEnabled: boolean
}

export default function WhatsappAgentSettings() {
  const [state, setState] = useState<AgentState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/coach/whatsapp-agent')
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then(setState)
      .catch(() => setError('Impossible de charger la configuration WhatsApp.'))
  }, [])

  async function toggle() {
    if (!state) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/coach/whatsapp-agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !state.agent?.enabled }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'La configuration n’a pas pu être enregistrée.')
      setState((current) => current ? { ...current, agent: payload.agent } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La configuration n’a pas pu être enregistrée.')
    } finally {
      setSaving(false)
    }
  }

  const enabled = state?.agent?.enabled === true
  const canEnable = state?.aiEnabled && state.phoneConfigured

  return (
    <div className="rounded-xl border-[0.3px] border-white/[0.06] bg-[#0a0a0a] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1f8a65]/10 text-[#1f8a65]">
            <MessageCircle size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Assistant WhatsApp</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
              Répond à vos demandes de consultation avec le contexte STRYV lab. Les modifications restent soumises à validation et ne sont pas encore activées.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label={enabled ? 'Désactiver l’assistant WhatsApp' : 'Activer l’assistant WhatsApp'}
          aria-pressed={enabled}
          disabled={!canEnable || saving || !state}
          onClick={toggle}
          className={`relative mt-1 h-6 w-10 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${enabled ? 'bg-[#1f8a65]' : 'bg-white/[0.10]'}`}
        >
          {saving ? <Loader2 className="absolute left-[13px] top-[5px] animate-spin text-white" size={14} /> : <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${enabled ? 'left-5' : 'left-1'}`} />}
        </button>
      </div>

      {!state && !error && <p className="mt-3 text-[11px] text-white/35">Chargement…</p>}
      {state && !state.aiEnabled && <p className="mt-3 text-[11px] text-white/45">Activez d’abord l’IA Coach ci-dessus.</p>}
      {state && !state.phoneConfigured && <p className="mt-3 text-[11px] text-white/45">Ajoutez puis enregistrez votre numéro WhatsApp dans le profil professionnel.</p>}
      {enabled && <p className="mt-3 text-[11px] text-[#1f8a65]">Actif pour le numéro +{state?.agent?.phone_e164} · lecture seule</p>}
      {error && <p className="mt-3 text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
