'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, CheckCircle2, ChevronRight, CircleHelp, Flame, Gift, Lock, MapPin, Sparkles, Trophy, X } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import StrivrToken from '@/components/client/StrivrToken'
import { PROGRESSION_LEVEL_COLORS, type ProgressionLevel } from '@/lib/rewards/progression'

type Reward = {
  id: string
  title: string
  description: string | null
  cost_points: number
  icon_name: string | null
  image_url: string | null
  reward_type: 'digital' | 'physical'
  unlocked?: boolean
}

type Redemption = { id: string; reward_id: string; status: string; redeemed_at: string; delivery_url: string | null }
type ShippingAddress = { recipientName: string; addressLine1: string; addressLine2: string; postalCode: string; city: string; country: string; phone: string }

export default function RewardsClientPage({
  rewards,
  redemptions,
  availablePoints,
  level,
  totalPoints,
  currentStreak,
  gender,
  shippingDefaults,
}: {
  rewards: Reward[]
  redemptions: Redemption[]
  availablePoints: number
  level: string
  totalPoints: number
  currentStreak: number
  gender: 'male' | 'female'
  shippingDefaults: ShippingAddress
}) {
  const { t } = useClientT()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const heroRef = useRef<HTMLDivElement | null>(null)
  const [heroCollapsed, setHeroCollapsed] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [delivery, setDelivery] = useState<{ title: string; url: string } | null>(null)
  const [physicalReward, setPhysicalReward] = useState<Reward | null>(null)
  const [shipping, setShipping] = useState<ShippingAddress>(shippingDefaults)
  const [showPointsInfo, setShowPointsInfo] = useState(false)

  const store = useMemo(() => {
    const statusFor = (rewardId: string) => {
      const status = redemptions.find((redemption) => redemption.reward_id === rewardId)?.status
      return status === 'pending' || status === 'fulfilled' ? status : undefined
    }
    const available = rewards.filter((reward) => !statusFor(reward.id) && availablePoints >= reward.cost_points)
    const locked = rewards.filter((reward) => !statusFor(reward.id) && availablePoints < reward.cost_points)
    const pending = rewards.filter((reward) => statusFor(reward.id) === 'pending')
    const fulfilled = rewards.filter((reward) => statusFor(reward.id) === 'fulfilled')
    const focus = available[0] ?? locked[0] ?? pending[0] ?? fulfilled[0] ?? null
    return { available, locked, pending, fulfilled, focus }
  }, [availablePoints, redemptions, rewards])
  const levelTrophies = useMemo(() => buildLevelTrophies(totalPoints, gender), [gender, totalPoints])

  useEffect(() => {
    const root = heroRef.current
    if (!root) return

    let scrollParent: HTMLElement | null = root.parentElement
    while (scrollParent) {
      const overflowY = window.getComputedStyle(scrollParent).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') break
      scrollParent = scrollParent.parentElement
    }

    const target = scrollParent ?? document.documentElement
    const onScroll = () => setHeroCollapsed(target.scrollTop > 34)
    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [])

  function redeem(reward: Reward) {
    if (reward.reward_type === 'physical') {
      setShipping(shippingDefaults)
      setPhysicalReward(reward)
      return
    }
    void submitRedemption(reward)
  }

  async function submitRedemption(reward: Reward, shippingDetails?: ShippingAddress) {
    setLoadingId(reward.id)
    try {
      const res = await fetch('/api/client/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: reward.id, shipping: shippingDetails }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('rewards.claim.error'))
      setConfirmingId(null)
      setPhysicalReward(null)
      if (data.redemption?.status === 'fulfilled') {
        if (data.deliveryUrl) setDelivery({ title: reward.title, url: data.deliveryUrl })
        setMessage(t(data.deliveryUrl ? 'rewards.claim.sent.auto' : 'rewards.claim.sent.auto.noLink', { title: reward.title }))
      } else {
        setMessage(t('rewards.claim.sent', { title: reward.title }))
      }
      router.refresh()
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : t('rewards.claim.error'))
    } finally {
      setLoadingId(null)
    }
  }

  async function cancelRedemption(rewardId: string) {
    const redemption = redemptions.find((item) => item.reward_id === rewardId && item.status === 'pending')
    if (!redemption) return
    setCancellingId(rewardId)
    try {
      const res = await fetch('/api/client/rewards/redeem', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemptionId: redemption.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('rewards.cancel.error'))
      setMessage(t('rewards.cancel.success'))
      router.refresh()
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : t('rewards.cancel.error'))
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <video
          className="h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster="/images/lclient-dashboard-bg.jpg"
        >
          <source src="/videos/client-dashboard-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,7,0.56),rgba(6,6,7,0.88))]" />
      </div>
      <RewardsFixedHeader
        headerRef={heroRef}
        trophies={levelTrophies}
        availablePoints={availablePoints}
        level={level}
        currentStreak={currentStreak}
        collapsed={heroCollapsed}
        onShowPointsInfo={() => setShowPointsInfo(true)}
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        style={{ paddingTop: heroCollapsed ? 156 : 440 }}
        className="relative z-10 flex flex-col gap-4 pb-5 transition-[padding] duration-300 ease-out"
      >

      {message && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#09090a] px-4 py-3 text-sm text-white/80">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label={t('rewards.message.close')} className="shrink-0 text-white/55 transition hover:text-white"><X size={16} /></button>
        </div>
      )}

      {delivery && (
        <div className="rounded-2xl border border-[#1f8a65]/30 bg-[#1f8a65]/[0.09] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a8f1d3]">{t('rewards.delivery.ready')}</p>
          <p className="mt-1 text-[13px] font-medium text-white">{delivery.title}</p>
          <a href={delivery.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-black transition hover:bg-white/90">
            {t('rewards.delivery.cta')} <ChevronRight size={14} />
          </a>
        </div>
      )}

      {physicalReward && (
        <ShippingAddressModal
          reward={physicalReward}
          value={shipping}
          loading={loadingId === physicalReward.id}
          onChange={setShipping}
          onClose={() => setPhysicalReward(null)}
          onSubmit={() => void submitRedemption(physicalReward, shipping)}
        />
      )}

      {store.focus && (
        <SpotlightReward
          reward={store.focus}
          availablePoints={availablePoints}
          claimable={store.available.some((reward) => reward.id === store.focus?.id)}
          confirming={confirmingId === store.focus.id}
          loading={loadingId === store.focus.id}
          onConfirm={setConfirmingId}
          onRedeem={redeem}
        />
      )}

      {rewards.length === 0 ? (
        <EmptyStore />
      ) : (
        <>
          <StoreShelf
            rewards={[...store.available, ...store.locked].filter((reward) => reward.id !== store.focus?.id)}
            availablePoints={availablePoints}
            confirmingId={confirmingId}
            loadingId={loadingId}
            onConfirm={setConfirmingId}
            onRedeem={redeem}
          />
          {store.pending.length > 0 && <OrderStatus title={t('rewards.pending.title')} icon={<Sparkles size={16} />} rewards={store.pending} description={t('rewards.pending.desc')} cancellingId={cancellingId} onCancel={cancelRedemption} />}
          {store.fulfilled.length > 0 && <OrderStatus title={t('rewards.fulfilled.title')} icon={<CheckCircle2 size={16} />} rewards={store.fulfilled} redemptions={redemptions} description={t('rewards.fulfilled.desc')} />}
        </>
      )}
      </motion.div>
      {showPointsInfo && <PointsInfoSheet onClose={() => setShowPointsInfo(false)} />}
    </div>
  )
}

function RewardsFixedHeader({ headerRef, trophies, availablePoints, level, currentStreak, collapsed, onShowPointsInfo }: {
  headerRef: React.RefObject<HTMLDivElement>; trophies: Reward[]; availablePoints: number; level: string; currentStreak: number; collapsed: boolean; onShowPointsInfo: () => void
}) {
  return (
    <div ref={headerRef} className="fixed inset-x-0 top-0 z-[60]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="premium-micrograin isolate mx-auto w-full max-w-xl overflow-hidden rounded-b-[32px] bg-[#09090a] shadow-lg shadow-black/40">
        <div className="mx-auto w-full max-w-lg px-4">
          <div className={`overflow-hidden transition-[max-height,height,padding] duration-300 ease-out ${collapsed ? 'h-[72px] py-2' : 'max-h-[500px] py-3'}`}>
            <JourneyHeader trophies={trophies} availablePoints={availablePoints} level={level} currentStreak={currentStreak} collapsed={collapsed} onShowPointsInfo={onShowPointsInfo} />
          </div>
        </div>
      </div>
    </div>
  )
}

function JourneyHeader({ trophies, availablePoints, level, currentStreak, collapsed, onShowPointsInfo }: {
  trophies: Reward[]; availablePoints: number; level: string; currentStreak: number; collapsed: boolean; onShowPointsInfo: () => void
}) {
  const { t } = useClientT()
  const levelColor = rankColor(level)
  const MotionDiv = motion.div

  return (
    <MotionDiv layout transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className={`relative overflow-hidden ${collapsed ? 'rounded-[18px] bg-[#09090a] px-3.5 py-2.5' : 'px-0 pb-4 pt-3'}`}>
      <div className="relative z-[1]">
        {collapsed && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/42">{t('rewards.availableBalance')}</p>
              <p className="flex items-center gap-1 truncate text-[18px] font-semibold leading-tight tabular-nums text-white">{availablePoints}<StrivrToken size={15} /></p>
            </div>
            <div className="border-l border-white/[0.08] pl-3 text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">{t('rewards.journey.streak')}</p>
              <p className="mt-1 text-[12px] font-semibold leading-none tabular-nums text-white">{currentStreak} {t('rewards.journey.days')}</p>
            </div>
            <div className="border-l border-white/[0.08] pl-3 text-right"><p className="text-[13px] font-semibold uppercase leading-none" style={{ color: levelColor }}>{level}</p></div>
            </div>
        )}
        {!collapsed && (
          <div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-white/45">{t('rewards.availableBalance')}</p>
              <p className="mt-1 flex items-center gap-2 text-[2.55rem] font-semibold leading-none tracking-[-0.07em] text-white tabular-nums">
                {availablePoints}<StrivrToken size={32} className="relative -top-px" />
              </p>
            </div>
            <button type="button" onClick={onShowPointsInfo} aria-label="Comprendre les points" className="flex h-7 w-7 shrink-0 items-center justify-center text-white/48 transition hover:text-white"><CircleHelp size={17} /></button>
            <div className="flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white/[0.045] px-3">
              <Flame size={21} strokeWidth={1.8} className="text-white/72" />
              <div className="leading-none">
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/35">{t('rewards.journey.streak')}</p>
                <p className="mt-1.5 text-[16px] font-semibold tabular-nums text-white">{currentStreak} <span className="text-[11px] font-medium text-white/58">{t('rewards.journey.days')}</span></p>
              </div>
            </div>
            <div className="flex h-12 min-w-[78px] shrink-0 flex-col justify-center rounded-2xl bg-white/[0.045] px-3">
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/35">Rang</p>
              <p className="mt-1.5 truncate text-[12px] font-semibold uppercase leading-none" style={{ color: levelColor }}>{rankLabel(level, t)}</p>
            </div>
          </div>
        <div className="mt-6 border-t border-white/[0.07] pt-4">
          <TrophyCollection trophies={trophies} embedded availablePoints={availablePoints} />
          </div>
          </div>
        )}
      </div>
    </MotionDiv>
  )
}

function SpotlightReward({ reward, availablePoints, claimable, confirming, loading, onConfirm, onRedeem }: {
  reward: Reward; availablePoints: number; claimable: boolean; confirming: boolean; loading: boolean
  onConfirm: (id: string | null) => void; onRedeem: (reward: Reward) => void
}) {
  const { t } = useClientT()
  const percentage = progress(availablePoints, reward.cost_points)
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/[0.05] bg-[#09090a]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(255,255,255,0.07),transparent_37%)]" />
      <div className="relative flex gap-4 p-4">
        <ProductImage reward={reward} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/38">{claimable ? t('rewards.spotlight.featured') : t('rewards.spotlight.next')}</p>
          <h2 className="mt-1 text-[20px] font-semibold leading-[0.98] tracking-[-0.045em] text-white">{reward.title}</h2>
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-white/48">{reward.description || t('rewards.spotlight.defaultDescription')}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[13px] font-semibold tabular-nums text-white">{reward.cost_points}<StrivrToken size={14} /></span>
            {!claimable && <span className="text-[11px] text-white/42">· {t('rewards.remainingPts', { n: Math.max(0, reward.cost_points - availablePoints) })}</span>}
          </div>
        </div>
      </div>

      {!claimable ? (
        <div className="relative border-t border-white/[0.05] px-4 py-3">
          <div className="flex items-center justify-between text-[10px] text-white/42"><span>{t('rewards.spotlight.progress')}</span><span>{percentage}%</span></div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-black/25"><motion.div initial={{ width: 0 }} whileInView={{ width: `${percentage}%` }} viewport={{ once: true }} className="h-full rounded-full bg-white/65" /></div>
        </div>
      ) : (
        <div className="relative border-t border-white/[0.05] px-4 py-3">
          {confirming ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-white/76">{t('rewards.spend.confirm', { n: reward.cost_points })}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => onConfirm(null)} className="rounded-xl px-3 py-2 text-[12px] text-white/62 hover:bg-white/[0.05]">{t('common.cancel')}</button>
                <button type="button" disabled={loading} onClick={() => onRedeem(reward)} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-black disabled:opacity-60"><Check size={14} /> {loading ? t('common.sending') : t('common.confirm')}</button>
              </div>
            </div>
          ) : <button type="button" onClick={() => onConfirm(reward.id)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.09] px-3 py-2.5 text-[12px] font-medium text-white transition hover:bg-white/[0.14]">{t('rewards.claim.cta')} <ChevronRight size={16} /></button>}
        </div>
      )}
    </section>
  )
}

function StoreShelf({ rewards, availablePoints, confirmingId, loadingId, onConfirm, onRedeem }: {
  rewards: Reward[]; availablePoints: number; confirmingId: string | null; loadingId: string | null
  onConfirm: (id: string | null) => void; onRedeem: (reward: Reward) => void
}) {
  const { t } = useClientT()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  if (rewards.length === 0) return null
  return (
    <section>
      <div className="flex items-end justify-between px-1">
        <h2 className="text-[18px] font-semibold tracking-[-0.035em]">{t('rewards.available.title')}</h2>
        <span className="mb-1 text-[11px] text-white/42">{t('rewards.swipe')} <ChevronRight className="inline" size={13} /></span>
      </div>
      <div className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
        {rewards.map((reward, index) => <CatalogCard key={reward.id} reward={reward} availablePoints={availablePoints} expanded={expandedId === reward.id} onToggle={() => setExpandedId((current) => current === reward.id ? null : reward.id)} confirming={confirmingId === reward.id} loading={loadingId === reward.id} onConfirm={onConfirm} onRedeem={onRedeem} index={index} />)}
      </div>
    </section>
  )
}

function CatalogCard({ reward, availablePoints, expanded, onToggle, confirming, loading, onConfirm, onRedeem, index }: {
  reward: Reward; availablePoints: number; expanded: boolean; onToggle: () => void; confirming: boolean; loading: boolean; index: number
  onConfirm: (id: string | null) => void; onRedeem: (reward: Reward) => void
}) {
  const { t } = useClientT()
  const claimable = availablePoints >= reward.cost_points
  const percentage = progress(availablePoints, reward.cost_points)
  return (
    <motion.article initial={{ opacity: 0, x: 14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }} className="w-[216px] shrink-0 snap-start overflow-hidden rounded-[22px] border border-white/[0.04] bg-[#09090a]">
      <div role="button" tabIndex={0} aria-expanded={expanded} onClick={onToggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle() } }} className="cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-white/50">
        <div className="relative h-[104px] overflow-hidden bg-black/16">
          <ProductImage reward={reward} size="cover" />
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg border border-white/[0.08] bg-black/35 px-2 py-1 text-[10px] font-medium text-white/78">{reward.cost_points}<StrivrToken size={12} /></span>
        </div>
        <div className="p-3 pb-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">{t('rewards.badge')}</p>
          <h3 className="mt-1 truncate text-[14px] font-medium text-white">{reward.title}</h3>
          {reward.description && <motion.p layout className={`mt-1.5 text-[11px] leading-relaxed text-white/48 ${expanded ? '' : 'line-clamp-2'}`}>{reward.description}</motion.p>}
          <p className="mt-2 text-[10px] text-white/35">{expanded ? t('rewards.details.collapse') : t('rewards.details.expand')}</p>
          {!claimable && <div className="mt-3 h-[4px] overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-white/55" style={{ width: `${percentage}%` }} /></div>}
        </div>
      </div>
      <div className="p-3 pt-2">
        <div className="mt-3">
          {claimable ? (
            confirming ? <div className="flex gap-1.5"><button type="button" onClick={() => onConfirm(null)} className="flex-1 rounded-lg py-2 text-[11px] text-white/55">{t('common.cancel')}</button><button type="button" disabled={loading} onClick={() => onRedeem(reward)} className="flex-1 rounded-lg bg-white py-2 text-[11px] font-bold text-black">{loading ? '…' : t('common.confirm')}</button></div>
            : <button type="button" onClick={() => onConfirm(reward.id)} className="flex w-full items-center justify-between rounded-lg bg-white/[0.07] px-2.5 py-2 text-[11px] font-medium text-white transition hover:bg-white/[0.12]">{t('rewards.claim.cta')} <ChevronRight size={13} /></button>
          ) : <p className="flex items-center gap-1 text-[10px] text-white/43"><Lock size={11} /> {t('rewards.points.left', { n: Math.max(0, reward.cost_points - availablePoints) })}</p>}
        </div>
      </div>
    </motion.article>
  )
}

