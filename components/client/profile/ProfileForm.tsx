'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import type { ClientDictKey } from '@/lib/i18n/clientTranslations'

interface ProfileData {
  first_name:       string
  last_name:        string
  phone:            string
  goal:             string
  date_of_birth:    string
  gender:           string
  training_goal:    string
  fitness_level:    string
  sport_practice:   string
  weekly_frequency: number | null
}

interface Props {
  clientId: string
  initial: ProfileData
}

const TRAINING_GOAL_KEYS: { value: string; key: ClientDictKey }[] = [
  { value: 'hypertrophy',  key: 'form.goal.hypertrophy' },
  { value: 'strength',     key: 'form.goal.strength' },
  { value: 'fat_loss',     key: 'form.goal.fat_loss' },
  { value: 'endurance',    key: 'form.goal.endurance' },
  { value: 'recomp',       key: 'form.goal.recomp' },
  { value: 'maintenance',  key: 'form.goal.maintenance' },
  { value: 'athletic',     key: 'form.goal.athletic' },
]

const FITNESS_LEVEL_KEYS: { value: string; key: ClientDictKey }[] = [
  { value: 'beginner',     key: 'form.level.beginner' },
  { value: 'intermediate', key: 'form.level.intermediate' },
  { value: 'advanced',     key: 'form.level.advanced' },
  { value: 'elite',        key: 'form.level.elite' },
]

const SPORT_PRACTICE_KEYS: { value: string; key: ClientDictKey }[] = [
  { value: 'sedentary', key: 'form.activity.sedentary' },
  { value: 'light',     key: 'form.activity.light' },
  { value: 'moderate',  key: 'form.activity.moderate' },
  { value: 'active',    key: 'form.activity.active' },
  { value: 'athlete',   key: 'form.activity.athlete' },
]

const GENDER_KEYS: { value: string; key: ClientDictKey }[] = [
  { value: 'male',              key: 'form.gender.male' },
  { value: 'female',            key: 'form.gender.female' },
  { value: 'other',             key: 'form.gender.other' },
  { value: 'prefer_not_to_say', key: 'form.gender.prefer_not_to_say' },
]

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function ProfileForm({ clientId, initial }: Props) {
  const { t } = useClientT()
  const [form, setForm] = useState<ProfileData>(initial)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function update(field: keyof ProfileData, value: string | number | null) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (saveState === 'saved' || saveState === 'error') setSaveState('idle')
  }

  async function handleSave() {
    setSaveState('saving')
    setErrorMsg(null)

    const res = await fetch('/api/client/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name:       form.first_name || undefined,
        last_name:        form.last_name || undefined,
        phone:            form.phone || null,
        goal:             form.goal || null,
        date_of_birth:    form.date_of_birth || null,
        gender:           form.gender || null,
        training_goal:    form.training_goal || null,
        fitness_level:    form.fitness_level || null,
        sport_practice:   form.sport_practice || null,
        weekly_frequency: form.weekly_frequency,
      }),
    })

    if (res.ok) {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } else {
      const d = await res.json().catch(() => ({}))
      setErrorMsg(d.error ?? t('form.error.save'))
      setSaveState('error')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Nom */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('form.firstName')}>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            className={inputCls}
            placeholder={t('form.firstName')}
          />
        </Field>
        <Field label={t('form.lastName')}>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            className={inputCls}
            placeholder={t('form.lastName')}
          />
        </Field>
      </div>

      {/* Téléphone */}
      <Field label={t('form.phone')}>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          className={inputCls}
          placeholder="+32 XXX XX XX XX"
        />
      </Field>

      {/* Date de naissance */}
      <Field label={t('form.birthDate')}>
        <input
          type="date"
          value={form.date_of_birth}
          onChange={(e) => update('date_of_birth', e.target.value)}
          className={inputCls}
        />
      </Field>

      {/* Genre */}
      <Field label={t('form.gender')}>
        <select
          value={form.gender}
          onChange={(e) => update('gender', e.target.value)}
          className={inputCls}
        >
          <option value="">{t('common.select')}</option>
          {GENDER_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.key)}</option>
          ))}
        </select>
      </Field>

      {/* Objectif texte libre */}
      <Field label={t('form.goal')}>
        <textarea
          value={form.goal}
          onChange={(e) => update('goal', e.target.value)}
          className={`${inputCls} resize-none h-16 py-3`}
          placeholder={t('form.goal.placeholder')}
        />
      </Field>

      {/* Objectif entraînement */}
      <Field label={t('form.trainingGoal')}>
        <select
          value={form.training_goal}
          onChange={(e) => update('training_goal', e.target.value)}
          className={inputCls}
        >
          <option value="">{t('common.select')}</option>
          {TRAINING_GOAL_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.key)}</option>
          ))}
        </select>
      </Field>

      {/* Niveau */}
      <Field label={t('form.fitnessLevel')}>
        <select
          value={form.fitness_level}
          onChange={(e) => update('fitness_level', e.target.value)}
          className={inputCls}
        >
          <option value="">{t('common.select')}</option>
          {FITNESS_LEVEL_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.key)}</option>
          ))}
        </select>
      </Field>

      {/* Activité */}
      <Field label={t('form.activityLevel')}>
        <select
          value={form.sport_practice}
          onChange={(e) => update('sport_practice', e.target.value)}
          className={inputCls}
        >
          <option value="">{t('common.select')}</option>
          {SPORT_PRACTICE_KEYS.map((o) => (
            <option key={o.value} value={o.value}>{t(o.key)}</option>
          ))}
        </select>
      </Field>

      {/* Fréquence */}
      <Field label={t('form.sessionsPerWeek')}>
        <div className="flex gap-2">
          {[1,2,3,4,5,6,7].map((n) => (
            <button
              key={n}
              onClick={() => update('weekly_frequency', form.weekly_frequency === n ? null : n)}
              className={`w-9 h-9 rounded-xl text-[13px] font-bold transition-all ${
                form.weekly_frequency === n
                  ? 'bg-[#f2f2f2] text-[#080808]'
                  : 'bg-[#1a1a1a] text-[#5a5a5a] hover:text-[#808080]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      {/* Error */}
      {saveState === 'error' && errorMsg && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saveState === 'saving'}
        className={`w-full h-11 rounded-xl text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.10em] transition-all flex items-center justify-center gap-2 ${
          saveState === 'saved'
            ? 'bg-[#f2f2f2] text-[#080808]'
            : 'bg-[#f2f2f2] text-[#080808] hover:bg-[#e0e0e0] active:scale-[0.99] disabled:opacity-50'
        }`}
      >
        {saveState === 'saving' && <Loader2 size={14} className="animate-spin" />}
        {saveState === 'saved'  && <Check size={14} />}
        {saveState === 'saved' ? t('common.saved') : saveState === 'saving' ? t('common.saving') : t('common.save')}
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-white/40 uppercase tracking-[0.14em] block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full bg-[#1e1e1e] border border-white/[0.08] rounded-xl px-3 h-11 text-[13px] text-white outline-none placeholder:text-[#5a5a5a] transition-colors focus:border-white/20'
