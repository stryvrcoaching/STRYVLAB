'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { HeroPhoneStack, AppMockup } from './AppMockup';
import { BetaForm } from './BetaForm';

/* ═══════════════════════════════════════════
   DA TECHNOGYM — tokens STRYVR
   ─────────────────────────────────────────
   Fond     #0a0a0a  — noir pur
   Card     #161616  — surface légèrement élevée
   Muted    #1e1e1e  — hover, inputs
   Border   rgba(255,255,255,0.08)
   Divider  rgba(255,255,255,0.05)
   FG       #ffffff
   MFG      rgba(255,255,255,0.45)
   SFG      rgba(255,255,255,0.25)
   Accent   #F5D800  — jaune — RARE : CTA + marqueurs actifs seulement
   ═══════════════════════════════════════════ */

const BG   = '#0a0a0a';
const CARD = '#161616';
const BD   = 'rgba(255,255,255,0.08)';
const AC   = '#F5D800';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  }),
};

/* ─── SECTION WRAPPER ─────────────────────── */
function Section({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ padding: '80px 0', borderTop: `1px solid ${BD}`, ...style }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {children}
      </div>
    </section>
  );
}

/* ─── EYEBROW LABEL ───────────────────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: AC, marginBottom: 16 }}>
      {children}
    </p>
  );
}

/* ─── SECTION H2 ──────────────────────────── */
function SectionH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#ffffff', marginBottom: 12 }}>
      {children}
    </h2>
  );
}

/* ─── OUTLINE BUTTON ──────────────────────── */
function OutlineBtn({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 44, padding: '0 20px',
        border: `1px solid rgba(255,255,255,0.35)`,
        color: '#ffffff',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        textDecoration: 'none',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffffff'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; }}
    >
      › {children}
    </a>
  );
}

/* ═══════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════ */
function Navbar() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      backgroundColor: 'rgba(10,10,10,0.92)',
      borderBottom: `1px solid ${BD}`,
      backdropFilter: 'blur(16px)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff' }}>STRYVR</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: AC, border: `1px solid rgba(245,216,0,0.35)`, padding: '2px 7px' }}>
            BÊTA
          </span>
        </div>
        {/* CTA desktop */}
        <a
          href="#waitlist"
          style={{
            display: 'none',
            height: 36,
            padding: '0 18px',
            backgroundColor: AC,
            color: '#0a0a0a',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            alignItems: 'center',
            gap: 8,
            transition: 'background-color 0.15s',
          }}
          className="sm:flex"
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ffe040'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = AC; }}
        >
          › ACCÈS BÊTA
        </a>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════ */
