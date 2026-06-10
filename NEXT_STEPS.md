# 🎯 VIRTUS Smart fit - STATUS & NEXT STEPS

## ✅ CE QUI EST CRÉÉ (INFRASTRUCTURE COMPLÈTE)

### **1. CONFIGURATION & SETUP**
- ✅ package.json (toutes dépendances)
- ✅ tsconfig.json
- ✅ tailwind.config.ts (thème medical premium)
- ✅ next.config.js
- ✅ .env.example (template complet)
- ✅ README.md (guide setup exhaustif)

### **2. DATABASE (SUPABASE)**
- ✅ Schema SQL complet (5 tables):
  - `ipt_calculator_results` (Calculator gratuit)
  - `assessments` (Bilan complet payant)
  - `assessment_brakes` (Freins détectés)
  - `analysis_log` (Debug AI)
  - `email_deliveries` (Email tracking)
- ✅ Indexes optimisés
- ✅ RLS policies
- ✅ Helper functions (token generation, validation)

### **3. TYPES TYPESCRIPT**
- ✅ Types complets dans `/types/index.ts`:
  - Questionnaires (Question, QuestionSection, Questionnaire)
  - IPT Scores (simple + detailed)
  - Assessments (Payment, Analysis status)
  - Brakes (Categories, Severity)
  - API Responses
  - Email types
  - VIRTUS AI types

### **4. QUESTIONNAIRES**
- ✅ **IPT Calculator** (`lib/questionnaires/ipt-calculator.json`):
  - 48 questions essentielles
  - 5 sections
  - 12 min estimé
  - Lead generation optimisé
  
- ✅ **Bilan Complet MVP** (`lib/questionnaires/bilan-complet-mvp.json`):
  - 75 questions détaillées
  - 8 sections (aligné doc IPT)
  - 25 min estimé
  - Génère 273 data points après calculs

### **5. STRUCTURE APP**
- ✅ app/layout.tsx (fonts premium)
- ✅ app/globals.css (styles medical)
- ✅ Folders structure:
  ```
  app/
    genesis-lab/    # Landing + Calculator
    bilan-complet/         # Bilan form (post-payment)
    pricing/               # 3 tiers
    api/
      calculate-ipt/       # Calculate IPT instant
      stripe/
        checkout/          # Create Stripe session
        webhook/           # Handle payments
      analyze/             # VIRTUS AI V3
      emails/              # Send emails
  ```

---

## 🚧 CE QUI RESTE À DÉVELOPPER

### **PRIORITÉ 1 - FRONTEND (2-3h)**

#### **A) Landing Page `/genesis-lab`**
Créer: `app/genesis-lab/page.tsx`

Sections nécessaires:
```tsx
1. Hero
   - Titre accrocheur
   - IPT Gauge animé (SVG)
   - CTA "Calcule Ton IPT Gratuit"

2. Problème
   - "90% échecs = Freins cachés jamais identifiés"
   - Statistiques percutantes

3. Solution IPT
   - Explique scoring 0-100
   - Breakdown composantes (Métabolique/Psycho/Env/Infra)
   - Scientifiquement validé (300+ études)

4. Social Proof
   - "150+ clients transformés"
   - Témoignages (si dispo)

5. IPT Calculator Embed
   - Multi-step form intégré
   - Progress bar
   - Résultat instant affiché

6. Pricing CTA
   - Après résultat IPT → CTA vers /pricing

7. FAQ
   - Questions communes

8. Footer
```

**Composants à créer:**
- `components/Hero.tsx`
- `components/IPTGauge.tsx` (SVG animé)
- `components/calculator/MultiStepForm.tsx`
- `components/calculator/ProgressBar.tsx`
- `components/calculator/QuestionRenderer.tsx`
- `components/PricingPreview.tsx`

#### **B) Pricing Page `/pricing`**
Créer: `app/pricing/page.tsx`

