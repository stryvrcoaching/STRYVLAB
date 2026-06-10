# 🚀 VIRTUS Smart fit - Guide Setup Complet

**Architecture complète:** Landing Page + IPT Calculator (gratuit) + Bilan Complet (payant) + VIRTUS AI V3 (AI Analysis)

---

## 📦 CONTENU PACKAGE

```
virtus-smart-fit/
├── app/                          # Next.js App Router
│   ├── layout.tsx
│   ├── globals.css
│   ├── virtus-smart-fit/       # Landing page + Calculator
│   ├── bilan-complet/            # Bilan complet (post-payment)
│   └── api/                      # API routes
│       ├── calculate-ipt/
│       ├── stripe/
│       └── analyze/
├── components/                   # React components
│   ├── calculator/               # IPT Calculator multi-step
│   ├── bilan/                    # Bilan Complet form
│   └── ui/                       # UI components
├── lib/                          # Utilities
│   ├── questionnaires/           # JSON questionnaires
│   ├── supabase.ts
│   ├── stripe.ts
│   └── virtus-ai.ts             # VIRTUS AI V3
├── types/                        # TypeScript types
├── supabase/                     # Database schema
├── emails/                       # Email templates (Resend)
└── docs/                         # Documentation

TOTAL: ~60 fichiers, Production-ready
```

---

## 🎯 ARCHITECTURE SYSTÈME

### **FLOW COMPLET:**

```
1. USER visite /
   ↓
2. Remplit IPT Calculator (48Q, 10min) - GRATUIT
   ↓
3. Résultat IPT affiché (ex: 34/100)
   ↓
4. CTA: "Débloquer Diagnostic Complet" → Pricing
   ↓
5. Choix Tier (47€ / 197€ / 1997€)
   ↓
6. Paiement Stripe
   ↓
7a. TIER 1: Email avec Rapport PDF (AI rapide)
7b. TIER 2/3: Email avec lien Bilan Complet
   ↓
8. User remplit Bilan Complet (75Q MVP, 25min)
   ↓
9. VIRTUS AI V3 analyse (AI forensique)
   ↓
10. Email Rapport complet + Protocole personnalisé
```

---

## ⚙️ SETUP - ÉTAPE PAR ÉTAPE

### **1. PRÉREQUIS**

- Node.js 18+ installé
- Compte Supabase (gratuit)
- Compte Stripe (mode test OK)
- Compte Resend (gratuit 3000 emails/mois)
- API Key Anthropic (Claude)
- Cursor IDE ou VS Code

---

### **2. INSTALLATION LOCALE**

```bash
# Clone/Copie le dossier dans Cursor
cd virtus-smart-fit

# Install dependencies
npm install

# Copie .env.example vers .env.local
cp .env.example .env.local

# Édite .env.local avec tes vraies variables (voir section 3)
```

---

### **3. CONFIGURATION SERVICES**

#### **A) SUPABASE**

