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
import BorderGlow from "@/components/ui/BorderGlow";

const CAL_URL = "https://cal.com/stryvlab/demo-stryvlab";

/** Scénario fictif de démonstration — pas un client réel ni une preuve de résultat. */
const caseStudy = {
  name: "Thomas D.",
  status: "Scénario de démonstration",
  objective: "Recomposition",
  cadence: "4 séances / semaine",
  access: "Accès Pro + STRYVR",
  summary:
    "Un fil unique pour illustrer comment STRYV lab et STRYVR gardent le contexte : du dossier calibré à l’ajustement, sans reconstituer le suivi à chaque message.",
  steps: [
    {
      number: "01",
      title: "Calibrer le dossier",
      description:
        "Objectif, disponibilité, historique et contraintes sont posés avant la première prescription.",
    },
    {
      number: "02",
      title: "Prescrire avec méthode",
      description:
        "Bilans, Workout Studio et Nutrition Studio partent de la personne — pas d’un modèle moyen.",
    },
    {
      number: "03",
      title: "Exécuter dans STRYVR",
      description:
        "Thomas retrouve séances, repas et check-ins dans l’application client, au quotidien.",
    },
    {
      number: "04",
      title: "Relire et ajuster",
      description:
        "Performance, nutrition et retours reviennent dans le dossier : le coach choisit la suite.",
    },
  ],
} as const;

const intelligenceHighlights = [
  {
    label: "Smart Workout",
    title: "Relire un programme comme un système, pas une liste d’exercices.",
    description:
      "Volume, répartition, mouvements, progression et récupération sont croisés pour faire remonter ce qui mérite vraiment votre attention.",
  },
  {
    label: "Smart Nutrition",
    title: "Un ajustement se propage au plan, sans tout reconstruire.",
    description:
      "Calories, macros, jours types, repas et portions restent liés. Vous changez une cible : le protocole se recalcule dans le même raisonnement.",
  },
  {
    label: "Cockpit coaché",
    title: "Le plan, le réel et la prochaine action sur la même vue.",
    description:
      "Depuis le dossier, rapprochez activité, récupération, adhérence, protocole et impact d’un ajustement avant de décider.",
  },
  {
    label: "Actions coach",
    title: "Transformer une observation en suite concrète.",
    description:
      "Une tâche, un événement daté, ou les deux — avec le contexte du coaché déjà rattaché, sans reconstituer le dossier à la main.",
  },
  {
    label: "Data Metrics",
    title: "Lire l’histoire du suivi, pas des courbes isolées.",
    description:
      "Superposez données corporelles, nutrition, récupération et performance, puis replacez programmes, notes et changements de phase sur la chronologie.",
  },
  {
    label: "Bilans configurables",
    title: "Poser les bonnes questions, au bon moment.",
    description:
      "Créez vos modèles, configurez les questions et réutilisez une structure adaptée à l’entrée, au suivi régulier ou à une phase précise.",
  },
] as const;

const planColumns = [
  {
    id: "solo",
    label: "Solo",
    price: "29 €",
    period: "/ mois",
    limit: "Jusqu’à 5 coachés",
    badge: "Espace coach",
    description:
      "Dossiers, bilans, Workout Studio et Nutrition Studio pour structurer votre méthode — sans application client.",
  },
  {
    id: "pro",
    label: "Pro",
    price: "79 €",
    period: "/ mois",
    limit: "Jusqu’à 30 coachés",
    badge: "Écosystème complet",
    description:
      "Tout le socle coach, plus STRYVR : le coaché exécute le protocole et vous renvoie le réel au bon endroit.",
  },
  {
    id: "studio",
    label: "Studio",
    price: "129 €",
    period: "/ mois",
    limit: "Volume étendu",
    badge: "Activité structurée",
    description:
      "Capacité élargie pour un portefeuille plus large et une organisation de coaching plus exigeante.",
  },
] as const;

