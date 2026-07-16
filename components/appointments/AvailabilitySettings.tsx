'use client'

/**
 * components/appointments/AvailabilitySettings.tsx
 *
 * Paramètres coach pour configurer ses horaires de travail hebdomadaires
 * et connecter ses agendas externes (Google Calendar, Outlook).
 */

import { useEffect, useState } from 'react'
import { Calendar, Save, Loader2, Plus, Trash2, Check, AlertCircle, ExternalLink, Copy, RefreshCw, Link2 } from 'lucide-react'

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 7, label: 'Dimanche' },
]

interface AvailabilityWindow {
  day_of_week: number
  start_time: string
  end_time: string
}

export default function AvailabilitySettings() {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedStatus, setSavedStatus] = useState<boolean | null>(null)
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)
  const [isOutlookConnected, setIsOutlookConnected] = useState(false)
  // ICS token
  const [icsToken, setIcsToken] = useState<string | null>(null)
  const [icsLoading, setIcsLoading] = useState(true)
  const [icsCopied, setIcsCopied] = useState(false)
  const [icsRegenerating, setIcsRegenerating] = useState(false)
  const [activeGuideTab, setActiveGuideTab] = useState<'google' | 'apple' | 'notion' | 'outlook'>('google')

  useEffect(() => {
    Promise.all([
      fetch('/api/coach/availabilities').then((r) => r.json()),
    ])
      .then(([availData]) => {
        setWindows(Array.isArray(availData) ? availData : [])
        const params = new URLSearchParams(window.location.search)
        if (params.get('success') === 'google_calendar_connected') setIsGoogleConnected(true)
        if (params.get('success') === 'outlook_calendar_connected') setIsOutlookConnected(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Fetch ICS token séparément
    fetch('/api/coach/ics-token')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.token) setIcsToken(data.token) })
      .catch(() => {})
      .finally(() => setIcsLoading(false))
  }, [])

  function addWindow(day: number) {
    setWindows((prev) => [
      ...prev,
      { day_of_week: day, start_time: '09:00', end_time: '17:00' },
    ])
  }

  function removeWindow(index: number) {
    setWindows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateWindow(index: number, key: 'start_time' | 'end_time', val: string) {
    setWindows((prev) =>
      prev.map((win, i) => (i === index ? { ...win, [key]: val } : win))
    )
  }

  async function handleSave() {
    setSaving(true)
    setSavedStatus(null)
    try {
      const res = await fetch('/api/coach/availabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(windows),
      })
      setSavedStatus(res.ok)
    } catch {
      setSavedStatus(false)
    } finally {
      setSaving(false)
    }
  }

  function handleConnectGoogle() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      alert('Google Calendar n\'est pas encore configuré sur cette plateforme. Contactez le support.')
      return
    }
    const redirectUri = `${window.location.origin}/api/coach/integrations/google/callback`
    const scope = 'https://www.googleapis.com/auth/calendar'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`
    window.open(authUrl, '_blank', 'noopener,noreferrer')
  }

  function handleConnectOutlook() {
    const clientId = process.env.NEXT_PUBLIC_OUTLOOK_CLIENT_ID || '4a8a688b-88a9-4670-8e12-321151dfd78b'
    const redirectUri = `${window.location.origin}/api/coach/integrations/outlook/callback`
    const scope = 'offline_access Calendars.ReadWrite'
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(scope)}`
    window.open(authUrl, '_blank', 'noopener,noreferrer')
  }

  function getIcsUrl(): string {
    if (!icsToken) return ''
    return `${window.location.origin}/api/coach/calendar.ics?token=${icsToken}`
  }

  async function copyIcsUrl() {
    const url = getIcsUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setIcsCopied(true)
      setTimeout(() => setIcsCopied(false), 2000)
    } catch {
      // Fallback pour les navigateurs sans clipboard API
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setIcsCopied(true)
      setTimeout(() => setIcsCopied(false), 2000)
    }
  }

  async function regenerateToken() {
    if (!confirm('Régénérer le lien invalidera l\'ancien. Les abonnements existants devront être mis à jour. Continuer ?')) return
    setIcsRegenerating(true)
    try {
      const res = await fetch('/api/coach/ics-token', { method: 'POST' })
      const data = res.ok ? await res.json() : null
      if (data?.token) setIcsToken(data.token)
    } catch { /* silent */ }
    finally { setIcsRegenerating(false) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={22} className="text-white/25 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Card abonnement iCal universel ── */}
      <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.08] p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#86aeb8]/15 shrink-0">
            <Link2 size={13} className="text-[#86aeb8]" />
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 leading-none mb-0.5">Universel</p>
            <p className="text-[12px] font-bold text-white leading-none">Abonnement calendrier</p>
          </div>
          <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border-[0.3px] border-white/[0.06]">
            <span className="text-[9px] text-white/40 font-medium">Apple Calendar · Notion · Fantastical · Google</span>
          </div>
        </div>

        <p className="text-[12px] text-white/40 mb-4 leading-relaxed">
          Abonnez-vous à votre agenda STRYV lab depuis n’importe quelle app calendrier. L’URL ci-dessous est unique et privée — ne la partagez pas.
        </p>

        {icsLoading ? (
          <div className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />
        ) : icsToken ? (
          <div className="space-y-3">
            {/* URL field */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl bg-[#0a0a0a] border-[0.3px] border-white/[0.06] px-3 py-2.5 min-w-0">
                <Link2 size={11} className="text-white/20 shrink-0" />
                <span className="text-[11px] text-white/50 font-mono truncate select-all">
                  {getIcsUrl()}
                </span>
              </div>
              <button
                onClick={copyIcsUrl}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${
                  icsCopied
                    ? 'bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30'
                    : 'bg-white/[0.05] text-white/60 hover:bg-white/[0.09] hover:text-white border-[0.3px] border-white/[0.08]'
                }`}
              >
                {icsCopied ? <Check size={12} /> : <Copy size={12} />}
                {icsCopied ? 'Copié !' : 'Copier'}
              </button>
            </div>

            {/* Guide d'abonnement interactif */}
            <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] overflow-hidden">
              {/* En-tête */}
              <div className="px-4 pt-4 pb-3">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-0.5">Comment s'abonner</p>
                <p className="text-[11px] text-white/45">Sélectionnez votre application pour voir la procédure.</p>
              </div>

              {/* Onglets d'application */}
              <div className="flex gap-1 px-3 pb-3 flex-wrap">
                {([
                  { id: 'google', label: 'Google' },
                  { id: 'apple',  label: 'Apple'  },
                  { id: 'notion', label: 'Notion'  },
                  { id: 'outlook', label: 'Outlook / Autre' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveGuideTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      activeGuideTab === tab.id
                        ? 'bg-white/[0.10] text-white border-[0.3px] border-white/[0.15]'
                        : 'text-white/40 hover:text-white/65 hover:bg-white/[0.04]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Contenu de l'onglet actif */}
              <div className="border-t border-white/[0.05] px-4 py-3 text-[11px] leading-relaxed text-white/55">

                {activeGuideTab === 'google' && (
                  <ol className="space-y-2.5 list-none">
                    {[
                      <>Allez sur <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-[#86aeb8] hover:underline inline-flex items-center gap-0.5">calendar.google.com <ExternalLink size={9} className="inline" /></a></>,
                      <>Dans le volet gauche, cliquez sur le <span className="text-white/80 font-semibold">+</span> à côté de <span className="text-white/80 font-semibold">Autres agendas</span>.</>,
                      <>Choisissez <span className="text-white/80 font-semibold">À partir de l&apos;URL</span>.</>,
                      <>Collez l&apos;URL copiée ci-dessus, puis cliquez sur <span className="text-white/80 font-semibold">Ajouter l&apos;agenda</span>.</>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.06] text-white/35 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {activeGuideTab === 'apple' && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[9px] font-semibold text-white/30 uppercase tracking-wider mb-2">Sur Mac</p>
                      <ol className="space-y-2 list-none">
                        {[
                          <>Ouvrez l&apos;application <span className="text-white/80 font-semibold">Calendrier</span>.</>,
                          <>Dans la barre de menus, cliquez sur <span className="text-white/80 font-semibold">Fichier</span> → <span className="text-white/80 font-semibold">Nouvel abonnement calendrier…</span></>,
                          <>Collez l&apos;URL et cliquez sur <span className="text-white/80 font-semibold">S&apos;abonner</span>.</>,
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.06] text-white/35 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="border-t border-white/[0.05] pt-4">
                      <p className="text-[9px] font-semibold text-white/30 uppercase tracking-wider mb-2">Sur iPhone / iPad</p>
                      <ol className="space-y-2 list-none">
                        {[
                          <>Ouvrez <span className="text-white/80 font-semibold">Réglages</span> → <span className="text-white/80 font-semibold">Calendrier</span> → <span className="text-white/80 font-semibold">Comptes</span>.</>,
                          <>Touchez <span className="text-white/80 font-semibold">Ajouter un compte</span> → <span className="text-white/80 font-semibold">Autre</span>.</>,
                          <>Sélectionnez <span className="text-white/80 font-semibold">Ajouter un calendrier avec abonnement</span>, collez l&apos;URL et enregistrez.</>,
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.06] text-white/35 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}

                {activeGuideTab === 'notion' && (
                  <ol className="space-y-2.5 list-none">
                    {[
                      <>Ouvrez <span className="text-white/80 font-semibold">Notion Calendar</span>.</>,
                      <>Dans la barre latérale gauche, cliquez sur le <span className="text-white/80 font-semibold">+</span> à côté de votre liste de calendriers.</>,
                      <>Sélectionnez <span className="text-white/80 font-semibold">À partir de l&apos;URL (iCal)</span>.</>,
                      <>Collez l&apos;URL copiée ci-dessus et validez.</>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.06] text-white/35 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {activeGuideTab === 'outlook' && (
                  <ol className="space-y-2.5 list-none">
                    {[
                      <>Ouvrez votre calendrier sur <a href="https://outlook.live.com" target="_blank" rel="noopener noreferrer" className="text-[#86aeb8] hover:underline inline-flex items-center gap-0.5">Outlook Web <ExternalLink size={9} className="inline" /></a> ou dans l&apos;application de bureau.</>,
                      <>Cliquez sur <span className="text-white/80 font-semibold">Ajouter un calendrier</span> dans le volet gauche.</>,
                      <>Choisissez <span className="text-white/80 font-semibold">S&apos;abonner à partir du web</span>.</>,
                      <>Collez l&apos;URL copiée, donnez un nom à l&apos;agenda, puis cliquez sur <span className="text-white/80 font-semibold">Importer</span>.</>,
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.06] text-white/35 text-[9px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}

              </div>
            </div>

            {/* Régénérer */}
            <div className="flex justify-end">
              <button
                onClick={regenerateToken}
                disabled={icsRegenerating}
                className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/50 transition-colors disabled:opacity-50"
              >
                {icsRegenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Régénérer le lien (révoque l’ancien)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border-[0.3px] border-red-500/20 px-3 py-2.5">
            <AlertCircle size={13} className="text-red-400 shrink-0" />
            <p className="text-[12px] text-red-400">Impossible de générer le lien d’abonnement. Rechargez la page.</p>
          </div>
        )}
      </div>

      {/* Intégration Agenda */}
      <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.08] p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1f8a65]/15 shrink-0">
            <Calendar size={13} className="text-[#1f8a65]" />
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 leading-none mb-0.5">Intégrations</p>
            <p className="text-[12px] font-bold text-white leading-none">Synchronisation de calendrier</p>
          </div>
        </div>

        <p className="text-[12px] text-white/40 mb-4 leading-relaxed">
          Liez vos agendas professionnels pour éviter les doubles réservations. La connexion s&apos;ouvre dans un nouvel onglet.
        </p>

        <div className="space-y-2">
          {/* Google Calendar */}
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white/60">G</span>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-white">Google Calendar</p>
                <p className="text-[10px] text-white/35 mt-0.5">
                  {isGoogleConnected
                    ? '✓ Connecté — génération automatique de liens Google Meet'
                    : process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
                      ? 'Non connecté'
                      : 'Configuration requise — contactez le support'}
                </p>
              </div>
            </div>
            <button
              onClick={handleConnectGoogle}
              disabled={!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isGoogleConnected
                  ? 'bg-white/[0.06] text-white/60 hover:bg-white/[0.10] hover:text-white/80'
                  : 'bg-[#1f8a65] text-white hover:bg-[#217356]'
              }`}
            >
              <ExternalLink size={10} />
              {isGoogleConnected ? 'Reconnecter' : 'Connecter'}
            </button>
          </div>

          {/* Outlook Calendar */}
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white/60">O</span>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-white">Outlook Calendar</p>
                <p className="text-[10px] text-white/35 mt-0.5">
                  {isOutlookConnected
                    ? '✓ Connecté — génération automatique de liens Microsoft Teams'
                    : 'Non connecté'}
                </p>
              </div>
            </div>
            <button
              onClick={handleConnectOutlook}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                isOutlookConnected
                  ? 'bg-white/[0.06] text-white/60 hover:bg-white/[0.10] hover:text-white/80'
                  : 'bg-[#1f8a65] text-white hover:bg-[#217356]'
              }`}
            >
              <ExternalLink size={10} />
              {isOutlookConnected ? 'Reconnecter' : 'Connecter'}
            </button>
          </div>
        </div>
      </div>

      {/* Disponibilités hebdomadaires */}
      <div className="rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.08] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] shrink-0">
              <Calendar size={13} className="text-white/50" />
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 leading-none mb-0.5">Planning</p>
              <p className="text-[12px] font-bold text-white leading-none">Disponibilités hebdomadaires</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f8a65] text-white text-[11px] font-semibold hover:bg-[#217356] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Enregistrer
          </button>
        </div>

        <p className="text-[12px] text-white/35 mb-4 leading-relaxed">
          Définissez vos fenêtres de travail hebdomadaires. Les événements et rendez-vous créés dans l&apos;agenda seront automatiquement considérés comme indisponibles.
        </p>

        {savedStatus === true && (
          <div className="flex items-center gap-2 rounded-xl bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 px-4 py-3 mb-4">
            <Check size={13} className="text-[#1f8a65]" />
            <p className="text-[12px] text-[#1f8a65]">Disponibilités enregistrées avec succès.</p>
          </div>
        )}

        {savedStatus === false && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border-[0.3px] border-red-500/20 px-4 py-3 mb-4">
            <AlertCircle size={13} className="text-red-400" />
            <p className="text-[12px] text-red-400">Une erreur est survenue lors de la sauvegarde.</p>
          </div>
        )}

        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day) => {
            const dayWindows = windows.filter((w) => w.day_of_week === day.value)

            return (
              <div key={day.value} className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                <div className="w-24 shrink-0 pt-1.5">
                  <span className="text-[12px] font-semibold text-white/70">{day.label}</span>
                </div>

                <div className="flex-1 space-y-2">
                  {dayWindows.length === 0 ? (
                    <p className="text-[11px] text-white/25 italic pt-1.5">Indisponible</p>
                  ) : (
                    <div className="space-y-2">
                      {windows.map((win, idx) => {
                        if (win.day_of_week !== day.value) return null

                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="time"
                              value={win.start_time.slice(0, 5)}
                              onChange={(e) => updateWindow(idx, 'start_time', e.target.value)}
                              className="rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.08] px-2.5 py-1.5 text-[12px] text-white outline-none [color-scheme:dark]"
                            />
                            <span className="text-white/25 text-[11px]">à</span>
                            <input
                              type="time"
                              value={win.end_time.slice(0, 5)}
                              onChange={(e) => updateWindow(idx, 'end_time', e.target.value)}
                              className="rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.08] px-2.5 py-1.5 text-[12px] text-white outline-none [color-scheme:dark]"
                            />
                            <button
                              type="button"
                              onClick={() => removeWindow(idx)}
                              className="p-1.5 text-white/20 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => addWindow(day.value)}
                  className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors pt-1.5 self-start"
                >
                  <Plus size={11} /> Ajouter
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
