'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { subscribeToPush } from '@/lib/client/push'

interface NotifPrefs {
  notif_session_reminder: boolean
  notif_bilan_received:   boolean
  notif_program_updated:  boolean
  notif_checkin_reminder: boolean
  notif_hydration_reminder: boolean
  notif_meal_reminder: boolean
  notif_protein_reminder: boolean
  notif_coach_messages: boolean
  notif_progress_updates: boolean
  training_reminder_times: string[]
  hydration_reminder_first_time: string
  hydration_reminder_count: number
  meal_reminder_breakfast_time: string
  meal_reminder_lunch_time: string
  protein_reminder_time: string
}

interface ReminderSchedule {
  training_reminder_times: string[]
  hydration_reminder_first_time: string
  hydration_reminder_count: number
  meal_reminder_breakfast_time: string
  meal_reminder_lunch_time: string
  protein_reminder_time: string
}

interface Props {
  preferences:   NotifPrefs
}

export default function NotificationsPanel({ preferences: initialPrefs }: Props) {
  const { t } = useClientT()
  const [prefs, setPrefs] = useState<NotifPrefs>(initialPrefs)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsError, setPrefsError] = useState(false)
  const [schedule, setSchedule] = useState<ReminderSchedule>(() => ({
    training_reminder_times: initialPrefs.training_reminder_times?.length
      ? initialPrefs.training_reminder_times.slice(0, 2)
      : ['08:00', '18:00'],
    hydration_reminder_first_time: initialPrefs.hydration_reminder_first_time || '09:00',
    hydration_reminder_count: Math.min(10, Math.max(1, initialPrefs.hydration_reminder_count || 3)),
    meal_reminder_breakfast_time: initialPrefs.meal_reminder_breakfast_time || '10:30',
    meal_reminder_lunch_time: initialPrefs.meal_reminder_lunch_time || '14:30',
    protein_reminder_time: initialPrefs.protein_reminder_time || '20:00',
  }))
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleState, setScheduleState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [testingPush, setTestingPush] = useState(false)
  const [pushTestResult, setPushTestResult] = useState<'ok' | 'error' | null>(null)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  )
  const [activatingPush, setActivatingPush] = useState(false)
  const [pushActivationError, setPushActivationError] = useState(false)

  async function togglePref(key: keyof NotifPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSavingPrefs(true)
    setPrefsError(false)
    const response = await fetch('/api/client/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: next[key] }),
    })
    if (!response.ok) {
      setPrefs(prefs)
      setPrefsError(true)
    }
    setSavingPrefs(false)
  }

  function setTrainingReminderCount(count: number) {
    setSchedule((current) => ({
      ...current,
      training_reminder_times: count === 1
        ? [current.training_reminder_times[0] || '08:00']
        : [current.training_reminder_times[0] || '08:00', current.training_reminder_times[1] || '18:00'],
    }))
    setScheduleState('idle')
  }

  function setTrainingReminderTime(index: number, value: string) {
    setSchedule((current) => ({
      ...current,
      training_reminder_times: current.training_reminder_times.map((time, timeIndex) =>
        timeIndex === index ? value : time,
      ),
    }))
    setScheduleState('idle')
  }

  async function saveReminderSchedule() {
    setSavingSchedule(true)
    setScheduleState('idle')
    const response = await fetch('/api/client/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    })
    setSavingSchedule(false)
    setScheduleState(response.ok ? 'saved' : 'error')
  }

  async function testPush() {
    setTestingPush(true)
    setPushTestResult(null)
    try {
      let response = await fetch('/api/client/push/test', { method: 'POST' })
      let result = await response.json().catch(() => null)

      if (!response.ok && result?.reason === 'web_push_rejected') {
        const renewedToken = await subscribeToPush({ forceRenew: true })
        if (renewedToken) {
          const saved = await fetch('/api/client/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ push_token: renewedToken }),
          })
          if (saved.ok) {
            response = await fetch('/api/client/push/test', { method: 'POST' })
            result = await response.json().catch(() => null)
          }
        }
      }

      setPushTestResult(response.ok ? 'ok' : 'error')
    } catch {
      setPushTestResult('error')
    } finally {
      setTestingPush(false)
    }
  }

  async function activatePush() {
    if (pushPermission === 'unsupported') return
    setActivatingPush(true)
    setPushActivationError(false)
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') return

      const pushToken = await subscribeToPush()
      if (!pushToken) throw new Error('subscription_unavailable')
      const response = await fetch('/api/client/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_token: pushToken }),
      })
      if (!response.ok) throw new Error('subscription_save_failed')
    } catch {
      setPushActivationError(true)
    } finally {
      setActivatingPush(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Notification preferences */}
      <div className="pt-4">
        <p className="text-[10px] font-bold text-secondary uppercase tracking-wide mb-3">
          {t('notif.prefsTitle')}
        {savingPrefs && <Loader2 size={10} className="inline ml-1.5 animate-spin" />}
        </p>
        {prefsError && <p className="mb-2 text-[11px] text-red-300">Impossible d’enregistrer cette préférence.</p>}
        <div className="flex flex-col gap-2">
          <PrefToggle
            label={t('notif.sessionReminder')}
            value={prefs.notif_session_reminder}
            onChange={() => togglePref('notif_session_reminder')}
          />
          <PrefToggle
            label={t('notif.bilanReceived')}
            value={prefs.notif_bilan_received}
            onChange={() => togglePref('notif_bilan_received')}
          />
          <PrefToggle
            label={t('notif.programUpdated')}
            value={prefs.notif_program_updated}
            onChange={() => togglePref('notif_program_updated')}
          />
          <PrefToggle
            label="Rappels de check-in"
            value={prefs.notif_checkin_reminder}
            onChange={() => togglePref('notif_checkin_reminder')}
          />
          <PrefToggle
            label="Rappels d’hydratation"
            value={prefs.notif_hydration_reminder}
            onChange={() => togglePref('notif_hydration_reminder')}
          />
          <PrefToggle
            label="Repas non renseignés"
            value={prefs.notif_meal_reminder}
            onChange={() => togglePref('notif_meal_reminder')}
          />
          <PrefToggle
            label="Objectif protéines"
            value={prefs.notif_protein_reminder}
            onChange={() => togglePref('notif_protein_reminder')}
          />
          <PrefToggle
            label="Messages de mon coach"
            value={prefs.notif_coach_messages}
            onChange={() => togglePref('notif_coach_messages')}
          />
          <PrefToggle
            label="Progression et récompenses"
            value={prefs.notif_progress_updates}
            onChange={() => togglePref('notif_progress_updates')}
          />
        </div>
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-white/80">Horaires des rappels</p>
              <p className="mt-1 text-[11px] leading-5 text-white/45">Les rappels s’adaptent à ton fuseau horaire.</p>
            </div>
            {savingSchedule && <Loader2 size={13} className="shrink-0 animate-spin text-white/55" />}
          </div>

          <div className="mt-4 space-y-3">
            <fieldset>
              <legend className="text-[11px] font-medium text-white/75">Entraînement</legend>
              <p className="mt-1 text-[10px] leading-4 text-white/40">Jusqu’à deux rappels : le second est envoyé seulement si la séance est encore en attente.</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/55">{schedule.training_reminder_times.length} rappel{schedule.training_reminder_times.length > 1 ? 's' : ''}</span>
                <input
                  aria-label="Nombre de rappels d’entraînement"
                  type="range"
                  min="1"
                  max="2"
                  step="1"
                  value={schedule.training_reminder_times.length}
                  onChange={(event) => setTrainingReminderCount(Number(event.target.value))}
                  className="w-28 accent-white"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {schedule.training_reminder_times.map((time, index) => (
                  <label key={index} className="text-[10px] text-white/45">
                    {index === 0 ? 'Rappel prévu' : 'Rappel si non terminée'}
                    <input
                      type="time"
                      step="300"
                      value={time}
                      onChange={(event) => setTrainingReminderTime(index, event.target.value)}
                      className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-[12px] text-white outline-none focus:border-white/45"
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="border-t border-white/[0.06] pt-3">
              <legend className="text-[11px] font-medium text-white/75">Hydratation</legend>
              <p className="mt-1 text-[10px] leading-4 text-white/40">Les alertes sont réparties régulièrement entre la première heure choisie et 21 h.</p>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-3">
                <label className="text-[10px] text-white/45">
                  Première alerte
                  <input
                    type="time"
                    step="300"
                    value={schedule.hydration_reminder_first_time}
                    onChange={(event) => { setSchedule((current) => ({ ...current, hydration_reminder_first_time: event.target.value })); setScheduleState('idle') }}
                    className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-[12px] text-white outline-none focus:border-white/45"
                  />
                </label>
                <span className="pb-2 text-[11px] font-medium text-white/70">{schedule.hydration_reminder_count}/jour</span>
              </div>
              <input
                aria-label="Nombre de rappels d’hydratation"
                type="range"
                min="1"
                max="10"
                step="1"
                value={schedule.hydration_reminder_count}
                onChange={(event) => { setSchedule((current) => ({ ...current, hydration_reminder_count: Number(event.target.value) })); setScheduleState('idle') }}
                className="mt-2 w-full accent-white"
              />
            </fieldset>

            <fieldset className="border-t border-white/[0.06] pt-3">
              <legend className="text-[11px] font-medium text-white/75">Suivi nutritionnel</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <ReminderTimeField label="Petit-déjeuner" value={schedule.meal_reminder_breakfast_time} onChange={(value) => { setSchedule((current) => ({ ...current, meal_reminder_breakfast_time: value })); setScheduleState('idle') }} />
                <ReminderTimeField label="Déjeuner" value={schedule.meal_reminder_lunch_time} onChange={(value) => { setSchedule((current) => ({ ...current, meal_reminder_lunch_time: value })); setScheduleState('idle') }} />
                <ReminderTimeField label="Protéines" value={schedule.protein_reminder_time} onChange={(value) => { setSchedule((current) => ({ ...current, protein_reminder_time: value })); setScheduleState('idle') }} />
              </div>
            </fieldset>
          </div>

          <button
            type="button"
            onClick={saveReminderSchedule}
            disabled={savingSchedule}
            className="mt-4 h-9 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-white/80 disabled:opacity-50"
          >
            Enregistrer les horaires
          </button>
          {scheduleState === 'saved' && <p className="mt-2 text-[11px] text-emerald-300">Horaires enregistrés.</p>}
          {scheduleState === 'error' && <p className="mt-2 text-[11px] text-red-300">Impossible d’enregistrer les horaires.</p>}
        </div>
        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <p className="text-[12px] font-medium text-white/80">Notifications push</p>
          <p className="mt-1 text-[11px] leading-5 text-white/45">
            {pushPermission === 'granted'
              ? 'Activées sur cet appareil.'
              : pushPermission === 'denied'
                ? 'Bloquées par les réglages de cet appareil.'
                : pushPermission === 'unsupported'
                  ? 'Non prises en charge par ce navigateur.'
                  : 'À activer pour recevoir les alertes même lorsque l’application est fermée.'}
          </p>
          {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={activatePush}
              disabled={activatingPush}
              className="mt-3 h-9 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white/75 disabled:opacity-50"
            >
              {activatingPush ? 'Activation…' : 'Activer les notifications push'}
            </button>
          )}
          {pushActivationError && <p className="mt-2 text-[11px] text-red-300">Impossible d’activer les notifications sur cet appareil.</p>}
        </div>
        <button
          type="button"
          onClick={testPush}
          disabled={testingPush}
          className="mt-4 h-9 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/70 disabled:opacity-50"
        >
          {testingPush ? 'Test en cours…' : 'Tester une notification'}
        </button>
        {pushTestResult === 'ok' && (
          <p className="mt-2 text-[11px] text-emerald-300">Test envoyé. Vérifie le centre de notifications.</p>
        )}
        {pushTestResult === 'error' && (
          <p className="mt-2 text-[11px] text-red-300">Le push n’a pas pu être envoyé. La souscription a été renouvelée automatiquement si elle était expirée ; si le problème continue, les variables VAPID du serveur déployé doivent être vérifiées.</p>
        )}
      </div>
    </div>
  )
}

function ReminderTimeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="text-[10px] text-white/45">
      {label}
      <input
        type="time"
        step="300"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-black/20 px-2 text-[12px] text-white outline-none focus:border-white/45"
      />
    </label>
  )
}

function PrefToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-primary">{label}</span>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={value}
        className={`relative w-11 h-6 rounded-full border transition-colors ${value ? 'border-[#73d39a] bg-[#73d39a]' : 'border-white/10 bg-white/[0.10]'}`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full shadow-sm transition-all ${
            value ? 'left-6 bg-[#0d0d0d]' : 'left-1 bg-white/70'
          }`}
        />
      </button>
    </div>
  )
}