function ProductImage({ reward, size }: { reward: Reward; size: 'sm' | 'lg' | 'cover' }) {
  const classes = { sm: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20 text-lg', lg: 'flex h-[92px] w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-black/18 text-4xl', cover: 'flex h-full w-full items-center justify-center text-4xl' }[size]
  return <div className={classes}>{reward.image_url ? <img src={reward.image_url} alt={reward.title} className="h-full w-full object-cover" /> : reward.icon_name || '🎁'}</div>
}

function ShippingAddressModal({ reward, value, loading, onChange, onClose, onSubmit }: {
  reward: Reward; value: ShippingAddress; loading: boolean; onChange: (value: ShippingAddress) => void; onClose: () => void; onSubmit: () => void
}) {
  const { t } = useClientT()
  const valid = Boolean(value.recipientName.trim() && value.addressLine1.trim() && value.postalCode.trim() && value.city.trim() && value.country.trim())
  const set = (key: keyof ShippingAddress, next: string) => onChange({ ...value, [key]: next })
  const fieldClass = 'mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-white/25'

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/65 p-3 backdrop-blur-sm sm:items-center sm:justify-center" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="shipping-modal-title" onMouseDown={(event) => event.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-[26px] border border-white/[0.1] bg-[#111112] p-4 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-3">
          <div><p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#a8f1d3]"><MapPin size={13} /> {t('rewards.shipping.eyebrow')}</p><h2 id="shipping-modal-title" className="mt-1 text-[18px] font-semibold text-white">{t('rewards.shipping.title')}</h2></div>
          <button type="button" onClick={onClose} aria-label={t('rewards.message.close')} className="rounded-xl p-2 text-white/50 hover:bg-white/[0.06] hover:text-white"><X size={16} /></button>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-white/52">{t('rewards.shipping.desc', { title: reward.title })}</p>
        <div className="mt-4 grid gap-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">{t('rewards.shipping.recipient')}<input value={value.recipientName} onChange={(event) => set('recipientName', event.target.value)} className={fieldClass} autoComplete="name" /></label>
          <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">{t('rewards.shipping.address1')}<input value={value.addressLine1} onChange={(event) => set('addressLine1', event.target.value)} className={fieldClass} autoComplete="address-line1" /></label>
          <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">{t('rewards.shipping.address2')}<input value={value.addressLine2} onChange={(event) => set('addressLine2', event.target.value)} className={fieldClass} autoComplete="address-line2" /></label>
          <div className="grid grid-cols-[0.8fr_1.2fr] gap-2"><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">{t('rewards.shipping.postal')}<input value={value.postalCode} onChange={(event) => set('postalCode', event.target.value)} className={fieldClass} autoComplete="postal-code" /></label><label className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">{t('rewards.shipping.city')}<input value={value.city} onChange={(event) => set('city', event.target.value)} className={fieldClass} autoComplete="address-level2" /></label></div>
          <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">{t('rewards.shipping.country')}<input value={value.country} onChange={(event) => set('country', event.target.value)} className={fieldClass} autoComplete="country-name" /></label>
          <label className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/42">{t('rewards.shipping.phone')}<input value={value.phone} onChange={(event) => set('phone', event.target.value)} className={fieldClass} autoComplete="tel" inputMode="tel" /></label>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-white/40">{t('rewards.shipping.privacy')}</p>
        <div className="mt-4 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/[0.08] px-3 py-2.5 text-[11px] font-medium text-white/65 hover:bg-white/[0.05]">{t('common.cancel')}</button><button type="button" disabled={!valid || loading} onClick={onSubmit} className="flex-[1.5] rounded-xl bg-white px-3 py-2.5 text-[11px] font-bold text-black disabled:opacity-45">{loading ? t('common.sending') : t('rewards.shipping.confirm')}</button></div>
      </section>
    </div>
  )
}

