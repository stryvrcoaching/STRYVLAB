'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  GraduationCap,
  Loader2,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  CoachActivationSnapshot,
  ResolvedActivationCategory,
  ResolvedActivationStep,
} from '@/lib/onboarding/coach-activation'
import {
  clearActivationNavigation,
  consumeActivationCompletedFlash,
  getActivationStepId,
  isActivationNavigationActive,
  markActivationCompletedFlash,
  markActivationNavigation,
} from '@/lib/onboarding/activation-session'

type Props = {
  snapshot: CoachActivationSnapshot
}

export default function WelcomeHeader({ snapshot }: Props) {
  const router = useRouter()
  const next = snapshot.nextStep
  const activeCatId = snapshot.activeCategoryId

  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => ({
    basics: activeCatId === 'basics',
    first_client: activeCatId === 'first_client',
    prescription: activeCatId === 'prescription',
    stryvr: activeCatId === 'stryvr',
    learn: false,
  }))
  const [billingLoading, setBillingLoading] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  // Keep only the active progress category open when next step changes
  useEffect(() => {
    if (!activeCatId) return
    setOpenCats((prev) => ({
      ...prev,
      basics: activeCatId === 'basics',
      first_client: activeCatId === 'first_client',
      prescription: activeCatId === 'prescription',
      stryvr: activeCatId === 'stryvr',
      // keep learn as user left it
      learn: prev.learn ?? false,
    }))
  }, [activeCatId])

  // On dashboard return: if previous step is now done, flash success
  useEffect(() => {
    const pendingFlash = consumeActivationCompletedFlash()
    if (pendingFlash) {
      setFlash(pendingFlash)
      return
    }
    if (!isActivationNavigationActive()) return
    const stepId = getActivationStepId()
    if (!stepId) return
    const step = snapshot.categories
      .flatMap((c) => c.steps)
      .find((s) => s.id === stepId)
    if (step?.done) {
      markActivationCompletedFlash(step.label)
      clearActivationNavigation()
      setFlash(step.label)
    }
  }, [snapshot])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 6000)
    return () => window.clearTimeout(t)
  }, [flash])

  const progressCategories = useMemo(
    // Completed activation blocks no longer need dashboard space. The optional
    // learning module remains available independently below.
    () => snapshot.categories.filter((c) => c.mode === 'progress' && !c.complete),
    [snapshot.categories],
  )
  const learnCategory = useMemo(
    () => snapshot.categories.find((c) => c.mode === 'learn') ?? null,
    [snapshot.categories],
  )

  const toggleCat = (id: string) => {
    setOpenCats((prev) => {
      // Accordion for progress: opening one closes others
      if (id === 'learn') return { ...prev, learn: !prev.learn }
      const nextOpen = !prev[id]
      return {
        basics: id === 'basics' ? nextOpen : false,
        first_client: id === 'first_client' ? nextOpen : false,
        prescription: id === 'prescription' ? nextOpen : false,
        stryvr: id === 'stryvr' ? nextOpen : false,
        learn: prev.learn,
      }
    })
  }

  const handleUpgrade = useCallback(async () => {
    setBillingLoading(true)
    markActivationNavigation('upgrade_pro_for_app', 'Activer l’app client STRYVR')
    try {
      const res = await fetch('/api/stripe/coach-platform/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })
      const data = await res.json().catch(() => null)

      if (res.status === 409 && data?.portalUrl) {
        window.location.href = data.portalUrl
        return
      }

      if (!res.ok || !data?.url) {
        router.push('/coach/settings?section=plan&intent=upgrade_pro&from=activation')
        return
      }

      window.location.href = data.url
    } catch {
      router.push('/coach/settings?section=plan&intent=upgrade_pro&from=activation')
    } finally {
      setBillingLoading(false)
    }
  }, [router])

  const handleStepCta = useCallback(
    async (step: ResolvedActivationStep) => {
      // Exploration links are simple shortcuts. They must not create an
      // activation session or show the "Continuer" bar on the destination.
      if (step.kind === 'learn') {
        clearActivationNavigation()
        router.push(step.hrefResolved)
        return
      }

      markActivationNavigation(step.id, step.label)
      if (step.ctaMode === 'checkout_or_portal' || step.isUpgradeTeaser) {
        await handleUpgrade()
        return
      }
      router.push(step.hrefResolved)
    },
    [handleUpgrade, router],
  )

  if (snapshot.progressComplete && !learnCategory) return null

  const pct =
    snapshot.progressTotal > 0
      ? Math.round((snapshot.progressDone / snapshot.progressTotal) * 100)
      : 0

  return (
    <div className="mb-6 space-y-3">
      {flash && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#1f8a65]/30 bg-[#1f8a65]/[0.1] px-4 py-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#7fe0b8]" />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-white">
              Étape validée — {flash}
            </p>
            {next ? (
              <p className="mt-0.5 text-[11px] text-white/50">
                Suivant : {next.label}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-white/50">
                Bases d’activation complètes.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Single dominant CTA */}
      {!snapshot.progressComplete && next && (
        <div className="rounded-2xl border-[0.3px] border-[#1f8a65]/25 bg-gradient-to-b from-[#1f8a65]/[0.08] to-white/[0.02] p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#7fe0b8]/80">
                Prochaine étape
              </p>
              <h2 className="text-lg font-bold tracking-tight text-white">
                {next.label}
              </h2>
              <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-white/50">
                {next.why}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white/45">
              {snapshot.progressDone}/{snapshot.progressTotal}
            </span>
          </div>

          <div className="mb-4 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[#1f8a65] transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          <button
            type="button"
            disabled={billingLoading}
            onClick={() => void handleStepCta(next)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1f8a65] px-4 py-2.5 text-[12px] font-bold text-white transition-colors hover:bg-[#217356] active:scale-[0.98] disabled:opacity-60"
          >
            {billingLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <>
                {next.ctaLabel}
                <ArrowRight size={13} />
              </>
            )}
          </button>

          <p className="mt-3 text-[10px] text-white/30">
            Plan{' '}
            {snapshot.plan === 'pro'
              ? 'Pro'
              : snapshot.plan === 'studio'
                ? 'Studio'
                : 'Solo'}
            {snapshot.clientAppEnabled
              ? ' · App client active'
              : ' · App client non incluse'}
            {snapshot.primaryClientId
              ? ' · Dossier client guidé'
              : ''}
          </p>
        </div>
      )}

      {/* Only unfinished activation categories remain visible. */}
      <div className="space-y-2">
        {progressCategories.map((cat) => (
          <CategoryBlock
            key={cat.id}
            cat={cat}
            open={Boolean(openCats[cat.id])}
            onToggle={() => toggleCat(cat.id)}
            nextStepId={next?.id ?? null}
            onStepCta={(s) => void handleStepCta(s)}
            billingLoading={billingLoading}
          />
        ))}
      </div>

      {learnCategory && (
        <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.015] p-4">
          <button
            type="button"
            onClick={() => router.push('/coach/apprendre')}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-2">
              <GraduationCap size={15} className="text-white/45" />
              <div>
                <p className="text-[12px] font-semibold text-white/85">
                  {learnCategory.label}
                </p>
                <p className="text-[11px] text-white/35">{learnCategory.hint}</p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#7fe0b8]">
              Ouvrir l’académie
              <ArrowRight size={12} />
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

function CategoryBlock({
  cat,
  open,
  onToggle,
  nextStepId,
  onStepCta,
  billingLoading,
}: {
  cat: ResolvedActivationCategory
  open: boolean
  onToggle: () => void
  nextStepId: string | null
  onStepCta: (step: ResolvedActivationStep) => void
  billingLoading: boolean
}) {
  return (
    <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold text-white/85">{cat.label}</p>
            {cat.complete && (
              <span className="rounded bg-[#1f8a65]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#7fe0b8]">
                Fait
              </span>
            )}
            {!cat.complete &&
              cat.steps.some((s) => s.id === nextStepId) && (
                <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/45">
                  En cours
                </span>
              )}
          </div>
          <p className="mt-0.5 text-[11px] text-white/35">{cat.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] tabular-nums text-white/35">
            {cat.doneCount}/{cat.totalCount}
          </span>
          <ChevronDown
            size={14}
            className={cn(
              'text-white/30 transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </button>

      {open && (
        <ul className="space-y-1 border-t border-white/[0.05] px-2 pb-2 pt-1">
          {cat.steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              isNext={step.id === nextStepId}
              onCta={() => onStepCta(step)}
              billingLoading={billingLoading}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function StepRow({
  step,
  isNext,
  onCta,
  billingLoading,
}: {
  step: ResolvedActivationStep
  isNext: boolean
  onCta: () => void
  billingLoading: boolean
}) {
  const isUpgrade = step.isUpgradeTeaser || step.kind === 'upgrade'
  // Only the current next step gets a CTA in the list (dominant action = header)
  const showCta = !step.done && isNext

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-xl px-3 py-2.5',
        step.done && 'bg-[#1f8a65]/5',
        isNext && !step.done && 'border border-[#1f8a65]/20 bg-[#1f8a65]/[0.04]',
        isUpgrade && !step.done && !isNext && 'opacity-80',
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {step.done ? (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#1f8a65]" />
        ) : isUpgrade ? (
          <Lock size={15} className="mt-0.5 shrink-0 text-amber-400/70" />
        ) : (
          <Circle
            size={15}
            className={cn(
              'mt-0.5 shrink-0',
              isNext ? 'text-[#1f8a65]' : 'text-white/25',
            )}
          />
        )}
        <div className="min-w-0">
          <p
            className={cn(
              'text-[12px] font-medium',
              step.done ? 'text-white/35 line-through' : 'text-white/80',
            )}
          >
            {step.label}
          </p>
          {!step.done && isNext && (
            <p className="mt-0.5 text-[11px] leading-snug text-white/38">
              {step.why}
            </p>
          )}
        </div>
      </div>

      {showCta && (
        <button
          type="button"
          disabled={billingLoading && isUpgrade}
          onClick={onCta}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors',
            isUpgrade
              ? 'bg-white/[0.08] text-white hover:bg-white/[0.12]'
              : 'bg-[#1f8a65] text-white hover:bg-[#217356]',
          )}
        >
          {billingLoading && isUpgrade ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <>
              {step.ctaLabel}
              <ArrowRight size={11} />
            </>
          )}
        </button>
      )}
    </div>
  )
}
