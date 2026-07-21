/**
 * Cockpit decision layer: turns observed signals into ordered coach actions.
 * Pure logic — no I/O. The UI only displays what this returns.
 *
 * Product charter (vision, do/don’t, priority rules):
 *   docs/COCKPIT_PRODUCT_CHARTER.md
 *
 * Non-negotiable priority order:
 *   1 complete data → 2 recovery → 3 adherence → 4 energy → 5 activity → 6 draft → 7 maintain
 */

export type GaugeState = 'aligné' | 'à surveiller' | 'à corriger' | 'à compléter'

export type DirectionSeverity = 'urgent' | 'important' | 'info' | 'ok'

export type CockpitDirection = {
  id: string
  severity: DirectionSeverity
  /** Short title: what to do */
  title: string
  /** Why, grounded in observed numbers */
  why: string
  /** Concrete next step in coach language */
  action: string
  /** In-app destination */
  href: string
  ctaLabel: string
  score: number
  /** Optional draft message to send the client (coach can edit before send) */
  clientMessage?: string | null
}

export type CockpitDirectionsInput = {
  clientId: string
  energyState: GaugeState
  adherenceState: GaugeState
  activityState: GaugeState
  recoveryState: GaugeState
  /** kcal/j: actual calories − TDEE (negative = deficit) */
  energyReality: number | null
  /** kcal/j: planned calories − coach TDEE */
  energyPrescription: number | null
  /** |reality − prescription| in kcal/j */
  energyDifference: number | null
  adherencePct: number | null
  activityRatio: number | null
  actualSteps: number | null
  plannedSteps: number | null
  /** NEAT+EAT budget (kcal/j) */
  activityRealityKcal?: number | null
  activityPlanKcal?: number | null
  activityNeatReality?: number | null
  activityEatReality?: number | null
  activityNeatPlan?: number | null
  activityEatPlan?: number | null
  activityStrengthSessionsActual?: number | null
  activityStrengthSessionsPlan?: number | null
  recoveryScore: number | null
  overreaching: boolean | null
  cyclePhase: string | null
  hasLiveDraft: boolean
}

const SEVERITY_SCORE: Record<DirectionSeverity, number> = {
  urgent: 100,
  important: 70,
  info: 40,
  ok: 10,
}

function base(clientId: string) {
  return `/coach/clients/${clientId}`
}

/**
 * Build 1–3 ordered directions for the coach.
 * Priority logic (hard rules):
 * 1. Missing data before adjusting targets
 * 2. Adherence before changing prescription (if both off)
 * 3. Recovery before more deficit / more volume
 * 4. Energy / activity as secondary levers
 */