function TrophyCollection({ trophies, availablePoints, embedded = false }: { trophies: Reward[]; availablePoints: number; embedded?: boolean }) {
  const { t } = useClientT()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = trophies.find((trophy) => trophy.id === selectedId) ?? null
  const unlockedCount = trophies.filter((trophy) => trophy.unlocked).length

  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={embedded ? 'relative' : 'premium-priority-card premium-micrograin relative overflow-hidden rounded-[26px] p-4'}>
      <div className="relative z-[1]">
        <div className="flex items-end justify-between">
          <h2 className="text-[18px] font-semibold tracking-[-0.04em] text-white">{t('rewards.collection.title')}</h2>
          <span className="text-[12px] font-semibold tabular-nums text-white/72">{unlockedCount}/8</span>
        </div>

        {trophies.length > 0 ? (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {trophies.map((trophy, index) => {
              const unlocked = Boolean(trophy.unlocked)
              const isCurrent = unlocked && index === unlockedCount - 1
              return (
                <motion.button
                  key={trophy.id}
                  type="button"
                  onClick={() => setSelectedId(trophy.id)}
                  initial={{ opacity: 0, scale: 0.78 }}
                  animate={{ opacity: 1, scale: isCurrent ? 1.08 : 1 }}
                  transition={{ delay: index * 0.045, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: isCurrent ? 1.13 : 1.06, y: -3 }}
                  whileTap={{ scale: 0.96 }}
                  aria-label={`${rankLabel(trophy.title, t)}${unlocked ? '' : `, ${t('rewards.collection.locked')}`}`}
                  className={`group relative aspect-square overflow-hidden rounded-[16px] border bg-black/10 ${isCurrent ? 'border-white/[0.32] shadow-[0_0_22px_rgba(255,255,255,0.14)]' : 'border-white/[0.07]'}`}
                >
                  <img src={trophy.image_url ?? ''} alt="" className={`h-full w-full object-contain transition duration-300 ${unlocked ? 'opacity-100' : 'opacity-[0.22] saturate-0'}`} />
                  {!unlocked && (
                    <>
                      <div className="absolute inset-0 bg-black/55" />
                      <Lock size={11} className="absolute right-1.5 top-1.5 text-white/50" />
                    </>
                  )}
                </motion.button>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[19px] border border-dashed border-white/[0.1] bg-black/10 px-4 py-5 text-center"><Trophy size={18} className="mx-auto text-white/35" /><p className="mt-2 text-[12px] text-white/60">{t('rewards.collection.empty')}</p></div>
        )}

        {selected && <TrophyDetailOverlay trophy={selected} availablePoints={availablePoints} onClose={() => setSelectedId(null)} />}
      </div>
    </motion.section>
  )
}

function TrophyDetailOverlay({ trophy, availablePoints, onClose }: { trophy: Reward; availablePoints: number; onClose: () => void }) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] bg-black/[0.62]" onClick={onClose} />
      <motion.div
        role="presentation"
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="fixed inset-0 z-[121] flex items-center justify-center p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={onClose}
      >
        <div className="w-full max-w-md max-h-[calc(100dvh-2.5rem)] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
          <TrophyDetail trophy={trophy} availablePoints={availablePoints} onClose={onClose} />
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

function TrophyDetail({ trophy, availablePoints, onClose }: { trophy: Reward; availablePoints: number; onClose: () => void }) {
  const { t } = useClientT()
  const unlocked = Boolean(trophy.unlocked)
  const percentage = progress(availablePoints, trophy.cost_points)
  return (
    <div role="dialog" aria-modal="true" aria-label={rankLabel(trophy.title, t)} className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#111112] p-4 shadow-2xl shadow-black/70">
      <div className="relative flex h-[min(42dvh,340px)] min-h-[250px] items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-x-10 top-4 h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.11),transparent_68%)]" />
        <TrophyArtwork trophy={trophy} unlocked={unlocked} />
        <button type="button" onClick={onClose} aria-label={t('rewards.message.close')} className="absolute right-1 top-1 rounded-full border border-white/[0.1] bg-black/35 p-2 text-white/60 transition hover:text-white"><X size={15} /></button>
      </div>
      <div className="relative mt-4 flex items-start gap-3 px-1">
        <div className="min-w-0 flex-1"><p className="text-[18px] font-semibold uppercase tracking-[-0.02em]" style={{ color: rankColor(trophy.title) }}>{rankLabel(trophy.title, t)}</p><p className="mt-1 text-[11px] text-white/48">{unlocked ? t('rewards.collection.acquired') : t('rewards.collection.threshold', { n: trophy.cost_points })}</p></div>
      </div>
      {!unlocked && <><div className="mt-3 h-[5px] overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-white/65" style={{ width: `${percentage}%` }} /></div><p className="mt-1.5 text-[10px] text-white/45">{t('rewards.collection.progress', { n: percentage, remaining: trophy.cost_points - availablePoints })}</p></>}
    </div>
  )
}

function TrophyArtwork({ trophy, unlocked }: { trophy: Reward; unlocked: boolean }) {
  const cutout = trophy.image_url ?? ''
  const fallback = cutout.replace('/cutout/', '/regenerated/').replace(/\.png$/i, '.jpg')
  const [src, setSrc] = useState(cutout)
  return <motion.img initial={{ opacity: 0, scale: 0.82, y: 12 }} animate={{ opacity: unlocked ? 1 : 0.32, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 230, damping: 20 }} src={src} onError={() => setSrc(fallback)} alt="" className="relative h-full max-h-[min(42dvh,340px)] w-full object-contain" />
}

function EmptyStore() {
  const { t } = useClientT()
  return <section className="rounded-[24px] border border-white/[0.04] bg-[#09090a] px-5 py-10 text-center"><Gift size={28} className="mx-auto text-white/48" /><h2 className="mt-4 text-lg font-semibold">{t('rewards.none.title')}</h2><p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-white/56">{t('rewards.none.desc')}</p></section>
}

function OrderStatus({ title, icon, rewards, redemptions = [], description, cancellingId, onCancel }: { title: string; icon: React.ReactNode; rewards: Reward[]; redemptions?: Redemption[]; description: string; cancellingId?: string | null; onCancel?: (rewardId: string) => void }) {
  const { t } = useClientT()
  return <section className="rounded-[22px] border border-white/[0.04] bg-[#09090a] px-4 py-4"><div className="flex items-center gap-2 text-white/72">{icon}<h2 className="text-[13px] font-medium">{title}</h2></div><p className="mt-1 text-[11px] text-white/45">{description}</p><div className="mt-3 grid gap-2">{rewards.map((reward) => {
    const deliveryUrl = redemptions.find((redemption) => redemption.reward_id === reward.id && redemption.status === 'fulfilled')?.delivery_url
    return <div key={reward.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2"><span className="min-w-0 truncate text-[11px] text-white/68">{reward.title}</span>{deliveryUrl ? <a href={deliveryUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg border border-[#1f8a65]/30 bg-[#1f8a65]/10 px-2 py-1.5 text-[10px] font-semibold text-[#a8f1d3] transition hover:bg-[#1f8a65]/18">{t('rewards.delivery.cta')}</a> : onCancel && <button type="button" disabled={cancellingId === reward.id} onClick={() => onCancel(reward.id)} className="shrink-0 text-[10px] font-medium text-white/45 hover:text-white disabled:opacity-50">{cancellingId === reward.id ? '…' : t('rewards.cancel.cta')}</button>}</div>
  })}</div></section>
}

function rankLabel(value: string, t: ReturnType<typeof useClientT>['t']) {
  const key = `rewards.rank.${value}` as const
  const translated = t(key as any)
  return translated === key ? value : translated
}

function rankColor(value: string) {
  return PROGRESSION_LEVEL_COLORS[value as ProgressionLevel] ?? '#ffffff'
}

function progress(availablePoints: number, cost: number) {
  return cost <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((availablePoints / cost) * 100)))
}