3 tiers:
```tsx
Tier 1 - Rapport IPT (47€)
  ✓ Rapport PDF 5-8 pages
  ✓ Score IPT breakdown
  ✓ Top 3-5 freins
  ✓ Recommandations générales

Tier 2 - Diagnostic Complet (197€) ⭐ RECOMMANDÉ
  ✓ Bilan Complet (75Q)
  ✓ Analyse VIRTUS AI V3
  ✓ Rapport 12+ pages
  ✓ Protocole Phase 1

Tier 3 - Coaching 3.0 (1997€)
  ✓ Tout Tier 2 +
  ✓ Suivi 12 semaines
  ✓ Ajustements mensuels
  ✓ Accès coach direct
```

Composants:
- `components/PricingCard.tsx`
- `components/FeatureList.tsx`

#### **C) Bilan Complet Page `/bilan-complet`**
Créer: `app/bilan-complet/page.tsx`

Features:
- Vérification access_token (URL param)
- Multi-step form (8 sections)
- Sauvegarde progression (localStorage)
- Submit → Trigger VIRTUS AI V3

Composants:
- `components/bilan/BilanMultiStepForm.tsx`
- `components/bilan/SectionRenderer.tsx`

---

### **PRIORITÉ 2 - API ROUTES (3-4h)**

#### **A) `/api/calculate-ipt/route.ts`**
**Input:** Calculator responses (48 questions)
**Process:**
1. Parse responses
2. Calculate IPT scores:
   ```typescript
   - Métabolique: Tour taille, fringales, crash énergie, etc.
   - Psychologique: Self-efficacy, motivation, emotional eating
   - Environnement: Support famille, social pressure
   - Infrastructure: Budget, temps, équipement
   ```
3. Detect top 3-5 brakes
4. Save to `ipt_calculator_results`
**Output:** `{ ipt_score, top_brakes }`

**Fichier à créer:** `lib/ipt-calculator.ts` (formules calcul)

#### **B) `/api/stripe/checkout/route.ts`**
**Input:** `{ tier, email, first_name, last_name }`
**Process:**
1. Create Stripe Checkout Session
2. Create assessment in DB (payment_status = pending)
3. Generate access_token (pour Bilan Complet)
**Output:** `{ checkout_url }`

**Fichier à créer:** `lib/stripe.ts` (helper functions)

#### **C) `/api/stripe/webhook/route.ts`**
**Process:**
1. Verify Stripe signature
2. Handle `checkout.session.completed`:
   - Update assessment payment_status = completed
   - Send email based on tier:
     - Tier 1: Trigger report generation + email PDF
     - Tier 2/3: Email avec lien Bilan Complet
**Fichier à créer:** Déjà structure dans `/api/stripe/webhook`

#### **D) `/api/analyze/route.ts`**
**Input:** `{ assessment_id }`
**Process:** Run VIRTUS AI V3 (5 prompts séquentiels)
1. **Extraction:** Parse bilan_responses → structured JSON
2. **Cross-Correlation:** Detect patterns/contradictions
3. **IPT Calculation:** Calculate detailed scores (273 data points)
4. **Brake Detection:** Identify freins + severity + priority
5. **Report Generation:** Generate DOCX report

**Fichier à créer:** `lib/genesis-ai.ts` (prompts + Anthropic calls)

---

### **PRIORITÉ 3 - EMAILS (1-2h)**

Créer templates dans `/emails`:

**A) `calculator-result.tsx`** (après Calculator gratuit)
```
Sujet: Ton IPT Score: XX/100
Body:
  - Résultat recap
  - Explication score
  - CTA: Débloquer Diagnostic Complet
```

**B) `tier1-report.tsx`** (après payment 47€)
```
Sujet: Ton Rapport IPT Complet
Body:
  - Link PDF download
  - Recap scores
  - Upsell Tier 2
```

**C) `bilan-access.tsx`** (après payment Tier 2/3)
```
Sujet: Accède à Ton Bilan Complet
Body:
  - Link unique: /bilan-complet?token=xxx
  - Expiration 7 jours
  - Instructions
```

