# 🚀 Comment Publier en Ligne - Guide Simple

## 📋 Étape par Étape

### ✅ Étape 1 : Vérifier que tout fonctionne localement

```bash
# Teste le build
npm run build
```

Si ça fonctionne, continue. Sinon, corrige les erreurs d'abord.

---

### ✅ Étape 2 : Commiter tes changements (optionnel mais recommandé)

```bash
# Ajoute tous les fichiers modifiés
git add .

# Commite
git commit -m "Préparation pour déploiement production"

# Push vers GitHub (si tu as un repo)
git push
```

---

### ✅ Étape 3 : Configurer les Variables d'Environnement sur Vercel

**C'EST LA PARTIE LA PLUS IMPORTANTE !**

1. Va sur [vercel.com](https://vercel.com) et connecte-toi
2. Va dans ton projet `genesis-lab`
3. Clique sur **Settings** → **Environment Variables**
4. Ajoute **TOUTES** les variables de ton fichier `.env.local`

**⚠️ IMPORTANT :**
- Pour `NEXT_PUBLIC_APP_URL`, mets : `https://www.virtus-smartfit.com` (pas localhost !)
- Pour Stripe, utilise les clés **LIVE** (pas test) : `pk_live_...` et `sk_live_...`
- Sélectionne **Production, Preview, Development** pour chaque variable

**Liste complète des variables :** Voir `ENV_CHECKLIST.md`

---

### ✅ Étape 4 : Ajouter le Domaine virtus-smartfit.com

1. Dans Vercel Dashboard → Ton projet → **Settings** → **Domains**
2. Clique sur **Add Domain**
3. Entre : `virtus-smartfit.com`
4. Vercel te donnera des instructions DNS à configurer

**Configuration DNS :**
- Va sur ton registrar (Namecheap, GoDaddy, etc.)
- Ajoute un enregistrement **A** :
  - Type : A
  - Name : @ (ou laisse vide)
  - Value : `76.76.21.21` (ou l'IP que Vercel te donne)
  - TTL : Auto

- Pour www.virtus-smartfit.com, ajoute un **CNAME** :
  - Type : CNAME
  - Name : www
  - Value : `cname.vercel-dns.com`

5. Attends 5-30 minutes (parfois jusqu'à 48h) pour la propagation DNS

---

### ✅ Étape 5 : Déployer !

```bash
# Option 1 : Déploiement rapide
npm run deploy:prod

# Option 2 : Déploiement avec vérifications
npm run deploy
```

Le script va :
- Vérifier que le build fonctionne
- Te demander confirmation
- Déployer sur Vercel

**Ou manuellement :**
```bash
npx vercel --prod
```

---

### ✅ Étape 6 : Mettre à jour le Webhook Stripe

1. Va sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. **Developers** → **Webhooks**
3. Trouve ou crée ton endpoint webhook
4. Change l'URL vers : `https://www.virtus-smartfit.com/api/stripe/webhook`
5. Copie le **Signing Secret** et mets-le dans Vercel comme `STRIPE_WEBHOOK_SECRET`
6. Sélectionne les événements : `checkout.session.completed`

---

### ✅ Étape 7 : Vérifier que tout fonctionne

1. **Teste le site :** Va sur `https://www.virtus-smartfit.com`
2. **Teste les liens :** Vérifie que tout fonctionne
3. **Teste un paiement :** Fais un test avec une carte Stripe test
4. **Vérifie les logs :** `npx vercel logs` si besoin

---

## 🎯 Commandes Utiles

```bash
# Voir les logs de déploiement
npx vercel logs

# Voir les variables d'environnement configurées
npx vercel env ls

# Redéployer après un changement
npm run deploy:prod

# Voir les domaines configurés
npx vercel domains ls
```

---

## ⚠️ Erreurs Courantes

### ❌ "Build failed"
**Solution :** Teste localement avec `npm run build` et corrige les erreurs

### ❌ "Environment variable not found"
**Solution :** Vérifie que toutes les variables sont dans Vercel Dashboard → Settings → Environment Variables

### ❌ "Domain not working"
**Solution :** 
- Vérifie les DNS sur [dnschecker.org](https://dnschecker.org)
- Attends la propagation (peut prendre jusqu'à 48h)
- Vérifie que le domaine est validé dans Vercel

### ❌ "Stripe payment doesn't work"
**Solution :**
- Vérifie que tu utilises les clés **LIVE** (pas test)
- Vérifie que le webhook pointe vers `https://www.virtus-smartfit.com/api/stripe/webhook`
- Vérifie que `STRIPE_WEBHOOK_SECRET` est correct

---

## 📝 Checklist Finale

Avant de dire "c'est fait", vérifie :

- [ ] Build local fonctionne (`npm run build`)
- [ ] Toutes les variables d'environnement sont dans Vercel
- [ ] `NEXT_PUBLIC_APP_URL` = `https://www.virtus-smartfit.com`
- [ ] Les clés Stripe sont en mode LIVE
- [ ] Le domaine `virtus-smartfit.com` est ajouté dans Vercel
- [ ] Les DNS sont configurés et propagés
- [ ] Le webhook Stripe est configuré avec la bonne URL
- [ ] Le site est accessible sur `https://www.virtus-smartfit.com`
- [ ] Un test de paiement fonctionne

---

## 🎉 C'est Tout !

Une fois tout ça fait, ton site sera en ligne sur **virtus-smartfit.com** !

**Besoin d'aide ?** Regarde :
- `QUICK_DEPLOY.md` - Guide rapide
- `ENV_CHECKLIST.md` - Liste complète des variables
- `DEPLOYMENT_GUIDE.md` - Guide détaillé avec troubleshooting















