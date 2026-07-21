---
name: STRYV
description: Une expérience de coaching connectée, sombre et précise.
colors:
  app-background: "#121212"
  client-background: "#0A0A0A"
  surface: "#181818"
  surface-elevated: "#1C1C1C"
  surface-interactive: "#222222"
  accent: "#1F8A65"
  accent-hover: "#217356"
  accent-deep: "#1F4637"
  text-primary: "#FFFFFF"
  text-heading: "#E0E0E0"
  text-body: "#B0B0B0"
  text-muted: "#808080"
  text-disabled: "#5A5A5A"
  attention: "#FF8660"
typography:
  display:
    fontFamily: "Barlow, sans-serif"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow Condensed, sans-serif"
    fontWeight: 600
    letterSpacing: "0.14em"
rounded:
  compact: "8px"
  card: "12px"
  panel: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "0 16px"
    height: "44px"
  surface-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.panel}"
    padding: "16px"
  notification-row:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "14px"
  bottom-navigation:
    backgroundColor: "{colors.app-background}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.panel}"
    padding: "8px 12px"
---

## Overview

**Creative North Star: "La discipline silencieuse"**

STRYV est un outil de pilotage, pas un décor de fitness. L'interface relie le raisonnement du coach aux actions quotidiennes du client dans un environnement sombre, dense et maîtrisé. Chaque surface doit faire ressortir une décision, une progression ou la prochaine action sans distraire de l'effort en cours.

La personnalité est sobre, précise et motivante. La profondeur vient des couches tonales, des bordures ultra-fines et d'une hiérarchie de texte nette — jamais de verre décoratif, de halos permanents ou d'illustrations guerrières. L'énergie doit évoquer la répétition et la maîtrise, pas l'agressivité.

**Key Characteristics:**
- Fond proche du noir, surfaces Flat Dark et contraste utilitaire.
- Accent vert rare, réservé aux actions, états actifs et progrès réels.
- Typographie compacte et lisible qui sépare le repère, la donnée et l'action.
- Mouvement court, orienté retour d'état, jamais chorégraphié.

## Colors

Une palette de noirs neutres laisse les informations et l'accent émerger uniquement lorsqu'ils sont utiles.

### Primary
- **Vert de progression** (`#1F8A65`): actions principales, navigation active, confirmations et progression accomplie.
- **Vert actif** (`#217356`): survol, pression et continuité de l'action primaire.
- **Vert profond** (`#1F4637`): fonds de succès atténués et indicateurs contextuels.

### Secondary
- **Signal d'attention** (`#FF8660`): informations urgentes, badges et états nécessitant une action. Ne jamais l'utiliser comme décoration.

### Neutral
- **Noir d'application** (`#121212`): fond général de la plateforme et dock flottant.
- **Noir client** (`#0A0A0A`): fond de la PWA client, chrome et champs assombris.
- **Surface Flat Dark** (`#181818`): cartes et feuilles principales.
- **Surface élevée** (`#1C1C1C`): lignes et éléments contenus dans une carte.
- **Surface interactive** (`#222222`): champs et contrôles actifs.
- **Texte principal** (`#FFFFFF`) et **texte de titre** (`#E0E0E0`): contenu décisionnel et valeurs.
- **Texte corps** (`#B0B0B0`), **muet** (`#808080`) et **désactivé** (`#5A5A5A`): détails secondaires selon leur importance.

**The One Accent Rule.** Le vert n'est pas une ambiance : il signale une action, une sélection ou un progrès réel. Une carte inactive reste neutre.

## Typography

**Display Font:** Barlow, sans-serif
**Body Font:** Inter, system-ui, sans-serif
**Label/Mono Font:** Barlow Condensed, sans-serif

**Character:** La lecture courante reste neutre et efficace. Barlow apporte du poids aux données et aux titres, tandis que Barlow Condensed structure les repères courts avec une tension calme et fonctionnelle.

### Hierarchy
- **Display** (700, 24–40px, 1.1): scores, chiffres clés et titres de destination.
- **Headline** (600–700, 18–24px, 1.2): noms de séance, intitulés de section et décisions principales.
- **Title** (500–600, 13–16px, 1.3): actions et contenus de cartes.
- **Body** (400, 12–14px, 1.5): explications courtes et contenu de suivi.
- **Label** (600, 10–11px, 0.14em, uppercase): catégories, repères et métadonnées brèves.

**The Evidence Rule.** Les labels décrivent, les chiffres prouvent, les titres orientent. Ne pas transformer chaque phrase en uppercase ni surcharger le suivi de micro-labels.

