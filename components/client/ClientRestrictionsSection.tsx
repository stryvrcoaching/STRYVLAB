'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface Restriction {
  id: string
  label: string
  body_part: string
  severity: 'avoid' | 'limit' | 'monitor'
  event_date: string
  body?: string | null
}

const BODY_PART_KEYS = [
  'shoulder_right', 'shoulder_left', 'elbow_right', 'elbow_left',
  'wrist_right', 'wrist_left', 'knee_right', 'knee_left',
  'hip_right', 'hip_left', 'lower_back', 'upper_back',
  'neck', 'ankle_right', 'ankle_left',
] as const

const SEVERITY_BG: Record<string, { bg: string; text: string; border: string }> = {
  avoid:   { bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/20' },
  limit:   { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  monitor: { bg: 'bg-[#1a1a1a]', text: 'text-[#808080]', border: '' },
}

export default function ClientRestrictionsSection() {
  const { t } = useClientT()

  const bodyPartLabel = (slug: string) => t((`restrict.body.${slug}`) as Parameters<typeof t>[0]) || slug

  const SEVERITY_PROMPTS = [
    { value: 'avoid'   as const, label: t('restrict.sev.avoid.label'),   desc: t('restrict.sev.avoid.desc') },
    { value: 'limit'   as const, label: t('restrict.sev.limit.label'),   desc: t('restrict.sev.limit.desc') },
    { value: 'monitor' as const, label: t('restrict.sev.monitor.label'), desc: t('restrict.sev.monitor.desc') },
  ]

  const SEVERITY_CONFIG = {
    avoid:   { label: t('restrict.cfg.avoid'),   ...SEVERITY_BG.avoid },
    limit:   { label: t('restrict.cfg.limit'),   ...SEVERITY_BG.limit },
    monitor: { label: t('restrict.cfg.monitor'), ...SEVERITY_BG.monitor },
  }
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formBodyPart, setFormBodyPart] = useState('')
  const [formSeverity, setFormSeverity] = useState<'avoid' | 'limit' | 'monitor'>('avoid')
  const [formNote, setFormNote] = useState('')

  useEffect(() => {
    fetch('/api/client/restrictions')
      .then(r => r.ok ? r.json() : [])
      .then(data => setRestrictions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!formBodyPart) return
    const autoLabel = `${bodyPartLabel(formBodyPart)} — ${SEVERITY_PROMPTS.find(s => s.value === formSeverity)?.label ?? ''}`
    setSaving(true)
    const res = await fetch('/api/client/restrictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bodyPart: formBodyPart,
        severity: formSeverity,
        label: autoLabel,
        note: formNote || null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setRestrictions(prev => [...prev, {
        id: created.id,
        label: created.label,
        body_part: created.body_part,
        severity: created.severity,
        event_date: created.event_date,
        body: created.body,
      }])
      setShowForm(false)
      setFormBodyPart('')
      setFormNote('')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/client/restrictions/${id}`, { method: 'DELETE' })
    setRestrictions(prev => prev.filter(r => r.id !== id))
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="h-px bg-white/[0.07]" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{t('restrict.title')}</p>
          <p className="text-[12px] text-white/40 mt-0.5">{t('restrict.desc')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/[0.04] text-[11px] font-semibold text-white/60 hover:bg-white/[0.07] hover:text-white transition-colors"
        >
          <Plus size={12} />
          {t('restrict.add')}
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      )}

      {!loading && restrictions.length === 0 && !showForm && (
        <p className="text-[12px] text-white/30 py-1">{t('restrict.empty')}</p>
      )}

      {!loading && (
        <div className="flex flex-col gap-2">
          {restrictions.map(r => {
            const cfg = SEVERITY_CONFIG[r.severity]
            return (
              <div key={r.id} className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2.5`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-white">{bodyPartLabel(r.body_part)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  {r.body && <p className="text-[10px] text-white/30 mt-0.5 italic">{r.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="text-white/20 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl bg-white/[0.02] p-3 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">{t('restrict.zone')}</label>
            <select
              value={formBodyPart}
              onChange={e => setFormBodyPart(e.target.value)}
              className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white outline-none border-none"
            >
              <option value="">{t('restrict.select')}</option>
              {BODY_PART_KEYS.map(slug => (
                <option key={slug} value={slug}>{bodyPartLabel(slug)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">{t('restrict.situation')}</label>
            <div className="flex flex-col gap-1.5">
              {SEVERITY_PROMPTS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFormSeverity(s.value)}
                  className={`flex items-start gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                    formSeverity === s.value
                      ? 'bg-[#2e2e2e]'
                      : 'bg-[#111111] hover:bg-[#1a1a1a]'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${
                    formSeverity === s.value ? 'bg-[#f2f2f2]' : 'bg-[#404040]'
                  }`} />
                  <div>
                    <p className={`text-[12px] font-semibold ${formSeverity === s.value ? 'text-[#f2f2f2]' : 'text-white/70'}`}>{s.label}</p>
                    <p className="text-[10px] text-white/30">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">{t('restrict.note')}</label>
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              placeholder={t('restrict.notePlaceholder')}
              rows={2}
              className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2 text-[13px] text-white placeholder:text-white/20 outline-none resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 h-9 rounded-xl bg-white/[0.04] text-[12px] text-white/50 hover:text-white/70 font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!formBodyPart || saving}
              className="flex-1 h-9 rounded-xl bg-[#f2f2f2] text-[12px] font-barlow-condensed font-bold uppercase text-[#080808] hover:bg-[#e0e0e0] disabled:opacity-50 transition-colors"
            >
              {saving ? '…' : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
