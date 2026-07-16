"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Briefcase,
  House,
  Stack,
  UserCircle,
  Users,
} from "@phosphor-icons/react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronRight,
  LogIn,
  Minus,
} from "lucide-react";
import {
  explorerSections,
  landingAthleteTabs,
  landingDockItems,
  landingExplorerViews,
  landingModulePreviews,
  landingStudioTabs,
  type LandingDockItem,
} from "./operating-system-content";

const CAL_URL = "https://cal.com/stryvlab/demo-stryvlab";

const intelligenceHighlights = [
  {
    label: "Smart Workout",
    title: "La programmation relue comme un système.",
    description:
      "Volume, répartition, mouvements, progression et récupération sont rapprochés pour faire apparaître les points qui méritent l’attention du coach.",
  },
  {
    label: "Smart Nutrition",
    title: "Une décision peut traverser tout le plan.",
    description:
      "Calories, macros, jours types, repas et portions restent liés. Un ajustement global peut recalculer les quantités sans reconstruire chaque repas.",
  },
  {
    label: "Cockpit client",
    title: "Le réel, le plan et l’action restent visibles.",
    description:
      "Depuis le dossier coaché, le cockpit rapproche activité, récupération, adhérence, protocole et impact d’un ajustement en préparation.",
  },
  {
    label: "Actions coach",
    title: "Une observation devient une suite organisée.",
    description:
      "Depuis n’importe quelle page, le coach peut transformer un constat en tâche, en événement daté ou dans les deux, avec le contexte déjà rattaché.",
  },
  {
    label: "Data Metrics",
    title: "Les courbes gardent l’histoire du suivi.",
    description:
      "Les superpositions croisent plusieurs données et replacent les changements de protocole, programmes, déplacements et notes coach sur la chronologie.",
  },
  {
    label: "Bilans configurables",
    title: "Le bon cadre de questions, au bon moment.",
    description:
      "Le coach crée ses modèles, configure les questions et réutilise une structure adaptée à l’entrée, au suivi régulier ou à une phase précise.",
  },
] as const;

const planColumns = [
  {
    id: "solo",
    label: "Solo",
    price: "29 € / mois",
    limit: "Jusqu’à 5 athlètes",
    description: "L’espace coach pour structurer et piloter l’accompagnement.",
  },
  {
    id: "pro",
    label: "Pro",
    price: "79 € / mois",
    limit: "Jusqu’à 30 athlètes",
    description: "L’écosystème complet avec l’application client STRYVR.",
  },
  {
    id: "studio",
    label: "Studio",
    price: "129 € / mois",
    limit: "Athlètes sans limite prédéfinie",
    description: "Une capacité étendue pour une activité de coaching structurée.",
  },
] as const;

type PlanAvailability = boolean | "soon";

const planFeatureGroups: Array<{
  title: string;
  features: Array<{
    label: string;
    availability: Record<(typeof planColumns)[number]["id"], PlanAvailability>;
  }>;
}> = [
  {
    title: "Espace coach",
    features: [
      { label: "Dossiers athlètes et historique", availability: { solo: true, pro: true, studio: true } },
      { label: "Bilans et modèles configurables", availability: { solo: true, pro: true, studio: true } },
      { label: "Workout Studio et Smart Workout", availability: { solo: true, pro: true, studio: true } },
      { label: "Nutrition Studio et Smart Nutrition", availability: { solo: true, pro: true, studio: true } },
      { label: "TDEE adaptatif et Cycle Sync", availability: { solo: true, pro: true, studio: true } },
      { label: "Data Metrics, superpositions et journal", availability: { solo: true, pro: true, studio: true } },
      { label: "Normes et repères contextualisés", availability: { solo: true, pro: true, studio: true } },
      { label: "Cockpit et actions coach contextuelles", availability: { solo: true, pro: true, studio: true } },
      { label: "Morpho Pro", availability: { solo: true, pro: true, studio: true } },
      { label: "Agenda, tâches, paiements et alertes", availability: { solo: true, pro: true, studio: true } },
    ],
  },
  {
    title: "Expérience client STRYVR",
    features: [
      { label: "Application client connectée", availability: { solo: false, pro: true, studio: true } },
      { label: "Exécution et progression des séances", availability: { solo: false, pro: true, studio: true } },
      { label: "Planning des repas et journal nutrition", availability: { solo: false, pro: true, studio: true } },
      { label: "Check-ins et retours quotidiens", availability: { solo: false, pro: true, studio: true } },
      { label: "Points, rangs et boutique de récompenses", availability: { solo: false, pro: true, studio: true } },
    ],
  },
  {
    title: "Équipe",
    features: [
      { label: "Espace multi-coachs et permissions", availability: { solo: false, pro: false, studio: "soon" } },
    ],
  },
];

