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
import PasswordResetButton from './PasswordResetButton'
import PortionScalingForm from './PortionScalingForm'
import ClientRestrictionsSection from '@/components/client/ClientRestrictionsSection'
import ClientLogoutButton from '@/app/client/profil/LogoutButton'
import Link from 'next/link'
import { useClientT } from '@/components/client/ClientI18nProvider'

type SectionId =
  | 'info'
  | 'restrictions'
  | 'portions'
  | 'progress'
  | 'notif'
  | 'prefs'
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
  notifications: {
    id: string
    type: string
    title: string
    body: string | null
    read_at: string | null
    created_at: string
  }[]
  notifPrefs: {
    notif_session_reminder: boolean
    notif_bilan_received: boolean
    notif_program_updated: boolean
  }
  unreadCount: number
  streak: {
    current_streak: number
    longest_streak: number
    total_points: number
    level: string
  } | null
  cycleState?: CycleState | null
}

const LEVEL_COLORS: Record<string, string> = {
  bronze:   'text-amber-400',
  silver:   'text-white/60',
  gold:     'text-yellow-400',
  platinum: 'text-cyan-400',
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
  notifications,
  notifPrefs,
  unreadCount,
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
            <p className="text-[9px] text-white/30 mt-0.5">streak</p>
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
        badge={unreadCount}
        isOpen={openSection === 'notif'}
        onToggle={toggle}
      >
        <NotificationsPanel notifications={notifications} preferences={notifPrefs} />
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
            title="Mon Cycle"
            icon="🩸"
            isOpen={openSection === 'cycle'}
            onToggle={toggle}
          >
            {!localCycleState?.hasActiveCycle ? (
              <div className="space-y-1">
                <p className="text-[12px] font-barlow text-[#a0a0a0]">Cycle sync désactivé</p>
                <p className="text-[11px] font-barlow text-[#5a5a5a]">Ménopause / aménorrhée renseignée dans ton bilan.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {localCycleState?.currentPhase && localCycleState.currentCycleDay ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a]">Phase actuelle</p>
                    <CyclePhasePill
                      phase={localCycleState.currentPhase}
                      cycleDay={localCycleState.currentCycleDay}
                      confidence={localCycleState.confidence}
                      size="md"
                    />
                  </div>
                ) : (
                  <p className="text-[12px] font-barlow text-[#5a5a5a]">Aucune donnée de cycle encore. Log ton premier cycle depuis le bouton +.</p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a] mb-1">Cycle moyen</p>
                    <p className="text-[15px] font-barlow font-bold text-[#e0e0e0]">{localCycleState?.avgCycleLengthDays ?? 28}j</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] p-3">
                    <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a] mb-1">Précision</p>
                    <p className="text-[12px] font-barlow font-semibold text-[#e0e0e0]">
                      {localCycleState?.confidence === 'calibrated' ? '● Calibré' : localCycleState?.confidence === 'learning' ? '◑ Apprentissage' : '◐ Estimé'}
                    </p>
                    <p className="text-[10px] font-barlow text-[#5a5a5a] mt-0.5">
                      {localCycleState?.logsCount ?? 0} cycle{(localCycleState?.logsCount ?? 0) !== 1 ? 's' : ''} loggé{(localCycleState?.logsCount ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowLogPeriod(true)}
                  className="w-full h-[44px] rounded-xl bg-white/[0.04] text-[#e0e0e0] text-[13px] font-barlow active:bg-white/[0.08]"
                >
                  Indiquer début de règles
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

function ProgressionContent({
  streak,
}: {
  streak: { current_streak: number; longest_streak: number; total_points: number; level: string }
}) {
  const { t } = useClientT()
  const levelColor = LEVEL_COLORS[streak.level] ?? LEVEL_COLORS.bronze
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className="text-[20px] font-black text-[#f2f2f2] leading-none mb-1">{streak.current_streak}</p>
          <p className="text-[9.5px] font-medium text-white/40">{t('profil.streakCurrent')}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className="text-[20px] font-black text-white leading-none mb-1">{streak.total_points}</p>
          <p className="text-[9.5px] font-medium text-white/40">{t('profil.pointsTotal')}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
          <p className={`text-[13px] font-black leading-none mb-1 ${levelColor}`}>{streak.level}</p>
          <p className="text-[9.5px] font-medium text-white/40">{t('home.level')}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-white/40">{t('profil.recordStreak')}</p>
        <p className="text-[12px] font-bold text-white">{streak.longest_streak} {t('profil.days.plural')}</p>
      </div>
    </div>
  )
}
