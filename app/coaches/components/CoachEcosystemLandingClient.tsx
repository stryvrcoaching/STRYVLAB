'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Loader2,
  MessageSquareMore,
  RefreshCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import AlertsFeed from '@/components/dashboard/AlertsFeed';
import ClientsSection from '@/components/dashboard/ClientsSection';
import QuickActions from '@/components/dashboard/QuickActions';
import type { DashboardAlert, DashboardClient } from '@/components/dashboard/types';
import ChatTodayStrip from '@/components/client/ChatTodayStrip';
import SmartAlertsFeed, {
  type GenericAlert,
} from '@/components/client/smart/SmartAlertsFeed';
import { requestCoachAccess, type AccessRequestResult } from '../actions';
import { AnalyticsConsentBanner } from '@/components/analytics/AnalyticsConsentBanner';
import { PublicPageTracker } from '@/components/analytics/PublicPageTracker';
import { trackProductEvent } from '@/lib/analytics/browser';

type AccessModalState =
  | { type: 'idle' }
  | { type: 'success'; firstName: string; alreadyExists: boolean }
  | { type: 'error'; message: string };

const coachAlerts: DashboardAlert[] = [
  {
    id: 'alert-1',
    severity: 'urgent',
    message: 'Nina L. a un check-in en retard et une routine en baisse.',
    actionLabel: 'Voir',
    actionHref: '/coach/inbox',
  },
  {
    id: 'alert-2',
    severity: 'info',
    message: 'Emma R. a terminé son bilan et attend une lecture coach.',
    actionLabel: 'Ouvrir',
    actionHref: '/coach/assessments',
  },
  {
    id: 'alert-3',
    severity: 'info',
    message: 'Lucas D. a un signal nutrition à revoir sur les jours bas.',
    actionLabel: 'Analyser',
    actionHref: '/coach/clients',
  },
];

const coachClients: DashboardClient[] = [
  {
    id: 'client-1',
    firstName: 'Nina',
    lastName: 'Leroy',
    status: 'stagnant',
    lastActivityDays: 0,
    lastMetrics: { weight: 68.4, bodyFatPct: 24.1, delta: 0.4 },
    subscription: { formulaName: 'Pro', status: 'active' },
    weightHistory: [
      { date: '2026-06-01', value: 67.6 },
      { date: '2026-06-08', value: 67.9 },
      { date: '2026-06-15', value: 68.1 },
      { date: '2026-06-22', value: 68.0 },
      { date: '2026-06-29', value: 68.4 },
    ],
  },
  {
    id: 'client-2',
    firstName: 'Emma',
    lastName: 'Renaud',
    status: 'progressing',
    lastActivityDays: 1,
    lastMetrics: { weight: 59.8, bodyFatPct: 21.3, delta: -0.3 },
    subscription: { formulaName: 'Solo', status: 'active' },
    weightHistory: [
      { date: '2026-06-01', value: 60.9 },
      { date: '2026-06-08', value: 60.6 },
      { date: '2026-06-15', value: 60.2 },
      { date: '2026-06-22', value: 60.1 },
      { date: '2026-06-29', value: 59.8 },
    ],
  },
  {
    id: 'client-3',
    firstName: 'Lucas',
    lastName: 'Dumont',
    status: 'inactive',
    lastActivityDays: 4,
    lastMetrics: { weight: 82.1, bodyFatPct: 18.6, delta: 0.6 },
    subscription: { formulaName: 'Pro', status: 'active' },
    weightHistory: [
      { date: '2026-06-01', value: 81.2 },
      { date: '2026-06-08', value: 81.4 },
      { date: '2026-06-15', value: 81.7 },
      { date: '2026-06-22', value: 81.9 },
      { date: '2026-06-29', value: 82.1 },
    ],
  },
];