## Elevation

Le système est plat par défaut. La profondeur repose sur une montée de ton de `#0A0A0A` à `#222222`, des bordures blanches à faible opacité et des séparations nettes. Les ombres sont limitées aux menus flottants, feuilles et modales qui doivent franchir une couche d'interface.

### Shadow Vocabulary
- **Surface** (`0 1px 0 rgba(255,255,255,0.04) inset`): définition discrète des cartes sans effet flottant.
- **Élevé** (`0 8px 24px rgba(0,0,0,0.45)`): panneau au-dessus du contenu.
- **Modal** (`0 16px 48px rgba(0,0,0,0.55)`): feuille ou modal au premier plan.
- **Focus** (`0 0 0 1px #1F8A65`): état clavier et champ actif.

**The Flat-By-Default Rule.** Ne pas combiner une bordure visible et une grande ombre douce par défaut. Une séparation tonale ou une ombre structurelle suffit.

## Components

### Buttons
- **Shape:** rayon de 12px pour une action, 8px pour un contrôle compact, pill uniquement pour les badges.
- **Primary:** fond `#1F8A65`, texte blanc, hauteur minimale de 44px, graisse 600, pression `scale(0.96–0.98)` en 150ms.
- **Hover / Focus:** fond `#217356` au survol ; anneau vert fin au focus clavier ; désactivé à opacité réduite sans changer la hiérarchie.
- **Secondary / Ghost:** fond blanc entre 3% et 6% d'opacité, texte blanc atténué ; ne pas créer de deuxième accent concurrent.

### Chips
- **Style:** surface neutre légèrement relevée, rayon pill, texte compact et donnée tabulaire si nécessaire.
- **State:** le chip sélectionné peut employer un fond vert à faible opacité et du texte vert ; un chip inactif reste neutre.

### Cards / Containers
- **Corner Style:** 16px pour les cartes et sections principales, 12px pour les cartes internes.
- **Background:** `#181818` pour une surface autonome ; à l'intérieur, `#1C1C1C` ou blanc à 3% d'opacité pour la ligne actionnable.
- **Shadow Strategy:** aucune ombre en repos ; élévation uniquement au-dessus du flux normal.
- **Border:** `0.3px` blanc à 4% d'opacité pour une carte principale, 6% pour une ligne interne interactive.
- **Internal Padding:** 16px pour une carte, 12–14px pour une ligne interne.

### Inputs / Fields
- **Style:** fond `#0A0A0A` ou `#222222`, rayon 8–12px, texte `#E0E0E0`, libellé explicite.
- **Focus:** anneau vert de 1px ; pas de glow diffus décoratif.
- **Error / Disabled:** signal rouge ou orange réservé à l'état, accompagné d'un libellé clair ; contenu désactivé à `#5A5A5A`.

### Navigation
- **Style:** dock flottant `#121212`, rayon 16px, hauteur client de 64px hors zone sûre. Les onglets inactifs sont `#808080` ; l'onglet courant utilise un fond vert à 10% et le vert `#1F8A65`.
- **Mobile treatment:** réserver l'espace du dock, respecter les safe areas et ne pas masquer l'action active sous la navigation.

### Notification Row
- **Style:** section externe Flat Dark, ligne interne `#1C1C1C` / blanc à 3%, icône dans un puits discret et point d'état coloré.
- **State:** action courte en vert ; alerte colorée toujours accompagnée d'un titre et d'un texte explicite.

## Do's and Don'ts

### Do:
- **Do** utiliser `#181818` pour les cartes client autonomes et `#0A0A0A` pour le fond PWA.
- **Do** réserver `#1F8A65` aux actions principales, progrès, succès et sélection active.
- **Do** construire la hiérarchie avec la taille, la graisse, l'opacité et les surfaces, avant d'ajouter une couleur.
- **Do** garder les interactions entre 150ms et 200ms et proposer une alternative sans mouvement pour `prefers-reduced-motion`.
- **Do** conserver des libellés explicites et des zones tactiles d'au moins 44px pour les actions.

### Don't:
- **Don't** utiliser une interface colorée, ludique ou générique de SaaS.
- **Don't** ajouter de luxe artificiel, d'ornements dorés ou d'effets de prestige sans fonction.
- **Don't** utiliser des codes de jeu, une gamification envahissante ou des animations démonstratives.
- **Don't** rendre une carte transparente : une section doit rester une surface stable sur le fond de page.
- **Don't** employer le vert pour décorer une surface inactive ou multiplier les bordures épaisses, halos et dégradés.
