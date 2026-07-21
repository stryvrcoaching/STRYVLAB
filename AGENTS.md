# STRYV lab — Landing Page Agent Rules

Ce fichier définit le cadre de conception, de rédaction et d’implémentation de la landing principale de STRYV lab. Il s’applique au dépôt entier lorsqu’une modification concerne la landing, sa structure, ses assets ou ses composants partagés. Le dossier `/stryvr` est hors périmètre de la landing et ne doit pas servir de source de design ou de contenu.

## Identité produit

- **Produit :** STRYV lab.
- **Catégorie :** plateforme de pilotage du coaching personnalisé, orientée données et prescription.
- **Écosystème :** STRYV lab est l’espace de travail du coach ; STRYVR est l’expérience PWA côté client. Ne pas confondre les deux produits.
- **Cible prioritaire :** coach sportif indépendant ou équipe de coaching qui suit plusieurs clients.
- **Cibles secondaires :** préparateur physique, coach nutrition, studio ou organisation de coaching.
- **Langue de la landing :** français, avec une terminologie naturelle et compréhensible par un professionnel du coaching.

## Positionnement

- Présenter STRYV lab comme un système de travail connecté pour le coach, pas comme une simple collection de fonctionnalités.
- Message central : relier profils, bilans, prescriptions, expérience client et données pour soutenir la prochaine décision du coach.
- Différenciateur : continuité du raisonnement coach et contexte client réuni au même endroit.
- Conversion primaire : réservation d’une démonstration personnalisée de 40 minutes via `https://cal.com/stryvlab/demo-stryvlab`.
- Le parcours est demo-led : ne pas pousser une inscription immédiate comme conversion principale.
- Ne pas publier de tarifs, résultats quantifiés, nombre de coachs bêta ou promesse d’essai sans validation explicite.

## Direction visuelle

- Construire une esthétique sombre, premium, précise et orientée produit, dérivée de l’application coach actuelle.
- Donner une place prioritaire aux captures réelles, aux workflows et aux états de produit plutôt qu’aux illustrations abstraites.
- Utiliser la profondeur avec mesure : surfaces, bordures fines, contrastes d’opacité et ombres discrètes.
- Préserver une impression d’outil métier avancé, calme et maîtrisé ; éviter l’esthétique SaaS générique, le futurisme décoratif et le faux glassmorphism.
- Les références externes peuvent inspirer hiérarchie, densité, rythme et présentation produit, mais jamais être copiées.

## Typographie

- **Titres :** Barlow, avec une graisse forte et une casse éventuellement uppercase pour les messages courts.
- **Labels et navigation :** Barlow Condensed, principalement pour les repères courts et les micro-labels.
- **Corps et interface :** Lufga lorsque le contexte produit l’utilise ; conserver une lecture confortable.
- **Marque :** Unbounded pour le logotype STRYV lab lorsque pertinent, sans l’utiliser pour les paragraphes.
- Échelle indicative : H1 56–88 px desktop / 38–48 px mobile ; H2 40–64 px desktop / 30–40 px mobile ; H3 24–32 px ; corps 16–18 px ; petit texte 13–15 px.
- Limiter le nombre de graisses et éviter les longs paragraphes entièrement en capitales.
- Contrôler la longueur de ligne : les paragraphes ne doivent pas devenir des bandes trop larges.

## Système de couleurs et tokens

> [!IMPORTANT]
> **Charte Graphique Unique (Flat Dark) :**
> L'ensemble du projet (Landing commerciale, Espace Coach, PWA client STRYVR, et pages publiques `/p/*`) utilise la charte **Flat Dark** historique :
> - **Fond principal :** `#121212` (Flat Dark)
> - **Surfaces :** `#181818` (avec opacités `bg-white/[0.02]`)
> - **Accent principal :** Vert émeraude `#1f8a65` (dérivé de `app/globals.css` et `tailwind.config.ts`)
> - **Champs de saisie / Inputs :** `#0a0a0a`
> - **Bordures ultra-fines :** `border-[0.3px] border-white/[0.06]`
> - **Texte :** blanc pour le niveau primaire ; opacités réduites pour les niveaux secondaire et tertiaire (100, 90, 60, 45, 40, 20).
>
> **AUCUN AUTRE THÈME DE COULEUR N'EST AUTORISÉ.** Les couleurs d'accent marketing passées (telles que le beige/doré `#c6b48b` ou le bleu-gris `#86aeb8`) sont formellement bannies du projet et de sa documentation.
>
> - Respecter impérativement les tokens de style du projet.
> - Ne pas introduire de palettes arc-en-ciel, de dégradés agressifs ou de bordures épaisses.
> - Vérifier le contraste des textes, des liens, des bordures et des états de focus.