function HeroSection({ betaCount }: { betaCount: number }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="hero-grid">
        {/* Left */}
        <div>
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28, border: `1px solid rgba(245,216,0,0.25)`, padding: '5px 12px' }}>
            <div style={{ width: 5, height: 5, backgroundColor: AC }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: AC }}>
              BELGIQUE · FRANCE — PLACES LIMITÉES
            </span>
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            style={{ fontSize: 'clamp(42px, 6vw, 72px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 0.95, color: '#ffffff', marginBottom: 24 }}
          >
            PAS UN<br />
            TRACKER.<br />
            <span style={{ color: AC }}>TON COACH</span><br />
            PHYSIOLOGIQUE.
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.65, color: 'rgba(255,255,255,0.5)', maxWidth: 420, marginBottom: 36 }}
          >
            STRYVR comprend ta physiologie, s'adapte à ton rythme, et prend des décisions coaching fondées sur la science. Pas un générateur de programmes — un moteur vivant.
          </motion.p>

          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} id="waitlist">
            <BetaForm />
          </motion.div>

          {betaCount > 0 && (
            <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={4}
              style={{ marginTop: 14, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
              <span style={{ color: '#ffffff' }}>{betaCount}+</span> PERSONNES SUR LA LISTE
            </motion.p>
          )}
        </div>

        {/* Right — phones */}
        <div className="hero-phones" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <HeroPhoneStack />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STATS BAR
   ═══════════════════════════════════════════ */
function StatsSection() {
  const stats = [
    { value: '95%', label: 'ABANDONNENT EN 12 SEMAINES', sub: 'Le statu quo actuel' },
    { value: '5 MIN', label: 'PAR JOUR', sub: 'Check-in + log complet' },
    { value: '8', label: 'FLUX PHYSIOLOGIQUES', sub: 'Du check-in au bilan mensuel' },
  ];

  return (
    <div style={{ borderTop: `1px solid ${BD}`, borderBottom: `1px solid ${BD}` }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map((s, i) => (
          <motion.div
            key={s.value}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            style={{
              padding: '48px 32px',
              borderRight: i < 2 ? `1px solid ${BD}` : 'none',
              textAlign: i === 0 ? 'left' : i === 1 ? 'center' : 'right',
            }}
          >
            <p style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: '#ffffff', marginBottom: 8, fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </p>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: AC, marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{s.sub}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FEATURES — 3 colonnes Technogym style
   ═══════════════════════════════════════════ */
function FeaturesSection() {
  const features = [
    {
      num: '01',
      title: 'SMART AGENDA',
      desc: 'Ton agenda du jour orchestré par ton moteur physiologique. Check-in, repas, séance, compléments — dans le bon ordre, au bon moment.',
    },
    {
      num: '02',
      title: 'NUTRITION COMPOSER',
      desc: '4 couches de saisie. Portions par morphologie de ta main. Macros calculés en temps réel. Sans peser, sans compter.',
    },
    {
      num: '03',
      title: 'MOTEUR ADAPTATIF',
      desc: 'Cycle féminin, adaptation métabolique, overreaching, rebond post-cut — le moteur détecte les phénomènes physiologiques et ajuste sans que tu n\'aies à y penser.',
    },
  ];

  return (
    <Section>
      <div style={{ marginBottom: 56 }}>
        <Eyebrow>Ce qui change tout</Eyebrow>
        <SectionH2>CONÇU POUR TA BIOLOGIE.<br />PAS POUR LA MOYENNE.</SectionH2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, backgroundColor: BD }}>
        {features.map((f, i) => (
          <motion.div
            key={f.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            style={{ backgroundColor: BG, padding: '40px 32px' }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: AC, marginBottom: 20 }}>{f.num}</p>
            <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff', marginBottom: 14, textTransform: 'uppercase' }}>{f.title}</p>
            <p style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.45)', margin: 0 }}>{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   APP SECTION — mockup training + texte
   ═══════════════════════════════════════════ */
function AppSection() {
  return (
    <Section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <AppMockup screen="training" />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <Eyebrow>Flux 3C — Training</Eyebrow>
          <SectionH2>LOG EN 30 SECONDES.<br />ANALYSE EN CONTINU.</SectionH2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>
            Log ta séance pendant que tu t'entraînes. Le moteur analyse la progression, détecte le surmenage et planifie les semaines suivantes — tout en arrière-plan.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 32 }}>
            {[
              ['Charge de travail', 'Calculée depuis ton historique réel'],
              ['Détection surmenage', 'Bascule automatique en récupération'],
              ['Mésocycle', '4–6 semaines + déload planifié'],
            ].map(([k, v], i) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, backgroundColor: BD }}>
                <div style={{ backgroundColor: BG, padding: '12px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{k}</p>
                </div>
                <div style={{ backgroundColor: CARD, padding: '12px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#ffffff', margin: 0 }}>{v}</p>
                </div>
              </div>
            ))}
          </div>

          <OutlineBtn href="#waitlist">ACCÈS BÊTA</OutlineBtn>
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   NUTRITION SECTION
   ═══════════════════════════════════════════ */
function NutritionSection() {
  return (
    <Section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        {/* Text */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <Eyebrow>Flux 3A — Nutrition Composer</Eyebrow>
          <SectionH2>4 COUCHES.<br />ZÉRO BALANCE.</SectionH2>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>
            Estime tes portions avec ta main — calibrée sur ta morphologie. Le moteur calcule les macros selon ton objectif du jour, ton cycle et ton activité réelle.
          </p>

          {/* Composer layers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { n: '1', label: 'CATÉGORIE', sub: 'Protéines · Glucides · Lipides · Légumes · Extras' },
              { n: '2', label: 'ALIMENT', sub: 'Recherche full-text + scan code-barres' },
              { n: '3', label: 'PORTION', sub: 'Paume · Poing · Pouce · Cuillère · Pincée' },
              { n: '4', label: 'CONFIRMATION', sub: 'Macros calculés en temps réel — 2 taps' },
            ].map(l => (
              <div key={l.n} style={{ display: 'flex', alignItems: 'center', gap: 0, backgroundColor: BD }}>
                <div style={{ width: 40, padding: '12px 0', backgroundColor: CARD, textAlign: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: AC }}>{l.n}</span>
                </div>
                <div style={{ flex: 1, padding: '12px 16px', backgroundColor: BG }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ffffff', marginBottom: 2 }}>{l.label}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{l.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.15 }}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <AppMockup screen="agenda" />
        </motion.div>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   SAFETY SECTION — grille 2×2 Technogym style
   ═══════════════════════════════════════════ */
function SafetySection() {
  const items = [
    { code: 'TCA', title: 'PROFILS SENSIBLES', desc: 'En mode TCA-safe, aucun chiffre de poids ni calorie affiché. Le moteur adapte son comportement sans jamais exposer l\'utilisateur à un risque.' },
    { code: 'GLP-1', title: 'CONDITIONS MÉDICALES', desc: 'GLP-1, post-bariatrique, grossesse — les planchers caloriques, les protocoles et les alertes s\'ajustent automatiquement selon le profil.' },
    { code: 'CYCLE', title: 'CYCLE FÉMININ', desc: 'Nutrition et training modulés par phase hormonale. Folliculaire, ovulatoire, lutéale, menstruelle — chaque phase a ses recommandations propres.' },
    { code: 'RED-S', title: 'SURMENAGE', desc: 'Le moteur détecte l\'overreaching et le RED-S. Bascule automatique en mode Recovery — sans validation manuelle requise.' },
  ];

  return (
    <Section>
      <div style={{ marginBottom: 48 }}>
        <Eyebrow>Flux 6 — Safety Layer</Eyebrow>
        <SectionH2>CONÇU POUR<br />TOUS LES PROFILS.</SectionH2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 480, marginTop: 8 }}>
          Le moteur tourne en continu. Il détecte les situations à risque et adapte le protocole en silence — sans t'alarmer, sans t'exposer.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, backgroundColor: BD }}>
        {items.map((it, i) => (
          <motion.div
            key={it.code}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            style={{ backgroundColor: BG, padding: '32px 28px' }}
          >
            <div style={{ display: 'inline-block', padding: '3px 8px', backgroundColor: 'rgba(245,216,0,0.08)', border: `1px solid rgba(245,216,0,0.2)`, marginBottom: 14 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: AC }}>{it.code}</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase', color: '#ffffff', marginBottom: 10 }}>{it.title}</p>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{it.desc}</p>
          </motion.div>
        ))}
      </div>

      <p style={{ marginTop: 16, fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.5 }}>
        STRYVR n'est pas un dispositif médical. Toujours consulter un professionnel de santé pour toute condition médicale sérieuse.
      </p>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   CTA FINAL — pleine largeur Technogym
   ═══════════════════════════════════════════ */
function FinalCTA() {
  return (
    <div style={{ backgroundColor: AC, padding: '80px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="cta-grid">
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', marginBottom: 12 }}>
            ACCÈS BÊTA
          </p>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0, color: '#0a0a0a', marginBottom: 16 }}>
            TU ES ENCORE LÀ ?<br />C'EST BON SIGNE.
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', lineHeight: 1.6, margin: 0 }}>
            Lancement Belgique & France. Places bêta limitées. Tu seras parmi les premiers à tester le moteur.
          </p>
        </div>
        <div style={{ backgroundColor: '#0a0a0a', padding: 32 }}>
          <BetaForm />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FOOTER — style Technogym
   ═══════════════════════════════════════════ */
function Footer() {
  const cols = [
    { title: 'PRODUIT', links: ['Smart Agenda', 'Nutrition Composer', 'Training', 'Safety Layer', 'Insights'] },
    { title: 'SUPPORT', links: ['Contact', 'FAQ', 'Status'] },
    { title: 'LÉGAL', links: ['Mentions légales', 'Confidentialité', 'CGU'] },
  ];

  return (
    <footer style={{ backgroundColor: BG, borderTop: `1px solid ${BD}` }}>
      {/* Main footer */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '56px 24px 40px', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 40 }}>
        {/* Brand */}
        <div>
          <p style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', marginBottom: 8 }}>STRYVR</p>
          <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.35)', maxWidth: 260, marginBottom: 24 }}>
            Le coach physiologique intelligent dans ta poche. Pas un tracker. Pas un générateur de programmes. Un moteur fondé sur la science.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            {['INSTAGRAM', 'TIKTOK', 'LINKEDIN'].map(s => (
              <a key={s} href="#" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}>
                {s}
              </a>
            ))}
          </div>
        </div>

        {/* Cols */}
        {cols.map(col => (
          <div key={col.title}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>{col.title}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.links.map(l => (
                <a key={l} href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'color 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}>
                  {l}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: `1px solid ${BD}`, maxWidth: 1200, margin: '0 auto', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>© 2026 STRYVR — by STRYVLAB</p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>🇧🇪 BELGIQUE · 🇫🇷 FRANCE</p>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════
   ROOT
   ═══════════════════════════════════════════ */
export function BetaLandingClient({ betaCount }: { betaCount: number }) {
  return (
    <div style={{ backgroundColor: BG, color: '#ffffff', minHeight: '100vh' }}>
      <Navbar />
      <HeroSection betaCount={betaCount} />
      <StatsSection />
      <FeaturesSection />
      <AppSection />
      <NutritionSection />
      <SafetySection />
      <FinalCTA />
      <Footer />

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-phones { display: none !important; }
          .cta-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
