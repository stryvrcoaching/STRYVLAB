# STRYVR — Vision Stratégique Globale 2026

> **Document de gouvernance produit**
> 
> Source de vérité pour l'alignement fondateur-produit-tech.
> 
> Date : 2026-04-26  
> Auteur : Coach-fondateur STRYVR  
> Révision : v1.0 — Vision, Piliers, Stratégie de Go-To-Market

---

## EXECUTIVE SUMMARY

STRYVR est une **plateforme ultra-personnalisée d'adhérence client** fondée sur la **collecte quotidienne de données**, l'**intelligence basée sur les données**, et l'**expérience utilisateur minimaliste et cohérente**.

L'objectif : **créer l'écosystème connecté le plus intuitif au monde** pour le coaching fitness, nutrition, et bien-être — accessible aux débutants mais capable d'optimisation chirurgicale pour les experts.

---

## 1. LA VISION FONDATRICE

### Problème core

Aujourd'hui, 95% des clients abandonnent les protocoles fitness/nutrition en moins de 12 semaines.

**Raison fondamentale** : les protocoles ne sont pas personnalisés en fonction des **données réelles quotidiennes** du client.

### Hypothèse de solution

Si on peut :
1. **Récolter des données quotidiennes simples** (5 min/jour max)
2. **Les traiter en intelligence**, enrichir les recommandations
3. **Afficher la data de manière visuelle et minimaliste**
4. **Adapter le protocole en temps réel** selon la data

Alors on augmente l'adhérence drastiquement et on crée une moat (avantage concurrentiel durable).

### Vision finale : l'écosystème STRYVR

```
Coaching Platform (Coach Dashboard + AI)
         ↓
      DATA LAYER (Client app quotidienne)
         ↓
    Smart Restaurants (nutrition ultra-personnalisée)
    + Sport Centers (env équipement connectés)
    + Wearables (montres, scales, capteurs)
         ↓
    ULTRA-PERSONALIZATION LOOP
    (chaque client = profil 100% unique)
```

**Horizon** : 5–7 ans. Mais les fondations se posent **maintenant**.

---

## 2. TROIS PILIERS FONDAMENTAUX

### Pilier 1 : Coaching Platform (Coach Dashboard)

**Rôle** : outil de coaching assisté par IA pour les coaches (débutants ET expérimentés)

**Caractéristiques clés** :
- **Accessibilité débutant** : protocoles pré-générés, pas de courbe d'apprentissage, "tout est pré-mâché"
- **Profondeur expert** : mode "Lab" pour l'expérimentation, la rigueur chirurgicale, les simulations
- **Intelligence basée sur la data** : recommandations auto-générées depuis les données client (RIR, body comp, performance trends)
- **Visual data display** : graphiques élégants (MacroFactor-like), tableau de bord à la pointe
- **Deux protocoles** : entraînement + nutrition, gérés ensemble (cohésion)

**Normes de référence** :
- MacroFactor (nutrition elite, pour utilisateurs avancés)
- Stronger by Science (autorité scientifique, SRA, Israetel volumes)
- Lift Smarter Macro Factor (simplicité + data)

**Non-négociable** : ultra-solide au niveau back-end et écosystème global.

---

### Pilier 2 : Client App (Data Entry Quotidienne)

**Rôle** : interface minimaliste pour la collecte quotidienne de données

**Objectif** : faire en sorte que le client rentre des données **sans friction**, **en 5 minutes max**, **tous les jours**.

**Types de data collectées** :
- **Biométriques** : poids, photo morpho, mesures (taille, tour de taille, etc.)
- **Performance** : sets, reps, poids, RIR, notes de ressenti (fatigue, énergie)
- **Nutrition** : repas, calories, macros (intégrées depuis restaurants / meal logging)
- **Bien-être** : sommeil, stress, douleurs, restrictions temporaires
- **Contexte** : contraintes du jour (manque de temps, absence équipement, état émotionnel)

