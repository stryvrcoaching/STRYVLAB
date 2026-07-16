import type {
  DerivedSignals,
  PhaseCoachDecision,
  PhaseMatrixConditionCode,
  PhaseOptimizationResult,
  RawSignalInput,
} from './types'
import type { PhaseHistoryPoint } from './history'
import { getPhaseEngineCopy, type PhaseEngineLocale } from './localeCopy'
import { buildPhaseConfidenceModel } from './confidenceModel'

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

function pct(v: number): number {
  return Math.round(clamp(v) * 100)
}

function signedPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}%`
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length)
}

function daysBetween(from: string, to: string): number | null {
  const fromTime = new Date(`${from}T00:00:00.000Z`).getTime()
  const toTime = new Date(`${to}T00:00:00.000Z`).getTime()
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return null
  return Math.max(0, Math.round((toTime - fromTime) / 86400000))
}

function rhrWindowAverage(
  series: RawSignalInput['rhrSeries'],
  anchorDate: string,
  days: number,
): number | null {
  const anchorTime = new Date(`${anchorDate}T23:59:59.999Z`).getTime()
  if (Number.isNaN(anchorTime)) return null
  const startTime = anchorTime - days * 86400000
  return average(
    series
      .filter((point) => {
        const pointTime = new Date(`${point.date}T12:00:00.000Z`).getTime()
        return (
          !Number.isNaN(pointTime) &&
          pointTime >= startTime &&
          pointTime <= anchorTime &&
          point.value > 0
        )
      })
      .map((point) => point.value),
  )
}

function buildRhrDriver(signals: DerivedSignals, locale: PhaseEngineLocale): string | null {
  const delta = signals.rhrDelta
  if (!delta?.currentRhr) return null
  if (delta.baselineRhr == null || delta.deviationPercentage == null) {
    return locale === 'en'
      ? `RHR ${delta.currentRhr} bpm, baseline still building`
      : `RHR ${delta.currentRhr} bpm, baseline en construction`
  }
  return locale === 'en'
    ? `RHR ${delta.currentRhr} bpm vs ${delta.baselineRhr} baseline (${signedPct(delta.deviationPercentage)})`
    : `RHR ${delta.currentRhr} bpm vs baseline ${delta.baselineRhr} (${signedPct(delta.deviationPercentage)})`
}

function directionVerb(result: PhaseOptimizationResult, locale: PhaseEngineLocale): string {
  const copy = getPhaseEngineCopy(locale)
  const direction = copy.directionLabels[result.recommendedAdjustment.direction].toLowerCase()
  const state = copy.adaptiveStateLabels[result.recommendedAdjustment.adaptiveState].toLowerCase()
  return locale === 'en'
    ? `Hold ${direction} with adaptive state ${state}.`
    : `Maintenir ${direction}, état adaptatif ${state}.`
}

function buildCoachRecommendation(
  result: PhaseOptimizationResult,
  matrix: PhaseCoachDecision['matrix'],
  locale: PhaseEngineLocale,
): string {
  if (locale === 'en') {
    if (matrix.status === 'not_adapted') {
      if (matrix.rule === 'recovery_overload' || matrix.rule === 'acute_under_recovery') {
        return 'Reduce phase pressure now and prioritize recovery before pushing again.'
      }
      if (matrix.rule === 'adherence_mismatch') {
        return 'Simplify the protocol and restore adherence before extending the phase.'
      }
      if (matrix.rule === 'body_response_mismatch' || matrix.rule === 'fat_gain_mismatch') {
        return 'Tighten the current phase before continuing on the same trajectory.'
      }
      return 'Adjust the current phase before maintaining the current lane.'
    }

    if (matrix.status === 'partially_adapted') {
      return 'Keep the current lane short term, but monitor closely and be ready to adjust.'
    }

    return directionVerb(result, locale)
  }

  if (matrix.status === 'not_adapted') {
    if (matrix.rule === 'recovery_overload' || matrix.rule === 'acute_under_recovery') {
      return 'Alléger la phase maintenant et prioriser la récupération avant de relancer.'
    }
    if (matrix.rule === 'adherence_mismatch') {
      return 'Simplifier le protocole et rétablir l’adhérence avant de prolonger la phase.'
    }
    if (matrix.rule === 'body_response_mismatch' || matrix.rule === 'fat_gain_mismatch') {
      return 'Resserrer la phase actuelle avant de poursuivre sur la même trajectoire.'
    }
    return 'Ajuster la phase actuelle avant de conserver la trajectoire en place.'
  }

  if (matrix.status === 'partially_adapted') {
    return 'Conserver la trajectoire à court terme, mais avec surveillance rapprochée et ajustement prêt.'
  }

  return directionVerb(result, locale)
}

function buildTemporalReading({
  result,
  raw,
  history,
  locale,
}: {
  result: PhaseOptimizationResult
  raw: Pick<RawSignalInput, 'rhrSeries' | 'anchorDate'>
  history: PhaseHistoryPoint[]
  locale: PhaseEngineLocale
}): PhaseCoachDecision['temporal'] {
  const anchorDate =
    raw.anchorDate ?? result.engineMetadata.evaluatedAt.slice(0, 10)
  const previous = history.at(-1) ?? null
  const directionDelta =
    previous != null ? round1(result.currentState.directionScore - previous.directionScore) : null
  const adaptiveDelta =
    previous != null ? round1(result.currentState.adaptiveScore - previous.adaptiveScore) : null
  const sevenDayAvg = rhrWindowAverage(raw.rhrSeries, anchorDate, 7)
  const thirtyDayAvg = rhrWindowAverage(raw.rhrSeries, anchorDate, 30)
  const rhrDelta =
    sevenDayAvg != null && thirtyDayAvg != null
      ? round1(sevenDayAvg - thirtyDayAvg)
      : null

  const changes = [
    directionDelta != null && Math.abs(directionDelta) >= 0.1
      ? locale === 'en'
        ? `Energetic direction moved ${directionDelta > 0 ? 'up' : 'down'} by ${Math.abs(directionDelta)}`
        : `Direction énergétique ${directionDelta > 0 ? 'en hausse' : 'en baisse'} de ${Math.abs(directionDelta)}`
      : null,
    adaptiveDelta != null && Math.abs(adaptiveDelta) >= 0.1
      ? locale === 'en'
        ? `Adaptive state moved ${adaptiveDelta > 0 ? 'up' : 'down'} by ${Math.abs(adaptiveDelta)}`
        : `État adaptatif ${adaptiveDelta > 0 ? 'en amélioration' : 'en baisse'} de ${Math.abs(adaptiveDelta)}`
      : null,
    rhrDelta != null && Math.abs(rhrDelta) >= 1
      ? locale === 'en'
        ? `7-day RHR is ${rhrDelta > 0 ? '+' : ''}${rhrDelta} bpm vs 30-day average`
        : `RHR 7j ${rhrDelta > 0 ? '+' : ''}${rhrDelta} bpm vs moyenne 30j`
      : null,
  ].filter((v): v is string => Boolean(v)).slice(0, 3)

  const gapDays = previous ? daysBetween(previous.recordedOn, anchorDate) : null
  const summary =
    previous == null
      ? locale === 'en'
        ? 'No previous phase snapshot yet; this reading becomes the comparison baseline.'
        : 'Pas encore de snapshot précédent; cette lecture devient le point de comparaison.'
      : changes.length === 0
        ? locale === 'en'
          ? `Reading remains stable since the previous snapshot${gapDays != null ? ` (${gapDays}d)` : ''}.`
          : `Lecture stable depuis le dernier point${gapDays != null ? ` (${gapDays}j)` : ''}.`
        : locale === 'en'
          ? `${changes[0]}.`
          : `${changes[0]}.`

  return {
    summary,
    changes,
    previousPoint: previous
      ? {
          recordedOn: previous.recordedOn,
          directionScore: round1(previous.directionScore),
          adaptiveScore: round1(previous.adaptiveScore),
        }
      : null,
    deltas: {
      directionScore: directionDelta,
      adaptiveScore: adaptiveDelta,
    },
    rhr: {
      sevenDayAvg,
      thirtyDayAvg,
      deltaBpm: rhrDelta,
    },
  }
}

function buildSevenDayTrajectory(
  result: PhaseOptimizationResult,
  signals: DerivedSignals,
  locale: PhaseEngineLocale,
): PhaseCoachDecision['sevenDayTrajectory'] {
  const recoveryPct = pct(signals.recoveryCapacity.value)
  const rhrDeviation = signals.rhrDelta?.deviationPercentage ?? null
  const highStress =
    Boolean(signals.cnsOverload) ||
    result.recommendedAdjustment.urgency === 'high' ||
    recoveryPct < 40

  const readyToReload =
    !highStress &&
    recoveryPct >= 55 &&
    result.currentState.adaptiveState === 'recovered'

  const strategy: PhaseCoachDecision['sevenDayTrajectory']['strategy'] =
    highStress ? 'deload' : readyToReload ? 'progressive_reload' : 'maintain'

  const exitCriteria = [
    locale === 'en'
      ? 'Morning RHR back within +5% of baseline'
      : 'RHR matin revenue à moins de +5% de la baseline',
    locale === 'en'
      ? 'Recovery capacity above 60%'
      : 'Capacité de récupération au-dessus de 60%',
  ]

  if (result.phaseMatrix.rule === 'fat_gain_mismatch') {
    const compositionCriteria = [
      locale === 'en'
        ? '7-day average weight returns to the planned pace'
        : 'La moyenne de poids sur 7 jours revient au rythme prévu',
      locale === 'en'
        ? 'Body-fat or waist measurement confirms the trend'
        : 'Une mesure BF ou du tour de taille confirme la tendance',
      locale === 'en'
        ? 'Training performance remains stable'
        : 'La performance d’entraînement reste stable',
    ]

    return {
      strategy: 'maintain',
      title: locale === 'en' ? '7-day composition control' : 'Contrôle compositionnel 7 jours',
      summary: locale === 'en'
        ? 'Keep training stable, verify calorie execution, and confirm the body-composition trend before changing the phase.'
        : 'Garder l’entraînement stable, vérifier l’exécution calorique et confirmer la tendance corporelle avant de modifier la phase.',
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        focus: i < 3
          ? (locale === 'en' ? 'Protocol audit' : 'Audit du protocole')
          : (locale === 'en' ? 'Trend confirmation' : 'Confirmation de tendance'),
        intensityPct: 75,
        nutrition: locale === 'en'
          ? 'Hit the current calorie target; do not add surplus'
          : 'Respecter la cible calorique actuelle, sans ajouter de surplus',
        exitCriteria: compositionCriteria,
      })),
    }
  }

  if (result.phaseMatrix.rule === 'body_response_mismatch') {
    return {
      strategy: 'maintain',
      title: locale === 'en' ? '7-day response check' : 'Vérification de réponse 7 jours',
      summary: locale === 'en'
        ? 'Hold the current lane while checking weight, body composition, adherence, and performance on the same window.'
        : 'Maintenir le cap le temps de vérifier poids, composition, adhérence et performance sur une même fenêtre.',
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        focus: locale === 'en' ? 'Stable execution' : 'Exécution stable',
        intensityPct: 75,
        nutrition: locale === 'en' ? 'Follow the current target exactly' : 'Suivre précisément la cible actuelle',
        exitCriteria: [
          locale === 'en' ? 'At least four morning weights logged' : 'Au moins quatre poids matin renseignés',
          locale === 'en' ? 'Body-fat or waist measurement available' : 'Une mesure BF ou tour de taille disponible',
          locale === 'en' ? 'Nutrition adherence can be interpreted' : 'Adhérence nutrition interprétable',
        ],
      })),
    }
  }

  if (strategy === 'deload') {
    return {
      strategy,
      title: locale === 'en' ? '7-day deload' : 'Décharge 7 jours',
      summary: locale === 'en'
        ? 'Keep the next week protective: reduce training stress until RHR and recovery normalize.'
        : 'Semaine protectrice: réduire le stress d’entraînement jusqu’à normalisation RHR/récupération.',
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        focus: i < 3
          ? (locale === 'en' ? 'Recovery priority' : 'Priorité récupération')
          : (locale === 'en' ? 'Controlled reactivation' : 'Réactivation contrôlée'),
        intensityPct: i < 3 ? 45 : i < 5 ? 55 : 60,
        nutrition: locale === 'en' ? 'Maintenance calories, no aggressive deficit' : 'Maintenance, pas de déficit agressif',
        exitCriteria,
      })),
    }
  }

  if (strategy === 'progressive_reload') {
    return {
      strategy,
      title: locale === 'en' ? '7-day progressive reload' : 'Reprise progressive 7 jours',
      summary: locale === 'en'
        ? 'Recovery is sufficient to rebuild training pressure gradually without jumping straight to peak intensity.'
        : 'La récupération permet de remonter la pression d’entraînement progressivement, sans pic brutal.',
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        focus: i < 2
          ? (locale === 'en' ? 'Technique and rhythm' : 'Technique et rythme')
          : i < 5
            ? (locale === 'en' ? 'Progressive loading' : 'Charge progressive')
            : (locale === 'en' ? 'Performance check' : 'Contrôle performance'),
        intensityPct: [60, 65, 70, 75, 80, 82, 85][i],
        nutrition: locale === 'en' ? 'Maintenance or slight surplus' : 'Maintenance ou léger surplus',
        exitCriteria: [
          ...exitCriteria,
          locale === 'en' ? 'No performance drop across two sessions' : 'Pas de baisse performance sur deux séances',
        ],
      })),
    }
  }

  return {
    strategy,
    title: locale === 'en' ? '7-day maintenance lane' : 'Maintien 7 jours',
    summary: locale === 'en'
      ? 'Keep the current lane and monitor whether recovery or RHR asks for a daily adjustment.'
      : 'Conserver la trajectoire actuelle et surveiller si récupération ou RHR imposent un ajustement quotidien.',
    days: Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      focus: locale === 'en' ? 'Stable execution' : 'Exécution stable',
      intensityPct: rhrDeviation != null && rhrDeviation > 5 ? 65 : 75,
      nutrition: locale === 'en' ? 'Follow current protocol' : 'Suivre le protocole actuel',
      exitCriteria: [
        locale === 'en' ? 'RHR stays within +5% of baseline' : 'RHR reste à moins de +5% de la baseline',
        locale === 'en' ? 'Recovery capacity stays above 50%' : 'Capacité de récupération reste au-dessus de 50%',
      ],
    })),
  }
}

function matrixConditionLabel(
  code: PhaseMatrixConditionCode,
  locale: PhaseEngineLocale,
): string {
  const labels: Record<PhaseMatrixConditionCode, { fr: string; en: string }> = {
    rhr_over_baseline: {
      fr: 'RHR aigu au-dessus de la baseline personnelle',
      en: 'Acute RHR sits above the personal baseline',
    },
    high_physiological_stress: {
      fr: 'Stress physiologique élevé',
      en: 'Physiological stress is elevated',
    },
    low_recovery_capacity: {
      fr: 'Capacité de récupération basse',
      en: 'Recovery capacity is low',
    },
    high_fatigue: {
      fr: 'Fatigue globale élevée',
      en: 'Global fatigue is elevated',
    },
    low_nutrition_adherence: {
      fr: 'Adhérence nutrition insuffisante',
      en: 'Nutrition adherence is insufficient',
    },
    performance_drop: {
      fr: 'Performance en baisse',
      en: 'Performance is trending down',
    },
    body_response_off_target: {
      fr: 'La réponse corporelle ne suit pas la phase visée',
      en: 'Body response is off-target for the current phase',
    },
    high_fat_gain_risk: {
      fr: 'Risque de prise de gras élevé',
      en: 'Fat gain risk is elevated',
    },
    phase_fit_optimal: {
      fr: 'Le score global confirme une phase très cohérente',
      en: 'The global score confirms a highly coherent phase',
    },
    phase_fit_fragile: {
      fr: 'Le score global montre une cohérence fragile',
      en: 'The global score shows a fragile alignment',
    },
    recovery_ready: {
      fr: 'La récupération autorise la phase actuelle',
      en: 'Recovery supports the current phase',
    },
    performance_stable: {
      fr: 'La performance reste stable ou monte',
      en: 'Performance is stable or rising',
    },
  }

  return labels[code][locale]
}

function buildMatrixNarrative(
  decision: PhaseOptimizationResult,
  locale: PhaseEngineLocale,
): PhaseCoachDecision['matrix'] {
  const matchedConditions = decision.phaseMatrix.matchedConditions.map((condition) =>
    matrixConditionLabel(condition, locale),
  )

  const matrixMap: Record<
    PhaseOptimizationResult['phaseMatrix']['rule'],
    { fr: { title: string; summary: string; rationale: string }; en: { title: string; summary: string; rationale: string } }
  > = {
    recovery_overload: {
      fr: {
        title: 'Phase non adaptée: surcharge de récupération',
        summary: 'Les signaux aigus indiquent que la phase actuelle dépasse ce que le client tolère maintenant.',
        rationale: 'Le système priorise la récupération avant toute progression car la contrainte physiologique est trop haute.',
      },
      en: {
        title: 'Phase not adapted: recovery overload',
        summary: 'Acute signals show the current phase exceeds what the client can tolerate right now.',
        rationale: 'The engine prioritizes recovery before progression because physiological strain is too high.',
      },
    },
    acute_under_recovery: {
      fr: {
        title: 'Phase non adaptée: récupération aiguë insuffisante',
        summary: 'La récupération ne compense plus le stress actuel et la performance commence à céder.',
        rationale: 'Le coach doit réduire la pression à court terme avant de relancer la phase.',
      },
      en: {
        title: 'Phase not adapted: acute under-recovery',
        summary: 'Recovery no longer offsets current stress and performance is starting to slip.',
        rationale: 'The coach should reduce short-term pressure before pushing the phase again.',
      },
    },
    adherence_mismatch: {
      fr: {
        title: 'Phase non adaptée: adhérence trop faible',
        summary: 'Le protocole prévu n’est pas assez suivi pour juger la phase comme réellement cohérente.',
        rationale: 'Avant de durcir ou prolonger la phase, il faut retrouver une exécution plus stable.',
      },
      en: {
        title: 'Phase not adapted: adherence too low',
        summary: 'The planned protocol is not being followed consistently enough to validate the phase.',
        rationale: 'Before extending or intensifying the phase, execution needs to stabilize.',
      },
    },
    body_response_mismatch: {
      fr: {
        title: 'Phase non adaptée: réponse corporelle incohérente',
        summary: 'Le corps ne répond pas comme attendu par rapport à la phase en cours.',
        rationale: 'La direction théorique doit être revalidée face à la réponse réelle du client.',
      },
      en: {
        title: 'Phase not adapted: body response mismatch',
        summary: 'The body is not responding as expected for the current phase.',
        rationale: 'The theoretical direction needs to be revalidated against the client’s real response.',
      },
    },
    fat_gain_mismatch: {
      fr: {
        title: 'Phase non adaptée: dérive compositionnelle',
        summary: 'La dynamique actuelle favorise une prise de gras trop forte pour la phase visée.',
        rationale: 'Le protocole doit être resserré ou ralenti avant de poursuivre.',
      },
      en: {
        title: 'Phase not adapted: composition drift',
        summary: 'The current dynamic is pushing fat gain beyond what the phase should allow.',
        rationale: 'The protocol should be tightened or slowed down before continuing.',
      },
    },
    fragile_workable: {
      fr: {
        title: 'Phase partiellement adaptée',
        summary: 'La phase reste exploitable, mais seulement avec surveillance et ajustements rapprochés.',
        rationale: 'On peut continuer à court terme, sans la considérer comme pleinement robuste.',
      },
      en: {
        title: 'Phase partially adapted',
        summary: 'The phase is still workable, but only with close monitoring and tighter adjustments.',
        rationale: 'It can continue short term, but should not be treated as fully robust.',
      },
    },
    optimal_alignment: {
      fr: {
        title: 'Phase adaptée et optimisée',
        summary: 'Les signaux principaux confirment que la phase actuelle est cohérente et bien tolérée.',
        rationale: 'Le coach peut maintenir la trajectoire actuelle tant que cette cohérence reste présente.',
      },
      en: {
        title: 'Adapted and optimized phase',
        summary: 'Core signals confirm the current phase is coherent and well tolerated.',
        rationale: 'The coach can keep the current trajectory as long as this alignment holds.',
      },
    },
    stable_alignment: {
      fr: {
        title: 'Phase adaptée',
        summary: 'La phase actuelle reste globalement cohérente, sans signal fort d’alerte.',
        rationale: 'La bonne décision est de poursuivre avec suivi normal et réévaluation régulière.',
      },
      en: {
        title: 'Adapted phase',
        summary: 'The current phase remains broadly coherent without strong warning signals.',
        rationale: 'The right move is to continue with normal monitoring and regular reassessment.',
      },
    },
  }

  const copy = matrixMap[decision.phaseMatrix.rule][locale]

  return {
    rule: decision.phaseMatrix.rule,
    status: decision.phaseMatrix.status,
    priority: decision.phaseMatrix.priority,
    title: copy.title,
    summary: copy.summary,
    rationale: copy.rationale,
    matchedConditions,
  }
}

export function buildCoachDecision(
  result: PhaseOptimizationResult,
  signals: DerivedSignals,
  raw: RawSignalInput,
  locale: PhaseEngineLocale = 'fr',
  history: PhaseHistoryPoint[] = [],
): PhaseCoachDecision {
  const copy = getPhaseEngineCopy(locale)
  const matrix = buildMatrixNarrative(result, locale)
  const confidencePct = pct(result.recommendedAdjustment.recommendationConfidence)
  const phaseFitScorePct = result.phaseFit.score
  const recoveryPct = pct(signals.recoveryCapacity.value)
  const fatiguePct = pct(signals.fatigueIndex.value)
  const perfPct = signals.performanceTrend.observed
    ? pct((signals.performanceTrend.value + 1) / 2)
    : null
  const nutritionPct = signals.nutritionAdherence.observed
    ? pct(signals.nutritionAdherence.value)
    : null

  const primaryDrivers = [
    buildRhrDriver(signals, locale),
    signals.recoveryCapacity.confidence >= 0.2
      ? (locale === 'en'
        ? `Recovery capacity ${recoveryPct}%`
        : `Capacité de récupération ${recoveryPct}%`)
      : null,
    perfPct != null
      ? (locale === 'en' ? `Performance trend ${perfPct}%` : `Tendance performance ${perfPct}%`)
      : null,
    nutritionPct != null
      ? (locale === 'en' ? `Nutrition adherence ${nutritionPct}%` : `Adhérence nutrition ${nutritionPct}%`)
      : null,
    ...result.reasons,
  ].filter((v): v is string => Boolean(v)).slice(0, 4)

  const watchouts = [
    signals.cnsOverload
      ? copy.reasonMap.cns_overload
      : null,
    signals.catabolicRisk.confidence >= 0.2 && signals.catabolicRisk.value >= 0.45
      ? copy.reasonMap.catabolic_risk
      : null,
    signals.dataQuality === 'minimal' || signals.dataQuality === 'limited'
      ? (locale === 'en'
        ? 'Decision confidence limited by missing signal coverage'
        : 'Confiance limitée par la couverture de données')
      : null,
  ].filter((v): v is string => Boolean(v)).slice(0, 3)

  const rhrDelta = signals.rhrDelta
  const rhrSamples = raw.rhrSeries.length
  const rhrStatus: PhaseCoachDecision['baselines']['rhr']['status'] =
    rhrSamples < 10 ? 'insufficient'
    : rhrDelta?.isCnsOverloaded ? 'overload'
    : rhrDelta?.baselineRhr != null ? 'stable'
    : 'insufficient'

  const headline = matrix.title

  return {
    headline,
    recommendation: buildCoachRecommendation(result, matrix, locale),
    confidencePct,
    phaseFitScorePct,
    phaseFitBand: result.phaseFit.band,
    matrix,
    horizon: result.recommendedAdjustment.horizon,
    primaryDrivers,
    watchouts,
    confidenceModel: buildPhaseConfidenceModel(signals, raw, locale),
    sevenDayTrajectory: buildSevenDayTrajectory(result, signals, locale),
    temporal: buildTemporalReading({ result, raw, history, locale }),
    baselines: {
      rhr: {
        current: rhrDelta?.currentRhr ?? null,
        baseline: rhrDelta?.baselineRhr ?? null,
        deviationPct: rhrDelta?.deviationPercentage ?? null,
        sampleCount: raw.rhrSeries.length,
        status: rhrStatus,
      },
      recovery: {
        capacityPct: recoveryPct,
        fatiguePct,
        confidencePct: pct(signals.recoveryCapacity.confidence),
      },
      body: {
        weightTrendKgPerWeek: signals.weightTrend.observed ? round1(signals.weightTrend.value) : null,
        bodyFatTrendPctPerWeek: signals.bodyFatTrend.observed ? round1(signals.bodyFatTrend.value) : null,
      },
      performance: {
        trendPct: perfPct,
        confidencePct: pct(signals.performanceTrend.confidence),
      },
      nutrition: {
        adherencePct: nutritionPct,
        calorieDeltaPct: raw.nutrition?.adherence.calorieDeltaAvg ?? null,
        proteinDeltaPct: raw.nutrition?.adherence.proteinDeltaAvg ?? null,
        loggedDays: raw.nutrition?.adherence.loggedDays ?? 0,
        source: raw.nutrition?.source ?? 'none',
      },
    },
  }
}