## Espacement

- Utiliser une échelle cohérente basée sur `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`.
- Garder les éléments liés proches et réserver les grandes respirations aux changements de section ou d’idée.
- Prévoir des sections généreuses sur desktop, puis réduire l’espace de façon intentionnelle sur mobile.
- Éviter l’empilement de marges ad hoc et les espacements qui varient sans raison entre composants similaires.

## Règles de layout

- Utiliser des conteneurs avec `max-width`, des grilles lisibles et des alignements stables.
- Le hero doit exposer rapidement le bénéfice pour le coach, le CTA principal et un aperçu produit réel.
- Favoriser une composition split hero ou dashboard hero : message à gauche, produit à droite lorsque la largeur le permet.
- Organiser la narration autour d’une boucle cohérente : profil → bilan → prescription → expérience client → données → ajustement.
- Ne pas transformer la page en catalogue de modules ; chaque section doit faire avancer la compréhension ou la conversion.
- Les cartes sont réservées aux groupes qui ont une fonction claire : module produit, étape de workflow, plan d’accès, preuve ou FAQ.
- Prévoir un empilement naturel et des largeurs de texte maîtrisées aux breakpoints mobiles.

## Règles de composants

- Réutiliser les composants et tokens existants avant de créer un nouveau primitive de bouton, carte, titre ou surface.
- Chaque CTA principal doit partager le même libellé, la même hiérarchie visuelle et la même destination Cal.com.
- Les CTA secondaires doivent rester clairement secondaires et ne pas concurrencer la réservation de démo.
- Les composants produit doivent accepter un texte alternatif précis et identifier honnêtement une capture, une vidéo ou une démonstration.
- Préférer des composants composables et des tableaux de contenu maintenables aux blocs de markup dupliqués.
- Les liens légaux, authentification et accès coach ne doivent pas être mélangés avec le CTA commercial principal.

## Règles de motion

- La priorité est : clarté du message, hiérarchie, conversion, accessibilité, performance, distinction de marque, puis effet visuel.
- Autoriser uniquement les transitions qui soutiennent la compréhension : apparition discrète, reveal de produit, progression au scroll, hover et micro-interactions.
- Ne jamais retarder la lecture ou cacher un CTA derrière une animation.
- Ne pas utiliser de scroll hijacking, de parallax lourd, de mouvement permanent en arrière-plan ou d’effet sans fonction.
- Si une vidéo liée au scroll est utilisée, fournir une image statique de fallback, une version mobile raisonnable et un traitement `prefers-reduced-motion`.
- Les utilisateurs qui préfèrent réduire les animations doivent recevoir le même contenu et la même hiérarchie sans animation imposée.

## Règles de visuels produit

- Montrer le produit tôt et souvent, en donnant la priorité aux captures desktop réelles validées dans `public/landing-demo/`.
- Captures de référence : dashboard, profil client, Workout Studio Builder, Nutrition Studio Builder, métriques, performances, données nutritionnelles et Morpho Pro.
- Attendre le chargement complet des pages avant toute capture ; ne jamais publier de skeleton, d’état vide accidentel ou de page mal cadrée.
- Les captures doivent être en format desktop lorsqu’elles servent à représenter l’espace coach ; les versions mobiles ne doivent pas être présentées comme desktop.
- Les données de démonstration doivent rester cohérentes, plausibles et clairement fictives si elles ne constituent pas une preuve publique.
- Montrer les bénéfices en langage naturel français ; ne pas exposer des libellés techniques ou des noms de code lorsque le contexte demande une présentation commerciale.
- Ne pas retoucher une capture pour fabriquer un résultat, un témoignage, une métrique ou une preuve qui n’existe pas.

## Règles de preuve

