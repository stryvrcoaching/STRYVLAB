# ✅ Checklist des Variables d'Environnement

## 📋 Variables Requises pour Production (virtus-smartfit.com)

### 🔴 OBLIGATOIRES

#### App Configuration
- [ ] `NEXT_PUBLIC_APP_URL` = `https://www.virtus-smartfit.com` ⚠️ **IMPORTANT : Change de localhost**

#### Supabase (3 variables)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = `https://xxxxx.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGc...`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGc...`

#### Stripe (6 variables) ⚠️ **Utilise les clés LIVE en production**
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_xxxxx` (pas `pk_test_`)
- [ ] `STRIPE_SECRET_KEY` = `sk_live_xxxxx` (pas `sk_test_`)
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_xxxxx`
- [ ] `STRIPE_PRICE_TIER1_RAPPORT` = `price_xxxxx` (Price ID LIVE)
- [ ] `STRIPE_PRICE_TIER2_PROTOCOL` = `price_xxxxx` (Price ID LIVE)
- [ ] `STRIPE_PRICE_TIER3_COACHING` = `price_xxxxx` (Price ID LIVE)

#### Stripe - Variables NEXT_PUBLIC (3 variables) ⚠️ **Pour les composants client**
- [ ] `NEXT_PUBLIC_STRIPE_PRICE_TIER1_RAPPORT` = `price_xxxxx` (même que STRIPE_PRICE_TIER1_RAPPORT)
- [ ] `NEXT_PUBLIC_STRIPE_PRICE_TIER2_PROTOCOL` = `price_xxxxx` (même que STRIPE_PRICE_TIER2_PROTOCOL)
- [ ] `NEXT_PUBLIC_STRIPE_PRICE_TIER3_COACHING` = `price_xxxxx` (même que STRIPE_PRICE_TIER3_COACHING)

#### Resend (2 variables)
- [ ] `RESEND_API_KEY` = `re_xxxxx`
- [ ] `RESEND_FROM_EMAIL` = `diagnostic@virtus-smartfit.com`

#### Anthropic (1 variable)
- [ ] `ANTHROPIC_API_KEY` = `sk-ant-xxxxx`

#### Security (2 variables)
- [ ] `NEXTAUTH_SECRET` = (généré avec `openssl rand -base64 32`)
- [ ] `TOKEN_SECRET` = (généré avec `openssl rand -base64 32`)

---

## 📝 Où Trouver Chaque Variable

### Supabase
1. Va sur [supabase.com](https://supabase.com) → Ton projet
2. Settings → API
3. Copie les 3 valeurs

### Stripe
1. Va sur [stripe.com](https://stripe.com) → Dashboard
2. **IMPORTANT :** Passe en mode **LIVE** (pas test)
3. Developers → API Keys → Copie les clés LIVE
4. Products → Copie les Price IDs des produits LIVE
5. Developers → Webhooks → Crée/modifie endpoint → Copie Signing Secret

### Resend
1. Va sur [resend.com](https://resend.com)
2. API Keys → Create → Copie
3. Domains → Vérifie que `virtus-smartfit.com` est configuré

### Anthropic
1. Va sur [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create → Copie

### Security Tokens
```bash
# Génère 2 secrets différents
openssl rand -base64 32
openssl rand -base64 32
```

---

## ⚠️ Erreurs Communes

### ❌ Utiliser les clés TEST de Stripe en production
**✅ Solution :** Utilise les clés **LIVE** (`pk_live_` et `sk_live_`)

### ❌ Oublier les variables NEXT_PUBLIC_STRIPE_PRICE_*
**✅ Solution :** Ces variables sont nécessaires pour les composants client (DiagnosticCards.tsx)

### ❌ Mettre `NEXT_PUBLIC_APP_URL=http://localhost:3000`
**✅ Solution :** Change en `https://www.virtus-smartfit.com`

### ❌ Oublier de configurer le webhook Stripe
**✅ Solution :** Configure le webhook avec l'URL `https://www.virtus-smartfit.com/api/stripe/webhook`

---

## 🔍 Vérification Rapide

Avant de déployer, vérifie que :

1. ✅ Toutes les variables sont remplies (pas de `xxxxx` ou valeurs vides)
2. ✅ `NEXT_PUBLIC_APP_URL` = `https://www.virtus-smartfit.com`
3. ✅ Toutes les clés Stripe commencent par `pk_live_` ou `sk_live_` (pas `test`)
4. ✅ Les Price IDs Stripe sont ceux du mode LIVE
5. ✅ Le webhook Stripe pointe vers `https://www.virtus-smartfit.com/api/stripe/webhook`
6. ✅ Les secrets de sécurité sont générés (pas copiés-collés depuis un exemple)

---

## 📦 Variables par Fichier

### `lib/stripe.ts`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_TIER1_RAPPORT`
- `STRIPE_PRICE_TIER2_PROTOCOL`
- `STRIPE_PRICE_TIER3_COACHING`

### `lib/supabase.ts`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### `components/DiagnosticCards.tsx`
- `NEXT_PUBLIC_STRIPE_PRICE_TIER1_RAPPORT`
- `NEXT_PUBLIC_STRIPE_PRICE_TIER2_PROTOCOL`
- `NEXT_PUBLIC_STRIPE_PRICE_TIER3_COACHING`

### `app/api/stripe/checkout/route.ts`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_APP_URL`

### `app/api/stripe/webhook/route.ts`
- `STRIPE_WEBHOOK_SECRET`

---

## 🚀 Après Configuration

Une fois toutes les variables configurées dans Vercel :

1. Redéploie : `npx vercel --prod`
2. Vérifie les logs : `npx vercel logs`
3. Teste le site : `https://www.virtus-smartfit.com`
4. Teste un paiement avec une carte test Stripe
5. Vérifie que le webhook fonctionne dans Stripe Dashboard















