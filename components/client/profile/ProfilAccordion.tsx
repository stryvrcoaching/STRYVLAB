'use client'

import { useState } from 'react'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import dynamic from 'next/dynamic'
import CyclePhasePill from '@/components/client/cycle/CyclePhasePill'
import AccordionSection from './AccordionSection'

const LogPeriodSheet = dynamic(() => import('@/components/client/cycle/LogPeriodSheet'), { ssr: false })
import ProfilePhotoUpload from './ProfilePhotoUpload'
import ProfileForm from './ProfileForm'
import PreferencesForm from './PreferencesForm'
import NotificationsPanel from './NotificationsPanel'
import HealthSyncPanel from './HealthSyncPanel'
import PasswordResetButton from './PasswordResetButton'
import PortionScalingForm from './PortionScalingForm'
import ClientRestrictionsSection from '@/components/client/ClientRestrictionsSection'
import ClientLogoutButton from '@/app/client/profil/LogoutButton'
import Link from 'next/link'
import { useClientT } from '@/components/client/ClientI18nProvider'
import StrivrToken from '@/components/client/StrivrToken'

type SectionId =
  | 'info'
  | 'restrictions'
  | 'docs'
  | 'portions'
  | 'progress'
  | 'notif'
  | 'prefs'
  | 'health'
  | 'security'
  | 'cycle'

interface Props {
  clientId: string
  profilePhotoUrl: string | null
  initials: string
  fullName: string
  email: string
  status: string | null
  memberSince: string
  profileInitial: {
    first_name: string
    last_name: string
    phone: string
    goal: string
    date_of_birth: string
    gender: string
    training_goal: string
    fitness_level: string
    sport_practice: string
    weekly_frequency: number | null
  }
  prefsInitial: {
    weight_unit: 'kg' | 'lbs'
    height_unit: 'cm' | 'ft'
    language: 'fr' | 'en' | 'es'
  }
  notifPrefs: {
    notif_session_reminder: boolean
    notif_bilan_received: boolean
    notif_program_updated: boolean
    notif_checkin_reminder: boolean
    notif_hydration_reminder: boolean
    notif_meal_reminder: boolean
    notif_protein_reminder: boolean
    notif_coach_messages: boolean
    notif_progress_updates: boolean
    training_reminder_times: string[]
    hydration_reminder_first_time: string
    hydration_reminder_count: number
    meal_reminder_breakfast_time: string
    meal_reminder_lunch_time: string
    protein_reminder_time: string
  }
  streak: {
    current_streak: number
    longest_streak: number
    total_points: number
    spent_points?: number
    level: string
  } | null
  cycleState?: CycleState | null
}

const LEVEL_COLORS: Record<string, string> = {
  iron:     'text-zinc-500',
  bronze:   'text-amber-600',
  silver:   'text-slate-300',
  gold:     'text-yellow-400',
  platinum: 'text-cyan-300',
  diamond:  'text-indigo-400',
  master:   'text-purple-500',
  olympian: 'text-rose-500',
}