const faqItems = [
  {
    question: "STRYV lab et STRYVR, c’est quoi la différence ?",
    answer:
      "STRYV lab est l’espace de travail du coach : dossiers, bilans, programmes, nutrition, données et organisation. STRYVR est l’application client connectée : le coaché y exécute le protocole et renvoie séances, repas, check-ins et retours utiles.",
  },
  {
    question: "Pour qui est faite la plateforme ?",
    answer:
      "Pour le coach sportif indépendant ou en équipe qui suit plusieurs personnes, le préparateur physique, le coach nutrition, et les studios qui veulent un suivi plus structuré sans disperser l’information.",
  },
  {
    question: "Qu’est-ce qu’on voit pendant la démo de 40 minutes ?",
    answer:
      "Votre méthode de travail, un parcours coaché de bout en bout, les studios d’entraînement et de nutrition, la boucle avec STRYVR, et les niveaux d’accès adaptés à votre activité. Aucune inscription obligatoire pour comprendre le produit.",
  },
  {
    question: "Est-ce que ça remplace Excel, WhatsApp et les formulaires ?",
    answer:
      "L’objectif est de réduire la dispersion : un dossier, une prescription, une exécution client et des données qui se relisent au même endroit. La démo montre comment coller à votre façon de coacher, pas l’inverse.",
  },
  {
    question: "Le coach garde-t-il la main sur les décisions ?",
    answer:
      "Oui. Les intelligences du système rapprochent le contexte et préparent une lecture. Elles n’imposent pas de protocole à votre place : la décision reste professionnelle.",
  },
  {
    question: "Solo, Pro, Studio : comment choisir ?",
    answer:
      "Solo (29 €/mois) structure l’espace coach jusqu’à 5 coachés. Pro (79 €/mois) ajoute STRYVR et le suivi connecté jusqu’à 30 coachés. Studio (129 €/mois) étend la capacité pour une activité plus large. La démo aide à confirmer le bon niveau.",
  },
  {
    question: "Le cas Thomas D. est-il un vrai client ?",
    answer:
      "Non. Thomas D. est un scénario fictif de démonstration, conçu pour rendre lisible la boucle coach → client → données. Les captures montrent le produit réel ; le récit client n’est pas une preuve de résultat.",
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
    title: "Espace coach STRYV lab",
    features: [
      { label: "Dossiers coachés et historique", availability: { solo: true, pro: true, studio: true } },
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
      { label: "Check-ins et retours structurés", availability: { solo: false, pro: true, studio: true } },
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
      className={`group inline-flex min-h-[52px] w-full items-center justify-between rounded-xl bg-[#1f8a65] pl-5 pr-3.5 text-sm font-medium text-white transition-[transform,background-color] duration-150 ease-out active:scale-[0.96] hover:bg-[#217356] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] focus-visible:ring-offset-2 focus-visible:ring-offset-[#181818] ${className}`}
      href={CAL_URL}
      rel="noreferrer"
      target="_blank"
    >
      Réserver une démo de 40 min
      <ArrowUpRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform duration-150 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
      />
    </a>
  );
}

function AccessPanel() {
  return (
    <BorderGlow
      animated={true}
      backgroundColor="#121212"
      borderRadius={16}
      className="p-6 sm:p-8"
      glowColor="158 63 33"
    >
      <aside>
        <SectionLabel>Prochaine étape</SectionLabel>
        <h2 className="mt-4 max-w-sm text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl text-balance">
          Voir STRYV lab autour de{" "}
          <span className="text-[#1f8a65]">votre</span> méthode de coaching.
        </h2>
        <p className="mt-5 max-w-sm text-sm leading-6 text-white/52 text-pretty">
          40 minutes pour parcourir un dossier coaché, les studios, la boucle
          avec STRYVR et les accès adaptés à votre activité. Sans promesse
          générique : le produit, dans votre contexte.
        </p>

        <ul className="mt-6 space-y-2.5 text-sm text-white/48">
          {[
            "Parcours type Thomas D. : profil → bilan → prescription → données",
            "Workout Studio, Nutrition Studio et application STRYVR",
            "Accès Solo 29 €, Pro 79 € ou Studio 129 € / mois",
          ].map((item) => (
            <li className="flex items-start gap-2.5" key={item}>
              <Check
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-[#7ee2bb]"
                strokeWidth={2.2}
              />
              <span className="text-pretty">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-9 space-y-3">
          <DemoButton />
          <Link
            className="group inline-flex min-h-11 w-full items-center justify-between rounded-xl border-[0.3px] border-white/[0.08] bg-white/[0.025] pl-4 pr-3.5 text-sm font-medium text-white/62 transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.96] hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
            href="/auth/login"
          >
            <span className="flex items-center gap-2.5">
              <LogIn aria-hidden="true" className="h-4 w-4" />
              Déjà coach ? Se connecter
            </span>
            <ChevronRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
            />
          </Link>
        </div>
      </aside>
    </BorderGlow>
  );
}

function ClientCaseSection() {
  return (
    <section
      aria-labelledby="case-title"
      className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SectionLabel>Cas d’usage illustratif</SectionLabel>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/40">
          {caseStudy.status}
        </span>
      </div>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end">
        <div>
          <h2
            className="max-w-[640px] text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.6rem] text-balance"
            id="case-title"
          >
            {caseStudy.name} — un fil de coaching, pas un dossier à reconstruire.
          </h2>
          <p className="mt-4 max-w-[560px] text-sm leading-6 text-white/48 text-pretty">
            {caseStudy.summary}
          </p>
        </div>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {[
            ["Objectif", caseStudy.objective],
            ["Cadence", caseStudy.cadence],
            ["Accès", caseStudy.access],
          ].map(([label, value]) => (
            <div
              className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3"
              key={label}
            >
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <ol className="mt-8 grid gap-3 sm:grid-cols-2">
        {caseStudy.steps.map((step) => (
          <li
            className="rounded-xl border border-white/[0.07] bg-[#121212] p-4"
            key={step.number}
          >
            <span className="text-xs font-medium tabular-nums text-[#7ee2bb]">
              {step.number}
            </span>
            <p className="mt-2 text-sm font-medium text-white">{step.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-white/45 text-pretty">
              {step.description}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <figure className="overflow-hidden rounded-2xl border-[0.3px] border-white/[0.07] bg-[#0a0a0a] p-2">
          <figcaption className="px-2 pb-2 pt-1 text-xs text-white/38">
            Dossier coaché · profil et contexte
          </figcaption>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-black outline outline-1 outline-white/10">
            <Image
              alt="Capture réelle du profil coaché dans STRYV lab — illustration du dossier de Thomas D."
              className="object-cover object-left-top"
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              src="/landing-demo/client-profile-desktop.png"
            />
          </div>
        </figure>
        <figure className="overflow-hidden rounded-2xl border-[0.3px] border-white/[0.07] bg-[#0a0a0a] p-2">
          <figcaption className="px-2 pb-2 pt-1 text-xs text-white/38">
            Suivi · données pour la prochaine décision
          </figcaption>
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-black outline outline-1 outline-white/10">
            <Image
              alt="Capture réelle des métriques de suivi dans STRYV lab — lecture des données de Thomas D."
              className="object-cover object-left-top"
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              src="/landing-demo/client-metrics-desktop.png"
            />
          </div>
        </figure>
      </div>

      <p className="mt-4 text-[11px] leading-5 text-white/30 text-pretty">
        Scénario fictif. Les captures montrent l’interface réelle de STRYV lab ;
        elles n’illustrent pas un résultat client documenté.
      </p>
    </section>
  );
}

function StryvrExperienceSection() {
  const moments = [
    {
      title: "Une journée lisible",
      description:
        "Les priorités, le check-in et la progression restent accessibles sans devoir interpréter un tableau de bord.",
      src: "/landing-demo/stryvr/stryvr-today.png",
      alt: "Aperçu de l’accueil STRYVR avec check-in, score de transformation et priorités de la journée",
      label: "Accueil · contexte et prochaine action",
    },
    {
      title: "Une séance consignée",
      description:
        "Volume, répétitions, durée et muscles sollicités donnent au coach une lecture utile de ce qui a été réalisé.",
      src: "/landing-demo/stryvr/stryvr-workout-recap.png",
      alt: "Aperçu STRYVR du récapitulatif d’une séance avec volume, répétitions et muscles sollicités",
      label: "Séance · exécution et retour terrain",
    },
    {
      title: "Une nutrition suivie",
      description:
        "Repas, apports et hydratation sont rattachés au jour et aux repères définis dans le protocole du coach.",
      src: "/landing-demo/stryvr/stryvr-nutrition-tracking.png",
      alt: "Aperçu STRYVR du suivi nutritionnel quotidien avec apports, repas et hydratation",
      label: "Nutrition · le prévu rencontre le réel",
    },
    {
      title: "Une progression comprise",
      description:
        "Le score de transformation rend les repères de régularité et de récupération visibles pour le coaché, sans les réduire à un chiffre isolé.",
      src: "/landing-demo/stryvr/stryvr-transformation-score.png",
      alt: "Aperçu STRYVR du score de transformation et de ses piliers d’adhérence et de récupération",
      label: "Suivi · progression rendue concrète",
    },
  ] as const;

  return (
    <section
      aria-labelledby="stryvr-experience-title"
      className="overflow-hidden rounded-2xl border-[0.3px] border-white/[0.07] bg-[#0a0a0a] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
      id="stryvr-experience"
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.56fr)] lg:items-end lg:gap-10">
        <div>
          <div className="flex items-center gap-3">
            <Image
              alt="Logo STRYVR"
              className="h-7 w-7 rounded-md object-contain"
              height={28}
              src="/logo/logo-stryvr-silver.png"
              width={28}
            />
            <SectionLabel>Application client connectée</SectionLabel>
          </div>
          <h2
            className="mt-4 max-w-[700px] text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.6rem] text-balance"
            id="stryvr-experience-title"
          >
            Le protocole devient un rythme que le coaché peut vraiment suivre.
          </h2>
        </div>
        <p className="max-w-[430px] text-sm leading-6 text-white/52 text-pretty lg:pb-1">
          STRYVR traduit le travail du coach en actions quotidiennes claires,
          puis replace l’exécution, les repas et les retours dans le contexte
          qui sert la prochaine décision.
        </p>
      </div>

      <div className="mt-8 grid gap-x-8 gap-y-5 border-y border-white/[0.07] py-5 sm:grid-cols-2 lg:grid-cols-4">
        {moments.map((moment) => (
          <div key={moment.title}>
            <p className="text-sm font-medium text-white">{moment.title}</p>
            <p className="mt-1.5 text-xs leading-5 text-white/45 text-pretty">
              {moment.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
        {moments.map((moment) => (
          <figure
            className="overflow-hidden rounded-xl border-[0.3px] border-white/[0.08] bg-[#121212]"
            key={moment.src}
          >
            <figcaption className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-medium text-white/45 sm:px-4 sm:py-2.5 sm:text-xs">
              {moment.label}
            </figcaption>
            <div className="relative aspect-[9/16] bg-black">
              <Image
                alt={moment.alt}
                className="object-cover"
                fill
                sizes="(max-width: 640px) calc((100vw - 76px) / 2), (max-width: 1024px) calc((100vw - 112px) / 2), 340px"
                src={moment.src}
              />
            </div>
          </figure>
        ))}
      </div>

      <p className="mt-4 max-w-[680px] text-[11px] leading-5 text-white/32 text-pretty">
        Vues de l’expérience STRYVR. Les écrans illustrent les fonctionnalités
        du produit ; ils ne constituent pas une preuve de résultat client.
      </p>
    </section>
  );
}

function PlanComparisonSection() {
  return (
    <section
      aria-labelledby="plans-title"
      className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
    >
      <SectionLabel>Tarifs & accès</SectionLabel>
      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(200px,230px)] lg:items-end">
        <div>
          <h2
            className="max-w-[650px] text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.6rem] text-balance"
            id="plans-title"
          >
            Trois accès, une même logique de coaching.
          </h2>
          <p className="mt-4 max-w-[620px] text-sm leading-6 text-white/48 text-pretty">
            Le socle coach est présent partout. STRYVR, l’application client,
            complète l’écosystème à partir de Pro. La démo confirme le niveau
            adapté à votre volume et à votre méthode.
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
                  Recommandé
                </span>
              )}
            </div>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums text-white">
                {plan.price}
              </span>
              <span className="text-xs text-white/40">{plan.period}</span>
            </p>
            <p className="mt-1 text-xs font-medium tabular-nums text-[#8ef0c7]">
              {plan.limit}
            </p>
            <p className="mt-1 text-[11px] text-white/35">{plan.badge}</p>
            <p className="mt-4 text-xs leading-5 text-white/45 text-pretty">
              {plan.description}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.07] [scrollbar-color:rgba(255,255,255,.18)_transparent]">
        <table className="min-w-[720px] w-full border-collapse text-left">
          <caption className="sr-only">
            Comparaison des capacités des accès Solo, Pro et Studio de STRYV lab
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
                  <span className="block">{plan.label}</span>
                  <span className="mt-0.5 block text-[10px] font-medium tabular-nums text-white/40">
                    {plan.price}
                    {plan.period}
                  </span>
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
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-white/45">
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
      aria-label="Smart Dock · navigation contextuelle de la plateforme STRYV lab"
      className="pointer-events-auto fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-1.5 sm:bottom-6"
      id="smart-dock"
    >
      {activeDock === "athletes" && (
        <div className="flex items-center gap-1 rounded-2xl border-[0.3px] border-white/[0.06] bg-[#121212] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.32)]">
          {landingAthleteTabs.map((tab) => {
            const isActive = activeViewId === tab.viewId;
            return (
              <button
                aria-controls="platform-explorer-panel"
                aria-pressed={isActive}
                className={`flex min-h-10 items-center rounded-xl px-3 text-[11px] font-medium transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] ${
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
        <div className="max-w-full overflow-x-auto rounded-2xl border-[0.3px] border-white/[0.06] bg-[#121212] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.32)]">
          <div className="flex min-w-max items-center gap-1">
            {landingStudioTabs.map((tab) => {
              const isActive = activeViewId === tab.viewId;
              return (
                <button
                  aria-controls="platform-explorer-panel"
                  aria-pressed={isActive}
                  className={`flex min-h-10 items-center rounded-xl px-3 text-[11px] font-medium transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] ${
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

      <div className="flex h-14 items-center gap-1 rounded-[20px] border-[0.3px] border-white/[0.06] bg-[#121212] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.32)]">
        {landingDockItems.map((item) => {
          const Icon = dockIcons[item.id];
          const isActive = activeDock === item.id;
          return (
            <motion.button
              aria-controls="platform-explorer-panel"
              aria-pressed={isActive}
              className={`relative flex h-11 min-w-[46px] flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 transition-[transform,background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] sm:px-3 ${
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
                  alt="Logo STRYV lab"
                  className="h-10 w-10 rounded-lg object-contain outline outline-1 outline-white/10"
                  height={48}
                  priority
                  src="/logo/logo-stryvr-silver.png"
                  width={48}
                />
                <span className="font-unbounded text-[15px] font-semibold tracking-[-0.03em] text-white">
                  STRYV <span className="font-light text-white/38">lab</span>
                </span>
              </Link>

              <div className="mt-10 sm:mt-12">
                <div className="max-w-[720px]">
                  <SectionLabel>Plateforme de coaching sportif</SectionLabel>
                  <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl xl:text-[4.25rem] text-balance">
                    Gardez le fil de chaque coaché.{" "}
                    <span className="text-[#1f8a65]">
                      Décidez avec le contexte, pas malgré lui.
                    </span>
                  </h1>
                  <p className="mt-6 max-w-[560px] text-base leading-7 text-white/52 text-pretty">
                    STRYV lab est le système de travail du coach : dossiers,
                    bilans, programmes, nutrition, données de suivi et STRYVR,
                    l’application client. Une boucle continue — de la
                    prescription à l’ajustement — sans reconstruire le dossier à
                    chaque message.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <DemoButton className="sm:w-auto sm:min-w-[240px]" />
                    <a
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] px-4 text-sm font-medium text-white/62 transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.96] hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                      href="#case-title"
                    >
                      Voir le cas {caseStudy.name}
                    </a>
                  </div>
                </div>

                <figure className="mt-8 overflow-hidden rounded-2xl border-[0.3px] border-white/[0.08] bg-[#0a0a0a] p-2 shadow-[0_16px_40px_rgba(0,0,0,.28)]">
                  <div className="flex items-center justify-between gap-3 px-2 pb-2 pt-1">
                    <figcaption className="text-xs text-white/40">
                      Capture réelle · tableau de bord coach
                    </figcaption>
                    <span className="rounded-full bg-[#1f8a65]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8ef0c7]">
                      Produit
                    </span>
                  </div>
                  <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-black outline outline-1 outline-white/10">
                    <Image
                      alt="Capture réelle du tableau de bord STRYV lab : portefeuille coachés, priorités et contexte de travail"
                      className="object-cover object-left-top"
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 720px"
                      src="/landing-demo/dashboard.png"
                    />
                  </div>
                </figure>

                <div className="mt-5 max-w-[620px] rounded-xl border border-[#1f8a65]/25 bg-[#1f8a65]/[0.065] p-4">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <p className="text-xs font-medium text-white">
                      <span className="text-[#7ee2bb]">Smart Dock</span>
                      <span className="text-white/42">
                        {" "}· Naviguez dans le vrai produit
                      </span>
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#8ef0c7]">
                      <span>En bas de l’écran</span>
                      <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-4 border-t border-white/[0.06] pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <p className="max-w-[340px] text-xs leading-5 text-white/48 text-pretty">
                      Accueil, coachés, studios, business : la barre flottante
                      ouvre les espaces de STRYV lab tels qu’ils existent dans
                      la plateforme — y compris le fil de {caseStudy.name}.
                    </p>

                    <div
                      aria-hidden="true"
                      className="flex w-fit items-center gap-1 rounded-[14px] border border-white/[0.08] bg-[#101010] p-1.5 shadow-[0_8px_22px_rgba(0,0,0,.24)]"
                    >
                      {landingDockItems.map((item, index) => {
                        const Icon = dockIcons[item.id];
                        const isActive = index === 0;
                        return (
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-md ${
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
            </header>
          </section>

          <section
            aria-labelledby="continuity-title"
            className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)] lg:items-start">
              <div>
                <SectionLabel>Le vrai problème</SectionLabel>
                <h2
                  className="mt-3 text-2xl font-semibold leading-[1.06] tracking-[-0.03em] text-white sm:text-3xl text-balance"
                  id="continuity-title"
                >
                  Le suivi se disperse. Le raisonnement aussi.
                </h2>
              </div>
              <div className="space-y-4">
                <p className="max-w-[520px] text-sm leading-6 text-white/48 text-pretty">
                  Excel, WhatsApp, formulaires, une app d’entraînement, un
                  journal alimentaire, des notes personnelles : chaque outil
                  détient un morceau du coaché. Avant de décider, vous
                  reconstruisez le contexte.
                </p>
                <p className="max-w-[520px] text-sm leading-6 text-white/48 text-pretty">
                  STRYV lab ne juxtapose pas des modules. Il conserve le lien
                  entre ce que vous structurez, ce que le coaché exécute dans
                  STRYVR, et ce qui mérite un ajustement — comme dans le fil de{" "}
                  {caseStudy.name}, plus bas.
                </p>
              </div>
            </div>

            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "01",
                  "Structurer",
                  "Dossier, objectifs, bilans et protocoles au même endroit.",
                ],
                [
                  "02",
                  "Prescrire",
                  "Entraînement et nutrition reliés à la personne, pas à un modèle moyen.",
                ],
                [
                  "03",
                  "Exécuter",
                  "Le coaché avance dans STRYVR avec un parcours clair au quotidien.",
                ],
                [
                  "04",
                  "Ajuster",
                  "Les retours retrouvent le dossier : vous choisissez la suite.",
                ],
              ].map(([number, title, description]) => (
                <li className="border-t border-white/[0.08] pt-3" key={number}>
                  <span className="text-xs font-medium tabular-nums text-[#7ee2bb]">
                    {number}
                  </span>
                  <p className="mt-2 text-sm font-medium text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-white/42 text-pretty">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <ClientCaseSection />

          <StryvrExperienceSection />

          <section
            aria-labelledby="platform-explorer-title"
            className="scroll-mt-4 outline-none"
            id="platform-explorer"
            ref={explorerRef}
            tabIndex={-1}
          >
            <BorderGlow
              animated
              backgroundColor="#121212"
              borderRadius={16}
              className="px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
              glowColor="158 63 33"
            >
              <div id="platform-explorer-panel" role="region">
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      shouldReduceMotion ? undefined : { opacity: 0, y: -4 }
                    }
                    initial={
                      shouldReduceMotion ? false : { opacity: 0, y: 6 }
                    }
                    key={activeView.id}
                    transition={transition}
                  >
                    <SectionLabel>{activeView.eyebrow}</SectionLabel>
                    <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,1fr)_205px] md:items-end">
                      <h2
                        className="text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.6rem] text-balance"
                        id="platform-explorer-title"
                      >
                        {activeView.title}
                      </h2>
                      <p className="text-sm leading-6 text-white/48 text-pretty md:pb-1">
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
                          className={`group flex min-h-[60px] min-w-[116px] flex-none flex-col items-center justify-center gap-1.5 rounded-xl border px-3 text-center transition-[transform,background-color,color,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb] sm:min-w-0 ${
                            isActive
                              ? "border-[#1f8a65]/45 bg-[#1f8a65]/10 text-white"
                              : "border-transparent bg-white/[0.035] text-white/52 hover:border-white/[0.08] hover:bg-white/[0.07] hover:text-white"
                          }`}
                          key={module.id}
                          onClick={() => setActiveModuleId(module.id)}
                          onFocus={() => setActiveModuleId(module.id)}
                          onMouseEnter={() => setActiveModuleId(module.id)}
                          type="button"
                          whileHover={
                            shouldReduceMotion ? undefined : { y: -2 }
                          }
                          whileTap={
                            shouldReduceMotion ? undefined : { scale: 0.96 }
                          }
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-[background-color,color] duration-150 ease-out ${
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
                  className="mt-3 rounded-xl border-[0.3px] border-white/[0.07] bg-[#0a0a0a] p-4 sm:p-5"
                >
                  <AnimatePresence initial={false} mode="wait">
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-[640px]"
                      exit={
                        shouldReduceMotion ? undefined : { opacity: 0, y: -4 }
                      }
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 6 }
                      }
                      key={`${activeView.id}-${activeModule.id}`}
                      transition={transition}
                    >
                      <p className="text-sm font-medium text-white">
                        {activeModule.label}
                      </p>
                      <p className="mt-1.5 text-sm leading-6 text-white/62 text-pretty">
                        {activeModule.description}
                      </p>
                      <p className="mt-3 rounded-md bg-[#1f8a65]/[0.08] px-3 py-2 text-xs leading-5 text-white/45 text-pretty">
                        {activeModule.connection}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {activePreview && (
                  <AnimatePresence initial={false} mode="wait">
                    <motion.figure
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 overflow-hidden rounded-2xl border-[0.3px] border-white/[0.07] bg-[#0a0a0a] p-2"
                      exit={
                        shouldReduceMotion ? undefined : { opacity: 0, y: -5 }
                      }
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 8 }
                      }
                      key={`${activeView.id}-${activeModule.id}-${activePreview.src}`}
                      transition={transition}
                    >
                      <figcaption className="px-2 pb-2 pt-1 text-xs text-white/38">
                        {activePreview.label}
                      </figcaption>
                      <div
                        className={`relative overflow-hidden rounded-xl bg-black outline outline-1 outline-white/10 sm:block sm:aspect-[16/9] ${
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
            </BorderGlow>
          </section>

          <section
            aria-labelledby="platform-spaces-title"
            className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
          >
            <SectionLabel>Ce que vous pilotez</SectionLabel>
            <h2
              className="mt-3 max-w-[680px] text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.6rem] text-balance"
              id="platform-spaces-title"
            >
              Des espaces métier qui servent une seule chose : la prochaine
              décision.
            </h2>
            <p className="mt-4 max-w-[620px] text-sm leading-6 text-white/48 text-pretty">
              Pas un catalogue de fonctionnalités. Une chaîne : comprendre la
              personne, prescrire, laisser le réel remonter, ajuster.
            </p>
            <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {[
                [
                  "Workout Studio",
                  "Programmes, séances et mésocycles. Smart Workout relit volume, répartition, alertes et ce qui a vraiment été exécuté.",
                ],
                [
                  "Nutrition Studio",
                  "Protocoles tenables, ajustement global des portions, TDEE adaptatif et rapprochement du prévu avec le vécu dans STRYVR.",
                ],
                [
                  "Data Metrics",
                  "Corps, récupération, nutrition et performance dans le même contexte de suivi — pour voir ce qui mérite une décision.",
                ],
                [
                  "Morpho Pro",
                  "Documenter l’observation visuelle dans le temps, la comparer, et la relier au dossier et à la programmation.",
                ],
                [
                  "Business",
                  "Portefeuille, agenda, tâches, paiements et alertes restés attachés aux coachés — l’opérationnel sans perdre le suivi.",
                ],
                [
                  "STRYVR",
                  "L’application client : séances, nutrition, check-ins et progression. Le protocole devient quotidien, les retours reviennent au coach.",
                ],
              ].map(([title, description]) => (
                <article
                  className="border-t border-white/[0.08] pt-4"
                  key={title}
                >
                  <h3 className="text-base font-medium text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48 text-pretty">
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
            <SectionLabel>Aide à la décision</SectionLabel>
            <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] lg:items-end">
              <h2
                className="max-w-[650px] text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.6rem] text-balance"
                id="intelligence-title"
              >
                Des outils qui préparent la lecture.{" "}
                <span className="text-white/55">
                  Jamais qui remplacent le coach.
                </span>
              </h2>
              <p className="text-sm leading-6 text-white/48 text-pretty">
                Chaque intelligence rapproche des informations déjà présentes
                pour éclairer une décision professionnelle — pas pour l’imposer.
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
                  <p className="mt-2 text-sm leading-6 text-white/48 text-pretty">
                    {highlight.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <PlanComparisonSection />

          <section
            aria-labelledby="faq-title"
            className="rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-12"
          >
            <SectionLabel>Questions fréquentes</SectionLabel>
            <h2
              className="mt-3 max-w-[620px] text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.6rem] text-balance"
              id="faq-title"
            >
              Ce que les coachs demandent avant la démo.
            </h2>
            <div className="mt-8 space-y-0">
              {faqItems.map((item) => (
                <details
                  className="group border-t border-white/[0.08] py-4 first:border-t-0 first:pt-0"
                  key={item.question}
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-4">
                      <span className="text-pretty">{item.question}</span>
                      <ChevronRight
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-white/35 transition-transform duration-150 ease-out group-open:rotate-90"
                      />
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[640px] text-sm leading-6 text-white/48 text-pretty">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-sm leading-6 text-white/48 text-pretty">
                Une question plus précise sur votre volume de coachés ou votre
                méthode ? La démo est le bon format.
              </p>
              <DemoButton className="sm:w-auto sm:min-w-[240px]" />
            </div>
          </section>
        </div>

        <div className="lg:sticky lg:top-8 lg:py-0">
          <AccessPanel />
          <footer className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between lg:items-start lg:flex-col xl:flex-row xl:items-center">
            <span>STRYV lab · L’espace de travail du coach.</span>
            <div className="flex flex-wrap gap-x-1 gap-y-1">
              {(
                [
                  ["/confidentialite", "Confidentialité"],
                  ["/mentions-legales", "Mentions légales"],
                  ["/cookies", "Cookies"],
                  ["/cgv", "Conditions"],
                  ["/sous-traitants", "Sous-traitants"],
                ] as const
              ).map(([href, label]) => (
                <Link
                  className="inline-flex min-h-10 items-center px-2 transition-colors duration-150 ease-out hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ee2bb]"
                  href={href}
                  key={href}
                >
                  {label}
                </Link>
              ))}
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