**D) `tier23-report.tsx`** (après analyse)
```
Sujet: Diagnostic + Protocole Prêts
Body:
  - Link PDF rapport
  - Prochaines étapes
```

**Fichier helper:** `lib/emails.ts` (send functions via Resend)

---

### **PRIORITÉ 4 - VIRTUS AI V3 (4-5h)**

**Fichier:** `lib/genesis-ai.ts`

Structure:
```typescript
export async function analyzeAssessment(assessmentId: string) {
  // 1. Load assessment data from Supabase
  const assessment = await getAssessment(assessmentId);
  
  // 2. Sequential prompts
  const extraction = await runExtractionPrompt(assessment.bilan_responses);
  const crossCorrelation = await runCrossCorrelationPrompt(extraction);
  const iptScores = await runIPTCalculationPrompt(crossCorrelation);
  const brakes = await runBrakeDetectionPrompt(iptScores);
  const report = await runReportGenerationPrompt(brakes);
  
  // 3. Save results
  await saveAnalysisResults(assessmentId, { iptScores, brakes, report });
  
  // 4. Generate PDF
  const pdfUrl = await generateReportPDF(report);
  
  // 5. Send email
  await sendReportEmail(assessment.email, pdfUrl);
}
```

**Prompts à créer:**

**Prompt 1 - Extraction:**
```
Tu es un expert en analyse de données VIRTUS Smart fit.
Voici les réponses d'un client au Bilan Complet (75 questions).

DONNÉES:
{JSON responses}

TÂCHE:
Extrait et structure TOUS les data points en JSON.
Format attendu:
{
  demographics: { age, gender, weight, height, ... },
  metabolic: { waist, insulin_signals, hpa_signals, ... },
  psychology: { self_efficacy, motivation, ... },
  environment: { family_support, social_pressure, ... },
  ...
}

Réponds UNIQUEMENT avec le JSON, aucun texte avant/après.
```

**Prompt 2 - Cross-Correlation:**
```
Analyse ces data points extraits.
Identifie:
1. Patterns significatifs
2. Contradictions (ex: "mange bien" mais waist 110cm)
3. Red flags métaboliques
4. Cohérence psychologique

Output JSON:
{
  patterns: [...],
  contradictions: [...],
  red_flags: [...],
  insights: [...]
}
```

**Prompt 3 - IPT Calculation:**
```
Calcule IPT Score selon formules IPT.

FORMULES:
{Include formulas from IPT doc}

DATA:
{Extracted data}

Output JSON avec scores 0-100:
{
  total: X,
  metabolic: X,
  psychological: X,
  environmental: X,
  infrastructure: X,
  subscores: { ir: X, hpa: X, thyroid: X, ... }
}
```

**Prompt 4 - Brake Detection:**
```
Identifie freins transformation.

CATÉGORIES:
- metabolic_ir, metabolic_hpa, metabolic_thyroid, metabolic_inflammation
- psychological_locus, psychological_self_efficacy, psychological_motivation, psychological_emotional_eating
- environmental_family, environmental_work, environmental_social
- infrastructure_time, infrastructure_budget, infrastructure_equipment

Pour chaque frein détecté:
{
  category: "...",
  name: "...",
  severity: "low|moderate|high|critical",
  confidence: 0.X,
  supporting_data: {...},
  correction_strategy: "...",
  priority: 1-10,
  estimated_correction_time: "..."
}

Output array JSON top 5-10 freins priorisés.
```

