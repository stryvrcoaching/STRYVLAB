# ⚡ Déploiement Rapide sur virtus-smartfit.com

## 🚀 En 3 Commandes

```bash
# 1. Vérifie que tout est prêt
npm run deploy:check

# 2. Déploie en production
npm run deploy:prod

# Ou utilise le script complet (avec vérifications)
npm run deploy
```

---

## 📋 Checklist Avant Déploiement

### ✅ Variables d'Environnement dans Vercel

1. Va sur [Vercel Dashboard](https://vercel.com/dashboard) → Ton projet → **Settings** → **Environment Variables**
2. Vérifie que **TOUTES** ces variables sont configurées (voir `ENV_CHECKLIST.md` pour la liste complète) :

**Variables CRITIQUES :**
- ✅ `NEXT_PUBLIC_APP_URL` = `https://www.virtus-smartfit.com` ⚠️ **Pas localhost !**
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `STRIPE_SECRET_KEY` = `sk_live_...` ⚠️ **Mode LIVE !**
- ✅ `STRIPE_WEBHOOK_SECRET`

### ✅ Domaine Configuré

1. Vercel Dashboard → **Settings** → **Domains**
2. Vérifie que `virtus-smartfit.com` est ajouté et validé
3. Vérifie que les DNS sont configurés correctement

### ✅ Webhook Stripe

1. Stripe Dashboard → **Developers** → **Webhooks**
2. Vérifie que l'URL est : `https://www.virtus-smartfit.com/api/stripe/webhook`
3. Vérifie que les événements sont sélectionnés

---

## 🎯 Commandes Disponibles

```bash
# Vérifier le build local
npm run build

# Vérifier la configuration (sans déployer)
npm run deploy:check

# Déployer en production (rapide)
npm run deploy:prod

# Déployer avec vérifications complètes
npm run deploy

# Voir les logs
npx vercel logs

# Voir les variables d'environnement
npx vercel env ls
```

---

## 🐛 Problèmes Courants

### "Build failed"
```bash
# Teste le build localement
npm run build
# Corrige les erreurs avant de redéployer
```

### "Environment variable not found"
- Vérifie que toutes les variables sont dans Vercel Dashboard
- Redéploie après avoir ajouté des variables

### "Domain not working"
- Vérifie les DNS avec [dnschecker.org](https://dnschecker.org)
- Attends la propagation (peut prendre jusqu'à 48h)

---

## 📚 Documentation Complète

- **Variables d'environnement :** `ENV_CHECKLIST.md`
- **Guide complet :** `DEPLOYMENT_GUIDE.md`
- **Exemple de variables :** `env.production.example`

---

## ✅ Après Déploiement

1. ✅ Teste `https://www.virtus-smartfit.com`
2. ✅ Teste un paiement Stripe (carte test)
3. ✅ Vérifie les logs : `npx vercel logs`
4. ✅ Vérifie que le webhook Stripe fonctionne

🎉 **C'est tout !**