export function buildCockpitDirections(
  input: CockpitDirectionsInput,
): CockpitDirection[] {
  const {
    clientId,
    energyState,
    adherenceState,
    activityState,
    recoveryState,
    energyReality,
    energyPrescription,
    energyDifference,
    adherencePct,
    activityRatio,
    actualSteps,
    plannedSteps,
    activityRealityKcal,
    activityPlanKcal,
    activityNeatReality,
    activityEatReality,
    activityNeatPlan,
    activityEatPlan,
    activityStrengthSessionsActual,
    activityStrengthSessionsPlan,
    recoveryScore,
    overreaching,
    cyclePhase,
    hasLiveDraft,
  } = input

  const directions: CockpitDirection[] = []
  const root = base(clientId)

  const incompleteCount = [
    energyState,
    adherenceState,
    activityState,
    recoveryState,
  ].filter((s) => s === 'à compléter').length

  // ── 1. Data gaps ──────────────────────────────────────────────────────────
  if (incompleteCount >= 2) {
    directions.push({
      id: 'complete-data',
      severity: 'important',
      title: 'Compléter le terrain avant d’ajuster',
      why: `${incompleteCount} signaux manquent encore (nutrition, activité ou check-in).`,
      action:
        'Relancer le client sur le suivi (repas, pas, check-in) plutôt que de changer le protocole à l’aveugle.',
      href: `${root}/profil`,
      ctaLabel: 'Voir le profil',
      score: SEVERITY_SCORE.important + incompleteCount,
    })
  } else if (adherenceState === 'à compléter' && energyState !== 'aligné') {
    directions.push({
      id: 'need-nutrition-logs',
      severity: 'important',
      title: 'Pas assez de logs nutrition',
      why: 'Impossible de juger l’adhérence ni l’énergie réelle sans saisies récentes.',
      action: 'Demander 3–5 jours de suivi repas cohérents avant de toucher aux calories cibles.',
      href: `${root}/protocoles/nutrition`,
      ctaLabel: 'Nutrition Studio',
      score: SEVERITY_SCORE.important + 5,
    })
  }

  // ── 2. Recovery first (safety) ────────────────────────────────────────────
  if (recoveryState === 'à corriger') {
    const cycleHint =
      cyclePhase === 'luteal' || cyclePhase === 'menstrual'
        ? ' Contexte cycle sensible : privilégier la récupération.'
        : ''
    directions.push({
      id: 'protect-recovery',
      severity: 'urgent',
      title: 'Protéger la récupération',
      why:
        overreaching === true
          ? 'Signal de surcharge + disponibilité basse.'
          : recoveryScore != null
            ? `Disponibilité à ${Math.round(recoveryScore)}/100 (repère ≥ 65).${cycleHint}`
            : `Disponibilité basse (sommeil / énergie / charge).${cycleHint}`,
      action:
        'Ne pas augmenter le déficit ni le volume. Alléger 1–2 séances ou programmer un deload, et vérifier le sommeil avec le client.',
      href: `${root}/protocoles/entrainement`,
      ctaLabel: 'Workout Studio',
      score: SEVERITY_SCORE.urgent + 20,
    })
  } else if (recoveryState === 'à surveiller' && energyState === 'à corriger') {
    directions.push({
      id: 'recovery-watch-energy',
      severity: 'important',
      title: 'Récupération fragile + énergie décalée',
      why: 'Ajuster les calories pendant une récupération moyenne augmente le risque de crash.',
      action:
        'Stabiliser d’abord la charge et le sommeil, puis revoir le plan calorique la semaine suivante.',
      href: `${root}/profil`,
      ctaLabel: 'Pilotage profil',
      score: SEVERITY_SCORE.important + 8,
    })
  }

  // ── 3. Adherence before prescription changes ──────────────────────────────
  if (adherenceState === 'à corriger') {
    directions.push({
      id: 'fix-adherence',
      severity: 'urgent',
      title: 'Remettre l’exécution avant le plan',
      why:
        adherencePct != null
          ? `Adhérence calorique à ${Math.round(adherencePct)}% (repère ≥ 85%).`
          : 'Adhérence nettement sous le repère.',
      action:
        'Message client + simplifier 1 levier (repas types, freins week-end, hydratation). Éviter de bouger les macros tant que l’exécution est instable.',
      href: `${root}/protocoles/nutrition`,
      ctaLabel: 'Ajuster le protocole',
      score: SEVERITY_SCORE.urgent + 15,
    })
  } else if (adherenceState === 'à surveiller') {
    directions.push({
      id: 'watch-adherence',
      severity: 'important',
      title: 'Sécuriser l’adhérence',
      why:
        adherencePct != null
          ? `Adhérence à ${Math.round(adherencePct)}% — zone grise.`
          : 'Adhérence en zone grise.',
      action:
        'Identifier le jour/le contexte qui casse (soirées, week-end, rush). Un micro-ajustement de praticité vaut mieux qu’un nouveau plan.',
      href: `${root}/protocoles/nutrition`,
      ctaLabel: 'Nutrition Studio',
      score: SEVERITY_SCORE.important + 3,
    })
  }

  // ── 4. Energy / prescription mismatch ─────────────────────────────────────
  // Only push hard energy changes if adherence is not the main fire.
  if (
    energyState === 'à corriger' &&
    adherenceState !== 'à corriger' &&
    recoveryState !== 'à corriger'
  ) {
    const reality = energyReality
    const plan = energyPrescription
    const diff = energyDifference

    let title = 'Réaligner énergie réelle et plan'
    let why =
      diff != null
        ? `${Math.round(diff)} kcal/j d’écart entre le terrain et la prescription.`
        : 'Écart important entre le terrain et le plan.'
    let action =
      'Comparer TDEE, apports moyens et target. Corriger soit le target, soit le TDEE de référence — pas les deux en même temps.'

    if (reality != null && plan != null) {
      // Client in bigger deficit than planned (eating less / burning more)
      if (reality < plan - 200) {
        title = 'Déficit plus fort que prévu'
        why = `Terrain ${Math.round(reality)} kcal/j vs plan ${Math.round(plan)} kcal/j.`
        action =
          'Vérifier sous-déclaration ou activité non planifiée. Si le déficit est voulu trop bas : remonter les calories ou baisser la charge pour préserver la récupération.'
      } else if (reality > plan + 200) {
        title = 'Surplus (ou déficit trop faible) vs plan'
        why = `Terrain ${Math.round(reality)} kcal/j vs plan ${Math.round(plan)} kcal/j.`
        action =
          'Si l’adhérence est bonne : recalibrer le target ou le TDEE. Si les logs sont optimistes : d’abord fiabiliser le suivi, pas punir le client.'
      }
    }

    directions.push({
      id: 'align-energy',
      severity: 'urgent',
      title,
      why,
      action,
      href: `${root}/protocoles/nutrition`,
      ctaLabel: 'Nutrition Studio',
      score: SEVERITY_SCORE.urgent + 10,
    })
  } else if (
    energyState === 'à surveiller' &&
    adherenceState === 'aligné' &&
    !directions.some((d) => d.id.startsWith('align-energy'))
  ) {
    directions.push({
      id: 'watch-energy',
      severity: 'info',
      title: 'Surveiller l’écart énergétique',
      why:
        energyDifference != null
          ? `Écart d’environ ${Math.round(energyDifference)} kcal/j — pas encore critique.`
          : 'Léger décalage énergie / plan.',
      action:
        'Noter la tendance sur 7 jours. N’ajuster que si le décalage se répète ou bloque la phase.',
      href: `${root}/protocoles/nutrition`,
      ctaLabel: 'Voir la tendance',
      score: SEVERITY_SCORE.info + 2,
    })
  }

  // ── 5. Activity (NEAT + EAT budget) ───────────────────────────────────────
  if (activityState === 'à corriger') {
    const low = activityRatio != null && activityRatio < 0.8
    const neatLow =
      activityNeatReality != null &&
      activityNeatPlan != null &&
      activityNeatPlan > 0 &&
      activityNeatReality / activityNeatPlan < 0.75
    const eatLow =
      activityEatReality != null &&
      activityEatPlan != null &&
      activityEatPlan > 0 &&
      activityEatReality / activityEatPlan < 0.75
    const sessionsGap =
      activityStrengthSessionsPlan != null &&
      activityStrengthSessionsPlan > 0 &&
      (activityStrengthSessionsActual == null ||
        activityStrengthSessionsActual < activityStrengthSessionsPlan * 0.75)

    let title = low ? 'Activité sous le plan' : 'Activité très au-dessus du plan'
    let why =
      activityRealityKcal != null && activityPlanKcal != null
        ? `${Math.round(activityRealityKcal)} vs ${Math.round(activityPlanKcal)} kcal/j d’activité (NEAT+EAT)${
            activityRatio != null ? ` · ${Math.round(activityRatio * 100)}%` : ''
          }.`
        : actualSteps != null && plannedSteps != null
          ? `${Math.round(actualSteps)} pas/j vs objectif ${Math.round(plannedSteps)}.`
          : 'Écart fort entre activité observée et plan.'

    if (sessionsGap && low) {
      title = 'Exécution training sous le plan'
      why =
        activityStrengthSessionsActual != null && activityStrengthSessionsPlan != null
          ? `≈ ${activityStrengthSessionsActual} séance(s)/sem loguées vs ${activityStrengthSessionsPlan} prescrites. ${why}`
          : `Séances d’entraînement sous le rythme prévu. ${why}`
    } else if (neatLow && !eatLow && low) {
      title = 'NEAT (pas) sous l’objectif'
    } else if (eatLow && !neatLow && low) {
      title = 'EAT (entraînement) sous le plan'
    }

    const action = low
      ? sessionsGap
        ? 'Prioriser la régularité des séances avant d’augmenter le déficit. Si le volume est irréaliste, recalibrer le programme.'
        : neatLow
          ? 'Soit baisser la cible de pas, soit lever un frein concret (trajet, pauses bureau). Ne pas cumuler avec un gros déficit.'
          : 'Recaler le budget d’activité (marche + entraînement) pour coller à la réalité tenable — sans surcharger la récupération.'
      : 'Vérifier si l’excès d’activité (NEAT/EAT) explique un plateau ou une fatigue. Ajuster l’objectif, le volume ou le TDEE si c’est structurel.'

    directions.push({
      id: 'activity-gap',
      severity: recoveryState === 'à corriger' ? 'important' : 'urgent',
      title,
      why,
      action,
      href: sessionsGap ? `${root}/protocoles/entrainement` : `${root}/profil`,
      ctaLabel: sessionsGap ? 'Workout Studio' : 'Objectif activité',
      score: SEVERITY_SCORE.important + (low ? 6 : 4),
    })
  } else if (activityState === 'à surveiller' && activityRatio != null) {
    directions.push({
      id: 'watch-activity',
      severity: 'info',
      title: 'Surveiller le budget d’activité',
      why:
        activityRealityKcal != null && activityPlanKcal != null
          ? `${Math.round(activityRealityKcal)} vs ${Math.round(activityPlanKcal)} kcal/j · ${Math.round(activityRatio * 100)}% du plan.`
          : `Activité à ${Math.round(activityRatio * 100)}% du plan — à confirmer sur 7 jours.`,
      action:
        'Noter la tendance NEAT (pas) vs EAT (séances). N’ajuster le plan que si l’écart se répète.',
      href: `${root}/data/performances`,
      ctaLabel: 'Voir l’activité',
      score: SEVERITY_SCORE.info + 2,
    })
  }

  // ── 6. Live draft reminder ────────────────────────────────────────────────
  if (hasLiveDraft) {
    directions.push({
      id: 'draft-pending',
      severity: 'info',
      title: 'Brouillon non partagé',
      why: 'Une modification Nutrition ou Workout est active dans le cockpit.',
      action:
        'Valider l’impact ici, puis partager au client — ou annuler le brouillon si ce n’est qu’un test.',
      href: `${root}/protocoles/nutrition`,
      ctaLabel: 'Revenir au studio',
      score: SEVERITY_SCORE.info + 1,
    })
  }

  // ── 7. All good ───────────────────────────────────────────────────────────
  const critical = directions.filter(
    (d) => d.severity === 'urgent' || d.severity === 'important',
  )
  if (critical.length === 0 && incompleteCount === 0) {
    directions.push({
      id: 'maintain',
      severity: 'ok',
      title: 'Maintenir le cap',
      why: 'Les signaux principaux sont alignés ou sous contrôle.',
      action:
        'Pas de changement majeur. Prévoir le prochain point (RDV ou message) et surveiller la tendance sur 7 jours.',
      href: `${root}/profil`,
      ctaLabel: 'Ouvrir le profil',
      score: SEVERITY_SCORE.ok,
    })
  }

  return directions
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(withClientMessage)
}