**Prompt 5 - Report Generation:**
```
Génère rapport markdown complet (sera converti en DOCX).

STRUCTURE:
# DIAGNOSTIC VIRTUS Smart fit - {client_name}

## Executive Summary
- IPT Score: X/100
- Potentiel: [Faible/Modéré/Élevé/Exceptionnel]
- Top 3 freins critiques

## Breakdown Scores
### Métabolique (X/100)
- Résistance Insuline: X/100 [Analysis]
- HPA Axis: X/100 [Analysis]
- Thyroïde: X/100 [Analysis]
- Inflammation: X/100 [Analysis]

### Psychologie (X/100)
- Self-Efficacy: X/100
- Motivation Qualité: X/100
- ...

[etc pour toutes composantes]

## Freins Détectés (Ordre Priorité)

### 1. [Frein Name] (CRITIQUE)
- Evidence: ...
- Impact: ...
- Correction Strategy: ...
- Timeline: ...

[Repeat pour top 5-10 freins]

## Protocole Phase 1 (4-8 semaines)

### Nutrition
- Calorique: ...
- Macros: ...
- Meal Timing: ...
- Suppléments: ...

### Training
- Fréquence: ...
- Split: ...
- Volume: ...
- Intensité: ...

### Lifestyle
- Sommeil: ...
- Stress Management: ...
- Hydratation: ...

## Roadmap 12 Semaines
[Timeline détaillé]

---
Rapport généré le {date} par VIRTUS AI V3
```

---

## 🎯 TIMELINE RECOMMANDÉE

### **SEMAINE 1 - Frontend Core**
- Jour 1-2: Landing page + Hero + Calculator embed
- Jour 3-4: Pricing page + Bilan Complet form
- Jour 5: Polish UI/UX + Responsive

### **SEMAINE 2 - Backend & Integration**
- Jour 1-2: API routes (calculate-ipt, stripe checkout/webhook)
- Jour 3-4: VIRTUS AI V3 (5 prompts)
- Jour 5: Email templates + testing

### **SEMAINE 3 - Testing & Deploy**
- Jour 1-2: End-to-end testing flow complet
- Jour 3: Bug fixes + optimizations
- Jour 4: Deploy Vercel + configure domaine
- Jour 5: Monitoring + analytics setup

---

## 📝 NOTES IMPORTANTES

### **Formules IPT à Implémenter**

Tu devras coder les formules exactes du doc IPT dans `lib/ipt-calculator.ts`.

Exemple structure:
```typescript
export function calculateMetabolicScore(responses: CalculatorResponses): number {
  let score = 100; // Start at 100, subtract penalties
  
  // Insulin Resistance signals
  if (responses.waist_circumference > 102 && responses.gender === 'Homme') {
    score -= 20; // Critical IR risk
  }
  if (responses.hunger_2h_post_meal === true) {
    score -= 10;
  }
  if (responses.sugar_cravings_frequency === 'Quotidien') {
    score -= 15;
  }
  
  // HPA Dysfunction signals
  if (responses.coffee_dependency_morning === '>3 cafés + obligatoire') {
    score -= 15;
  }
  if (responses.energy_crash_afternoon >= 4) {
    score -= 10;
  }
  if (responses.night_awakenings === 'Multiples (sommeil fragmenté)') {
    score -= 15;
  }
  
  // ... Continue pour tous signaux
  
  return Math.max(0, Math.min(100, score)); // Clamp 0-100
}
```

Référence doc IPT section formules IPT.

### **PDF Generation**

Pour générer PDFs des rapports, utilise une de ces options:
1. **Puppeteer** (render HTML → PDF)
2. **jsPDF** (JavaScript PDF library)
3. **Docx → PDF service** (Gotenberg, CloudConvert)

Recommandation: **Puppeteer** sur Vercel avec `@sparticuz/chromium`

---

## ✅ CHECKLIST AVANT DEPLOY

- [ ] Toutes env variables configurées
- [ ] Supabase schema exécuté
- [ ] Stripe products créés (3 prices)
- [ ] Resend domaine vérifié
- [ ] Anthropic credits disponibles
- [ ] Tests locaux OK
- [ ] Build Next.js réussit (`npm run build`)
- [ ] Vercel deploy OK
- [ ] Domaine custom configuré
- [ ] Stripe webhook pointant sur prod
- [ ] Test end-to-end en production
- [ ] Monitoring setup (Sentry/Vercel Analytics)

---

**🚀 INFRASTRUCTURE COMPLÈTE. TIME TO CODE! 💪**
