"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  Activity,
  Apple,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  ChevronRight,
  ClipboardCheck,
  Dumbbell,
  Layers3,
  Menu,
  MoveRight,
  Send,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserPlus,
  X,
  Zap,
} from "lucide-react";
import { AnalyticsConsentBanner } from "@/components/analytics/AnalyticsConsentBanner";
import { trackPageView, trackProductEvent } from "@/lib/analytics/browser";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const CAL_DEMO_URL = "https://cal.com/stryvlab/demo-stryvlab";

const steps = [
  { number: "01", label: "Ajouter", title: "Le dossier client devient le point de départ.", copy: "Crée le profil, pose l’objectif et rassemble le contexte avant de prescrire.", icon: UserPlus, color: "#c6b48b" },
  { number: "02", label: "Paramétrer", title: "Calibre ton client, pas une moyenne.", copy: "Genesis et les données de profil donnent une base de travail lisible et exploitable.", icon: SlidersHorizontal, color: "#86aeb8" },
  { number: "03", label: "Inviter", title: "Le coaching continue dans sa poche.", copy: "Une invitation ouvre STRYVR : agenda, séance, nutrition et check-ins restent connectés.", icon: Send, color: "#dbe4df" },
  { number: "04", label: "Questionner", title: "Les bilans arrivent sans relance manuelle.", copy: "Tes templates personnalisés partent au bon rythme et reviennent dans ton espace.", icon: ClipboardCheck, color: "#c6b48b" },
  { number: "05", label: "Comprendre", title: "Les logs deviennent des signaux.", copy: "Adhérence, récupération, performance et réponse corporelle se lisent dans le contexte.", icon: BarChart3, color: "#86aeb8" },
  { number: "06", label: "Piloter", title: "Tu sais quoi ajuster ensuite.", copy: "Transformation Score, phase optimale, Workout Studio et Nutrition Studio travaillent ensemble.", icon: Layers3, color: "#dbe4df" },
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] } }),
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2" aria-label="STRYV lab">
      <span className={`relative overflow-hidden rounded-xl border border-white/15 bg-white/[0.07] ${compact ? "h-7 w-7" : "h-8 w-8"}`}>
        <Image src="/images/logo.png" alt="" fill sizes="32px" className="object-contain p-1.5 brightness-0 invert transition-transform duration-300 group-hover:scale-110" />
      </span>
      <span className="font-unbounded text-[13px] font-semibold tracking-[-0.08em] text-white">STRYV <span className="font-light text-white/40">lab</span></span>
    </Link>
  );
}

function StryvrMark({ size = 30 }: { size?: number }) {
  return <Image src="/images/logo-stryvr-silver.png" alt="Logo STRYVR" width={size} height={size} className="object-contain" />;
}

