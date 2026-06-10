# 🚀 Guide de Déploiement sur virtus-smartfit.com

## 📋 Checklist de Déploiement

### ✅ Étape 1 : Vérifier que le build fonctionne localement

```bash
npm run build
```

Si le build échoue, corrige les erreurs avant de continuer.

---

### ✅ Étape 2 : Déployer sur Vercel

Tu as déjà un projet Vercel lié (`virtus-smart-fit`). Pour déployer :

```bash
# Déploiement en production
npx vercel --prod

# Ou pour tester d'abord en preview
npx vercel
```

**Note :** Le projet est déjà lié, donc Vercel utilisera automatiquement la bonne configuration.

---

### ✅ Étape 3 : Configurer les Variables d'Environnement sur Vercel

1. Va sur [Vercel Dashboard](https://vercel.com/dashboard)
2. Sélectionne ton projet `virtus-smart-fit`
3. Va dans **Settings** → **Environment Variables**
4. Ajoute **TOUTES** les variables de ton `.env.local` :

#### Variables OBLIGATOIRES :

```env
# App (IMPORTANT : Change l'URL pour la production)
NEXT_PUBLIC_APP_URL=https://www.virtus-smartfit.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Stripe (Utilise les clés LIVE en production, pas test)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_TIER1_RAPPORT=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_TIER2_PROTOCOL=price_xxxxx
NEXT_PUBLIC_STRIPE_PRICE_TIER3_COACHING=price_xxxxx

# Resend
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=diagnostic@virtus-smartfit.com

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Security
NEXTAUTH_SECRET=ton_secret_genere
TOKEN_SECRET=ton_autre_secret
```

**⚠️ IMPORTANT :**
- Pour `NEXT_PUBLIC_APP_URL`, utilise `https://www.virtus-smartfit.com` (pas localhost)
- Pour Stripe, utilise les clés **LIVE** (pas test) en production
- Sélectionne **Production, Preview, Development** pour chaque variable

---

### ✅ Étape 4 : Ajouter le Domaine virtus-smartfit.com

1. Va sur Vercel Dashboard → Ton projet → **Settings** → **Domains**
2. Clique sur **Add Domain**
3. Entre `virtus-smartfit.com`
4. Vercel te donnera des instructions DNS à configurer

#### Configuration DNS (selon ton registrar) :

**Option A : Configuration A Record (Recommandé)**
```
Type: A
Name: @ (ou laisse vide)
Value: 76.76.21.21
TTL: Auto (ou 3600)
```

**Option B : Configuration CNAME (Alternative)**
```
Type: CNAME
Name: @ (ou www)
Value: cname.vercel-dns.com
TTL: Auto
```

**Pour www.virtus-smartfit.com :**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: Auto
```

5. Attends la propagation DNS (5-30 minutes, parfois jusqu'à 48h)
6. Vérifie que le domaine est actif dans Vercel (statut "Valid")

---

### ✅ Étape 5 : Mettre à jour le Webhook Stripe

1. Va sur [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Trouve ton endpoint webhook existant ou crée-en un nouveau
3. Mets à jour l'URL :
   ```
   https://www.virtus-smartfit.com/api/stripe/webhook
   ```
4. Copie le **Signing Secret** et mets-le dans Vercel comme `STRIPE_WEBHOOK_SECRET`
5. Sélectionne les événements à écouter :
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - (autres selon tes besoins)

---

### ✅ Étape 6 : Redéployer après les changements

Après avoir ajouté/modifié les variables d'environnement ou le domaine :

```bash
# Redéploie en production
npx vercel --prod
```

Ou utilise le **Redeploy** dans le dashboard Vercel.

---

### ✅ Étape 7 : Vérifier que tout fonctionne

1. **Teste l'accès :** Va sur `https://www.virtus-smartfit.com`
2. **Teste les liens :** Vérifie que tous les liens internes fonctionnent
3. **Teste Stripe :** Fais un paiement test avec une carte de test Stripe
4. **Teste le webhook :** Vérifie dans Stripe Dashboard que les webhooks sont reçus
5. **Vérifie Supabase :** Check que les données sont bien enregistrées

---

## 🔧 Commandes Utiles

```bash
# Voir les logs de déploiement
npx vercel logs

# Voir les variables d'environnement
npx vercel env ls

# Déployer en preview (test)
npx vercel

# Déployer en production
npx vercel --prod

# Voir les domaines configurés
npx vercel domains ls
```

---

## 🐛 Problèmes Courants

### Le domaine ne fonctionne pas
- Vérifie que les DNS sont bien configurés (utilise `dig virtus-smartfit.com` ou [dnschecker.org](https://dnschecker.org))
- Attends la propagation DNS (peut prendre jusqu'à 48h)
- Vérifie que le domaine est bien validé dans Vercel

### Les variables d'environnement ne sont pas prises en compte
- Redéploie après avoir ajouté les variables
- Vérifie que tu as sélectionné "Production" pour les variables
- Les variables `NEXT_PUBLIC_*` doivent être dans les 3 environnements

### Stripe ne fonctionne pas
- Vérifie que tu utilises les clés **LIVE** (pas test)
- Vérifie que le webhook pointe vers `https://www.virtus-smartfit.com/api/stripe/webhook`
- Vérifie que `STRIPE_WEBHOOK_SECRET` est correct

### Erreurs de build
- Vérifie les logs : `npx vercel logs`
- Teste le build localement : `npm run build`
- Vérifie que toutes les dépendances sont dans `package.json`

---

## 📝 Notes Importantes

1. **HTTPS automatique :** Vercel fournit automatiquement un certificat SSL pour ton domaine
2. **Variables d'environnement :** Les variables `NEXT_PUBLIC_*` sont exposées au client, ne mets pas de secrets dedans
3. **Stripe Live Mode :** Assure-toi d'utiliser les clés LIVE en production
4. **DNS Propagation :** Peut prendre jusqu'à 48h, sois patient
5. **Redéploiement :** Après chaque changement de variable d'environnement, redéploie

---

## ✅ Checklist Finale

- [ ] Build local fonctionne (`npm run build`)
- [ ] Déployé sur Vercel (`npx vercel --prod`)
- [ ] Toutes les variables d'environnement sont configurées
- [ ] `NEXT_PUBLIC_APP_URL=https://www.virtus-smartfit.com`
- [ ] Domaine `virtus-smartfit.com` ajouté et validé dans Vercel
- [ ] DNS configuré et propagé
- [ ] Webhook Stripe mis à jour avec la bonne URL
- [ ] Site accessible sur `https://www.virtus-smartfit.com`
- [ ] Tests fonctionnels effectués (paiement, webhook, etc.)

Une fois tout cela fait, ton site localhost sera accessible sur **virtus-smartfit.com** !