const dockIcons = {
  accueil: House,
  athletes: Users,
  studio: Stack,
  business: Briefcase,
  compte: UserCircle,
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide text-white/38">
      {children}
    </p>
  );
}

function DemoButton({ className = "" }: { className?: string }) {
  return (
    <a
      className={`group inline-flex min-h-[52px] w-full items-center justify-between rounded-xl bg-[#1f8a65] px-5 text-sm font-medium text-white transition hover:bg-[#217356] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] focus-visible:ring-offset-2 focus-visible:ring-offset-[#181818] ${className}`}
      href={CAL_URL}
      rel="noreferrer"
      target="_blank"
    >
      Réserver une démo
      <ArrowUpRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </a>
  );
}

function AccessPanel() {
  return (
    <aside className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#121212] p-6 sm:p-8">
      <SectionLabel>Accès coach</SectionLabel>
      <h2 className="mt-4 max-w-sm text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl">
        Découvrir STRYVLAB, la plateforme de coaching sportif.
      </h2>
      <p className="mt-5 max-w-sm text-sm leading-6 text-white/52">
        Une démonstration personnalisée pour voir comment dossiers coachés,
        programmes, nutrition et suivi s’organisent autour de votre méthode.
      </p>

      <div className="mt-9 space-y-3">
        <DemoButton />
        <Link
          className="group inline-flex min-h-11 w-full items-center justify-between rounded-xl border-[0.3px] border-white/[0.08] bg-white/[0.025] px-4 text-sm font-medium text-white/62 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
          href="/auth/login"
        >
          <span className="flex items-center gap-2.5">
            <LogIn aria-hidden="true" className="h-4 w-4" />
            Déjà coach ? Se connecter
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </aside>
  );
}