**Design** :
- **Minimaliste, visuel, intuitive**
- **8x UX design** : propre, cohérent, clair, aucune friction
- **PWA** : offline-first, instantanée, native-like feel
- **Dark mode natif** (DS v2.0 : #121212 fond, accent vert #1f8a65)
- **Temps réel** : modifications sauvegardées instantanément

**Non-négociable** : Le client DOIT vouloir entrer les données. L'app doit être plus addictive que TikTok pour les 5 min de data entry.

---

### Pilier 3 : Écosystème Connecté (Future, Fondations Now)

**Rôle** : intégration progressive avec les systèmes externes

**Phase 1 (Now - 2026)** : Wearables + Stock data
- Intégration Oura Ring, Apple Watch, Garmin
- Nutrition : restaurants partenaires, meal logging APIs
- Sport centers : synchro équipement dispo, réservations live

**Phase 2 (2027)** : Smart Restaurants
- Restaurants partenaires avec menus ultra-personnalisés par client
- Chaque client voit des repas **préparés exactement pour ses macros/calories**
- Nutrition devient aussi simple que commander (pas de saisie manuelle)

**Phase 3 (2028+)** : Sport Centers + AI Coaching
- Centres sportifs partenaires : réservation live, guidance IA via écrans gym
- Coach virtuel adaptatif : regarde le client, ajuste les volumes/intensités en temps réel
- Écosystème fermé = avantage concurrentiel insurmontable

---

## 3. STRATÉGIE UX/DESIGN

### Philosophie de conception

**"Simple par défaut, puissant si désiré"**

#### Pour les débutants
- **Protocoles pré-générés** (templates)
- **Pas de choix paralysant** — le coach choisit, le client exécute
- **Feedback visuel constant** — voir la progression, c'est motivant
- **Onboarding guidé** — 5 étapes, puis c'est bon

#### Pour les experts
- **Mode Lab** visible par défaut
- **Sliders de contrôle** — ajustements calorique, macros, SRA, volumes
- **Data export** (PDF, JSON, CSV) pour utiliser les données ailleurs
- **Simulations** — "et si je modifie les protéines de +20g?"
- **Timeline data** — voir les trends, corrélations

#### Pour les coaches "intermédiaires" (la majorité)
- **Templates pré-générés** comme point de départ
- **Mode semi-auto** — je valide, j'ajuste, je suis en contrôle
- **Recommandations intelligentes** affichées mais non forcées
- **1-click application** des changements

### Design System

**Référence** : DS v2.0 STRYVR (Flat, Dark, Sans-bruit)

**Palette** :
- Fond app : `#121212`
- Accent primaire : `#1f8a65` (vert)
- Accent secondaire : `#8b5cf6` (violet pour Lab mode)
- Surface cards : `bg-white/[0.02]`
- Texte primaire : `white` / `text-white`
- Texte muted : `text-white/60`
- Métadonnées : `text-white/40`

**Principes** :
- Aucune bordure (`border-*` interdit sauf état d'erreur)
- Aucune ombre (`shadow-*` interdit)
- Hiérarchie = couleur + opacité uniquement
- Typographie : Lufga (default), Unbounded (logo), Mono (numériques)
- Arrondis : `rounded-2xl` (bloc), `rounded-xl` (card), `rounded-lg` (inputs)

**Minimalisme** :
- 1 couleur d'accent par section max
- 3 niveaux de texte max par page
- Pas de décoration, pas de gradients
- Inspiré de Cursor, Apple, Figma (design sophistiqué sans bruit)

---

## 4. ARCHITECTURE SYSTÈME

### Stack Tech (Current State)

```
Frontend
├─ Next.js 15 (App Router)
├─ TypeScript strict
├─ Tailwind CSS 3 + DS tokens
├─ Framer Motion (animations)
└─ React Query (data sync)

Backend
├─ Next.js API Routes (Node.js)
├─ Prisma ORM
├─ Supabase (PostgreSQL + Auth + RLS)
└─ Inngest (async jobs, durable)

Data
├─ PostgreSQL (Supabase)
├─ RLS (multi-tenant isolation)
└─ Seeds (idempotent, version truth)

DevOps
├─ Vercel (deploy, Edge Functions)
├─ GitHub (version control)
└─ Inngest Dashboard (job observability)
```

### Modèle de données : trois couches

#### Layer 1 : Transactional (Client Execution)
- `client_session_logs` (séances complétées)
- `client_set_logs` (sets réels : poids, reps, RIR, side)
- `client_nutrition_logs` (repas saisis ou intégrés)
- `client_daily_logs` (biométriques, bien-être, contexte)

**Propriété** : temps réel, atomique, versionnée par timestamp

#### Layer 2 : Protocols (Coach Instructions)
- `nutrition_protocols` (macros, hydratation, cycle sync)
- `coach_program_templates` (séances, exercices, volumes)
- `program_exercises` (assignation avec biomécanique)

**Propriété** : immuable (version history via `created_at`, pas de mise à jour in-place)

#### Layer 3 : Intelligence (Computed)
- `morpho_analyses` (body comp, asymétries, stimulus adjustments)
- `performance_feedback` (RIR trends, stagnation alerts)
- `program_adjustment_proposals` (recommandations auto, coach approval)
- `metric_annotations` (timeline événements coaching)

**Propriété** : régénéré, pas de dogme, compute-on-demand

### Invariants Core

1. **Data model = runtime truth** — la base de données est la source unique, jamais un cache
2. **RLS = isolation multi-tenant** — chaque coach ne voit que ses clients
3. **Inngest = async jobs** — pas d'appels externes bloquants (morceaux de n8n remplacés)
4. **TypeScript strict** — 0 erreur `npx tsc --noEmit`, toujours
5. **Seeds = version truth** — idempotent upserts pour les données de référence
6. **Audit trail** — chaque changement client est tracé via `created_at`, `updated_at`, `event_type`

---

## 5. STRATÉGIE GO-TO-MARKET

### Phase 1 : MVP (Now - June 2026)

**Focus** : Coach dashboard + Client app basics

**Deliverables** :
- [x] Coaching dashboard (Program builder, MorphoPro bridge)
- [x] Client app (PWA, session logging, basic data)
- [x] Nutrition protocols (macros, hydratation, carb cycling)
- [ ] Performance feedback loops (auto-recommendations)
- [ ] Export + webhooks

**GTM** : Direct to coaches (beta, 5–10 coaches, feedback loops)

---

### Phase 2 : Ecosystem Foundations (July - Dec 2026)

**Focus** : Smart nutrition integration, Data personalization

**Deliverables** :
- [ ] Wearables integration (Apple Watch, Oura Ring)
- [ ] Restaurant partnerships (meal logging → exact macros)
- [ ] Advanced analytics (correlation body comp ↔ protocol adherence)
- [ ] Coach AI assistants (bulk protocol generation)
- [ ] Client AI coach (virtual trainer for form checks via Vision)

**GTM** : Scale to 50–100 coaches, enterprise partnerships (gyms, restaurant chains)

---

### Phase 3 : Ecosystem Scale (2027+)

**Focus** : Smart restaurants, Sport centers, full integration

**Deliverables** :
- [ ] Smart restaurant chain launch (STRYVR-branded, 10+ cities)
- [ ] Sport center partnerships (gym equipment + live coaching)
- [ ] Predictive coaching (ML models for individual response patterns)
- [ ] International expansion (FR/ES/EN, local partnerships)

**GTM** : Become the "Apple of fitness coaching" — ecosystem lock-in, recurring revenue, consumer brand

---

## 6. ALIGNEMENT AVEC L'EXISTANT : FORCES & FAIBLESSES

### ✅ FORCES actuelles

| Composant | Status | Validation |
|-----------|--------|-----------|
| **MorphoPro Bridge** | ✅ Phase 0 complet | OpenAI Vision + stimulus adjustments OK |
| **Program Intelligence** | ✅ Phase 2 complet | Scoring engine (SRA, balance, specificity) OK |
| **Program Builder** | ✅ Phase 1 complet | Dual-pane Studio-Lab OK |
| **Client App** | ✅ Minimal OK | Session logging, basic data entry, PWA OK |
| **Nutrition System** | ✅ Phase 2 complet | Protocols (macros, hydratation, CC) OK |
| **DS v2.0** | ✅ Deployed | Dark theme, minimal, clean OK |
| **Database** | ✅ Solid | Supabase RLS, multi-tenant, audit trail OK |
| **Backend** | ✅ Solid | Inngest, API routes, Prisma ORM OK |

**Verdict** : Fondations excellentes. Le core produit marche.

---

### ⚠️ FAIBLESSES actuelles

| Domaine | Problème | Impact | Priority |
|---------|----------|--------|----------|
| **Client app frictionless-ness** | Data entry requiert clicks multiples | Adhérence client -20% | 🔴 CRITICAL |
| **Real-time sync** | Updates ne sont pas live (refresh requis) | UX feels sluggish | 🟠 HIGH |
| **Performance feedback** | Auto-recommendations en place mais pas connectés à l'action | Coaches not using | 🟠 HIGH |
| **Wearables integration** | Zéro intégration (COMING) | Data silos | 🟠 HIGH |
| **Export/sharing** | Pas d'export PDF/JSON pour clients | Friction externe | 🟡 MEDIUM |
| **Mobile app** | Pas d'app native (PWA seule) | Discoverability, store presence | 🟡 MEDIUM |
| **Onboarding coach** | Pas de guided setup pour débutants | Churn coaches day 1 | 🟡 MEDIUM |
| **Analytics coach** | Dashboard business (MRR, churn, NPS) absent | Blind spot | 🟡 MEDIUM |
| **Legal/compliance** | RGPD, ToS, privacy policy basics | Risk | 🟡 MEDIUM |

---

### 🎯 AXES D'AMÉLIORATION

#### Short term (Apr-June 2026)

1. **Client app UX** — Single-tap data entry (voice input, preset buttons, smart defaults)
   - Impact : +30% daily engagement
   - Effort : 2 weeks
   
2. **Real-time collab** — Live sync between coach edits and client views
   - Impact : UX perception +40%
   - Effort : 3 weeks

3. **Coach onboarding** — Guided setup, template selection, first client creation
   - Impact : Coach retention +25%
   - Effort : 2 weeks

4. **Mobile app (iOS beta)** — React Native wrapper, AppStore presence
   - Impact : Discoverability, brand presence
   - Effort : 6 weeks (add to backlog for Phase 2)

#### Medium term (June-Dec 2026)

5. **Wearables SDK** — Apple Health, Google Fit, Oura direct integration
   - Impact : Zero-friction biometric sync
   - Effort : 4 weeks

6. **Export engine** — PDF/CSV/JSON generation, email delivery
   - Impact : Client sharing, word-of-mouth
   - Effort : 3 weeks

7. **AI Coach Assistant** — Bulk protocol generation from client profile (Claude API)
   - Impact : Coach productivity +5x
   - Effort : 4 weeks

8. **Analytics dashboard** — MRR, churn rate, client adherence trends, LTV cohort
   - Impact : Data-driven biz decisions
   - Effort : 3 weeks

#### Long term (2027+)

9. **Smart restaurant MVP** — Partner with 2–3 restaurants, test personalized meal ordering
   - Impact : Moat formation, network effect
   - Effort : 12 weeks + partnerships

10. **Sport center partnerships** — Integration with gyms (booking, equipment, live coaching)
    - Impact : Ecosystem lock-in
    - Effort : 16 weeks + partnerships

11. **Predictive ML models** — Individual response curves, optimal macro distribution, recovery patterns
    - Impact : Ultra-personalization, brand positioning
    - Effort : 20 weeks (data collection prerequisite)

---

## 7. PRINCIPLES & COMMANDMENTS

### Anti-patterns (Never Do)

```
🚫 Never:
  - Add UI feature before data model is defined
  - Hardcode values (enums, thresholds, formulas) — always externalize
  - Skip TypeScript validation
  - Deploy without audit trail
  - Forget that data IS the product
  
  - Build for coaches first, forget clients (they're the end user)
  - Add features without measuring impact
  - Sacrifice simplicity for premature optimization
  - Assume users will RTFM (onboarding must be obvious)
```

### Core Principles

```
✅ Always:
  - Start with data model
  - Ship with TypeScript strict mode
  - Test on real coaches + clients
  - Measure daily engagement (data entry completion %)
  - Keep client app under 5-minute entry time
  - Design for debutant first, then unlock depth
  - Every coach feature = client impact metric
  
  - Validate assumptions (build, measure, learn)
  - Iterate on UX (ugly → fast → beautiful → obsession-worthy)
  - Document decisions in project-state.md
  - Treat data as sacred (audit trail, RLS, versioning)
```

---

## 8. SUCCESS METRICS

### Coach Platform

| Metric | Target (Year 1) | Measurement |
|--------|-----------------|-------------|
| **Coach Onboarding Time** | < 15 min | Time from signup to first protocol created |
| **Coach NPS** | > 50 | Net Promoter Score survey |
| **Monthly Active Coaches** | 100 | Coaches with ≥1 protocol creation/month |
| **Protocol Completion Rate** | > 70% | % of clients finishing assigned protocols |
| **Feature Adoption** | > 60% | Coaches using Lab Mode, auto-recommendations |

### Client App

| Metric | Target (Year 1) | Measurement |
|--------|-----------------|-------------|
| **Daily Active Users** | 60% | % of assigned clients logging daily |
| **Session Logging Accuracy** | > 90% | Form validation, RIR estimation accuracy |
| **Data Entry Time** | < 5 min | Avg time to complete daily entry |
| **Retention (30d)** | > 70% | % of onboarded clients active after 30 days |
| **NPS** | > 60 | Net Promoter Score survey |

### Business

| Metric | Target (Year 1) | Measurement |
|--------|-----------------|-------------|
| **MRR** | €10k | Recurring revenue from coach subscriptions |
| **CAC** | < €50 | Cost per acquired coach |
| **LTV** | > €500 | Lifetime value per coach (annual × 3 years) |
| **Churn Rate** | < 5% | Monthly coach churn |
| **NRR** | > 110% | Net Revenue Retention (expansion revenue) |

---

## 9. DEPENDENCIES & RISKS

### Critical Dependencies

| Dependency | Status | Mitigation |
|------------|--------|-----------|
| **OpenAI API** | ✅ Active | Have backup: on-device vision (Phase 2) |
| **Supabase** | ✅ Active | Self-host Postgres + S3 backup ready |
| **Vercel** | ✅ Active | Multi-region ready, can self-host Next.js |
| **Restaurant partners** | ⏳ Future | Start with small test, scale incrementally |
| **Wearables SDKs** | ⏳ Future | Open APIs available, built-in fallback |

### Key Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **Coaches abandon tool (learning curve)** | High | Critical | Guided onboarding, templates, support |
| **Clients don't log daily** | High | Critical | 1-tap entry, gamification, rewards |
| **Wearables integration fragile** | Medium | High | Graceful degradation, manual input fallback |
| **Regulatory (RGPD, health data)** | Medium | High | Legal review now, compliance as tech |
| **Competitor copies** | Medium | Medium | Moat = ecosystem (restaurants, gyms), speed |

---

## 10. VISION STATEMENT (One-liner)

**"STRYVR = MacroFactor meets Apple Health meets a personal coach — ultra-personalized fitness & nutrition protocols driven by daily data, designed for adherence, powered by intelligence."**

---

## 11. 18-MONTH ROADMAP

### Q2 2026 (Apr-Jun)
- [x] MorphoPro Bridge Phase 0
- [x] Program Intelligence Phase 2
- [ ] Client app UX refinement (frictionless data entry)
- [ ] Coach onboarding flow
- [ ] Performance feedback loops → action

### Q3 2026 (Jul-Sep)
- [ ] Wearables beta (Apple Health, Oura)
- [ ] Export engine (PDF, JSON)
- [ ] AI Coach Assistant (bulk protocol generation)
- [ ] Analytics dashboard (coach business metrics)

### Q4 2026 (Oct-Dec)
- [ ] Mobile app (iOS beta)
- [ ] Restaurant partnership MVP (2–3 partners)
- [ ] Advanced nutrition correlations (body comp ↔ macros)
- [ ] Predictive ML models (Phase 1)

### Q1 2027
- [ ] Smart restaurant chain launch (STRYVR-branded)
- [ ] Sport center integrations (5–10 gyms)
- [ ] International expansion (start with FR)
- [ ] B2B SaaS for gym chains

### Q2–Q4 2027+
- [ ] Scale ecosystem (50+ restaurant partners, 100+ gyms)
- [ ] Consumer brand (Instagram, TikTok, PR)
- [ ] Predictive coaching (ML full deployment)
- [ ] Potential Series A / strategic partnerships

---

## 12. CONCLUSION

STRYVR n'est pas un "fitness app". C'est une **plateforme d'adhérence client** fondée sur des données réelles quotidiennes et une intelligence adaptative.

**Le succès** = clients qui restent 2+ ans (vs 12 semaines actuels).

**La moat** = écosystème fermé (restaurants, gyms, wearables) + data flywheel (plus de data = meilleure IA = meilleure adhérence = plus de data).

**Le north star** = dans 5 ans, quand quelqu'un dit "je veux un coach fitness", la réponse c'est "tu essaies STRYVR?".

---

## DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-04-26 | Coach Founder | Initial strategic vision, pillars, roadmap |

**Next Review** : 2026-06-30 (post-Q2 execution)

**Steward** : Coach-founder (vision) + Product Lead (execution tracking)
