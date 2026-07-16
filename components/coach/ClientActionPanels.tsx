'use client'

import type { ClientActionItem } from '@/lib/coach/client-action-items'

const DRAWER_TOP_OFFSET = 88
const DRAWER_WIDTH = 392

function actionLabel(action: ClientActionItem['primaryAction']) {
  switch (action) {
    case 'assign_formula':
      return 'Attribuer une formule'
    case 'open_notifications':
      return 'Ouvrir les notifications'
    case 'open_assessments':
      return 'Voir le bilan'
    case 'plan_follow_up':
      return 'Planifier le suivi'
    default:
      return 'Ouvrir le profil'
  }
}

function priorityLabel(priority: ClientActionItem['priority']) {
  switch (priority) {
    case 'urgent':
      return 'Urgent'
    case 'important':
      return 'Important'
    default:
      return 'À planifier'
  }
}

function priorityClassName(priority: ClientActionItem['priority']) {
  switch (priority) {
    case 'urgent':
      return 'border-[#ff7a7a]/20 bg-[#ff7a7a]/10 text-[#ff9b9b]'
    case 'important':
      return 'border-[#f6c451]/20 bg-[#f6c451]/10 text-[#f6d57c]'
    default:
      return 'border-white/[0.08] bg-white/[0.04] text-white/55'
  }
}

function categoryLabel(kind: ClientActionItem['kind']) {
  switch (kind) {
    case 'missing_formula':
      return 'Commercial'
    case 'assessment_review':
      return 'Suivi'
    case 'coach_notification':
      return 'Échange'
    case 'upcoming_event_preparation':
      return 'Organisation'
    case 'kanban_blocker':
      return 'Organisation'
    case 'planned_follow_up':
      return 'Relance'
    default:
      return 'Priorité'
  }
}