function withClientMessage(dir: CockpitDirection): CockpitDirection {
  const drafts: Record<string, string | null> = {
    'complete-data':
      'Salut ! Pour qu’on pilote bien ta phase, j’ai besoin que tu sois un peu plus régulier·ère sur le suivi (repas, pas, check-in) cette semaine. Même 3–4 jours solides m’aident énormément. Tu tiens le coup ?',
    'need-nutrition-logs':
      'Salut ! Peux-tu logger tes repas sur 3 à 5 jours d’affilée ? Sans ça je ne peux pas juger ton adhérence ni ajuster le plan proprement. Dis-moi si un frein t’empêche de le faire.',
    'protect-recovery':
      'Salut ! Je regarde tes signaux de récupération : on va plutôt protéger le sommeil et alléger un peu la charge que forcer. Comment tu te sens sur les dernières séances ?',
    'recovery-watch-energy':
      'Salut ! On a un combo récupération un peu juste + énergie décalée. On stabilise d’abord ton rythme (sommeil, charge) avant de retoucher les calories. OK pour toi ?',
    'fix-adherence':
      'Salut ! Je vois que l’application du plan nutrition est un peu instable. On simplifie un levier plutôt que de tout changer — dis-moi ce qui casse le plus (soirées, week-end, rush).',
    'watch-adherence':
      'Salut ! Ton suivi est correct mais encore un peu irrégulier. Y a-t-il un moment de la semaine où c’est plus dur de tenir le cadre ? On ajuste la praticité, pas la motivation.',
    'align-energy':
      'Salut ! Il y a un écart entre ce que tu vis et le plan énergétique. On regarde ça ensemble — pas de jugement, juste pour recaler le cadre si besoin.',
    'watch-energy':
      'Salut ! Petit décalage énergétique à surveiller, rien d’alarmant. Continue comme ça et on ajuste seulement si ça se répète.',
    'activity-gap':
      'Salut ! Ton niveau d’activité (marche + entraînement) est assez loin du plan. On peut soit recalibrer des cibles tenables, soit lever un frein concret (séances, trajets, pauses). Qu’est-ce qui te semble le plus réaliste cette semaine ?',
    'watch-activity':
      'Salut ! Petit décalage d’activité à surveiller (pas et/ou séances), rien d’alarmant. On garde le cap et on ajuste seulement si ça se répète.',
    'draft-pending': null,
    maintain:
      'Salut ! Les signaux sont bons, on maintient le cap. Si quelque chose coince de ton côté, dis-le-moi — sinon on continue sur cette lancée.',
  }

  return {
    ...dir,
    clientMessage: drafts[dir.id] ?? null,
  }
}

export function primaryDirection(
  directions: CockpitDirection[],
): CockpitDirection | null {
  return directions[0] ?? null
}