export default function ProfilAccordion({
  clientId,
  profilePhotoUrl,
  initials,
  fullName,
  email,
  status,
  memberSince,
  profileInitial,
  prefsInitial,
  notifPrefs,
  streak,
  cycleState: initialCycleState,
}: Props) {
  const { t } = useClientT()
  const [openSection, setOpenSection] = useState<SectionId | null>(null)
  const [localCycleState, setLocalCycleState] = useState<CycleState | null>(initialCycleState ?? null)
  const [showLogPeriod, setShowLogPeriod] = useState(false)
  const isFemale = profileInitial.gender === 'female'

  function toggle(id: string) {
    setOpenSection(prev => prev === id ? null : id as SectionId)
  }

  return (
    <div className="flex flex-col gap-2">

      {/* ── Hero compact ── */}
      <div className="bg-[#161616] rounded-2xl p-4 flex items-center gap-4">
        <ProfilePhotoUpload
          currentUrl={profilePhotoUrl}
          initials={initials}
          compact
        />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white truncate">{fullName}</p>
          <p className="text-[11px] text-white/40 truncate">{email}</p>
          {status && (
            <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
              status === 'active'
                ? 'bg-[#f2f2f2]/15 text-[#f2f2f2]'
                : 'bg-white/[0.06] text-white/40'
            }`}>
              {status === 'active' ? t('profil.status.active') : status}
            </span>
          )}
        </div>
        {streak && (
          <div className="text-right shrink-0">
            <p className="text-[22px] font-black text-[#f2f2f2] leading-none">{streak.current_streak}</p>
            <p className="text-[9px] text-white/30 mt-0.5">{t('progress.streak.title')}</p>
          </div>
        )}
      </div>

      {/* ── Section 1 : Infos personnelles ── */}
      <AccordionSection
        id="info"
        title={t('profil.section.info')}
        icon="👤"
        isOpen={openSection === 'info'}
        onToggle={toggle}
      >
        <ProfileForm clientId={clientId} initial={profileInitial} />
      </AccordionSection>

      {/* ── Section 2 : Restrictions physiques ── */}
      <AccordionSection
        id="restrictions"
        title={t('profil.section.restrictions')}
        icon="🚫"
        isOpen={openSection === 'restrictions'}
        onToggle={toggle}
      >
        <ClientRestrictionsSection />
      </AccordionSection>

      <AccordionSection
        id="docs"
        title={t('profil.docs.workout')}
        icon="📘"
        isOpen={openSection === 'docs'}
        onToggle={toggle}
      >
        <Link
          href="/client/profil/documentation/workout"
          className="flex items-start justify-between rounded-xl bg-white/[0.03] px-3 py-3 transition-colors hover:bg-white/[0.05]"
        >
          <div>
            <p className="text-[12px] font-semibold text-white/78">{t('profil.docs.workout.title')}</p>
            <p className="mt-1 text-[11px] leading-5 text-white/45">{t('profil.docs.workout.desc')}</p>
          </div>
          <span className="text-[10px] text-white/30">→</span>
        </Link>
      </AccordionSection>

      {/* ── Section 4 : Portions visuelles ── */}
      <AccordionSection
        id="portions"
        title={t('profil.section.portions')}
        icon="🤚"
        isOpen={openSection === 'portions'}
        onToggle={toggle}
      >
        <PortionScalingForm />
      </AccordionSection>

      {/* ── Section 5 : Ma progression ── */}
      {streak && (
        <AccordionSection
          id="progress"
          title={t('profil.section.progress')}
          icon="🏆"
          isOpen={openSection === 'progress'}
          onToggle={toggle}
        >
          <ProgressionContent streak={streak} />
        </AccordionSection>
      )}

      {/* ── Section 6 : Notifications ── */}
      <AccordionSection
        id="notif"
        title={t('profil.section.notif')}
        icon="🔔"
        isOpen={openSection === 'notif'}
        onToggle={toggle}
      >
        <NotificationsPanel preferences={notifPrefs} />
        <Link
          href="/client/checkin/schedule"
          className="mt-3 flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-2.5 hover:bg-white/[0.05] transition-colors"
        >
          <p className="text-[12px] text-white/60">{t('profil.configReminders')}</p>
          <p className="text-[10px] text-white/30">→</p>
        </Link>
      </AccordionSection>

      {/* ── Section 7 : Préférences ── */}
      <AccordionSection
        id="prefs"
        title={t('profil.section.prefs')}
        icon="⚙️"
        isOpen={openSection === 'prefs'}
        onToggle={toggle}
      >
        <PreferencesForm initial={prefsInitial} />
      </AccordionSection>

      <AccordionSection
        id="health"
        title={t('profil.section.health')}
        icon="❤️"
        isOpen={openSection === 'health'}
        onToggle={toggle}
      >
        <HealthSyncPanel />
      </AccordionSection>

      {/* ── Section 8 : Sécurité ── */}
      <AccordionSection
        id="security"
        title={t('profil.section.security')}
        icon="🔒"
        isOpen={openSection === 'security'}
        onToggle={toggle}
      >
        <PasswordResetButton email={email} />
      </AccordionSection>

      {/* ── Section Cycle (female only) ── */}
      {isFemale && (
        <>
          <AccordionSection
            id="cycle"
            title={t('profil.cycle.title')}
            icon="🩸"
            isOpen={openSection === 'cycle'}
            onToggle={toggle}
          >
            {!localCycleState?.hasActiveCycle ? (
              <div className="space-y-1">
                <p className="text-[12px] font-barlow text-[#a0a0a0]">{t('profil.cycle.disabled')}</p>
                <p className="text-[11px] font-barlow text-[#5a5a5a]">{t('profil.cycle.disabled.desc')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {localCycleState?.currentPhase && localCycleState.currentCycleDay ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a]">{t('profil.cycle.currentPhase')}</p>
                    <CyclePhasePill
                      phase={localCycleState.currentPhase}
                      cycleDay={localCycleState.currentCycleDay}
                      confidence={localCycleState.confidence}
                      size="md"
                    />
                  </div>
                ) : (
                  <p className="text-[12px] font-barlow text-[#5a5a5a]">{t('profil.cycle.noData')}</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a] mb-1">{t('profil.cycle.average')}</p>
                    <p className="text-[15px] font-barlow font-bold text-[#e0e0e0]">{localCycleState?.avgCycleLengthDays ?? 28}j</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a] mb-1">{t('profil.cycle.confidence')}</p>
                    <p className="text-[12px] font-barlow font-semibold text-[#e0e0e0]">
                      {localCycleState?.confidence === 'calibrated' ? t('profil.cycle.conf.calibrated') : localCycleState?.confidence === 'learning' ? t('profil.cycle.conf.learning') : t('profil.cycle.conf.estimated')}
                    </p>
                    <p className="text-[10px] font-barlow text-[#5a5a5a] mt-0.5">
                      {t('profil.cycle.loggedCount', {
                        n: localCycleState?.logsCount ?? 0,
                        pl: (localCycleState?.logsCount ?? 0) !== 1 ? 's' : '',
                      })}
                    </p>
                    <p className="text-[10px] font-barlow text-[#5a5a5a] mt-0.5">
                      {localCycleState?.regularity === 'irregular'
                        ? t('profil.cycle.regularity.irregular')
                        : localCycleState?.regularity === 'regular'
                          ? t('profil.cycle.regularity.regular')
                          : t('profil.cycle.regularity.learning')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowLogPeriod(true)}
                  className="w-full h-[44px] rounded-xl bg-white/[0.04] text-[#e0e0e0] text-[13px] font-barlow active:bg-white/[0.08]"
                >
                  {t('profil.cycle.logStart')}
                </button>
              </div>
            )}
          </AccordionSection>

          <LogPeriodSheet
            open={showLogPeriod}
            cycleState={localCycleState}
            onClose={() => setShowLogPeriod(false)}
            onUpdated={(newState) => { setLocalCycleState(newState); setShowLogPeriod(false); }}
          />
        </>
      )}

      {/* ── Déconnexion + mention ── */}
      <div className="pt-2 flex flex-col gap-3">
        <ClientLogoutButton />
        <p className="text-center text-[10px] text-white/20 pb-2">
          {t('profil.memberSince')} {memberSince}
        </p>
      </div>

    </div>
  )
}

import { LEVEL_THRESHOLDS } from '@/lib/checkins/points'
import ClientLevelUpModal from './ClientLevelUpModal'

function ProgressionContent({
  streak,
}: {
  streak: { current_streak: number; longest_streak: number; total_points: number; spent_points?: number; level: string }
}) {
  const { t } = useClientT()
  const levelColor = LEVEL_COLORS[streak.level] ?? LEVEL_COLORS.bronze
  const availablePoints = Math.max(0, streak.total_points - (streak.spent_points ?? 0))

  // Calculate progress
  const currentIndex = LEVEL_THRESHOLDS.findIndex(t => streak.total_points >= t.min)
  const safeIndex = currentIndex === -1 ? LEVEL_THRESHOLDS.length - 1 : currentIndex
  const currentLevelMin = LEVEL_THRESHOLDS[safeIndex]?.min ?? 0
  const nextLevelInfo = safeIndex > 0 ? LEVEL_THRESHOLDS[safeIndex - 1] : null
  const nextLevelMin = nextLevelInfo?.min ?? currentLevelMin
  
  const isMaxLevel = !nextLevelInfo
  const progressPercent = isMaxLevel ? 100 : Math.max(0, Math.min(100, ((streak.total_points - currentLevelMin) / (nextLevelMin - currentLevelMin)) * 100))

  return (
    <div className="space-y-4">
      <ClientLevelUpModal currentLevel={streak.level} />
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className="text-[20px] font-black text-[#f2f2f2] leading-none mb-1">{streak.current_streak}</p>
          <p className="text-[9.5px] font-medium text-white/40">{t('profil.streakCurrent')}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className="flex items-center justify-center gap-1 text-[20px] font-black text-white leading-none mb-1">{availablePoints}<StrivrToken size={15} /></p>
          <p className="text-[9.5px] font-medium text-white/40">{t('rewards.availableBalance')}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className={`text-[13px] font-black leading-none mb-1 uppercase tracking-wide ${levelColor}`}>{streak.level}</p>
          <p className="text-[9.5px] font-medium text-white/40">{t('home.level')}</p>
        </div>
      </div>

      <div className="bg-white/[0.02] rounded-xl p-3">
        <div className="flex justify-between text-[10px] font-medium text-white/60 mb-2">
          <span>{streak.level.toUpperCase()}</span>
          <span className="flex items-center gap-1">{isMaxLevel ? 'MAX' : <>{nextLevelMin}<StrivrToken size={12} /></>}</span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-white/40 to-white/90 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {!isMaxLevel && (
          <p className="text-[9px] text-center text-white/40 mt-2">
            {t('profil.level.next', {
              points: nextLevelMin - streak.total_points,
              level: nextLevelInfo.level.toUpperCase(),
            })}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-[12px] text-white/40">{t('profil.recordStreak')}</p>
        <p className="text-[12px] font-bold text-white">{streak.longest_streak} {t('profil.days.plural')}</p>
      </div>

      <Link
        href="/client/profil/rewards"
        className="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 px-3 py-3 transition-colors hover:from-indigo-500/20 hover:to-purple-500/20"
      >
        <div>
          <p className="text-[12px] font-bold text-white/90">{t('rewards.shop.link')}</p>
          <p className="text-[10px] text-white/50 mt-0.5">{t('rewards.shop.desc')}</p>
        </div>
        <span className="text-[14px]">🎁</span>
      </Link>
    </div>
  )
}
