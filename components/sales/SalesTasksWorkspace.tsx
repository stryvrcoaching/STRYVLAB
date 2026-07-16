'use client'

import { FormEvent, useEffect, useState } from 'react'
import { CalendarClock, Check, Loader2, Plus } from 'lucide-react'

type Lead = { id: string; contact_name: string }
type Task = { id: string; title: string; details: string | null; due_at: string | null; completed_at: string | null; lead_id: string | null; created_at: string }

function toLocalDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function formatDate(value: string | null) {
  if (!value) return 'Sans date'
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function SalesTasksWorkspace() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    const [tasksResponse, leadsResponse] = await Promise.all([fetch('/api/sales/tasks', { cache: 'no-store' }), fetch('/api/sales/leads', { cache: 'no-store' })])
    const tasksPayload = await tasksResponse.json().catch(() => null)
    const leadsPayload = await leadsResponse.json().catch(() => null)
    if (!tasksResponse.ok) setError(tasksPayload?.error ?? 'Chargement impossible')
    else setTasks(tasksPayload.tasks ?? [])
    if (leadsResponse.ok) setLeads(leadsPayload.leads ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [])

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')
    const formData = new FormData(event.currentTarget)
    const dueAt = String(formData.get('dueAt') ?? '')
    const response = await fetch('/api/sales/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: formData.get('title'), details: formData.get('details') || null, leadId: formData.get('leadId') || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null }) })
    const payload = await response.json().catch(() => null)
    if (!response.ok) setError(payload?.error ?? 'Création impossible')
    else { setTasks((current) => [...current, payload.task]); event.currentTarget.reset() }
    setCreating(false)
  }

  async function toggleTask(task: Task) {
    const response = await fetch(`/api/sales/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !task.completed_at }) })
    const payload = await response.json().catch(() => null)
    if (!response.ok) { setError(payload?.error ?? 'Mise à jour impossible'); return }
    setTasks((current) => current.map((item) => item.id === task.id ? payload.task : item))
  }

  const activeTasks = tasks.filter((task) => !task.completed_at)
  const completedTasks = tasks.filter((task) => task.completed_at)
  const leadNames = new Map(leads.map((lead) => [lead.id, lead.contact_name]))
  const formControlClassName = 'h-12 min-w-0 w-full rounded-xl border border-white/[0.10] bg-black/20 px-3 text-base text-white outline-none focus:border-white/45 md:h-11 md:text-sm'

  return (
    <div className="space-y-7">
      <section>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Organisation</p>
        <h1 className="mt-2 font-barlow text-4xl font-semibold uppercase leading-none tracking-[-0.04em] sm:text-5xl">Vos actions</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">Centralisez vos relances, préparations de démo et rendez-vous de vente.</p>
      </section>

      <form onSubmit={createTask} className="grid grid-cols-1 gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5 md:grid-cols-[minmax(0,1fr)_190px_190px_auto]">
        <input required name="title" className={formControlClassName} placeholder="Ex. Préparer la démo de demain" />
        <select name="leadId" defaultValue="" className={formControlClassName}><option value="">Sans prospect lié</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.contact_name}</option>)}</select>
        <div className="relative min-w-0">
          <CalendarClock aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/42" />
          <input aria-label="Date et heure d’échéance" title="Date et heure d’échéance" name="dueAt" type="datetime-local" className={`${formControlClassName} pl-10`} />
        </div>
        <button disabled={creating} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] px-4 text-[11px] font-bold uppercase tracking-[0.11em] text-[#111315] disabled:opacity-55 md:h-11 md:w-auto">{creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Ajouter</button>
        <textarea name="details" rows={2} className="w-full rounded-xl border border-white/[0.10] bg-black/20 p-3 text-base text-white outline-none focus:border-white/45 md:col-span-4 md:text-sm" placeholder="Note ou contexte utile (optionnel)." />
      </form>

      {error ? <p role="alert" className="rounded-xl border border-red-300/15 bg-red-400/[0.07] px-4 py-3 text-sm text-red-100">{error}</p> : null}

      {loading ? <div className="h-48 animate-pulse rounded-[24px] bg-white/[0.03]" /> : <section className="grid gap-5 xl:grid-cols-[1fr_0.65fr]">
        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/36">À traiter · {activeTasks.length}</p>
          <div className="mt-4 space-y-2">{activeTasks.length ? activeTasks.map((task) => <article key={task.id} className="flex items-start gap-3 rounded-xl border border-white/[0.055] bg-black/15 p-3"><button aria-label={`Terminer ${task.title}`} onClick={() => void toggleTask(task)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 text-transparent transition hover:border-white hover:text-white"><Check size={17} /></button><div className="min-w-0 py-1"><p className="text-[14px] font-medium text-white/88">{task.title}</p>{task.details ? <p className="mt-1 text-[12px] leading-5 text-white/42">{task.details}</p> : null}<p className="mt-2 text-[11px] text-white/55">{formatDate(task.due_at)}{task.lead_id && leadNames.get(task.lead_id) ? ` · ${leadNames.get(task.lead_id)}` : ''}</p></div></article>) : <p className="rounded-xl border border-dashed border-white/[0.09] px-4 py-8 text-center text-[12px] text-white/42">Aucune action en attente.</p>}</div>
        </div>
        <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/36">Terminé · {completedTasks.length}</p>
          <div className="mt-4 space-y-2">{completedTasks.length ? completedTasks.slice(0, 8).map((task) => <article key={task.id} className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-black/10 p-3 opacity-55"><button aria-label={`Réouvrir ${task.title}`} onClick={() => void toggleTask(task)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#111315]"><Check size={17} /></button><p className="py-2 text-[13px] leading-5 line-through">{task.title}</p></article>) : <p className="text-[12px] text-white/38">Vos actions terminées apparaîtront ici.</p>}</div>
        </div>
      </section>}
    </div>
  )
}