const TROPHY_LEVELS = [
  ['metal', 25], ['bronze', 150], ['silver', 350], ['gold', 700],
  ['platinum', 1500], ['diamond', 3000], ['master', 4500], ['olympian', 6500],
] as const

function buildLevelTrophies(totalPoints: number, gender: 'male' | 'female'): Reward[] {
  return TROPHY_LEVELS.map(([trophyLevel, threshold]) => {
    const trophyAsset = trophyLevel
    return {
    id: `trophy-${trophyLevel}`,
    title: trophyLevel,
    description: null,
    cost_points: threshold,
    icon_name: '🏆',
    image_url: `/images/trophies/relics-v2/${trophyAsset}-${gender}.png`,
    reward_type: 'digital',
    unlocked: totalPoints >= threshold,
    }
  })
}

function PointsInfoSheet({ onClose }: { onClose: () => void }) {
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-info-title"
        initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={(event) => event.stopPropagation()}
        className="client-native-bottom-sheet fixed inset-x-0 bottom-0 z-[121] mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[#0d0d0d] shadow-[0_-18px_60px_rgba(0,0,0,0.45)]"
        style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/[0.10]" />
        <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-5">
          <div>
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">Progression</p>
            <h2 id="points-info-title" className="mt-1 text-[20px] font-semibold tracking-[-0.035em] text-white">Comment gagner des points ?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 transition active:bg-white/[0.08] hover:text-white"><X size={16} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
          <p className="text-[13px] leading-relaxed text-white/56">Ta progression récompense surtout le suivi de ce que ton coach a réellement prévu pour toi.</p>
          <div className="mt-5 space-y-2.5">
            <PointsRule title="Entraînement" description="Termine les séances prévues : c’est l’un des leviers principaux de progression." />
            <PointsRule title="Nutrition" description="La journée est évaluée une fois clôturée, selon ta proximité avec les objectifs nutritionnels du jour." />
            <PointsRule title="Check-ins et bilans" description="Les check-ins donnent un petit bonus — réduit lorsqu’ils sont tardifs. Un bilan demandé et complété rapporte 25 points." />
          </div>
          <p className="pb-3 pt-5 text-[11px] leading-relaxed text-white/36">Ton rang et tes trophées restent acquis. Le solde de cette boutique est lié à ton accompagnement actuel.</p>
        </div>
      </motion.section>
    </AnimatePresence>,
    document.body,
  )
}

function PointsRule({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl bg-white/[0.035] px-4 py-3.5"><p className="text-[13px] font-semibold text-white">{title}</p><p className="mt-1.5 text-[12px] leading-relaxed text-white/50">{description}</p></div>
}