- Autoriser uniquement : produit fonctionnel, captures réelles, vidéo réelle, témoignages approuvés, coachs bêta confirmés, résultats documentés et logos explicitement autorisés.
- Séparer clairement preuve produit, crédibilité de contexte et preuve de résultat.
- Ne jamais inventer de chiffres de performance, gains de temps, taux de transformation, logos, certifications, clients ou avis.
- Les données de compte fictif servent à illustrer l’interface et ne doivent pas être présentées comme des résultats clients.
- Si une preuve manque, formuler une promesse de démonstration ou de capacité plutôt qu’une affirmation factuelle.

## Accessibilité

- Conserver une structure sémantique avec un seul H1 principal, des titres hiérarchisés et des landmarks clairs.
- Tous les visuels informatifs ont un `alt` utile ; les visuels purement décoratifs sont ignorés par les lecteurs d’écran.
- Les CTA et liens doivent être accessibles au clavier, avoir un focus visible et annoncer clairement leur destination.
- Ne pas transmettre une information uniquement par la couleur, le mouvement ou l’opacité.
- Respecter des tailles de texte lisibles, des zones tactiles suffisantes et un contraste accessible.
- Prévoir `prefers-reduced-motion` et éviter l’autoplay audio ou les interactions indispensables au scroll.

## Responsive behavior

- Concevoir mobile et desktop comme deux compositions intentionnelles, pas comme une simple réduction du desktop.
- Sur mobile : valeur visible rapidement, CTA accessible, grilles empilées, textes lisibles et aucune barre de navigation ou capture qui déborde horizontalement.
- Simplifier les captures complexes avec un recadrage ciblé, une pile de visuels ou un carrousel accessible ; ne pas réduire une interface complète jusqu’à la rendre illisible.
- Conserver une hiérarchie forte entre CTA primaire et secondaire à tous les breakpoints.
- Tester au minimum les largeurs 390 px, 768 px et 1440 px, avec attention particulière aux titres longs, aux boutons et aux visuels produit.

## Performance

- Utiliser `next/image` pour les visuels, avec `sizes` adaptés et priorité uniquement pour le visuel critique du hero.
- Optimiser les captures et vidéos avant publication ; ne pas charger toutes les variantes lourdes au-dessus de la ligne de flottaison.
- Éviter les bibliothèques ou animations supplémentaires si les composants existants suffisent.
- Préférer le rendu statique et les interactions légères ; ne pas bloquer la première lecture avec une animation ou un script non essentiel.
- Respecter les fallbacks sans JavaScript lorsque cela est raisonnable et vérifier les états de chargement.
- Contrôler les erreurs console, les images manquantes, les débordements et le poids des assets avant livraison.

## Do / Don’t

### Do

- Montrer une vraie plateforme et un workflow coach compréhensible.
- Écrire pour un coach sportif francophone, expert de son métier mais pas nécessairement technique.
- Relier chaque section à une décision, un problème ou une preuve.
- Utiliser le CTA Cal.com comme conversion principale.
- Préserver la direction sombre, premium, calme et data-informed de STRYV lab.
- Documenter les hypothèses et demander validation dès qu’une preuve commerciale manque.

### Don’t

- Ne pas utiliser le dossier `/stryvr` comme base de design, de copy ou de structure de la landing.
- Ne pas inventer de preuve, de prix, de résultats ou de clients.
- Ne pas remplacer le produit réel par des cartes abstraites ou des illustrations génériques.
- Ne pas multiplier les CTA concurrents ni rediriger le CTA principal vers `/auth/login`.
- Ne pas publier des captures skeleton, vides, non desktop ou incohérentes avec le scénario.
- Ne pas ajouter de motion lourde, de gradients décoratifs arbitraires ou de faux glassmorphism.
- Ne pas sacrifier lisibilité, accessibilité ou performance pour un effet visuel.

## Sources de référence

- Brief produit : `LANDING_BRIEF.md`.
- Design system : `tailwind.config.ts` et `app/globals.css` ; la palette landing est définie dans ce document.
- Fonts et metadata : `app/layout.tsx`.
- Captures validées : `public/landing-demo/`.
- Route landing : `app/page.tsx`.

## Questions bloquantes restantes

Aucune question ne bloque le cadrage visuel ou la structure de la landing. Avant publication commerciale, il faudra toutefois confirmer les prix publics, la politique bêta, les témoignages ou logos publiables, les chiffres de preuve et la version finale de la vidéo produit.
