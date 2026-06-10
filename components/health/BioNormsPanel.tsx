'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { BioNormsGauge } from './BioNormsGauge'
import { NavySuggestionBanner } from './NavySuggestionBanner'
import { useBiometrics } from '@/lib/health/useBiometrics'
import type { NormEvaluation } from '@/lib/health/bioNorms'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BioNormsPanelProps {
  clientId: string
  clientProfile: {
    date_of_birth?: string | null
    sex?: string | null
  }
  className?: string
}

// ---------------------------------------------------------------------------
// Sections de groupement
// ---------------------------------------------------------------------------

const METRIC_SECTIONS = [
  {
    label: 'Composition Corporelle',
    keys: ['body_fat_pct', 'muscle_mass_pct', 'lean_mass_kg', 'bone_mass_kg'],
  },
  {
    label: 'Santé Métabolique',
    keys: ['bmi', 'visceral_fat_level', 'body_water_pct'],
  },
  {
    label: 'Morphométrie',
    keys: ['waist_cm', 'waist_hip_ratio', 'waist_height_ratio'],
  },
  {
    label: 'Métabolisme',
    keys: ['metabolic_age_delta'],
  },
]

// ---------------------------------------------------------------------------
// GaugeSkeleton — reflète la structure d'un BioNormsGauge
// ---------------------------------------------------------------------------

function GaugeSkeleton() {
  return (
    <div className="bg-white/[0.02] rounded-xl p-4 border-[0.3px] border-white/[0.06] flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-2 w-24" />
        <Skeleton className="h-4 w-4 rounded-md shrink-0" />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-2.5 w-6" />
        </div>
        <Skeleton className="h-5 w-16 rounded-md shrink-0" />
      </div>
      {/* Source badge skeleton */}
      <Skeleton className="h-2.5 w-28" />
      {/* Barre segmentée */}
      <div className="flex gap-[3px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[3px] flex-1 rounded-full bg-white/[0.06] animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function BioNormsPanel({
  clientId,
  clientProfile,
  className,
}: BioNormsPanelProps) {
  const {
    loading,
    error,
    evaluations,
    criticalAlerts,
    navySuggestion,
    metricSources,
    applyNavySuggestion,
  } = useBiometrics(clientId, clientProfile)

  // --- Loading ---
  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div>
          <Skeleton className="h-2.5 w-36 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => <GaugeSkeleton key={i} />)}
          </div>
        </div>
        <div>
          <Skeleton className="h-2.5 w-28 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <GaugeSkeleton key={i} />)}
          </div>
        </div>
        <div>
          <Skeleton className="h-2.5 w-24 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2].map((i) => <GaugeSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error) {
    return (
      <div className={cn('bg-white/[0.02] rounded-xl p-6 border-[0.3px] border-white/[0.06] text-center', className)}>
        <p className="text-[13px] text-red-400">{error}</p>
      </div>
    )
  }

  // --- Empty ---
  if (evaluations.length === 0) {
    return (
      <div className={cn('bg-white/[0.02] rounded-xl p-6 border-[0.3px] border-white/[0.06] text-center', className)}>
        <p className="text-[13px] text-white/40">
          Données biométriques insuffisantes pour afficher les normes.
        </p>
        <p className="text-[11px] text-white/30 mt-1">
          Le poids et la taille sont requis au minimum.
        </p>
      </div>
    )
  }

  // --- Normal ---
  return (
    <div className={cn(className)}>
      {/* Alertes critiques */}
      {criticalAlerts.length > 0 && (
        <div className="mb-5 rounded-xl border-[0.3px] border-red-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/10">
            <span className="text-red-400 text-[10px]">⚠</span>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-400/80">
              {criticalAlerts.length === 1 ? 'Valeur critique détectée' : `${criticalAlerts.length} valeurs critiques détectées`}
            </p>
          </div>
          {criticalAlerts.map((alert, i) => (
            <div
              key={alert.metric_key}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-3 bg-red-500/[0.04]',
                i < criticalAlerts.length - 1 && 'border-b border-red-500/[0.08]',
              )}
            >
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white/80 leading-snug">{alert.label_fr}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{alert.value} {alert.unit}</p>
              </div>
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] text-red-400 bg-red-500/10 px-2 py-1 rounded-md">
                {alert.zone_label_fr}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bandeau Navy */}
      <NavySuggestionBanner
        suggestion={navySuggestion}
        onApply={applyNavySuggestion}
        className="mb-4"
      />

      {/* Sections de jauges */}
      {METRIC_SECTIONS.map((section) => {
        const sectionEvals = section.keys
          .map((key) => evaluations.find((e) => e.metric_key === key))
          .filter((e): e is NormEvaluation => e !== undefined)

        if (sectionEvals.length === 0) return null

        return (
          <div key={section.label} className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3">
              {section.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sectionEvals.map((ev) => (
                <BioNormsGauge
                  key={ev.metric_key}
                  evaluation={ev}
                  source={metricSources[ev.metric_key]}
                  showSource={false}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
