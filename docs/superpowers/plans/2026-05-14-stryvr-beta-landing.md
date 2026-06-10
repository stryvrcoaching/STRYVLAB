# STRYVR Beta Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer une landing page premium light-mode pour la bêta STRYVR à la route `/stryvr`, avec formulaire prénom+email stocké dans Supabase `beta_waitlist`, ciblant les clients finaux en Belgique et France.

**Architecture:** Server Component (`/app/stryvr/page.tsx`) qui fetch le compteur bêta + Server Action (`/app/stryvr/actions.ts`) pour l'insert Supabase. Un seul Client Component `BetaLandingClient` gère le formulaire et les animations Framer Motion. Style light-mode premium sur fond `#FAFAFA`, font Urbanist (Google Fonts), accent vert `#1F8A65`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, Framer Motion, Supabase (Server Action via `@supabase/ssr`), `next/font/google` pour Urbanist.

---

## File Map

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `app/stryvr/page.tsx` | Créer | Server Component — fetch compteur + render layout |
| `app/stryvr/actions.ts` | Créer | Server Action — insert beta_waitlist + validation |
| `app/stryvr/components/BetaLandingClient.tsx` | Créer | Client Component — animations, form state, submit |
| `app/stryvr/components/AppMockup.tsx` | Créer | Mockup iPhone stylisé en CSS (perspective 3D) |
| `app/stryvr/components/BetaForm.tsx` | Créer | Form prénom+email+CTA, réutilisable (hero + repeat) |
| `supabase/migrations/20260514_beta_waitlist.sql` | Créer | Migration table + RLS |

---

## Task 1 — Migration Supabase `beta_waitlist`

**Files:**
- Create: `supabase/migrations/20260514_beta_waitlist.sql`

- [ ] **Step 1 : Créer le fichier de migration**

```sql
-- supabase/migrations/20260514_beta_waitlist.sql

CREATE TABLE IF NOT EXISTS beta_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'stryvr-landing'
);

CREATE UNIQUE INDEX IF NOT EXISTS beta_waitlist_email_idx ON beta_waitlist (lower(email));

ALTER TABLE beta_waitlist ENABLE ROW LEVEL SECURITY;

-- Insert public (anon peut s'inscrire)
CREATE POLICY "beta_waitlist_insert_anon"
  ON beta_waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

-- Select uniquement authenticated (coaches/admin)
CREATE POLICY "beta_waitlist_select_authenticated"
  ON beta_waitlist FOR SELECT
  TO authenticated
  USING (true);
```

- [ ] **Step 2 : Appliquer la migration via Supabase Dashboard**

Ouvrir Supabase Dashboard → SQL Editor → coller et exécuter le contenu du fichier.

Vérifier : `SELECT COUNT(*) FROM beta_waitlist;` retourne `0` sans erreur.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260514_beta_waitlist.sql
git commit -m "feat(stryvr): add beta_waitlist table with RLS"
```

---

## Task 2 — Server Action `actions.ts`

**Files:**
- Create: `app/stryvr/actions.ts`

- [ ] **Step 1 : Créer le Server Action**

```typescript
// app/stryvr/actions.ts
'use server';

import { createClient } from '@/utils/supabase/server';

export type WaitlistResult =
  | { success: true; alreadyExists: false }
  | { success: true; alreadyExists: true }
  | { success: false; error: string };