const clientAlerts: GenericAlert[] = [
  {
    code: 'sleep',
    severity: 'warning',
    title: 'Sommeil plus bas que d’habitude',
    body: 'La routine du soir est incomplète depuis trois jours.',
  },
  {
    code: 'water',
    severity: 'info',
    title: 'Hydratation en dessous de la cible',
    body: '1.8 L enregistrés sur 2.7 L prévus aujourd’hui.',
  },
  {
    code: 'nutrition',
    severity: 'info',
    title: 'Calories basses sur les jours d’entraînement',
    body: 'Le coach peut ajuster la cible ou les consignes depuis la plateforme.',
  },
];

const clientPriorityAction = {
  title: 'Compléter le check-in du soir',
  subtitle: 'Sommeil, routine et ressenti alimentent le suivi coach.',
  ctaLabel: 'Continuer',
};

const problemRows = [
  {
    outside: 'Bilans envoyés puis suivis à part',
    inside: 'Templates, envois, réponses et historique dans un même flux.',
  },
  {
    outside: 'Relances et retards gérés à la mémoire',
    inside: 'Check-ins, alertes et inbox coach remontent les actions utiles.',
  },
  {
    outside: 'Consignes perdues entre messages et notes',
    inside: 'Le client retrouve sa routine, son plan et ses bilans dans son espace.',
  },
  {
    outside: 'Nutrition et entraînement lus séparément',
    inside: 'Les signaux se recroisent avec la progression, l’adhérence et la récupération.',
  },
];

const decisionSignals = [
  {
    title: 'Adhérence',
    body: 'Check-ins, régularité des séances, continuité des routines.',
  },
  {
    title: 'Récupération',
    body: 'Sommeil, stress, fatigue, ressenti et qualité du rythme.',
  },
  {
    title: 'Nutrition',
    body: 'Calories, protéines, hydratation et tenue réelle du protocole.',
  },
  {
    title: 'Réponse corporelle',
    body: 'Poids, composition, progression et cohérence dans le temps.',
  },
];

const coachBenefits = [
  'Moins de charge mentale pour relancer, lire et prioriser.',
  'Une vue plus propre sur les clients qui demandent une action.',
  'Des décisions plus rapides parce que le contexte reste dans le produit.',
];

const clientBenefits = [
  'Une expérience de suivi plus sérieuse qu’un simple échange de messages.',
  'Des routines, consignes et bilans plus faciles à retrouver.',
  'Une continuité plus claire entre les séances et les retours coach.',
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
      {children}
    </p>
  );
}

function SectionTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`max-w-[13ch] text-[32px] font-medium leading-[1.04] tracking-[-0.04em] text-white sm:text-[40px] lg:text-[50px] ${className}`}
    >
      {children}
    </h2>
  );
}

function Body({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`text-[16px] leading-8 text-white/58 lg:text-[18px] ${className}`}>{children}</p>;
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function PrimaryCta({
  onClick,
  fullWidth = false,
  children,
  featureKey,
}: {
  onClick?: () => void;
  fullWidth?: boolean;
  children: React.ReactNode;
  featureKey?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (featureKey) {
          void trackProductEvent({
            eventName: 'cta_clicked',
            source: 'coaches-landing',
            featureKey,
            pagePath: '/coaches',
          });
        }
        onClick?.();
      }}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#1f8a65] px-6 text-[14px] font-medium text-white transition-colors hover:bg-[#217356] ${fullWidth ? 'w-full' : ''}`}
    >
      {children}
    </button>
  );
}

function SecondaryCta({ href, children, featureKey }: { href: string; children: React.ReactNode; featureKey?: string }) {
  return (
    <a
      href={href}
      onClick={() => {
        if (!featureKey) return;
        void trackProductEvent({
          eventName: 'cta_clicked',
          source: 'coaches-landing',
          featureKey,
          pagePath: '/coaches',
        });
      }}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/[0.08] px-6 text-[14px] font-medium text-white transition-colors hover:bg-white/[0.04]"
    >
      {children}
    </a>
  );
}

