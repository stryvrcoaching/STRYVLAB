'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Restriction {
  id: string
  label: string
  body_part: string
  severity: 'avoid' | 'limit' | 'monitor'
  event_date: string
  body?: string | null
}

const BODY_PART_LABELS: Record<string, string> = {
  shoulder_right: 'Épaule droite',
  shoulder_left:  'Épaule gauche',
  elbow_right:    'Coude droit',
  elbow_left:     'Coude gauche',
  wrist_right:    'Poignet droit',
  wrist_left:     'Poignet gauche',
  knee_right:     'Genou droit',
  knee_left:      'Genou gauche',
  hip_right:      'Hanche droite',
  hip_left:       'Hanche gauche',
  lower_back:     'Bas du dos',
  upper_back:     'Haut du dos',
  neck:           'Nuque / cou',
  ankle_right:    'Cheville droite',
  ankle_left:     'Cheville gauche',
}

const SEVERITY_CONFIG = {
  avoid:   { label: 'Éviter',     bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/20' },
  limit:   { label: 'Limiter',    bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  monitor: { label: 'Surveiller', bg: 'bg-white/[0.04]', text: 'text-white/50',  border: 'border-white/[0.06]' },
}

const EQUIPMENT_OPTIONS = [
  { slug: 'barre',       label: 'Barre' },
  { slug: 'halteres',    label: 'Haltères' },
  { slug: 'machine',     label: 'Machine' },
  { slug: 'poulie',      label: 'Poulie / Câbles' },
  { slug: 'kettlebell',  label: 'Kettlebell' },
  { slug: 'smith',       label: 'Smith machine' },
  { slug: 'trx',         label: 'TRX / Suspension' },
  { slug: 'elastiques',  label: 'Élastiques' },
]

interface Props {
  clientId: string
  section?: 'all' | 'restrictions' | 'equipment'
}

export default function RestrictionsWidget({ clientId, section = 'all' }: Props) {
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [equipment, setEquipment] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formBodyPart, setFormBodyPart] = useState('')
  const [formSeverity, setFormSeverity] = useState<'avoid' | 'limit' | 'monitor'>('avoid')
  const [formLabel, setFormLabel] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetch(`/api/clients/${clientId}/intelligence-profile`)
      .then(r => r.json())
      .then(data => {
        // The intelligence-profile endpoint returns injuries as {bodyPart, severity}
        // but we need to fetch annotations directly for id/label/body
        return fetch(`/api/clients/${clientId}/annotations`)
      })
      .then(r => r.json())
      .then(data => {
        const injuryAnnotations = (Array.isArray(data) ? data : [])
          .filter((a: Record<string, unknown>) => a.event_type === 'injury' && a.body_part)
        setRestrictions(injuryAnnotations.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          label: a.label as string,
          body_part: a.body_part as string,
          severity: a.severity as 'avoid' | 'limit' | 'monitor',
          event_date: a.event_date as string,
          body: a.body as string | null,
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Load equipment separately
    fetch(`/api/clients/${clientId}/intelligence-profile`)
      .then(r => r.json())
      .then(data => setEquipment(data.equipment ?? []))
      .catch(() => {})
  }, [clientId])

  async function handleAdd() {
    if (!formBodyPart || !formLabel) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'injury',
        event_date: formDate,
        label: formLabel,
        body: formNote || null,
        body_part: formBodyPart,
        severity: formSeverity,
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
      setFormLabel('')
      setFormNote('')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/clients/${clientId}/annotations/${id}`, { method: 'DELETE' })
    setRestrictions(prev => prev.filter(r => r.id !== id))
  }

  async function handleEquipmentToggle(slug: string) {
    // poulie and cables are aliases in the scoring engine — keep them in sync
    const aliases: Record<string, string> = { poulie: 'cables', cables: 'poulie' }
    const active = equipment.includes(slug)
    let next = active
      ? equipment.filter(e => e !== slug && e !== (aliases[slug] ?? ''))
      : [...equipment.filter(e => e !== (aliases[slug] ?? '')), slug, ...(aliases[slug] ? [aliases[slug]] : [])]
    setEquipment(next)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment: next }),
    })
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Restrictions physiques */}
      {section !== 'equipment' && <div>
        <div className={`flex items-center mb-3 ${section === 'all' ? 'justify-between' : 'justify-end'}`}>
          {section === 'all' && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Restrictions</p>}
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1f8a65] hover:opacity-80 transition-opacity"
          >
            <Plus size={12} />
            Ajouter
          </button>
        </div>

        {restrictions.length === 0 && !showForm && (
          <p className="text-[12px] text-white/30 py-2">Aucune restriction enregistrée.</p>
        )}

        <div className="flex flex-col gap-2">
          {restrictions.map(r => {
            const cfg = SEVERITY_CONFIG[r.severity]
            return (
              <div key={r.id} className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2.5`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-white">{BODY_PART_LABELS[r.body_part] ?? r.body_part}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5">{r.label}</p>
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

        {showForm && (
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Zone</label>
              <select
                value={formBodyPart}
                onChange={e => setFormBodyPart(e.target.value)}
                className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white outline-none border-none"
              >
                <option value="">Sélectionner…</option>
                {Object.entries(BODY_PART_LABELS).map(([slug, label]) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Niveau</label>
              <div className="flex gap-2">
                {(['avoid', 'limit', 'monitor'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormSeverity(s)}
                    className={`flex-1 h-8 rounded-lg text-[10px] font-bold transition-colors ${
                      formSeverity === s
                        ? `${SEVERITY_CONFIG[s].bg} ${SEVERITY_CONFIG[s].text} border ${SEVERITY_CONFIG[s].border}`
                        : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'
                    }`}
                  >
                    {SEVERITY_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Label</label>
              <input
                value={formLabel}
                onChange={e => setFormLabel(e.target.value)}
                placeholder="ex: Tendinite rotateurs"
                className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Date</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Note (optionnel)</label>
              <textarea
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                placeholder="Détails, contexte, protocole kiné…"
                rows={2}
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2 text-[13px] text-white placeholder:text-white/20 outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 h-9 rounded-xl bg-white/[0.04] text-[12px] text-white/50 hover:text-white/70 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!formBodyPart || !formLabel || saving}
                className="flex-1 h-9 rounded-xl bg-[#1f8a65] text-[12px] font-bold text-white hover:bg-[#217356] disabled:opacity-50 transition-colors"
              >
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>}

      {/* Équipement disponible */}
      {section !== 'restrictions' && <div>
        {section === 'all' && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3">Équipement</p>}
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map(eq => {
            const active = equipment.includes(eq.slug)
            return (
              <button
                key={eq.slug}
                type="button"
                onClick={() => handleEquipmentToggle(eq.slug)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                    : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05] hover:text-white/60'
                }`}
              >
                {eq.label}
              </button>
            )
          })}
        </div>
      </div>}
    </div>
  )
}
