"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import LiquidGlassEffect from "./LiquidGlassEffect";

const CAL_URL = "https://cal.com/stryvlab/demo-stryvlab";

const productStories = [
  {
    index: "01",
    eyebrow: "Workout Studio",
    title: "La programmation devient un raisonnement visible.",
    body: "Construisez le programme, contrôlez le volume et gardez les recommandations Smart Fit dans le même espace de décision.",
    image: "/landing-demo/workout-studio-builder-desktop.png",
    alt: "Workout Studio STRYV lab avec programme, volume et recommandations Smart Fit",
    points: ["Construction structurée", "Volume lisible", "Recommandations contextualisées"],
    accent: "#c6b48b",
  },
  {
    index: "02",
    eyebrow: "Nutrition Studio",
    title: "Un protocole nutritionnel qui reste connecté au terrain.",
    body: "Planning, repas, macros et hydratation composent un protocole que le coach peut relire et ajuster dans son contexte global.",
    image: "/landing-demo/nutrition-studio-builder-desktop.png",
    alt: "Nutrition Studio STRYV lab avec planning alimentaire, repas et macros",
    points: ["Semaine complète", "Repas et apports", "Cohérence nutritionnelle"],
    accent: "#86aeb8",
  },
  {
    index: "03",
    eyebrow: "Data & performances",
    title: "Les signaux cessent d’être des chiffres isolés.",
    body: "Charge, volume, fatigue et nutrition se lisent ensemble pour éclairer ce qui mérite réellement d’être ajusté.",
    image: "/landing-demo/client-performances-desktop.png",
    alt: "Analyse de performances STRYV lab avec charge, volume, fatigue et recommandations",
    points: ["Tendances croisées", "Contexte de période", "Prochaine action"],
    accent: "#dbe4df",
  },
  {
    index: "04",
    eyebrow: "Morpho Pro",
    title: "La personnalisation commence avant la première série.",
    body: "Morphologie, asymétries et leviers biomécaniques donnent au coach une lecture supplémentaire pour construire sa prescription.",
    image: "/landing-demo/morphopro-desktop.png",
    alt: "Analyse Morpho Pro STRYV lab avec score et lecture biomécanique",
    points: ["Lecture biomécanique", "Asymétries observées", "Points d’attention"],
    accent: "#9d7052",
  },
];

const faqs = [
  ["À qui s’adresse STRYV lab ?", "Aux coachs sportifs en priorité, puis aux préparateurs physiques, coachs nutrition et structures de coaching."],
  ["Que montre la démonstration ?", "Un parcours de 40 minutes dans le dossier client, les studios, les données, les performances et Morpho Pro."],
  ["Pourquoi les prix ne sont-ils pas affichés ?", "Les niveaux Solo, Pro et Studio existent. Le périmètre adapté à votre activité est présenté pendant la démonstration."],
  ["Quelle est la place de STRYVR ?", "STRYV lab organise le travail du coach. STRYVR prolonge ce travail dans l’expérience quotidienne du client."],
];

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "blue" | "light" }) {
  const colors = { gold: "text-[#c6b48b]", blue: "text-[#86aeb8]", light: "text-white/55" };
  return <p className={`font-barlow-condensed text-[11px] font-medium uppercase tracking-[.24em] ${colors[tone]}`}>{children}</p>;
}

function DemoButton({ children = "Réserver une démo de 40 min", inverse = false, compact = false }: { children?: ReactNode; inverse?: boolean; compact?: boolean }) {
  return (
    <a
      href={CAL_URL}
      target="_blank"
      rel="noreferrer"
      className={`group inline-flex items-center justify-center gap-2 rounded-full font-bold uppercase tracking-[.14em] transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6b48b] ${compact ? "min-h-11 px-4 text-[9px]" : "min-h-14 px-6 text-[10px]"} ${inverse ? "bg-[#101514] text-white hover:bg-black" : "bg-[#f2f2ef] text-[#101514] hover:bg-white"}`}
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
    </a>
  );
}