function Surface({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[28px] border border-white/[0.06] bg-[#181818] ${className}`}>
      {children}
    </div>
  );
}

function Inset({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-[22px] bg-[#121212] ${className}`}>{children}</div>;
}

function AccessRequestModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, setState] = useState<AccessModalState>({ type: 'idle' });
  const [isPending, startTransition] = useTransition();
  const startedRef = useRef(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const firstName = (formData.get('first_name') as string | null)?.trim() ?? '';

    startTransition(() => {
      void (async () => {
        const result: AccessRequestResult = await requestCoachAccess(formData);
        if (result.success) {
          await trackProductEvent({
            eventName: 'lead_submitted',
            source: 'coaches-landing',
            featureKey: 'coach_access_request',
            pagePath: '/coaches',
            properties: {
              already_exists: result.alreadyExists,
              lead_type: 'demo_request',
            },
          });
          setState({ type: 'success', firstName, alreadyExists: result.alreadyExists });
          return;
        }

        if ('error' in result) {
          setState({ type: 'error', message: result.error });
        }
      })();
    });
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-[560px] overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#181818] text-white"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#121212] text-white/45 transition-colors hover:text-white"
            >
              <X size={16} />
            </button>

            <div className="px-6 pb-6 pt-7 md:px-8 md:pb-8 md:pt-8">
              <div className="max-w-[420px]">
                <Eyebrow>Demander un accès</Eyebrow>
                <h3 className="mt-4 text-[31px] font-medium leading-[1.06] tracking-[-0.04em] text-white md:text-[38px]">
                  Passe dans la prochaine ouverture coach.
                </h3>
                <Body className="mt-4">
                  Laisse ton prénom et ton email. On te recontacte quand la prochaine vague d’accès devient disponible.
                </Body>
              </div>

              {state.type === 'success' ? (
                <Inset className="mt-8 p-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="mt-0.5 text-[#1f8a65]" />
                    <div>
                      <p className="text-[14px] font-medium text-white">
                        {state.alreadyExists ? 'Tu es déjà enregistré.' : 'Demande enregistrée.'}
                      </p>
                      <p className="mt-2 text-[14px] leading-7 text-white/60">
                        {state.alreadyExists
                          ? 'Tu fais déjà partie de la liste. On te prévient dès que la prochaine ouverture est disponible.'
                          : `${state.firstName}, on te contacte dès que la prochaine ouverture devient disponible.`}
                      </p>
                    </div>
                  </div>
                </Inset>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  onFocusCapture={() => {
                    if (startedRef.current) return;
                    startedRef.current = true;
                    void trackProductEvent({
                      eventName: 'form_started',
                      source: 'coaches-landing',
                      featureKey: 'coach_access_request',
                      pagePath: '/coaches',
                    });
                  }}
                  className="mt-8 space-y-4"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[12px] font-medium text-white/58">Prénom</span>
                      <input
                        name="first_name"
                        type="text"
                        required
                        minLength={2}
                        placeholder="Kévin"
                        className="h-12 w-full rounded-2xl border border-white/[0.06] bg-[#121212] px-4 text-[14px] text-white outline-none placeholder:text-white/20"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[12px] font-medium text-white/58">Email</span>
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="coach@exemple.com"
                        className="h-12 w-full rounded-2xl border border-white/[0.06] bg-[#121212] px-4 text-[14px] text-white outline-none placeholder:text-white/20"
                      />
                    </label>
                  </div>

                  {state.type === 'error' ? (
                    <p className="text-[13px] font-medium text-[#ff8e8e]">{state.message}</p>
                  ) : null}

                  <div className="flex flex-col gap-4 pt-2 md:flex-row md:items-center md:justify-between">
                    <p className="text-[13px] leading-6 text-white/35">
                      Pas de spam. Juste les prochaines ouvertures et les informations utiles.
                    </p>
                    <PrimaryCta featureKey="coach_access_submit">
                      {isPending ? <Loader2 size={15} className="animate-spin" /> : null}
                      {isPending ? 'Envoi' : 'Demander un accès'}
                    </PrimaryCta>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CoachProductScene() {
  return (
    <Surface className="overflow-hidden p-4 md:p-5">
      <Inset className="overflow-hidden border border-white/[0.05]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo/logo-stryvr-silver.png"
              alt="STRYV"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                STRYV Lab
              </p>
              <p className="mt-0.5 text-[15px] font-medium text-white">Vue coach réelle</p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none p-4 md:p-5">
          <AlertsFeed alerts={coachAlerts} />
          <ClientsSection clients={coachClients} />
          <QuickActions alerts={coachAlerts} />
        </div>
      </Inset>
    </Surface>
  );
}

function ClientProductScene() {
  return (
    <Surface className="p-4 md:p-5">
      <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:items-start">
        <div className="mx-auto w-full max-w-[290px] overflow-hidden rounded-[30px] border border-white/[0.06] bg-[#121212]">
          <div className="border-b border-white/[0.06] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
              STRYVR
            </p>
            <p className="mt-1 text-[15px] font-medium text-white">Extrait côté client</p>
          </div>
          <div className="pointer-events-none">
            <ChatTodayStrip
              data={{
                sessions: [{ id: 'session-1', name: 'Push A' }],
                calories: { logged: 1840, target: 2100 },
                water: { logged: 1800, target: 2700 },
                checkin: { morning: true, evening: false, pendingCount: 1 },
              }}
            />
            <div className="space-y-3 px-3 py-3">
              <a
                href="/client/checkin/evening"
                className="flex items-center gap-3 rounded-2xl bg-[#161616] px-4 py-4 transition-transform"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] font-bold leading-tight text-white">
                    {clientPriorityAction.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/50">{clientPriorityAction.subtitle}</p>
                </div>
                <div className="shrink-0 rounded-xl bg-[#1f8a65]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#8ef0c7]">
                  {clientPriorityAction.ctaLabel}
                </div>
              </a>
              <SmartAlertsFeed alerts={clientAlerts} />
            </div>
          </div>
        </div>

        <Inset className="p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Ce que le client retrouve
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-[22px] font-medium leading-[1.22] tracking-[-0.03em] text-white">
                Routines, check-ins, hydratation, consignes, bilans et actions à faire restent dans le même espace.
              </p>
            </div>
            <div className="space-y-4">
              {[
                'Le suivi ne dépend plus uniquement de messages perdus.',
                'Le coach garde un prolongement réel de l’accompagnement entre les séances.',
                'Le client sait quoi faire, où le retrouver et quoi renvoyer.',
              ].map((item) => (
                <div key={item} className="border-l border-white/[0.07] pl-4">
                  <p className="text-[15px] leading-7 text-white/58">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </Inset>
      </div>
    </Surface>
  );
}

function DecisionScene() {
  return (
    <Surface className="p-4 md:p-5">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Inset className="p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Signaux utilisés
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {decisionSignals.map((signal) => (
              <div key={signal.title} className="rounded-[18px] border border-white/[0.06] bg-[#181818] p-4">
                <p className="text-[15px] font-medium text-white">{signal.title}</p>
                <p className="mt-2 text-[14px] leading-7 text-white/55">{signal.body}</p>
              </div>
            ))}
          </div>
        </Inset>

        <Inset className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                Lecture coach
              </p>
              <h3 className="mt-3 max-w-[14ch] text-[28px] font-medium leading-[1.08] tracking-[-0.03em] text-white">
                Voir ce qui bloque, puis agir plus proprement.
              </h3>
            </div>
            <ShieldCheck size={18} className="text-[#1f8a65]" />
          </div>

          <div className="mt-6 rounded-[22px] border border-[#1f8a65]/20 bg-[#1f8a65]/[0.08] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ef0c7]">
              Exemple de décision
            </p>
            <p className="mt-3 text-[24px] font-medium leading-[1.12] tracking-[-0.03em] text-white">
              Réduire légèrement le cardio, relancer le check-in du soir, puis revoir la cible calorique.
            </p>
            <p className="mt-3 text-[15px] leading-7 text-white/58">
              STRYV Lab n’ajoute pas juste des données. Il garde ensemble le bilan, l’adhérence, la récupération, la nutrition et le retour client pour aider le coach à savoir quoi ajuster et pourquoi.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {[
              'Le coach lit les signaux dans un contexte exploitable.',
              'Les relances et feedback remontent dans l’inbox coach.',
              'Le suivi client garde une continuité côté application.',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-[18px] bg-[#181818] px-4 py-4">
                <RefreshCcw size={16} className="mt-1 shrink-0 text-[#1f8a65]" />
                <p className="text-[15px] leading-7 text-white/58">{item}</p>
              </div>
            ))}
          </div>
        </Inset>
      </div>
    </Surface>
  );
}

function ProofMap() {
  return (
    <Surface className="overflow-hidden">
      <div className="grid border-b border-white/[0.06] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35 md:grid-cols-[1fr_1fr]">
        <p>Ce qui reste hors système</p>
        <p className="mt-3 md:mt-0">Ce que STRYV remet dans le produit</p>
      </div>

      <div>
        {problemRows.map((row, index) => (
          <div
            key={row.outside}
            className={`grid gap-4 px-6 py-5 md:grid-cols-[1fr_1fr] ${
              index < problemRows.length - 1 ? 'border-b border-white/[0.06]' : ''
            }`}
          >
            <div className="pr-0 md:pr-6">
              <p className="text-[15px] leading-7 text-white/48">{row.outside}</p>
            </div>
            <div className="border-l-0 pl-0 md:border-l md:border-white/[0.06] md:pl-6">
              <p className="text-[15px] leading-7 text-white">{row.inside}</p>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function BenefitsBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Inset className="p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">{title}</p>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <CheckCircle2 size={18} className="mt-1 shrink-0 text-[#1f8a65]" />
            <p className="text-[16px] leading-7 text-white/58">{item}</p>
          </div>
        ))}
      </div>
    </Inset>
  );
}

export function CoachEcosystemLandingClient({ leadCount }: { leadCount: number }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#121212] text-white">
      <AnalyticsConsentBanner source="coaches-landing" pagePath="/coaches" featureKey="landing_page" />
      <PublicPageTracker source="coaches-landing" pagePath="/coaches" featureKey="landing_page" />
      <AccessRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-5 pb-20 pt-6 md:px-8 lg:px-10">
          <header className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo/logo-stryvr-silver.png"
                alt="STRYV"
                width={34}
                height={34}
                className="h-8 w-8 object-contain"
              />
              <div>
                <p className="text-[15px] font-medium tracking-[-0.03em] text-white">STRYV Lab</p>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Plateforme coach
                </p>
              </div>
            </div>

            <div className="hidden md:block">
              <PrimaryCta onClick={() => setModalOpen(true)} featureKey="header_open_access_modal">Demander un accès</PrimaryCta>
            </div>
          </header>

          <div className="grid gap-16 pt-14 lg:grid-cols-[minmax(0,470px)_minmax(0,1fr)] lg:items-center lg:gap-20 lg:pt-24">
            <Reveal>
              <Eyebrow>Suivi coach</Eyebrow>
              <h1 className="mt-5 max-w-[10ch] text-[42px] font-medium leading-[1.01] tracking-[-0.05em] text-white sm:text-[56px] lg:text-[74px]">
                Quand le suivi se disperse, la qualité devient fragile.
              </h1>
              <Body className="mt-6 max-w-[680px]">
                STRYV Lab recentralise ce qui ne devrait plus vivre entre formulaires séparés, mémoire, relances manuelles et messages épars : bilans, check-ins, signaux de suivi, nutrition, entraînement et continuité côté client.
              </Body>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <PrimaryCta onClick={() => setModalOpen(true)} featureKey="hero_open_access_modal">
                  Demander un accès
                  <ArrowRight size={15} />
                </PrimaryCta>
                <SecondaryCta href="#produit" featureKey="hero_view_product">Voir le produit</SecondaryCta>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-[13px] text-white/42">
                <span>{leadCount}+ coachs en attente</span>
                <span>•</span>
                <span>Bilans, check-ins, nutrition, entraînement, inbox coach</span>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <CoachProductScene />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 md:py-28 lg:px-10 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <Reveal>
              <Eyebrow>Le problème réel</Eyebrow>
              <SectionTitle className="mt-4 max-w-[12ch]">
                Le point faible n’est pas l’effort du coach. C’est la dispersion du système.
              </SectionTitle>
              <Body className="mt-6 max-w-[640px]">
                Le marché du coaching vend déjà des apps tout-en-un. Le vrai problème, lui, reste le même : trop d’informations vivent encore hors du produit ou sans continuité claire. C’est là que le suivi perd en lisibilité, en réactivité et en tenue dans le temps.
              </Body>
            </Reveal>

            <Reveal delay={0.06}>
              <ProofMap />
            </Reveal>
          </div>
        </div>
      </section>

      <section id="produit" className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 md:py-28 lg:px-10 lg:py-32">
          <Reveal className="max-w-[760px]">
            <Eyebrow>Vue coach</Eyebrow>
            <SectionTitle className="mt-4 max-w-[14ch]">
              Une surface coach pour lire les clients, les retards et les prochaines actions.
            </SectionTitle>
            <Body className="mt-6 max-w-[680px]">
              La plateforme donne une vue multi-clients, fait remonter les alertes utiles, garde les bilans et les actions rapides au même endroit, puis évite au coach de reconstruire le contexte à chaque décision.
            </Body>
          </Reveal>

          <Reveal className="mt-14" delay={0.06}>
            <CoachProductScene />
          </Reveal>
        </div>
      </section>

      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 md:py-28 lg:px-10 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <Reveal>
              <Eyebrow>Décision</Eyebrow>
              <SectionTitle className="mt-4 max-w-[12ch]">Savoir quoi ajuster, et sur quelle base.</SectionTitle>
              <Body className="mt-6 max-w-[640px]">
                Les plateformes concurrentes promettent déjà des check-ins, du messaging et du tracking. La différence utile est ailleurs : garder ensemble l’adhérence, la récupération, la nutrition, la progression et le retour client pour rendre les ajustements plus cohérents.
              </Body>
            </Reveal>

            <Reveal delay={0.06}>
              <DecisionScene />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 md:py-28 lg:px-10 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <Reveal>
              <Eyebrow>Côté client</Eyebrow>
              <SectionTitle className="mt-4 max-w-[12ch]">
                Une continuité réelle entre les séances.
              </SectionTitle>
              <Body className="mt-6 max-w-[640px]">
                L’application client sert à faire exister le suivi en dehors de la séance : check-ins, routine du jour, hydratation, consignes, bilans, feedback et actions prioritaires restent visibles au bon endroit.
              </Body>
            </Reveal>

            <Reveal delay={0.06}>
              <ClientProductScene />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 md:py-28 lg:px-10 lg:py-32">
          <Reveal className="max-w-[760px]">
            <Eyebrow>Bénéfices</Eyebrow>
            <SectionTitle className="mt-4 max-w-[15ch]">
              Plus de structure pour le coach. Plus de continuité pour le client.
            </SectionTitle>
          </Reveal>

          <Reveal className="mt-14" delay={0.06}>
            <div className="grid gap-4 lg:grid-cols-2">
              <BenefitsBlock title="Pour le coach" items={coachBenefits} />
              <BenefitsBlock title="Pour le client" items={clientBenefits} />
            </div>
          </Reveal>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-8 md:py-28 lg:px-10 lg:py-32">
          <Reveal>
            <Surface className="px-6 py-8 md:px-10 md:py-10 lg:px-12 lg:py-12">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
                <div className="max-w-[700px]">
                  <Eyebrow>Ouverture progressive</Eyebrow>
                  <SectionTitle className="mt-4 max-w-[12ch]">
                    Passe sur un suivi plus lisible, plus propre et plus solide.
                  </SectionTitle>
                  <Body className="mt-6 max-w-[640px]">
                    STRYV Lab ouvre progressivement l’accès aux coachs qui veulent structurer leur accompagnement avec une vraie logique produit, côté coach comme côté client.
                  </Body>
                </div>

                <div className="lg:justify-self-end">
                  <PrimaryCta onClick={() => setModalOpen(true)} fullWidth featureKey="footer_open_access_modal">
                    Demander un accès
                  </PrimaryCta>
                </div>
              </div>
            </Surface>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