function PlanComparisonSection() {
  return (
    <section
      aria-labelledby="plans-title"
      className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
    >
      <SectionLabel>Accès STRYVLAB</SectionLabel>
      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-end">
        <div>
          <h2
            className="max-w-[650px] text-3xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[2.6rem]"
            id="plans-title"
          >
            Comparer les espaces de travail.
          </h2>
          <p className="mt-4 max-w-[620px] text-sm leading-6 text-white/48">
            Le socle coach reste disponible dans chaque accès. STRYVR complète
            l’écosystème à partir du plan Pro.
          </p>
        </div>
        <DemoButton />
      </div>

      <div className="mt-8 grid gap-2 sm:grid-cols-3">
        {planColumns.map((plan) => (
          <article
            className={`rounded-xl border p-4 ${
              plan.id === "pro"
                ? "border-[#1f8a65]/45 bg-[#1f8a65]/[0.08]"
                : "border-white/[0.07] bg-white/[0.025]"
            }`}
            key={plan.id}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-white">{plan.label}</h3>
              {plan.id === "pro" && (
                <span className="rounded-full bg-[#1f8a65]/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8ef0c7]">
                  Écosystème complet
                </span>
              )}
            </div>
            <p className="mt-3 text-xl font-semibold text-white">{plan.price}</p>
            <p className="mt-1 text-xs text-[#8ef0c7]">{plan.limit}</p>
            <p className="mt-4 text-xs leading-5 text-white/45">
              {plan.description}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07] [scrollbar-color:rgba(255,255,255,.18)_transparent]">
        <table className="min-w-[720px] w-full border-collapse text-left">
          <caption className="sr-only">
            Comparaison des fonctionnalités des plans Solo, Pro et Studio
          </caption>
          <thead className="bg-white/[0.035]">
            <tr>
              <th className="w-[40%] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35" scope="col">
                Fonctionnalités
              </th>
              {planColumns.map((plan) => (
                <th
                  className="border-l border-white/[0.07] px-4 py-3 text-center text-xs font-semibold text-white"
                  key={plan.id}
                  scope="col"
                >
                  {plan.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planFeatureGroups.map((group) => (
              <Fragment key={group.title}>
                <tr className="border-y border-white/[0.07] bg-white/[0.025]">
                  <th
                    className="px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8ef0c7]"
                    colSpan={4}
                    scope="colgroup"
                  >
                    {group.title}
                  </th>
                </tr>
                {group.features.map((feature) => (
                  <tr className="border-b border-white/[0.055]" key={feature.label}>
                    <th className="px-4 py-2.5 text-xs font-normal text-white/62" scope="row">
                      {feature.label}
                    </th>
                    {planColumns.map((plan) => {
                      const availability = feature.availability[plan.id];
                      return (
                        <td
                          className="border-l border-white/[0.055] px-4 py-2.5 text-center"
                          key={plan.id}
                        >
                          {availability === true ? (
                            <Check
                              aria-label="Inclus"
                              className="mx-auto h-4 w-4 text-[#8ef0c7]"
                              strokeWidth={2.2}
                            />
                          ) : availability === "soon" ? (
                            <span className="rounded-full border border-[#c6b48b]/25 bg-[#c6b48b]/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-[#d8c9a6]">
                              Bientôt
                            </span>
                          ) : (
                            <Minus
                              aria-label="Non inclus"
                              className="mx-auto h-4 w-4 text-white/18"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlatformDock({
  activeDock,
  activeViewId,
  onDockChange,
  onAthleteViewChange,
  onStudioViewChange,
}: {
  activeDock: LandingDockItem["id"];
  activeViewId: string;
  onDockChange: (item: LandingDockItem) => void;
  onAthleteViewChange: (viewId: string) => void;
  onStudioViewChange: (viewId: string) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <nav
      aria-label="Smart Dock · navigation contextuelle de la plateforme STRYVLAB"
      className="pointer-events-auto fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-1.5 sm:bottom-6"
      id="smart-dock"
    >
      {activeDock === "athletes" && (
        <div className="flex items-center gap-1 rounded-xl border-[0.3px] border-white/[0.06] bg-[#121212] px-2 py-1 shadow-[0_12px_32px_rgba(0,0,0,.32)]">
          {landingAthleteTabs.map((tab) => {
            const isActive = activeViewId === tab.viewId;
            return (
              <button
                aria-controls="platform-explorer-panel"
                aria-pressed={isActive}
                className={`flex h-7 items-center rounded-lg px-3 text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] ${
                  isActive
                    ? "border-[0.3px] border-[#1f8a65]/20 bg-[#1f8a65]/10 text-[#7ee2bb]"
                    : "text-white/40 hover:bg-white/[0.05] hover:text-white/70"
                }`}
                key={tab.id}
                onClick={() => onAthleteViewChange(tab.viewId)}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {activeDock === "studio" && (
        <div className="max-w-full overflow-x-auto rounded-xl border-[0.3px] border-white/[0.06] bg-[#121212] px-2 py-1 shadow-[0_12px_32px_rgba(0,0,0,.32)]">
          <div className="flex min-w-max items-center gap-1">
            {landingStudioTabs.map((tab) => {
              const isActive = activeViewId === tab.viewId;
              return (
                <button
                  aria-controls="platform-explorer-panel"
                  aria-pressed={isActive}
                  className={`flex h-7 items-center rounded-lg px-3 text-[11px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] ${
                    isActive
                      ? "border-[0.3px] border-[#1f8a65]/20 bg-[#1f8a65]/10 text-[#7ee2bb]"
                      : "text-white/40 hover:bg-white/[0.05] hover:text-white/70"
                  }`}
                  key={tab.id}
                  onClick={() => onStudioViewChange(tab.viewId)}
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex h-14 items-center gap-1 rounded-2xl border-[0.3px] border-white/[0.06] bg-[#121212] px-3 shadow-[0_12px_32px_rgba(0,0,0,.32)]">
        {landingDockItems.map((item) => {
          const Icon = dockIcons[item.id];
          const isActive = activeDock === item.id;
          return (
            <motion.button
              aria-controls="platform-explorer-panel"
              aria-pressed={isActive}
              className={`relative flex h-9 min-w-[46px] flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] sm:px-3 ${
                isActive
                  ? "text-[#7ee2bb]"
                  : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              }`}
              key={item.id}
              onClick={() => onDockChange(item)}
              type="button"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
            >
              {isActive && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl bg-[#1f8a65]/12"
                  layoutId="smart-dock-active-item"
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }
                  }
                />
              )}
              <Icon
                aria-hidden="true"
                className="relative"
                size={16}
                weight={isActive ? "fill" : "regular"}
              />
              <span className="relative whitespace-nowrap text-[8px] font-medium leading-none">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

export default function OperatingSystemLanding() {
  const shouldReduceMotion = useReducedMotion();
  const explorerRef = useRef<HTMLElement>(null);
  const moduleRailRef = useRef<HTMLDivElement>(null);
  const [activeDock, setActiveDock] =
    useState<LandingDockItem["id"]>("accueil");
  const [activeViewId, setActiveViewId] = useState("accueil");
  const activeView = useMemo(
    () =>
      landingExplorerViews.find((view) => view.id === activeViewId) ??
      landingExplorerViews[0],
    [activeViewId],
  );
  const activeSection = useMemo(
    () =>
      explorerSections.find((section) => section.id === activeView.sectionId) ??
      explorerSections[0],
    [activeView.sectionId],
  );
  const [activeModuleId, setActiveModuleId] = useState(
    landingExplorerViews[0].defaultModuleId ??
      explorerSections[0].modules[0].id,
  );
  const activeModule =
    activeSection.modules.find((module) => module.id === activeModuleId) ??
    activeSection.modules[0];
  const activePreview =
    landingModulePreviews[`${activeSection.id}-${activeModule.id}`];
  const mobilePreviewSrc = activePreview?.mobileSrc;
  const mobilePreviewAlt = activePreview?.mobileAlt ?? activePreview?.alt;
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: [0.16, 1, 0.3, 1] };

  useEffect(() => {
    const activeButton = moduleRailRef.current?.querySelector<HTMLButtonElement>(
      '[aria-pressed="true"]',
    );

    activeButton?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeModule.id, shouldReduceMotion]);

  function selectView(viewId: string, dockId: LandingDockItem["id"]) {
    const nextView = landingExplorerViews.find((view) => view.id === viewId);
    const nextSection = explorerSections.find(
      (section) => section.id === nextView?.sectionId,
    );
    if (!nextView || !nextSection) return;

    setActiveDock(dockId);
    setActiveViewId(viewId);
    setActiveModuleId(nextView.defaultModuleId ?? nextSection.modules[0].id);
    window.requestAnimationFrame(() => {
      explorerRef.current?.scrollIntoView({
        behavior: shouldReduceMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return (
    <main className="min-h-screen bg-[#121212] px-3 pb-44 pt-3 font-sans text-white selection:bg-[#1f8a65]/35 sm:px-6 sm:pb-48 sm:pt-6 lg:px-8 lg:pt-8 xl:px-10 xl:pt-10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] h-24"
        style={{
          background:
            "linear-gradient(to top, #121212 0px, #121212 44px, rgba(18, 18, 18, 0.98) 58px, rgba(18, 18, 18, 0.78) 72px, rgba(18, 18, 18, 0) 96px)",
        }}
      />
      <div className="mx-auto grid w-full max-w-[1240px] gap-5 lg:grid-cols-[minmax(0,1.22fr)_minmax(360px,.78fr)] lg:items-start lg:gap-8 xl:gap-10">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12">
            <header>
              <Link
                className="inline-flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] focus-visible:ring-offset-4 focus-visible:ring-offset-[#181818]"
                href="/"
              >
                <Image
                  alt="Logo STRYVLAB"
                  className="h-10 w-10 object-contain"
                  height={48}
                  priority
                  src="/logo/logo-stryvr-silver.png"
                  width={48}
                />
                <span className="font-unbounded text-[15px] font-semibold tracking-[-0.09em] text-white">
                  STRYV <span className="font-light text-white/38">lab</span>
                </span>
              </Link>

              <div className="mt-12">
                <div className="max-w-[720px]">
                  <SectionLabel>Plateforme de coaching sportif</SectionLabel>
                  <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-white sm:text-6xl xl:text-[4.25rem]">
                    Le système de travail des coachs sportifs.{" "}
                    <span className="text-[#1f8a65]">
                      Du suivi à la prochaine décision.
                    </span>
                  </h1>
                  <p className="mt-6 max-w-[540px] text-base leading-7 text-white/52">
                    STRYVLAB réunit les dossiers coachés, les programmes
                    d’entraînement, Nutrition Studio, les données de suivi et
                    STRYVR, l’application client, dans un seul environnement.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <DemoButton className="sm:w-auto sm:min-w-[196px]" />
                    <a
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] px-4 text-sm font-medium text-white/62 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                      href="#platform-explorer-title"
                    >
                      Explorer le système
                    </a>
                  </div>
                  <div className="mt-7 max-w-[620px] rounded-xl border border-[#1f8a65]/25 bg-[#1f8a65]/[0.065] p-4">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p className="text-xs font-medium text-white">
                        <span className="text-[#7ee2bb]">Smart Dock</span>
                        <span className="text-white/42">
                          {" "}· La navigation flottante de STRYVLAB
                        </span>
                      </p>
                      <div className="flex shrink-0 items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#8ef0c7]">
                        <span>En bas de l’écran</span>
                        <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-4 border-t border-white/[0.06] pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <p className="max-w-[320px] text-xs leading-5 text-white/48">
                        Elle garde les espaces utiles à portée de main. Cliquez sur
                        la barre visible en bas de la page pour explorer la
                        plateforme.
                      </p>

                      <div
                        aria-hidden="true"
                        className="flex w-fit items-center gap-1 rounded-xl border border-white/[0.08] bg-[#101010] p-1.5 shadow-[0_8px_22px_rgba(0,0,0,.24)]"
                      >
                        {landingDockItems.map((item, index) => {
                          const Icon = dockIcons[item.id];
                          const isActive = index === 0;
                          return (
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                                isActive
                                  ? "bg-[#1f8a65]/18 text-[#7ee2bb]"
                                  : "text-white/28"
                              }`}
                              key={item.id}
                            >
                              <Icon
                                size={13}
                                weight={isActive ? "fill" : "regular"}
                              />
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </header>
          </section>

          <section
            aria-labelledby="continuity-title"
            className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] lg:items-end">
              <div>
                <SectionLabel>Un système connecté</SectionLabel>
                <h2
                  className="mt-3 text-2xl font-semibold leading-[1.06] tracking-[-0.035em] text-white sm:text-3xl"
                  id="continuity-title"
                >
                  Une méthode qui reste entière, du coach au coaché.
                </h2>
              </div>
              <p className="max-w-[520px] text-sm leading-6 text-white/48">
                STRYVLAB ne juxtapose pas des outils : il garde le lien entre ce
                qui est structuré, ce qui est exécuté et ce qui mérite un
                ajustement.
              </p>
            </div>

            <ol className="mt-7 grid gap-2 sm:grid-cols-4">
              {[
                ["01", "Structurer", "Dossiers, objectifs et protocoles."],
                ["02", "Exécuter", "Le coaché avance dans STRYVR."],
                ["03", "Relire", "Les retours retrouvent leur contexte."],
                ["04", "Ajuster", "Le coach choisit la suite à donner."],
              ].map(([number, title, description]) => (
                <li className="border-t border-white/[0.08] pt-3" key={number}>
                  <span className="text-xs font-medium text-[#7ee2bb]">
                    {number}
                  </span>
                  <p className="mt-2 text-sm font-medium text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/42">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby="platform-explorer-title"
            className="scroll-mt-4 rounded-2xl border border-[#1f8a65]/35 bg-[#181818] px-5 py-7 shadow-[0_0_0_1px_rgba(31,138,101,.05)] outline-none sm:px-8 sm:py-10 lg:px-10 xl:px-12"
            id="platform-explorer"
            ref={explorerRef}
            tabIndex={-1}
          >
            <div id="platform-explorer-panel" role="region">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  key={activeView.id}
                  transition={transition}
                >
                  <SectionLabel>{activeView.eyebrow}</SectionLabel>
                  <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_205px] md:items-end">
                    <h2
                      className="text-3xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[2.6rem]"
                      id="platform-explorer-title"
                    >
                      {activeView.title}
                    </h2>
                    <p className="text-sm leading-6 text-white/48 md:pb-1">
                      {activeView.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div
                aria-label="Outils disponibles dans cet espace"
                className="-mx-1 mt-7 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                ref={moduleRailRef}
                role="group"
              >
                <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-6">
                  {activeSection.modules.map((module) => {
                    const Icon = module.icon;
                    const isActive = module.id === activeModule.id;
                    return (
                      <motion.button
                        aria-pressed={isActive}
                        className={`group flex min-h-[60px] min-w-[116px] flex-none flex-col items-center justify-center gap-1.5 rounded-lg border px-3 text-center transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] sm:min-w-0 ${
                          isActive
                            ? "border-[#1f8a65]/45 bg-[#1f8a65]/10 text-white"
                            : "border-transparent bg-white/[0.035] text-white/52 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"
                        }`}
                        key={module.id}
                        onClick={() => setActiveModuleId(module.id)}
                        onFocus={() => setActiveModuleId(module.id)}
                        onMouseEnter={() => setActiveModuleId(module.id)}
                        type="button"
                        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                        whileTap={
                          shouldReduceMotion ? undefined : { scale: 0.98 }
                        }
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-md transition duration-150 ${
                            isActive
                              ? "bg-[#1f8a65]/22 text-[#7ee2bb]"
                              : "bg-white/[0.045] text-white/58 group-hover:text-white"
                          }`}
                        >
                          <Icon
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            strokeWidth={1.65}
                          />
                        </span>
                        <span className="whitespace-nowrap text-[10px] font-medium leading-none">
                          {module.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div
                aria-atomic="true"
                aria-live="polite"
                className="mt-3 rounded-xl border-[0.3px] border-white/[0.07] bg-[#121212] p-4 sm:p-5"
              >
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-[640px]"
                    exit={
                      shouldReduceMotion ? undefined : { opacity: 0, y: -4 }
                    }
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    key={`${activeView.id}-${activeModule.id}`}
                    transition={transition}
                  >
                    <p className="text-sm font-medium text-white">
                      {activeModule.label}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-white/62">
                      {activeModule.description}
                    </p>
                    <p className="mt-3 border-l border-[#1f8a65]/45 pl-3 text-xs leading-5 text-white/38">
                      {activeModule.connection}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {activePreview && (
                <AnimatePresence initial={false} mode="wait">
                  <motion.figure
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 overflow-hidden rounded-xl border-[0.3px] border-white/[0.07] bg-[#121212] p-2"
                    exit={
                      shouldReduceMotion ? undefined : { opacity: 0, y: -5 }
                    }
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                    key={`${activeView.id}-${activeModule.id}-${activePreview.src}`}
                    transition={transition}
                  >
                    <figcaption className="px-2 pb-2 pt-1 text-xs text-white/38">
                      {activePreview.label}
                    </figcaption>
                    <div
                      className={`relative overflow-hidden rounded-lg bg-black sm:block sm:aspect-[16/9] ${
                        mobilePreviewSrc ? "aspect-[4/5]" : "hidden"
                      }`}
                    >
                      <Image
                        alt={mobilePreviewAlt ?? activePreview.alt}
                        className="object-cover object-left-top sm:hidden"
                        fill
                        sizes="(max-width: 639px) calc(100vw - 56px), 1px"
                        src={mobilePreviewSrc ?? activePreview.src}
                      />
                      <Image
                        alt={activePreview.alt}
                        className="hidden object-contain object-top sm:block"
                        fill
                        sizes="(max-width: 1024px) 100vw, 650px"
                        src={activePreview.src}
                      />
                    </div>
                  </motion.figure>
                </AnimatePresence>
              )}
            </div>
          </section>

          <section
            aria-labelledby="platform-spaces-title"
            className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
          >
            <SectionLabel>Les espaces de travail</SectionLabel>
            <h2
              className="mt-3 max-w-[680px] text-3xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[2.6rem]"
              id="platform-spaces-title"
            >
              Un environnement de coaching qui relie la méthode, le quotidien et
              le suivi.
            </h2>
            <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {[
                [
                  "Workout Studio",
                  "Construire programmes, séances et mésocycles ; Smart Workout relit ensuite volume, répartition, alertes et exécution réelle.",
                ],
                [
                  "Smart Nutrition",
                  "Composer des protocoles nutritionnels, ajuster les portions à l’échelle du plan et rapprocher le prévu du vécu.",
                ],
                [
                  "Data Metrics",
                  "Lire les données corporelles, la récupération, la nutrition et la performance dans leur contexte de suivi.",
                ],
                [
                  "Business",
                  "Garder portefeuille coachés, agenda, tâches, paiements et alertes à proximité des accompagnements concernés.",
                ],
                [
                  "Morpho Pro",
                  "Conserver les observations visuelles dans le dossier du coaché et les relier à l’évolution du travail.",
                ],
                [
                  "STRYVR",
                  "Donner au coaché un espace clair pour exécuter le protocole, partager ses retours et suivre son parcours.",
                ],
              ].map(([title, description]) => (
                <article
                  className="border-t border-white/[0.08] pt-4"
                  key={title}
                >
                  <h3 className="text-base font-medium text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="intelligence-title"
            className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
          >
            <SectionLabel>L’intelligence du système</SectionLabel>
            <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-end">
              <h2
                className="max-w-[650px] text-3xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-[2.6rem]"
                id="intelligence-title"
              >
                Des outils qui gardent le contexte, pas des automatismes qui
                remplacent le coach.
              </h2>
              <p className="text-sm leading-6 text-white/48">
                Chaque intelligence rapproche des informations déjà présentes
                pour préparer une lecture et une prochaine action.
              </p>
            </div>

            <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {intelligenceHighlights.map((highlight) => (
                <article
                  className="border-t border-white/[0.08] pt-4"
                  key={highlight.label}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8ef0c7]">
                    {highlight.label}
                  </p>
                  <h3 className="mt-2 text-base font-medium leading-6 text-white">
                    {highlight.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">
                    {highlight.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <PlanComparisonSection />
        </div>

        <div className="lg:sticky lg:top-8 lg:py-0">
          <AccessPanel />
          <footer className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between lg:items-start lg:flex-col xl:flex-row xl:items-center">
            <span>STRYVLAB · L’espace de travail du coach.</span>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link
                className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                href="/confidentialite"
              >
                Confidentialité
              </Link>
              <Link
                className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                href="/mentions-legales"
              >
                Mentions légales
              </Link>
              <Link
                className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                href="/cookies"
              >
                Cookies
              </Link>
              <Link
                className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                href="/cgv"
              >
                Conditions
              </Link>
              <Link
                className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                href="/sous-traitants"
              >
                Sous-traitants
              </Link>
            </div>
          </footer>
        </div>
      </div>

      <PlatformDock
        activeDock={activeDock}
        activeViewId={activeViewId}
        onAthleteViewChange={(viewId) => selectView(viewId, "athletes")}
        onDockChange={(item) => selectView(item.viewId, item.id)}
        onStudioViewChange={(viewId) => selectView(viewId, "studio")}
      />
    </main>
  );
}