export async function joinWaitlist(formData: FormData): Promise<WaitlistResult> {
  const firstName = (formData.get('first_name') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';

  if (!firstName || firstName.length < 2) {
    return { success: false, error: 'Prénom requis (min. 2 caractères).' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Adresse email invalide.' };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('beta_waitlist')
    .insert({ first_name: firstName, email, source: 'stryvr-landing' });

  if (error) {
    // Unique constraint violation → déjà inscrit
    if (error.code === '23505') {
      return { success: true, alreadyExists: true };
    }
    console.error('[joinWaitlist] Supabase error:', error);
    return { success: false, error: 'Erreur lors de l\'inscription. Réessaie.' };
  }

  return { success: true, alreadyExists: false };
}

export async function getBetaCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('beta_waitlist')
    .select('*', { count: 'exact', head: true });
  // Arrondi à la dizaine inférieure, minimum 0
  const raw = count ?? 0;
  return Math.floor(raw / 10) * 10;
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add app/stryvr/actions.ts
git commit -m "feat(stryvr): add joinWaitlist and getBetaCount server actions"
```

---

## Task 3 — Mockup iPhone `AppMockup.tsx`

**Files:**
- Create: `app/stryvr/components/AppMockup.tsx`

- [ ] **Step 1 : Créer le composant mockup**

```tsx
// app/stryvr/components/AppMockup.tsx
'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

// UI fictive dark mode représentant l'app STRYVR
function AppScreen() {
  return (
    <div className="w-full h-full bg-[#121212] rounded-[2rem] p-4 flex flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[8px] text-white/40 uppercase tracking-widest">Aujourd'hui</p>
          <p className="text-[13px] font-bold text-white leading-tight">Séance Push · Jour 3</p>
        </div>
        <div className="w-7 h-7 rounded-full bg-[#1F8A65]/20 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-[#1F8A65]" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-white/[0.06]">
        <div className="h-full w-2/3 rounded-full bg-[#1F8A65]" />
      </div>

      {/* Exercise card */}
      <div className="rounded-2xl bg-white/[0.04] p-3 flex flex-col gap-2">
        <p className="text-[9px] text-white/40 uppercase tracking-wider">Exercice 2 / 5</p>
        <p className="text-[12px] font-semibold text-white">Développé couché</p>
        <div className="grid grid-cols-3 gap-1.5">
          {['Série 1', 'Série 2', 'Série 3'].map((s, i) => (
            <div key={s} className={`rounded-lg p-2 text-center ${i < 2 ? 'bg-[#1F8A65]/10' : 'bg-white/[0.04]'}`}>
              <p className="text-[8px] text-white/40">{s}</p>
              <p className={`text-[11px] font-bold ${i < 2 ? 'text-[#1F8A65]' : 'text-white/30'}`}>
                {i < 2 ? `${80 + i * 2.5}kg` : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.04] p-2.5">
          <p className="text-[7px] text-white/35 uppercase tracking-wider mb-0.5">Charge</p>
          <p className="text-[14px] font-black text-white">82.5<span className="text-[9px] font-normal text-white/40 ml-0.5">kg</span></p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-2.5">
          <p className="text-[7px] text-white/35 uppercase tracking-wider mb-0.5">RIR estimé</p>
          <p className="text-[14px] font-black text-[#1F8A65]">2</p>
        </div>
      </div>

      {/* CTA button */}
      <div className="mt-auto rounded-xl bg-[#1F8A65] py-2.5 flex items-center justify-center gap-2">
        <p className="text-[10px] font-bold text-white uppercase tracking-widest">Valider la série</p>
      </div>
    </div>
  );
}

export function AppMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [20, -20]);

  return (
    <motion.div ref={ref} style={{ y }} className="relative flex items-center justify-center select-none">
      {/* Glow */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[3rem] blur-3xl opacity-20"
        style={{ background: 'radial-gradient(ellipse at center, #1F8A65 0%, transparent 70%)' }}
      />

      {/* iPhone frame */}
      <div
        className="relative w-[220px] h-[440px] rounded-[3rem] bg-[#0A0A0A] p-[10px]"
        style={{
          transform: 'perspective(1000px) rotateY(-8deg) rotateX(4deg)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        {/* Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#0A0A0A] rounded-full z-10" />
        {/* Screen */}
        <div className="w-full h-full rounded-[2.25rem] overflow-hidden">
          <AppScreen />
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add app/stryvr/components/AppMockup.tsx
git commit -m "feat(stryvr): add AppMockup component with parallax scroll"
```

---

## Task 4 — Formulaire `BetaForm.tsx`

**Files:**
- Create: `app/stryvr/components/BetaForm.tsx`

- [ ] **Step 1 : Créer le composant formulaire**

```tsx
// app/stryvr/components/BetaForm.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useTransition } from 'react';
import { joinWaitlist, WaitlistResult } from '../actions';

type FormState =
  | { type: 'idle' }
  | { type: 'success'; firstName: string; alreadyExists: boolean }
  | { type: 'error'; message: string };

export function BetaForm() {
  const [state, setState] = useState<FormState>({ type: 'idle' });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const firstName = (formData.get('first_name') as string)?.trim() ?? '';

    startTransition(async () => {
      const result: WaitlistResult = await joinWaitlist(formData);
      if (result.success) {
        setState({ type: 'success', firstName, alreadyExists: result.alreadyExists });
      } else {
        setState({ type: 'error', message: result.error });
      }
    });
  }

  if (state.type === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl bg-[#1F8A65]/[0.08] border border-[#1F8A65]/20 p-6 text-center"
      >
        <div className="w-10 h-10 rounded-full bg-[#1F8A65]/10 flex items-center justify-center mx-auto mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F8A65" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-[15px] font-bold text-[#0A0A0A] mb-1">
          {state.alreadyExists
            ? `Tu es déjà sur la liste ✓`
            : `Bienvenue ${state.firstName} !`}
        </p>
        <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
          {state.alreadyExists
            ? 'On t\'a déjà enregistré. Tu seras parmi les premiers contactés.'
            : 'Tu es sur la liste. On te contacte en premier pour le lancement bêta.'}
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          name="first_name"
          type="text"
          required
          minLength={2}
          placeholder="Ton prénom"
          className="flex-1 h-[52px] rounded-xl bg-white border border-[#E8E8E8] px-4 text-[14px] font-medium text-[#0A0A0A] placeholder:text-[#A0A0A0] outline-none focus:border-[#1F8A65] transition-colors"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Ton email"
          className="flex-1 h-[52px] rounded-xl bg-white border border-[#E8E8E8] px-4 text-[14px] font-medium text-[#0A0A0A] placeholder:text-[#A0A0A0] outline-none focus:border-[#1F8A65] transition-colors"
        />
      </div>

      <AnimatePresence>
        {state.type === 'error' && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[12px] text-red-500 font-medium px-1"
          >
            {state.message}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={isPending}
        className="h-[52px] w-full rounded-xl bg-[#1F8A65] flex items-center justify-between pl-5 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-60"
      >
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white">
          {isPending ? 'Inscription...' : 'Rejoindre la liste bêta'}
        </span>
        <div className="w-[42px] h-[42px] rounded-lg bg-black/[0.12] flex items-center justify-center">
          {isPending ? (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.2" />
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </button>

      <p className="text-center text-[11px] text-[#A0A0A0]">
        Zéro spam. Désabonnement en 1 clic.
      </p>
    </form>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 3 : Commit**

```bash
git add app/stryvr/components/BetaForm.tsx
git commit -m "feat(stryvr): add BetaForm component with server action integration"
```

---

## Task 5 — Page principale `page.tsx`

**Files:**
- Create: `app/stryvr/page.tsx`
- Create: `app/stryvr/components/BetaLandingClient.tsx`

- [ ] **Step 1 : Créer `BetaLandingClient.tsx`**

Ce composant gère les animations d'entrée et assemble les sections.

```tsx
// app/stryvr/components/BetaLandingClient.tsx
'use client';

import { motion } from 'framer-motion';
import { AppMockup } from './AppMockup';
import { BetaForm } from './BetaForm';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] },
  }),
};

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
    title: 'Programme adapté en temps réel',
    desc: 'Chaque séance évolue selon tes données, tes performances et ton énergie du jour.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: '5 min/jour, zéro friction',
    desc: 'Un log de séance pensé pour aller vite. Ton coach voit tout, tu ne fais rien de plus.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    title: 'Ton coach dans ta poche',
    desc: 'Protocoles entraînement + nutrition personnalisés. Tout au même endroit, toujours à jour.',
  },
];

const STATS = [
  { value: '95%', label: 'abandonnent en 12 semaines', sub: 'L\'industrie actuelle' },
  { value: '5 min', label: 'par jour suffisent', sub: 'Pour des vrais résultats' },
  { value: '0', label: 'config technique', sub: 'Ton coach s\'occupe de tout' },
];

type Props = { betaCount: number };

export function BetaLandingClient({ betaCount }: Props) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A]">
      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 bg-[#FAFAFA]/90 backdrop-blur-md border-b border-[#E8E8E8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-[17px] tracking-tight text-[#0A0A0A]" style={{ fontFamily: 'var(--font-urbanist, sans-serif)' }}>
              STRYVR
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#1F8A65]/10 text-[10px] font-bold text-[#1F8A65] uppercase tracking-widest">
              Bêta
            </span>
          </div>
          <a
            href="#waitlist"
            className="hidden sm:flex h-9 px-4 rounded-xl bg-[#0A0A0A] items-center text-[12px] font-bold text-white uppercase tracking-[0.1em] hover:bg-[#1F8A65] transition-colors"
          >
            Rejoindre la bêta
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center" id="waitlist">
        {/* Left */}
        <div>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-[#1F8A65]/[0.08] border border-[#1F8A65]/20"
          >
            <span className="text-[11px] font-semibold text-[#1F8A65]">🇧🇪 Belgique · 🇫🇷 France</span>
            <span className="w-px h-3 bg-[#1F8A65]/30" />
            <span className="text-[11px] font-semibold text-[#1F8A65]">Places bêta limitées</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-[3.5rem] sm:text-[4.5rem] lg:text-[5rem] font-extrabold leading-[1.0] tracking-[-0.03em] text-[#0A0A0A] mb-6"
            style={{ fontFamily: 'var(--font-urbanist, sans-serif)' }}
          >
            95% abandonnent.
            <br />
            <span className="text-[#1F8A65]">Pas toi.</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-[15px] text-[#6B6B6B] leading-[1.7] max-w-[420px] mb-8"
          >
            STRYVR adapte ton programme en temps réel selon tes données. Coaching ultra-personnalisé, 5 min par jour — sans friction, sans excuses.
          </motion.p>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
            <BetaForm />
          </motion.div>

          {betaCount > 0 && (
            <motion.p
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={4}
              className="mt-4 text-[12px] text-[#A0A0A0] font-medium"
            >
              <span className="text-[#0A0A0A] font-bold">{betaCount}+</span> personnes déjà sur la liste
            </motion.p>
          )}
        </div>

        {/* Right — Mockup */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <AppMockup />
        </motion.div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-[#F0F0F0] border-y border-[#E8E8E8] py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {STATS.map((s, i) => (
            <motion.div
              key={s.value}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <p
                className="text-[3.5rem] font-extrabold text-[#0A0A0A] leading-none mb-1"
                style={{ fontFamily: 'var(--font-urbanist, sans-serif)' }}
              >
                {s.value}
              </p>
              <p className="text-[13px] font-semibold text-[#0A0A0A] mb-0.5">{s.label}</p>
              <p className="text-[11px] text-[#A0A0A0]">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#A0A0A0] text-center mb-3"
        >
          Pourquoi STRYVR
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-[2rem] sm:text-[2.5rem] font-extrabold text-center text-[#0A0A0A] mb-12 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-urbanist, sans-serif)' }}
        >
          L'app qui s'adapte à toi,<br className="hidden sm:block" /> pas l'inverse.
        </motion.h2>

        <div className="grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="rounded-2xl bg-white border border-[#E8E8E8] p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-[#1F8A65]/[0.08] text-[#1F8A65] flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <p className="text-[14px] font-bold text-[#0A0A0A] mb-2 leading-snug">{f.title}</p>
              <p className="text-[12px] text-[#6B6B6B] leading-[1.65]">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── REPEAT FORM ── */}
      <section className="bg-[#0A0A0A] py-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#1F8A65] mb-4"
          >
            Tu es encore là ? C'est bon signe.
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[2rem] font-extrabold text-white mb-3 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-urbanist, sans-serif)' }}
          >
            Rejoins la liste bêta.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[13px] text-white/50 mb-8"
          >
            Lancement Belgique & France. Places limitées.
          </motion.p>

          {/* Dark form override */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="[&_input]:!bg-white/[0.06] [&_input]:!border-white/[0.1] [&_input]:!text-white [&_input]:!placeholder-white/30 [&_input:focus]:!border-[#1F8A65]"
          >
            <BetaForm />
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0A0A0A] border-t border-white/[0.06] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[14px] text-white" style={{ fontFamily: 'var(--font-urbanist, sans-serif)' }}>
              STRYVR
            </span>
            <span className="text-white/20">·</span>
            <span className="text-[11px] text-white/30">by STRYVLAB</span>
          </div>
          <p className="text-[11px] text-white/30">🇧🇪 Belgique · 🇫🇷 France · © 2026</p>
          <a href="/mentions-legales" className="text-[11px] text-white/30 hover:text-white/60 transition-colors">
            Mentions légales
          </a>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `app/stryvr/page.tsx`**

```tsx
// app/stryvr/page.tsx
import type { Metadata } from 'next';
import { getBetaCount } from './actions';
import { BetaLandingClient } from './components/BetaLandingClient';
import { Urbanist } from 'next/font/google';

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'STRYVR — Bêta · Coaching ultra-personnalisé',
  description:
    'STRYVR adapte ton programme en temps réel. Rejoins la liste bêta pour le lancement en Belgique et France. Places limitées.',
  openGraph: {
    title: 'STRYVR — Bêta',
    description: '95% abandonnent. Pas toi. Rejoins la liste bêta STRYVR.',
    siteName: 'STRYVR',
  },
};

export default async function StryvrLandingPage() {
  const betaCount = await getBetaCount();

  return (
    <div className={urbanist.variable}>
      <BetaLandingClient betaCount={betaCount} />
    </div>
  );
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit
```

Expected: 0 erreurs.

- [ ] **Step 4 : Lancer le dev server et vérifier la page**

```bash
cd /Users/user/Desktop/STRYVLAB && npm run dev
```

Ouvrir `http://localhost:3000/stryvr` et vérifier :
- Hero avec headline "95% abandonnent. Pas toi."
- Formulaire prénom + email fonctionnel
- Mockup iPhone visible en perspective
- Stats bar visible
- Features 3 cards
- Repeat form section dark
- Footer

- [ ] **Step 5 : Tester la soumission du formulaire**

Soumettre le formulaire avec un prénom et email test.
Vérifier dans Supabase Dashboard → Table `beta_waitlist` → la ligne est insérée.
Soumettre à nouveau avec le même email → message "Tu es déjà sur la liste ✓".

- [ ] **Step 6 : Commit**

```bash
git add app/stryvr/
git commit -m "feat(stryvr): add beta landing page with waitlist form"
```

---

## Task 6 — CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1 : Ajouter l'entrée CHANGELOG**

Ouvrir `CHANGELOG.md`, trouver ou créer la section `## 2026-05-14`, ajouter en tête :

```
## 2026-05-14

FEATURE: Add STRYVR beta landing page at /stryvr with waitlist form
FEATURE: Add beta_waitlist Supabase table with RLS and server action
```

- [ ] **Step 2 : Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for STRYVR beta landing"
```

---

## Vérifications finales

- [ ] `npx tsc --noEmit` → 0 erreurs
- [ ] Route `/stryvr` accessible et rendue correctement sur mobile et desktop
- [ ] Formulaire insère bien dans `beta_waitlist`
- [ ] Dedup email fonctionne
- [ ] Compteur social s'affiche si > 0 inscrits
- [ ] Mockup iPhone visible avec perspective CSS
- [ ] Animations Framer Motion fluides
- [ ] Footer liens fonctionnels
