# DÉPLOIEMENT ET PUBLICATION — STRYVR App Mobile

## Version 1.0.0 — Mai 2026

## Partie de l'écosystème STRYVLAB

---

## CONTEXTE

Ce document détaille les étapes obligatoires pour publier STRYVR sur les stores iOS (App Store) et Android (Google Play), basé sur la stack technique décrite dans `ARCHITECTURE.md` (Expo SDK 52+, EAS Build, EAS Update).

STRYVR est une app mobile native (pas webapp/PWA) conçue pour iOS + Android simultanément dès la V1.

---

## PRÉREQUIS OBLIGATOIRES

### Comptes Développeur

- **Apple Developer Program** : 99€/an. Nécessaire pour App Store Connect, certificats, TestFlight.
- **Google Play Console** : 25€ unique. Nécessaire pour Google Play.
- **Expo Application Services (EAS)** : Compte Expo gratuit/payant selon usage. Nécessaire pour EAS Build et EAS Update.

### Configuration Technique

- Bundle ID iOS : `com.stryvr.app` (unique sur App Store).
- Package Name Android : `com.stryvr.app` (unique sur Google Play).
- Icônes : 1024x1024px (requis pour stores).
- Permissions : HealthKit (iOS), Health Connect (Android) configurées dans `app.json`/`eas.json`.

---

## ÉTAPES DE DÉPLOIEMENT

### 1. Configuration EAS Build

- Installer EAS CLI : `npm install -g @expo/eas-cli`
- Se connecter : `eas login`
- Créer `eas.json` à la racine de `stryvr/` :
  ```json
  {
    "build": {
      "development": {
        "developmentClient": true,
        "distribution": "internal"
      },
      "preview": {
        "distribution": "internal"
      },
      "production": {
        "channel": "production"
      }
    },
    "submit": {
      "production": {}
    }
  }
  ```
- Configurer `app.json` avec metadata stores (nom, description FR, screenshots).

### 2. Builds de Développement/Test

- Build dev : `eas build --platform ios --profile development`
- Distribuer via TestFlight (iOS) ou Google Play Beta (Android).
- Tests fonctionnels sur devices réels : valider onboarding, check-ins, nutrition composer, training, insights.

### 3. Préparation Stores

- **App Store Connect** :
  - Créer app avec bundle ID.
  - Préparer screenshots (iPhone/iPad), description FR, mots-clés.
  - Configurer achats in-app si applicable.
- **Google Play Console** :
  - Créer app avec package name.
  - Préparer screenshots (phones/tablets), description FR, catégories (Santé & Fitness).
  - Configurer politique confidentialité (RGPD compliant).

### 4. Builds de Production

- Build iOS : `eas build --platform ios --profile production`
- Build Android : `eas build --platform android --profile production`
- Télécharger les binaires depuis EAS dashboard.

### 5. Soumission aux Stores

- **iOS** : Uploader via EAS Submit (`eas submit --platform ios`) ou Transporter. Soumettre pour revue (5-7 jours).
- **Android** : Uploader AAB via Google Play Console. Publier en production (24-48h).
- Gérer rejets potentiels (guidelines santé/fitness).

### 6. Post-Lancement

- **OTA Updates** : `eas update --channel production` pour mises à jour JS sans resoumission.
- **Monitoring** : Sentry (erreurs), PostHog (analytics RGPD).
- **Support** : Répondre avis utilisateurs, corriger bugs critiques.

---

## RISQUES ET VALIDATIONS

- **RGPD** : Analytics PostHog configuré compliant (Belgique/France).
- **Rejets Stores** : Prévoir 1-2 itérations pour guidelines (ex: contenu santé).
- **Performance** : Tests sur devices anciens (iOS 15+, Android 8+).
- **Sécurité** : Auth Supabase, données chiffrées.

---

## RÉFÉRENCES

- `ARCHITECTURE.md` : Stack EAS Build + OTA.
- Guides Expo : https://docs.expo.dev/submit/introduction/
- App Store Guidelines : https://developer.apple.com/app-store/review/guidelines/
- Google Play Policies : https://play.google.com/about/developer-content-policy/

---

_Mis à jour : 14 mai 2026_</content>
<parameter name="filePath">/Users/user/Desktop/STRYVLAB/stryvr/DEPLOYMENT.md