1. Crée projet sur [supabase.com](https://supabase.com)
2. Dashboard → Settings → API → Copie:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. SQL Editor → Colle le contenu de `supabase/schema.sql` → Run
   - ✅ Crée 5 tables: ipt_calculator_results, assessments, assessment_brakes, analysis_log, email_deliveries

4. Vérifie dans Table Editor que tout est créé

#### **B) STRIPE**

1. Crée compte [stripe.com](https://stripe.com) (mode test OK)
2. Dashboard → Developers → API Keys → Copie:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_...)
   - `STRIPE_SECRET_KEY` (sk_test_...)

3. **IMPORTANT: Crée 3 produits/prix:**
   - Products → Add Product
   - **Rapport IPT:** 47 EUR → Copie Price ID → `STRIPE_PRICE_TIER1_RAPPORT`
   - **Diagnostic Complet:** 197 EUR → Copie Price ID → `STRIPE_PRICE_TIER2_PROTOCOL`
   - **Coaching 3.0:** 1997 EUR → Copie Price ID → `STRIPE_PRICE_TIER3_COACHING`

4. **Webhook (après déploiement Vercel):**
   - Developers → Webhooks → Add endpoint
   - URL: `https://ton-domaine.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`
   - Copie Signing secret → `STRIPE_WEBHOOK_SECRET`

#### **C) RESEND (Emails)**

1. Crée compte [resend.com](https://resend.com)
2. API Keys → Create → Copie → `RESEND_API_KEY`
3. Domains → Add domain: `virtus-smartfit.com`
   - Configure DNS (MX, TXT records)
   - Vérifie domaine

4. From email: `diagnostic@virtus-smartfit.com` → `RESEND_FROM_EMAIL`

#### **D) ANTHROPIC (AI)**

1. Crée compte [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create → Copie → `ANTHROPIC_API_KEY`
3. Tu auras besoin de crédits (5-10€ pour tester)

#### **E) SECURITY TOKENS**

Génère des secrets sécurisés:

```bash
# MacOS/Linux:
openssl rand -base64 32

# Génère 2 tokens et copie dans .env.local:
# NEXTAUTH_SECRET=...
# TOKEN_SECRET=...
```

---

### **4. FICHIER .env.local COMPLET**

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_TIER1_RAPPORT=price_1Se9COJnGdVKN3qG6JrAHnMKEUR
STRIPE_PRICE_TIER2_PROTOCOL=price_1Se9DDJnGdVKN3qG0fhXbcfc
STRIPE_PRICE_TIER3_COACHING=price_1Se9EPJnGdVKN3qGnJ3aoKo9UR

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=diagnostic@virtus-smartfit.com

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Security
NEXTAUTH_SECRET=ton_secret_genere
TOKEN_SECRET=ton_autre_secret
```

---

### **5. LANCEMENT LOCAL**

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000)

**Test Flow:**
1. Remplis Calculator (fake data OK)
2. Vérifie résultat IPT affiché
3. Check Supabase Table Editor → `ipt_calculator_results` → nouvelle ligne
4. Clique "Débloquer Diagnostic" → Pricing
5. **Skip Stripe en dev** ou utilise carte test: `4242 4242 4242 4242`

---

### **6. DÉPLOIEMENT VERCEL**

#### **A) Setup Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Suit les prompts:
# - Link to existing project? No
# - Project name: virtus-smart-fit
# - Directory: ./
```

#### **B) Configure Env Variables**

Vercel Dashboard → Ton projet → Settings → Environment Variables

Copie **TOUTES** les variables de `.env.local` (sauf `NODE_ENV`)

**IMPORTANT:** Update `NEXT_PUBLIC_APP_URL` avec ton URL Vercel:
```
NEXT_PUBLIC_APP_URL=https://genesis-lab.vercel.app
```

#### **C) Configure Domaine Custom**

1. Vercel → Settings → Domains → Add
2. Domaine: `virtus-smartfit.com`
3. Configure DNS sur Namecheap:
   - Type A → @ → 76.76.21.21
   - Type CNAME → www → cname.vercel-dns.com

4. Attendre propagation DNS (5-30 min)

#### **D) Update Stripe Webhook**

Stripe Dashboard → Webhooks → Edit endpoint:
```
URL: https://www.virtus-smartfit.com/api/stripe/webhook
```

---

## 🧪 TESTS COMPLETS

### **Test 1: IPT Calculator**
1. Va sur `/`
2. Remplis formulaire Calculator
3. Vérifie score IPT affiché
4. Check Supabase: nouvelle ligne dans `ipt_calculator_results`

### **Test 2: Payment Tier 1 (47€)**
1. Clique "Débloquer Rapport IPT"
2. Choisis Tier 1
3. Paye avec carte test Stripe
4. Vérifie email reçu (Resend)
5. Check Supabase: `assessments` table, payment_status = completed

### **Test 3: Bilan Complet (Tier 2)**
1. Paye Tier 2 (197€)
2. Reçois email avec lien unique `/bilan-complet?token=xxx`
3. Remplis Bilan Complet (75Q)
4. Submit → Vérifie `assessments.bilan_completed = true`
5. Attendre analyse AI (~2-5 min)
6. Email avec Rapport PDF reçu

### **Test 4: VIRTUS AI V3**
1. Check `analysis_log` table pendant analyse
2. Vérifie steps: extraction → cross_correlation → ipt_calculation → brake_detection → report_generation
3. Si erreur: check `analysis_log.error_message`

---

## 🔧 PERSONNALISATION

### **Modifier Questionnaires**

Fichiers JSON dans `lib/questionnaires/`:
- `ipt-calculator.json` → Calculator gratuit (48Q)
- `bilan-complet-mvp.json` → Bilan payant (75Q MVP)

**Ajouter question:**
```json
{
  "id": "nouvelle_question",
  "type": "select",
  "text": "Texte question",
  "required": true,
  "options": ["Option 1", "Option 2"]
}
```

Types disponibles: `text`, `number`, `email`, `select`, `multiselect`, `textarea`, `boolean`, `scale`, `range`

### **Modifier Prompts VIRTUS AI V3**

Fichier: `lib/genesis-ai.ts`

5 prompts séquentiels:
1. **Extraction:** Parse responses JSON
2. **Cross-Correlation:** Détecte patterns/contradictions
3. **IPT Calculation:** Calcule scores selon formules
4. **Brake Detection:** Identifie freins + severity
5. **Report Generation:** Génère rapport DOCX

---

## 📊 MONITORING & DEBUG

### **Logs Vercel**
```bash
vercel logs --follow
```

### **Supabase Logs**
Dashboard → Logs → Filter par table

### **Stripe Events**
Dashboard → Events → Filter `checkout.session`

### **Resend Deliveries**
Dashboard → Emails → Status

---

## 🚨 TROUBLESHOOTING

### **"Supabase connection failed"**
→ Vérifie `SUPABASE_SERVICE_ROLE_KEY` (pas anon key)

### **"Stripe webhook signature invalid"**
→ Redéploie après avoir set `STRIPE_WEBHOOK_SECRET` correct

### **"Email not sent"**
→ Check Resend domain vérifié + From email correct

### **"VIRTUS AI timeout"**
→ Check Anthropic API key + crédits disponibles

### **"IPT Score = 0"**
→ Formule calcul dans `lib/ipt-calculator.ts` → Debug console.log

---

## 📞 SUPPORT

- **Documentation:** `/docs`
- **Issues:** Créer fichier `ISSUES.md`
- **Questions:** Contact VIRTUS Smart fit

---

## 🎯 PROCHAINES ÉTAPES

### **Après déploiement initial:**

1. ✅ Tester flow complet A→Z avec vraies données
2. ✅ Valider emails reçus (formatting OK)
3. ✅ Ajuster prompts VIRTUS AI V3 si hallucinations
4. ✅ Étendre Bilan Complet vers 120-150Q
5. ✅ Créer dashboard admin `/admin`
6. ✅ Analytics (Plausible ou PostHog)
7. ✅ A/B testing pricing/messaging

### **Optimisations futures:**

- Cache Redis pour calculs IPT répétés
- Queue jobs pour analyses longues (BullMQ)
- Webhook retry logic
- Rate limiting API routes
- GDPR compliance (data export/delete)

---

## ✨ FEATURES ACTUELLES

✅ Landing page premium medical design
✅ IPT Calculator gratuit (48Q, 10min)
✅ Calcul IPT instant avec formules
✅ 3 pricing tiers (47€ / 197€ / 1997€)
✅ Stripe Checkout integration
✅ Bilan Complet MVP (75Q, 25min)
✅ VIRTUS AI V3 (AI analysis 5 prompts)
✅ Email automation (Resend)
✅ Reports PDF generation
✅ Database complet Supabase (5 tables)
✅ TypeScript full
✅ Responsive mobile

---

## 📈 METRICS À TRACKER

- **Conversion Calculator → Pricing:** X%
- **Conversion Pricing → Payment:** X%
- **Bilan Completion Rate:** X%
- **Average IPT Score:** X/100
- **Top Brakes Detected:** IR (X%), HPA (X%), Psycho (X%)
- **Tier Distribution:** T1 (X%), T2 (X%), T3 (X%)

---

**🚀 TU ES PRÊT! Deploy et domine le game transformation.**