function CTA({ href, children, tone = "light" }: { href: string; children: ReactNode; tone?: "light" | "dark" | "outline" }) {
  const styles = tone === "light" ? "bg-[#f2f2f2] text-[#111315] hover:bg-white" : tone === "dark" ? "bg-[#1f2826] text-white hover:bg-[#2a3834]" : "border border-white/20 text-white/75 hover:border-white/50 hover:text-white";
  const destination = href === "/auth/login" ? CAL_DEMO_URL : href;
  const label = href === "/auth/login" ? "Réserver une démo de 40 min" : children;
  return (
    <Link href={destination} target={destination === CAL_DEMO_URL ? "_blank" : undefined} rel={destination === CAL_DEMO_URL ? "noreferrer" : undefined} onClick={() => void trackProductEvent({ eventName: "cta_clicked", source: "main-landing", featureKey: destination, pagePath: "/" })} className={`group inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6b48b] ${styles}`}>
      {label}<ArrowUpRight size={15} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[28px] border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.035)_48%,rgba(92,98,104,.14))] shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_20px_50px_rgba(0,0,0,.24)] ${className}`}>{children}</div>;
}

function HeroDashboard() {
  return (
    <Surface className="relative overflow-hidden p-2 sm:p-3">
      <div className="relative aspect-[1.6/1] overflow-hidden rounded-[22px] border border-white/10 bg-[#111]">
        <Image src="/landing-demo/dashboard.png" alt="Aperçu réel du tableau de bord STRYV lab pour coach" fill sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover object-top" priority />
      </div>
    </Surface>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-2xl bg-white/[0.045] p-3"><p className="text-[9px] uppercase tracking-[0.12em] text-white/35">{label}</p><p className="mt-4 font-barlow text-3xl font-semibold tracking-[-0.05em]" style={{ color }}>{value}</p></div>;
}

function WorkflowPanel({ active, reducedMotion }: { active: number; reducedMotion: boolean }) {
  const currentStep = steps[active] ?? steps[0];
  const Icon = currentStep.icon ?? Activity;
  return (
    <div data-workflow-panel className="relative h-[490px] overflow-hidden rounded-[30px] border border-white/15 bg-[#151918] shadow-[0_30px_80px_rgba(0,0,0,.38)] sm:h-[630px]">
      <Image src="/images/ffj.jpg" alt="Texture topographique STRYV lab" fill className="object-cover opacity-25" sizes="(max-width: 1024px) 100vw, 50vw" />
      <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(36,49,45,.88),rgba(13,15,15,.96))]" />
      <div data-workflow-orbit className="absolute -right-24 top-20 h-[370px] w-[370px] rounded-full border border-white/10 opacity-60" />
      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-7">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.08]" style={{ color: currentStep.color }}><Icon size={18} /></div><div><p className="font-barlow-condensed text-[11px] uppercase tracking-[0.18em] text-white/40">Workflow coach</p><p className="mt-1 text-sm font-medium text-white">{currentStep.label}</p></div></div><span className="font-mono text-[10px] text-white/30">{currentStep.number} / 06</span></div>
        <motion.div data-workflow-card animate={{ y: reducedMotion ? 0 : active * -3 }} transition={{ duration: reducedMotion ? 0 : 0.45 }} className="mx-auto w-full max-w-[390px] rounded-[26px] border border-white/20 bg-[#0d1110]/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,.4)] backdrop-blur-xl sm:p-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-4"><div><p className="text-[9px] uppercase tracking-[0.14em] text-white/35">Client actif</p><p className="mt-1 text-lg font-semibold tracking-[-0.04em]">Thomas D.</p></div><span className="rounded-lg bg-[#c6b48b]/15 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[#c6b48b]">Recomposition</span></div>
          {active === 0 && <ClientProfileScene />}
          {active === 1 && <CalibrationScene />}
          {active === 2 && <InvitationScene />}
          {active === 3 && <AssessmentScene />}
          {active === 4 && <MetricsScene />}
          {active === 5 && <StudiosScene />}
        </motion.div>
        <div><div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-white/35"><span>{currentStep.title}</span><span data-workflow-progress-label>0{active + 1}</span></div><div className="relative flex gap-1.5"><div data-workflow-progress className="absolute left-0 top-0 z-10 h-1 w-0 rounded-full bg-[#c6b48b]" />{steps.map((step) => <div key={step.number} className="h-1 flex-1 rounded-full bg-white/15" />)}</div></div>
      </div>
    </div>
  );
}

function ClientProfileScene() {
  return <div className="mt-5 space-y-2.5"><div className="flex items-center justify-between rounded-xl bg-white/[0.05] p-3"><span className="text-[11px] text-white/55">Objectif</span><span className="text-[10px] text-[#c6b48b]">Recomposition</span></div><div className="flex items-center justify-between rounded-xl bg-white/[0.05] p-3"><span className="text-[11px] text-white/55">Disponibilité</span><span className="text-[10px] text-white/70">4 séances / semaine</span></div><div className="flex items-center justify-between rounded-xl bg-white/[0.05] p-3"><span className="text-[11px] text-white/55">Statut</span><span className="flex items-center gap-2 text-[10px] text-[#c6b48b]"><span className="h-1.5 w-1.5 rounded-full bg-[#c6b48b]" /> À paramétrer</span></div><button className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] text-[10px] font-bold uppercase tracking-[0.12em] text-[#111315]">Ouvrir le profil <ArrowRight size={14} /></button></div>;
}

function CalibrationScene() {
  return <div className="mt-5 space-y-3"><div className="rounded-xl bg-white/[0.05] p-4"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[0.13em] text-white/35">Calibration Genesis</span><span className="text-[10px] text-[#86aeb8]">78%</span></div><div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-[78%] rounded-full bg-[#86aeb8]" /></div></div>{[["Morphologie", "Analysée"], ["Historique", "4.2 ans"], ["Contraintes", "3 signaux"]].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-xl bg-white/[0.05] p-3"><span className="text-[11px] text-white/55">{label}</span><span className="text-[10px] text-[#86aeb8]">{value}</span></div>)}</div>;
}

function InvitationScene() {
  return <div className="mt-5"><div className="rounded-xl border border-[#86aeb8]/30 bg-[#86aeb8]/10 p-4"><div className="flex items-center gap-3"><StryvrMark size={32} /><div><p className="text-[11px] text-white/80">Invitation STRYVR</p><p className="mt-1 text-[9px] text-white/35">thomas@example.com</p></div></div><div className="mt-5 flex items-center gap-2 text-[10px] text-[#86aeb8]"><span className="h-1.5 w-1.5 rounded-full bg-[#86aeb8]" /> Envoyée il y a 2 min</div></div><p className="mt-4 text-center text-[9px] uppercase tracking-[0.13em] text-white/30">Son espace client est prêt.</p></div>;
}

function AssessmentScene() {
  return <div className="mt-5 space-y-2"><div className="flex items-center justify-between rounded-xl bg-white/[0.05] p-3"><div className="flex items-center gap-3"><ClipboardCheck size={16} className="text-[#c6b48b]" /><div><p className="text-[11px] text-white/75">Bilan hebdomadaire</p><p className="mt-1 text-[9px] text-white/35">8 questions · automatique</p></div></div><span className="text-[9px] text-[#c6b48b]">Actif</span></div><div className="flex items-center justify-between rounded-xl bg-white/[0.05] p-3"><div className="flex items-center gap-3"><BellRing size={16} className="text-[#86aeb8]" /><div><p className="text-[11px] text-white/75">Récupération</p><p className="mt-1 text-[9px] text-white/35">Dimanche · 6 questions</p></div></div><span className="text-[9px] text-[#c6b48b]">Programmé</span></div><div className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-[10px] text-white/40"><Sparkles size={14} className="text-[#dbe4df]" /> Les réponses arrivent dans la fiche client.</div></div>;
}

function MetricsScene() {
  return <div className="mt-5"><div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[9px] text-white/35">Transformation</p><p className="mt-3 font-barlow text-3xl text-[#c6b48b]">68</p><p className="mt-1 text-[9px] text-white/35">+12 ce mois</p></div><div className="rounded-xl bg-white/[0.05] p-3"><p className="text-[9px] text-white/35">Phase actuelle</p><p className="mt-3 text-sm text-[#86aeb8]">À surveiller</p><p className="mt-1 text-[9px] text-white/35">confiance 82%</p></div></div><div className="mt-3 rounded-xl bg-white/[0.045] p-3"><div className="flex items-end gap-1">{[26, 38, 31, 44, 40, 53, 48, 61, 55, 69, 62, 75, 68, 81].map((height, i) => <span key={i} className={`flex-1 rounded-t-sm ${i > 10 ? "bg-[#86aeb8]" : "bg-white/15"}`} style={{ height }} />)}</div><div className="mt-3 flex justify-between text-[9px] uppercase tracking-[0.12em] text-white/30"><span>7 derniers jours</span><span className="text-[#86aeb8]">récupération ↑</span></div></div></div>;
}

function StudiosScene() {
  const studioRows: Array<{ icon: ElementType; title: string; copy: string; color: string }> = [[Dumbbell, "Workout Studio", "Tempo · repos · surcharge", "#c6b48b"], [Apple, "Nutrition Studio", "TDEE · macros · hydratation", "#86aeb8"], [Target, "Phase optimale", "Maintenir · ajuster · consolider", "#dbe4df"]];
  return <div className="mt-5 space-y-2">{studioRows.map(({ icon, title, copy, color }) => { const StudioIcon = icon ?? Activity; return <div key={title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3"><StudioIcon size={16} style={{ color }} /><div><p className="text-[11px] text-white/75">{title}</p><p className="mt-1 text-[9px] text-white/35">{copy}</p></div><ChevronRight size={14} className="ml-auto text-white/25" /></div>; })}</div>;
}

function WorkflowStory() {
  const scope = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const reducedMotion = useReducedMotion();

  useGSAP(() => {
    const section = scope.current;
    if (!section || reducedMotion) return;
    const timeline = gsap.timeline({ scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 1, onUpdate: (self) => setActive(Math.min(5, Math.floor(self.progress * 6.01))) } });
    timeline.to("[data-workflow-orbit]", { rotation: 360, duration: 6, ease: "none" }, 0).to("[data-workflow-progress]", { width: "100%", duration: 6, ease: "none" }, 0).fromTo("[data-workflow-panel]", { y: 26, scale: 0.98 }, { y: 0, scale: 1, duration: 6, ease: "none" }, 0);
  }, { scope, dependencies: [reducedMotion], revertOnUpdate: true });

  return <section ref={scope} id="workflow" className="relative h-[420vh] border-y border-white/10 bg-[#0d0d0d]"><div className="sticky top-0 flex min-h-screen items-center overflow-hidden py-20"><div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-20"><div className="flex flex-col justify-center"><p className="mb-5 font-barlow-condensed text-[12px] uppercase tracking-[0.22em] text-[#c6b48b]">Le workflow coach</p><h2 className="max-w-[520px] font-barlow text-5xl font-semibold uppercase leading-[.88] tracking-[-.045em] sm:text-7xl">De la première fiche<br /><span className="text-white/30">à la prochaine décision.</span></h2><div className="mt-10 hidden space-y-7 lg:block">{steps.map((step, index) => <motion.div key={step.number} animate={{ opacity: active === index ? 1 : .28, x: active === index && !reducedMotion ? 8 : 0 }} transition={{ duration: reducedMotion ? 0 : .3 }} className="flex gap-4"><span className="font-mono text-[10px] text-[#c6b48b]">{step.number}</span><div><p className="font-barlow-condensed text-[18px] uppercase tracking-[.1em] text-white">{step.label}</p><p className="mt-1 max-w-[330px] text-sm leading-6 text-white/45">{step.copy}</p></div></motion.div>)}</div><div className="mt-8 flex gap-2 lg:hidden">{steps.map((step, index) => <button key={step.number} type="button" onClick={() => setActive(index)} aria-label={`Étape ${step.number} : ${step.label}`} className={`h-2 flex-1 rounded-full ${active === index ? "bg-[#c6b48b]" : "bg-white/15"}`} />)}</div></div><WorkflowPanel active={active} reducedMotion={Boolean(reducedMotion)} /></div></div></section>;
}

function CoachProblem() {
  const fragments = ["Excel", "WhatsApp", "Google Forms", "App training", "Journal alimentaire", "Notes perso"];
  return <section className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 sm:py-32"><div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24"><div><p className="mb-5 font-barlow-condensed text-[12px] uppercase tracking-[.22em] text-[#c6b48b]">Le problème n’est pas ton expertise</p><h2 className="font-barlow text-5xl font-semibold uppercase leading-[.88] tracking-[-.045em] sm:text-7xl">C’est tout ce qui<br /><span className="text-white/30">lui vole du temps.</span></h2></div><div><p className="max-w-[560px] text-lg leading-8 text-white/55">Quand le suivi est dispersé, le coach passe plus de temps à chercher la bonne information qu’à décider. STRYV lab rassemble le contexte, le signal et l’action au même endroit.</p><div className="mt-10 flex flex-wrap gap-2">{fragments.map((item, i) => <div key={item} className={`rounded-2xl border px-4 py-3 text-[11px] uppercase tracking-[.12em] ${i % 3 === 0 ? "border-[#c6b48b]/30 bg-[#c6b48b]/10 text-[#c6b48b]" : "border-white/10 bg-white/[.04] text-white/45"}`}>{item}</div>)}</div><div className="mt-9 flex items-center gap-3 text-sm text-white/60"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c6b48b]/20 text-[#c6b48b]"><Zap size={13} /></span> Une seule fiche. Une seule boucle. Une meilleure lecture.</div></div></div></section>;
}

function UniverseSection() {
  return <section id="studios" className="border-y border-white/10 bg-[#151918] px-5 py-24 sm:px-8 sm:py-32"><div className="mx-auto max-w-[1240px]"><div className="mb-14 max-w-[650px]"><p className="mb-5 font-barlow-condensed text-[12px] uppercase tracking-[.22em] text-[#86aeb8]">Trois univers. Une même donnée.</p><h2 className="font-barlow text-5xl font-semibold uppercase leading-[.88] tracking-[-.045em] sm:text-7xl">Prescrire.<br /><span className="text-white/30">Calculer. Décider.</span></h2></div><div className="grid gap-3 lg:grid-cols-[1.12fr_.88fr]"><Surface className="relative overflow-hidden bg-[linear-gradient(145deg,rgba(47,63,55,.96),rgba(166,146,112,.88)_52%,rgba(86,127,149,.94))] p-6 text-[#101514] sm:p-8"><div className="absolute right-[-8%] top-[-12%] h-80 w-80 rounded-full border border-[#101514]/15" /><div className="relative z-10 flex h-full min-h-[340px] flex-col justify-between"><div className="flex items-center justify-between"><Dumbbell size={22} /><span className="font-barlow-condensed text-[11px] uppercase tracking-[.18em] text-[#101514]/60">01 / Studio</span></div><div><h3 className="font-barlow text-4xl font-semibold uppercase leading-[.9] tracking-[-.04em]">Workout<br />Studio</h3><p className="mt-4 max-w-[400px] text-sm leading-6 text-[#101514]/70">Du template à la séance réelle : exercices, séries, charge, tempo, repos, RIR et lecture de performance dans le même espace.</p><Link href="/auth/login" className="mt-7 inline-flex items-center gap-2 font-barlow-condensed text-[13px] uppercase tracking-[.15em] text-[#101514] hover:text-white">Voir l’espace coach <ArrowRight size={15} /></Link></div></div></Surface><div className="grid gap-3"><Surface className="p-6 sm:p-8"><div className="flex min-h-[160px] flex-col justify-between"><div className="flex items-center justify-between"><Apple size={22} className="text-[#86aeb8]" /><span className="font-barlow-condensed text-[11px] uppercase tracking-[.18em] text-white/35">02 / Studio</span></div><div><h3 className="font-barlow text-3xl font-semibold uppercase tracking-[-.04em]">Nutrition Studio</h3><p className="mt-3 text-sm leading-6 text-white/45">TDEE, macros, hydratation, CycleSync, cohérence et planification au service d’une prescription tenable.</p></div></div></Surface><Surface className="p-6 sm:p-8"><div className="flex min-h-[160px] flex-col justify-between"><div className="flex items-center justify-between"><Target size={22} className="text-[#c6b48b]" /><span className="font-barlow-condensed text-[11px] uppercase tracking-[.18em] text-white/35">03 / Décision</span></div><div><h3 className="font-barlow text-3xl font-semibold uppercase tracking-[-.04em]">Transformation</h3><p className="mt-3 text-sm leading-6 text-white/45">Score, dimensions, confiance, phase optimale et direction recommandée pour savoir quoi faire maintenant.</p></div></div></Surface></div></div></div></section>;
}

function ClientMirror() {
  return <section id="stryvr" className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 sm:py-32"><div className="grid items-center gap-14 lg:grid-cols-[.95fr_1.05fr] lg:gap-24"><div className="relative mx-auto w-full max-w-[340px]"><div className="absolute -inset-12 rounded-full bg-[#86aeb8]/15 blur-[80px]" /><div className="relative rounded-[38px] border-[7px] border-[#292d2c] bg-[#0b0e0d] p-2 shadow-[0_30px_70px_rgba(0,0,0,.5)]"><div className="overflow-hidden rounded-[28px] bg-[#111514] px-4 pb-5 pt-7"><div className="flex items-center justify-between border-b border-white/10 pb-3"><div className="flex items-center gap-2"><StryvrMark size={18} /><span className="text-[9px] font-bold tracking-[.2em]">STRYVR</span></div><span className="text-[9px] text-white/35">08:42</span></div><div className="mt-5 flex items-end justify-between"><div><p className="text-[9px] uppercase tracking-[.16em] text-[#c6b48b]">Bonjour Thomas</p><p className="mt-1 text-xl font-medium tracking-[-.05em]">Aujourd’hui</p></div><span className="rounded-xl bg-[#c6b48b]/15 p-2 text-[#c6b48b]"><Sparkles size={16} /></span></div><div className="mt-5 rounded-2xl bg-[#1a211d] p-4"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.12em] text-white/40">Balance énergétique</span><span className="text-[9px] text-[#86aeb8]">Dans la cible</span></div><p className="mt-4 font-barlow text-4xl font-semibold tracking-[-.06em]">2 180 <span className="text-[10px] font-normal text-white/35">kcal moy.</span></p><div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-[78%] rounded-full bg-[#86aeb8]" /></div></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white/[.05] p-3"><p className="text-[9px] text-white/35">Pas moyens</p><p className="mt-2 text-lg">8 240</p><p className="mt-1 text-[9px] text-[#86aeb8]">82% de l’objectif</p></div><div className="rounded-xl bg-white/[.05] p-3"><p className="text-[9px] text-white/35">Volume 7j</p><p className="mt-2 text-lg">18,4k</p><p className="mt-1 text-[9px] text-white/35">kg déplacés</p></div></div><div className="mt-3 rounded-2xl bg-white/[.05] p-4"><div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.12em] text-white/35">Séance du jour</span><span className="text-[9px] text-[#c6b48b]">18:00</span></div><p className="mt-2 text-sm">Bas du corps · adaptée</p><button className="mt-3 flex h-9 w-full items-center justify-center rounded-xl bg-[#f2f2f2] text-[9px] font-bold uppercase tracking-[.12em] text-[#101514]">Commencer</button></div></div></div></div><div><p className="mb-5 font-barlow-condensed text-[12px] uppercase tracking-[.22em] text-[#86aeb8]">Le miroir client</p><h2 className="font-barlow text-5xl font-semibold uppercase leading-[.88] tracking-[-.045em] sm:text-7xl">Ton travail.<br /><span className="text-white/30">Sa journée.</span></h2><p className="mt-7 max-w-[500px] text-lg leading-8 text-white/55">STRYVR transforme ta prescription en une expérience mobile claire. Le client sait quoi faire, pourquoi il le fait et où il en est.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{[[Dumbbell, "Séance guidée", "Tempo, repos, charges et alternatives."], [Apple, "Nutrition lisible", "Plan, macros, scan, voix et hydratation."], [ClipboardCheck, "Check-ins", "Les bons signaux, sans friction."], [Sparkles, "Récompenses", "Points, niveaux, boutique coach."]].map(([icon, title, copy]) => { const ItemIcon = icon ?? Dumbbell; return <div key={title as string} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><ItemIcon size={17} className="text-[#c6b48b]" /><p className="mt-5 text-sm font-medium text-white/75">{title as string}</p><p className="mt-1 text-[12px] leading-5 text-white/40">{copy as string}</p></div>; })}</div></div></div></section>;
}

function BridgeSection() {
  return <section className="border-y border-white/10 bg-[#101413] px-5 py-20 sm:px-8 sm:py-24"><div className="mx-auto grid max-w-[1240px] items-center gap-8 lg:grid-cols-[1fr_auto]"><div><p className="mb-4 font-barlow-condensed text-[12px] uppercase tracking-[.22em] text-[#c6b48b]">Une boucle, pas une suite d’outils</p><h2 className="max-w-[720px] font-barlow text-4xl font-semibold uppercase leading-[.9] tracking-[-.045em] sm:text-6xl">Chaque donnée revient<br /><span className="text-white/30">servir ta prochaine décision.</span></h2><p className="mt-5 max-w-[620px] text-base leading-7 text-white/48">Tu prescris dans STRYV lab. Ton client agit dans STRYVR. Les données remontent, les signaux s’éclairent et ton accompagnement devient plus précis à chaque cycle.</p></div><div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><CTA href="#studios" tone="outline">Explorer les studios</CTA><CTA href="/auth/login" tone="light">Créer mon espace coach</CTA></div></div></section>;
}

function App() {
  const [menu, setMenu] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => { trackPageView({ source: "main-landing", pagePath: "/", featureKey: "landing_page" }); }, []);
  return <main className="min-h-screen overflow-x-hidden bg-[#0d0d0d] text-white selection:bg-[#c6b48b] selection:text-[#0d0d0d]"><AnalyticsConsentBanner source="main-landing" pagePath="/" featureKey="landing_page" /><nav className="fixed left-3 right-3 top-3 z-50 rounded-2xl border border-white/15 bg-[#0d0d0d]/80 px-4 shadow-[0_14px_40px_rgba(0,0,0,.25)] backdrop-blur-xl sm:left-6 sm:right-6 sm:top-5 sm:px-5"><div className="mx-auto flex h-12 max-w-[1240px] items-center justify-between"><Brand compact /><div className="hidden items-center gap-7 font-barlow-condensed text-[12px] uppercase tracking-[.15em] text-white/45 md:flex"><a href="#workflow" className="hover:text-white">Workflow</a><a href="#studios" className="hover:text-white">Les studios</a><a href="#stryvr" className="hover:text-white">STRYVR</a></div><div className="hidden items-center gap-4 md:flex"><Link href="/auth/login" className="font-barlow-condensed text-[12px] uppercase tracking-[.15em] text-white/45 hover:text-white">Se connecter</Link><CTA href="/auth/login" tone="light">Créer mon espace coach</CTA></div><button type="button" aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setMenu(!menu)} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 md:hidden">{menu ? <X size={18} /> : <Menu size={18} />}</button></div>{menu && <div className="border-t border-white/10 py-5 md:hidden"><div className="flex flex-col gap-4 font-barlow-condensed text-[14px] uppercase tracking-[.15em] text-white/65"><a href="#workflow" onClick={() => setMenu(false)}>Workflow coach</a><a href="#studios" onClick={() => setMenu(false)}>Les studios</a><a href="#stryvr" onClick={() => setMenu(false)}>STRYVR client</a><Link href="/auth/login" className="text-[#c6b48b]">Ouvrir mon espace →</Link></div></div>}</nav><section className="relative mx-auto grid min-h-[820px] max-w-[1360px] items-center gap-12 px-5 pb-20 pt-32 sm:px-8 sm:pt-40 lg:grid-cols-[.8fr_1.2fr] lg:px-10"><div className="relative z-10 lg:pl-6"><motion.p initial="hidden" animate="visible" variants={reveal} custom={0} className="mb-6 font-barlow-condensed text-[12px] uppercase tracking-[.22em] text-[#c6b48b]">STRYV lab / operating system pour coachs</motion.p><motion.h1 initial="hidden" animate="visible" variants={reveal} custom={.08} className="max-w-[650px] font-barlow text-[4.2rem] font-semibold uppercase leading-[.82] tracking-[-.055em] sm:text-[6.5rem] lg:text-[7.6rem]">Votre méthode.<br /><span className="text-white/30">En système.</span></motion.h1><motion.p initial="hidden" animate="visible" variants={reveal} custom={.18} className="mt-8 max-w-[500px] text-[16px] leading-7 text-white/58 sm:text-[17px]">De la première fiche client à la prochaine décision coach, STRYV lab relie profils, bilans, données, prescriptions et expérience mobile dans une seule boucle.</motion.p><motion.div initial="hidden" animate="visible" variants={reveal} custom={.28} className="mt-9 flex flex-col gap-3 sm:flex-row"><CTA href="/auth/login" tone="light">Créer mon espace coach</CTA><a href="#workflow" className="group inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/20 px-5 font-barlow-condensed text-[13px] uppercase tracking-[.15em] text-white/65 hover:border-white/50 hover:text-white">Voir le workflow <ArrowDown size={16} className="transition-transform group-hover:translate-y-1" /></a></motion.div><motion.div initial="hidden" animate="visible" variants={reveal} custom={.38} className="mt-12 flex flex-wrap gap-x-5 gap-y-3 text-[10px] uppercase tracking-[.14em] text-white/35"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#c6b48b]" /> Profils contextualisés</span><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#86aeb8]" /> Données connectées</span><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#dbe4df]" /> Décisions lisibles</span></motion.div></div><motion.div initial={reducedMotion ? false : { opacity: 0, x: 30, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ duration: 1, delay: .18, ease: [0.16, 1, 0.3, 1] }}><HeroDashboard /></motion.div></section><div className="border-y border-white/10 bg-[#151918]"><div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-5 font-barlow-condensed text-[13px] uppercase tracking-[.18em] text-white/40 sm:justify-between sm:px-8"><span>Profil</span><MoveRight size={15} className="text-[#c6b48b]" /><span>Invitation</span><MoveRight size={15} className="text-[#86aeb8]" /><span>Bilans</span><MoveRight size={15} className="text-[#dbe4df]" /><span>Métriques</span><MoveRight size={15} className="text-[#c6b48b]" /><span className="text-white">Décision coach</span></div></div><CoachProblem /><WorkflowStory /><BridgeSection /><UniverseSection /><ClientMirror /><section className="bg-[#c6b48b] px-5 py-20 text-[#101514] sm:px-8 sm:py-28"><div className="mx-auto flex max-w-[1080px] flex-col items-start justify-between gap-9 sm:flex-row sm:items-end"><div><p className="mb-5 font-barlow-condensed text-[12px] uppercase tracking-[.22em] text-[#101514]/60">Le prochain client commence ici</p><h2 className="font-barlow text-5xl font-semibold uppercase leading-[.86] tracking-[-.045em] sm:text-7xl">Votre expertise.<br /><span className="text-white/75">Une vraie continuité.</span></h2></div><CTA href="/auth/login" tone="dark">Ouvrir mon espace coach</CTA></div></section><footer className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 font-barlow-condensed text-[12px] uppercase tracking-[.16em] text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Brand compact /><div className="flex flex-wrap gap-5"><Link href="/auth/login" className="hover:text-white">Espace coach</Link><Link href="/stryvr" className="hover:text-white">STRYVR</Link><Link href="/confidentialite" className="hover:text-white">Confidentialité</Link><Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link></div><span>© {new Date().getFullYear()} STRYV lab</span></footer></main>;
}

export default App;