export default function ClientActionPanels(props: {
  withoutFormulaOpen: boolean
  toFollowOpen: boolean
  withoutFormula: Array<{ clientId: string; clientName: string; createdAt: string | null }>
  toFollow: ClientActionItem[]
  onCloseWithoutFormula: () => void
  onCloseToFollow: () => void
  onHeaderWithoutFormulaClick: () => void
  onHeaderToFollowClick: () => void
  onOpenClient: (clientId: string) => void
  onAssignFormula: (clientId: string) => void
  onOpenNotifications: (clientId: string) => void
  onOpenAssessments: (clientId: string) => void
  onOpenKanban: (item: ClientActionItem) => void
  onPlanPriority: (item: ClientActionItem, mode: 'agenda' | 'kanban' | 'both') => void
  onRequestPlanChoice: (item: ClientActionItem, suggestedMode: 'agenda' | 'kanban' | 'both') => void
  onMarkTreated: (item: ClientActionItem) => void
}) {
  const runPrimaryAction = (item: ClientActionItem) => {
    if (item.primaryAction === 'assign_formula') return props.onAssignFormula(item.clientId)
    if (item.primaryAction === 'open_notifications') return props.onOpenNotifications(item.clientId)
    if (item.primaryAction === 'open_assessments') return props.onOpenAssessments(item.clientId)
    if (item.primaryAction === 'create_alert') return props.onRequestPlanChoice(item, 'agenda')
    if (item.primaryAction === 'create_kanban_task') return props.onRequestPlanChoice(item, 'kanban')
    if (item.primaryAction === 'create_alert_and_task') return props.onRequestPlanChoice(item, 'both')
    if (item.primaryAction === 'open_kanban_item') return props.onOpenKanban(item)
    return props.onOpenClient(item.clientId)
  }

  return (
    <>
      {props.withoutFormulaOpen && (
        <aside
          className="fixed right-0 bottom-0 z-[64] border-l-[0.3px] border-white/[0.013] bg-[#121212]"
          style={{ top: DRAWER_TOP_OFFSET, height: `calc(100vh - ${DRAWER_TOP_OFFSET}px)`, width: DRAWER_WIDTH }}
        >
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 border-b-[0.3px] border-white/[0.013] bg-[#121212] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  aria-label="Afficher les clients sans formule"
                  onClick={props.onHeaderWithoutFormulaClick}
                  className="min-w-0 flex-1 rounded-2xl border border-transparent px-1 py-1 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">Clients</p>
                  <h2 className="mt-2 text-[22px] font-semibold text-white">Sans formule</h2>
                  <p className="mt-1 text-[12px] text-white/45">
                    {props.withoutFormula.length} client{props.withoutFormula.length > 1 ? 's' : ''} à traiter
                  </p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/36">
                    Cliquer pour filtrer la vue
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Fermer le panneau sans formule"
                  onClick={props.onCloseWithoutFormula}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-subtle bg-[#181818] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {props.withoutFormula.map((row) => (
                  <article key={row.clientId} className="rounded-2xl bg-[#181818] border-subtle p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{row.clientName}</p>
                        <p className="mt-3 text-[14px] text-white/72">Aucune formule active</p>
                        <p className="mt-1 text-[10px] text-white/30 font-medium">
                          {row.createdAt ? `Entré le ${new Date(row.createdAt).toLocaleDateString('fr-FR')}` : 'À qualifier'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => props.onAssignFormula(row.clientId)}
                        className="inline-flex items-center justify-center rounded-xl bg-[#1f8a65] px-4 h-10 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-all hover:bg-[#217356] active:scale-[0.99]"
                      >
                        Attribuer une formule
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onOpenClient(row.clientId)}
                        className="text-[12px] font-medium text-white/58 transition-colors hover:text-white"
                      >
                        Ouvrir le profil
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}

      {props.toFollowOpen && (
        <aside
          className="fixed right-0 bottom-0 z-[64] border-l-[0.3px] border-white/[0.013] bg-[#121212]"
          style={{ top: DRAWER_TOP_OFFSET, height: `calc(100vh - ${DRAWER_TOP_OFFSET}px)`, width: DRAWER_WIDTH }}
        >
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 border-b-[0.3px] border-white/[0.013] bg-[#121212] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  aria-label="Afficher les clients à suivre"
                  onClick={props.onHeaderToFollowClick}
                  className="min-w-0 flex-1 rounded-2xl border border-transparent px-1 py-1 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">Priorités</p>
                  <h2 className="mt-2 text-[22px] font-semibold text-white">À suivre</h2>
                  <p className="mt-1 text-[12px] text-white/45">
                    {props.toFollow.length} action{props.toFollow.length > 1 ? 's' : ''} prioritaire{props.toFollow.length > 1 ? 's' : ''}
                  </p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/36">
                    Cliquer pour isoler ces clients
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Fermer le panneau à suivre"
                  onClick={props.onCloseToFollow}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border-subtle bg-[#181818] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                {props.toFollow.map((item) => (
                  <article key={item.priorityKey} className="rounded-2xl bg-[#181818] border-subtle p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-white text-sm truncate">{item.clientName}</p>
                      </div>
                      <div className="relative flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${priorityClassName(item.priority)}`}>
                          {priorityLabel(item.priority)}
                        </span>
                        <details className="relative">
                          <summary
                            aria-label={`Plus d’actions pour ${item.clientName}`}
                            className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-xl bg-white/[0.04] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
                          >
                            ⋯
                          </summary>
                          <div className="absolute right-0 top-10 z-10 min-w-[190px] rounded-xl bg-[#181818] border-subtle p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.32)]">
                            <button
                              type="button"
                              onClick={() => {
                                props.onOpenClient(item.clientId)
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/72 hover:bg-white/[0.05]"
                            >
                              Ouvrir le profil
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                props.onPlanPriority(item, 'kanban')
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/72 hover:bg-white/[0.05]"
                            >
                              Ajouter au kanban
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                props.onPlanPriority(item, 'agenda')
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/72 hover:bg-white/[0.05]"
                            >
                              Créer une alerte
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                props.onPlanPriority(item, 'both')
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/72 hover:bg-white/[0.05]"
                            >
                              Créer alerte + tâche
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                props.onMarkTreated(item)
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-[12px] text-white/72 hover:bg-white/[0.05]"
                            >
                              Marquer comme traité
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                    <p className="mt-4 max-w-[32ch] text-[15px] leading-relaxed text-white/84">{item.reason}</p>
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/46">
                        {categoryLabel(item.kind)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-white/34">
                      {item.sourceLabel}{item.plannedContext?.label ? ` · ${item.plannedContext.label}` : item.planned ? ' · Déjà planifié' : ''}
                    </p>
                    <div className="mt-5 flex items-center gap-4">
                      <button
                        type="button"
                        aria-label={actionLabel(item.primaryAction)}
                        onClick={() => runPrimaryAction(item)}
                        className="inline-flex items-center justify-center rounded-xl bg-[#1f8a65] px-4 h-10 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-all hover:bg-[#217356] active:scale-[0.99]"
                      >
                        {actionLabel(item.primaryAction)}
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onOpenClient(item.clientId)}
                        className="text-[12px] font-medium text-white/58 transition-colors hover:text-white"
                      >
                        Ouvrir le profil
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  )
}