function ProductStory({ story, reverse }: { story: (typeof productStories)[number]; reverse?: boolean }) {
  return (
    <article className="grid items-center gap-10 border-t border-white/10 py-20 lg:grid-cols-[.72fr_1.28fr] lg:gap-16 lg:py-28">
      <Reveal className={reverse ? "lg:order-2" : ""}>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-white/30">{story.index}</span>
          <span className="h-px w-10" style={{ backgroundColor: story.accent }} />
          <Eyebrow tone="light">{story.eyebrow}</Eyebrow>
        </div>
        <h3 className="mt-8 max-w-[580px] font-barlow text-[2.65rem] font-semibold uppercase leading-[.91] tracking-[-.045em] text-white sm:text-6xl">
          {story.title}
        </h3>
        <p className="mt-7 max-w-[520px] text-[15px] leading-7 text-white/55 sm:text-base">{story.body}</p>
        <ul className="mt-8 space-y-3">
          {story.points.map((point) => (
            <li key={point} className="flex items-center gap-3 text-sm text-white/65">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/[.04]">
                <Check className="h-3 w-3" style={{ color: story.accent }} aria-hidden="true" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal className={reverse ? "lg:order-1" : ""} delay={0.08}>
        <div className="group relative overflow-hidden rounded-[28px] border border-white/12 bg-[#111] p-2 shadow-[0_28px_80px_rgba(0,0,0,.38)]">
          <div className="absolute inset-x-12 top-0 h-px opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${story.accent}, transparent)` }} />
          <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-[#0a0a0a]">
            <Image src={story.image} alt={story.alt} fill sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover object-top transition duration-700 group-hover:scale-[1.012]" />
          </div>
        </div>
      </Reveal>
    </article>
  );
}

export default function SaasLanding() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0b0c0c] text-white selection:bg-[#c6b48b]/30">
      <LiquidGlassEffect targetId="hero-liquid-glass" />

      <nav className="fixed left-3 right-3 top-3 z-50 px-3 sm:left-6 sm:right-6 sm:top-5 sm:px-6">
        <div aria-hidden="true" className="absolute inset-0 z-0 rounded-[20px] border border-white/20 bg-[#0b0c0c]/68 shadow-[0_16px_50px_rgba(0,0,0,.32)] backdrop-blur-xl" />
        <div className="relative z-10 mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4">
          <Link href="/" className="shrink-0 font-unbounded text-[12px] font-semibold tracking-[-.08em]">STRYV <span className="font-light text-white/38">lab</span></Link>
          <div className="hidden items-center gap-8 font-barlow-condensed text-[11px] uppercase tracking-[.18em] text-white/45 md:flex">
            <a href="#methode" className="transition hover:text-white">Méthode</a>
            <a href="#plateforme" className="transition hover:text-white">Plateforme</a>
            <a href="#acces" className="transition hover:text-white">Accès</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </div>
          <DemoButton compact><span className="hidden sm:inline">Réserver une démo</span><span className="sm:hidden">Démo</span></DemoButton>
        </div>
      </nav>

      <section className="relative isolate min-h-[940px] overflow-hidden px-5 pb-20 pt-36 sm:px-8 lg:px-10 lg:pt-40">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_76%_22%,rgba(134,174,184,.11),transparent_28%),radial-gradient(circle_at_24%_32%,rgba(198,180,139,.08),transparent_26%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

        <div className="mx-auto grid max-w-[1360px] items-center gap-14 lg:grid-cols-[.82fr_1.18fr]">
          <Reveal>
            <Eyebrow>Plateforme de pilotage pour coachs</Eyebrow>
            <h1 className="mt-7 max-w-[720px] font-barlow text-[3.65rem] font-semibold uppercase leading-[.82] tracking-[-.06em] sm:text-[6.5rem] lg:text-[7.1rem]">
              Votre méthode
              <span className="block text-white/25">mérite un système.</span>
            </h1>
            <p className="mt-8 max-w-[570px] text-[17px] leading-8 text-white/62">
              STRYV lab réunit dossiers clients, prescriptions et données pour que chaque décision reste connectée à ce qui s’est réellement passé.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <DemoButton />
              <a href="#plateforme" className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/18 px-6 text-[10px] font-bold uppercase tracking-[.14em] text-white/65 transition hover:border-white/45 hover:text-white">Explorer la plateforme</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-[12px] text-white/42">
              <span>Démo personnalisée</span><span>40 minutes</span><span>Coach sportif en priorité</span>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="relative lg:translate-y-10">
              <div className="absolute -inset-8 -z-10 rounded-full bg-[#86aeb8]/8 blur-3xl" />
              <div id="hero-liquid-glass" aria-hidden="true" className="absolute -right-6 -top-8 z-0 h-40 w-56 rounded-[42px] border border-white/20 bg-[#dbe4df]/[.055] shadow-[0_25px_70px_rgba(0,0,0,.32)]" />
              <div className="relative z-10 overflow-hidden rounded-[30px] border border-white/15 bg-white/[.035] p-2 shadow-[0_40px_100px_rgba(0,0,0,.52)]">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[23px] bg-[#090909]">
                  <Image src="/landing-demo/dashboard.png" alt="Tableau de bord réel STRYV lab pour coach" fill priority sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover object-top" />
                </div>
              </div>
              <div className="absolute -bottom-5 left-5 z-20 flex items-center gap-3 rounded-full border border-white/15 bg-[#111716]/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:left-8">
                <span className="h-2 w-2 rounded-full bg-[#c6b48b]" />
                <span className="font-barlow-condensed text-[10px] uppercase tracking-[.16em] text-white/65">Une vue. Le contexte complet.</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#111514] px-5 py-6 sm:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-5 font-barlow-condensed text-[11px] uppercase tracking-[.17em] text-white/42 sm:grid-cols-3">
          <div className="flex items-center gap-3"><span className="text-[#c6b48b]">01</span> Produit fonctionnel</div>
          <div className="flex items-center gap-3"><span className="text-[#86aeb8]">02</span> Démonstration sur cas cohérent</div>
          <div className="flex items-center gap-3"><span className="text-[#dbe4df]">03</span> Plateforme coach + expérience client</div>
        </div>
      </section>

      <section id="methode" className="px-5 py-24 sm:px-8 sm:py-36 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <Reveal className="grid gap-10 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
            <div>
              <Eyebrow>Le problème n’est pas votre expertise</Eyebrow>
              <h2 className="mt-6 font-barlow text-5xl font-semibold uppercase leading-[.9] tracking-[-.05em] sm:text-7xl">C’est tout ce qui la disperse.</h2>
            </div>
            <div className="lg:pt-9">
              <p className="max-w-[650px] text-xl leading-9 text-white/55">Un profil dans un formulaire. Une prescription ailleurs. Des messages pour comprendre ce qui s’est passé. Le problème commence entre les outils.</p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-white/10 bg-white/10 lg:grid-cols-2">
            <Reveal className="bg-[#0e0f0f] p-7 sm:p-10">
              <Eyebrow tone="light">Quand le suivi est fragmenté</Eyebrow>
              <ul className="mt-9 space-y-6">
                {["Le contexte se reconstruit à chaque séance", "Les signaux arrivent sans leur histoire", "La prescription et le vécu client se séparent"].map((item) => <li key={item} className="border-b border-white/8 pb-6 text-lg text-white/48">{item}</li>)}
              </ul>
            </Reveal>
            <Reveal className="bg-[#141a18] p-7 sm:p-10" delay={0.08}>
              <Eyebrow tone="gold">Quand la méthode devient un système</Eyebrow>
              <ul className="mt-9 space-y-6">
                {["Chaque décision repart du dossier client", "Les programmes restent reliés aux données", "La prochaine action devient explicite"].map((item) => <li key={item} className="border-b border-white/8 pb-6 text-lg text-white/75">{item}</li>)}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#d6c69f] px-5 py-24 text-[#101514] sm:px-8 sm:py-32 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <Reveal>
            <Eyebrow tone="light">Une boucle de travail continue</Eyebrow>
            <h2 className="mt-6 max-w-[1050px] font-barlow text-5xl font-semibold uppercase leading-[.88] tracking-[-.055em] sm:text-7xl lg:text-8xl">Du premier bilan à la prochaine décision.</h2>
          </Reveal>
          <div className="mt-14 grid gap-3 md:grid-cols-3">
            {[
              ["01", "Comprendre", "Profil, bilans et contexte ouvrent le dossier."],
              ["02", "Prescrire", "Entraînement et nutrition traduisent la méthode."],
              ["03", "Ajuster", "Les données ramènent le réel dans la décision."],
            ].map(([number, title, copy], index) => (
              <Reveal key={number} delay={index * 0.07} className="rounded-[22px] border border-[#101514]/15 bg-[#f1e8d2]/45 p-6 sm:p-8">
                <span className="font-mono text-[10px] text-[#101514]/48">{number}</span>
                <h3 className="mt-12 font-barlow text-3xl font-semibold uppercase">{title}</h3>
                <p className="mt-4 max-w-[320px] text-sm leading-6 text-[#101514]/65">{copy}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="plateforme" className="px-5 py-24 sm:px-8 sm:py-36 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <Reveal className="max-w-[850px]">
            <Eyebrow tone="blue">La plateforme en situation</Eyebrow>
            <h2 className="mt-6 font-barlow text-5xl font-semibold uppercase leading-[.88] tracking-[-.055em] sm:text-7xl lg:text-8xl">Quatre espaces. Une même continuité.</h2>
            <p className="mt-7 max-w-[620px] text-lg leading-8 text-white/52">Chaque vue répond à un moment concret du travail du coach. Les captures ci-dessous proviennent du produit.</p>
          </Reveal>

          <div className="mt-16">
            {productStories.map((story, index) => <ProductStory key={story.index} story={story} reverse={index % 2 === 1} />)}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#111514] px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <Reveal className="grid items-end gap-10 lg:grid-cols-[1fr_.7fr]">
            <div>
              <Eyebrow tone="blue">L’écosystème complet</Eyebrow>
              <h2 className="mt-6 max-w-[850px] font-barlow text-5xl font-semibold uppercase leading-[.88] tracking-[-.05em] sm:text-7xl">STRYV lab pense avec le coach. STRYVR accompagne le client.</h2>
            </div>
            <p className="max-w-[480px] text-base leading-8 text-white/50">La prescription part du coach, vit dans l’expérience client, puis revient enrichie par les données observées.</p>
          </Reveal>
          <div className="mt-14 grid gap-3 md:grid-cols-4">
            {["Dossier client", "Prescription", "Expérience STRYVR", "Décision coach"].map((item, index) => (
              <div key={item} className="flex min-h-28 items-end justify-between rounded-[20px] border border-white/10 bg-white/[.025] p-5">
                <span className="font-barlow-condensed text-sm uppercase tracking-[.1em] text-white/65">{item}</span>
                <span className="text-[#c6b48b]">{index < 3 ? "→" : "↺"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="acces" className="px-5 py-24 sm:px-8 sm:py-36 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <Reveal className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
            <div>
              <Eyebrow>Accès et accompagnement</Eyebrow>
              <h2 className="mt-6 font-barlow text-5xl font-semibold uppercase leading-[.9] tracking-[-.05em] sm:text-7xl">Un niveau adapté à votre manière de coacher.</h2>
            </div>
            <p className="max-w-[570px] text-lg leading-8 text-white/52 lg:pt-9">Les niveaux structurent les capacités de la plateforme. Les détails sont présentés pendant la démo, sans afficher de prix non validés.</p>
          </Reveal>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {[
              ["Solo", "Pour commencer avec un portefeuille resserré.", ["Jusqu’à 5 clients", "Espace coach", "Studios de prescription"]],
              ["Pro", "Pour relier le suivi coach à l’expérience client.", ["Jusqu’à 30 clients", "Accès STRYVR", "Suivi client avancé"]],
              ["Studio", "Pour structurer une organisation de coaching.", ["Capacité étendue", "Fonctionnalités d’équipe", "Organisation multi-coachs"]],
            ].map(([name, copy, features], index) => (
              <Reveal key={name as string} delay={index * 0.06} className={`rounded-[24px] border p-7 sm:p-8 ${index === 1 ? "border-[#c6b48b]/45 bg-[#171914] shadow-[0_25px_70px_rgba(0,0,0,.24)]" : "border-white/10 bg-white/[.025]"}`}>
                <div className="flex items-center justify-between"><h3 className="font-barlow text-3xl font-semibold uppercase">{name as string}</h3>{index === 1 && <span className="rounded-full border border-[#c6b48b]/35 px-3 py-1 font-barlow-condensed text-[9px] uppercase tracking-[.15em] text-[#c6b48b]">Expérience connectée</span>}</div>
                <p className="mt-5 min-h-14 text-sm leading-6 text-white/48">{copy as string}</p>
                <ul className="mt-8 space-y-3">{(features as string[]).map((feature) => <li key={feature} className="flex items-center gap-3 text-sm text-white/65"><Check className="h-3.5 w-3.5 text-[#c6b48b]" aria-hidden="true" />{feature}</li>)}</ul>
                <a href={CAL_URL} target="_blank" rel="noreferrer" className="mt-10 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-white/65 transition hover:text-white">Voir pendant la démo <ArrowUpRight className="h-3.5 w-3.5" /></a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-white/10 px-5 py-24 sm:px-8 sm:py-32 lg:px-10">
        <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[.55fr_1fr] lg:gap-20">
          <Reveal>
            <Eyebrow>Avant la démo</Eyebrow>
            <h2 className="mt-6 font-barlow text-5xl font-semibold uppercase leading-[.9] tracking-[-.05em] sm:text-6xl">Les réponses utiles, sans détour.</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="divide-y divide-white/10 border-y border-white/10">
              {faqs.map(([question, answer]) => (
                <details key={question} className="group py-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-medium text-white marker:hidden sm:text-lg">
                    {question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#c6b48b] transition group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="max-w-[650px] pb-1 pt-4 text-sm leading-7 text-white/50">{answer}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#d6c69f] px-5 py-24 text-[#101514] sm:px-8 sm:py-32 lg:px-10">
        <Reveal className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <div>
            <Eyebrow tone="light">Votre prochain système de travail</Eyebrow>
            <h2 className="mt-6 max-w-[800px] font-barlow text-5xl font-semibold uppercase leading-[.86] tracking-[-.055em] sm:text-7xl lg:text-8xl">Montrez-nous votre méthode. Voyez-la prendre forme.</h2>
            <p className="mt-6 max-w-[540px] text-sm leading-7 text-[#101514]/65">Choisissez un créneau de 40 minutes pour parcourir STRYV lab avec votre contexte.</p>
          </div>
          <DemoButton inverse>Choisir mon créneau</DemoButton>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-[1280px] flex-col gap-6 px-5 py-10 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link href="/" className="font-unbounded text-[12px] tracking-[-.08em] text-white">STRYV <span className="font-light text-white/40">lab</span></Link>
        <div className="flex flex-wrap gap-5"><Link href="/confidentialite" className="transition hover:text-white">Confidentialité</Link><Link href="/mentions-legales" className="transition hover:text-white">Mentions légales</Link><Link href="/stryvr" className="transition hover:text-white">STRYVR</Link></div>
        <span>© {new Date().getFullYear()} STRYV lab</span>
      </footer>
    </main>
  );
}
