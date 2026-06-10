# SPÉCIFICATIONS TECHNIQUES : PROTOCOLE D'ANALYSE BIOMÉCANIQUE "MORPHOPRO" (PHASE 2)

**Version :** 2.0
**Statut :** Document d'Ingénierie - Prêt pour Implémentation
**Objectif :** Standardisation de l'extraction de données anthropométriques et biomécaniques via Vision par Ordinateur.

---

## 1. PROTOCOLE DE CAPTURE (STANDARDISATION)

L'élimination du bruit de mesure commence à la source. L'IA ne peut compenser une distorsion optique majeure sans perte de précision chirurgicale.

### Contraintes Strictes de l'Environnement

- **Optique & Distance :** Utilisation d'une focale équivalente à **50mm** (pour minimiser la distorsion radiale). Distance minimale sujet-capteur : **3,5 mètres**.
- **Alignement Latéral (Pitch/Roll) :** Le capteur doit être à **0° d'inclinaison**. L'application doit bloquer la capture via l'accéléromètre si l'inclinaison dépasse **2°**.
- **Hauteur du Centre Optique ($H_c$) :** Alignement strict sur le processus transverse de **L5** (milieu du tronc).
  - _Règle de validation :_ $H_c \approx 0.55 \times \text{Taille du sujet}$.
- **Référence Métrique :** Pose d'un marqueur de calibration (mire damier ou QR code de 10x10cm) sur le plan de mesure pour définir le ratio $\text{Pixels}/\text{cm}$ réel.

---

## 2. CARTOGRAPHIE DES POINTS NODAUX (KEYPOINTS)

Le modèle de détection (type **HigherHRNet**) doit extraire les coordonnées cartésiennes $(x, y)$ des processus osseux palpables pour s'affranchir de la masse grasse.

### A. Vue de Face (Plan Frontal)

- **Vertex** (Sommet du crâne)
- **Processus acromiaux** (Épaules - bord externe)
- **Épines Iliaques Antéro-Supérieures (EIAS)** (Bassin osseux)
- **Grand Trochanter** (Pivot de la hanche)
- **Centre de la patella** (Genou)
- **Malléoles internes** (Chevilles)

### B. Vue de Profil (Plan Sagittal)

- **Tragus de l'oreille** et **C7** (Alignement cervical)
- **Processus styloïde du radius** (Longueur de l'avant-bras)
- **Épicondyle latéral du fémur** (Axe de rotation du genou)
- **Malléole externe**

### C. Vue de Dos (Plan Postérieur)

- **Épines Iliaques Postéro-Supérieures (EIPS)** (Stabilité du bassin)
- **Bords médians des scapulas** (Positionnement des omoplates)

---

## 3. CALCULS DES RATIOS ET ALGORITHMES BIOMÉCANIQUES

Toutes les coordonnées sont normalisées pour obtenir une invariance d'échelle totale.

### Formules de Diagnostic Morphologique

- **Indice de Skelic (Proportions Buste/Jambes) :**
  $$I_s = \frac{Y_{vertex} - Y_{trochanter}}{Y_{trochanter} - Y_{sol}} \times 100$$
  - _Interprétation :_ $I_s > 90$ = Longiligne (Fémurs longs, buste court). Risque de cisaillement lombaire accru au squat.

- **Angle d'Antéversion Pelvienne :**
  Calcul de l'angle $\theta$ formé par le segment $[EIPS \to EIAS]$ par rapport à l'horizontale.
  $$\theta = \arctan\left(\frac{\Delta Y_{EIPS-EIAS}}{\Delta X_{EIPS-EIAS}}\right)$$

---

## 4. ALGORITHME DE DÉTECTION DES INSERTIONS

Analyse de la morphologie musculaire via **Segmentation d'Instance** et **Gradient de Luminance**.

1.  **Isolation de la ROI :** Masquage du segment musculaire (ex: Biceps Brachial).
2.  **Point d'Inflection :** Calcul de la dérivée seconde de la silhouette pour identifier le ventre musculaire ($P_{max}$).
3.  **Analyse de Texture de Gabor :** Identification de la transition entre la zone striée (muscle) et la zone lisse/réfléchissante (tendon).
4.  **Ratio d'Insertion ($R_{ins}$) :**
    $$R_{ins} = \frac{\text{Distance}(P_{max}, \text{Articulation Distale})}{\text{Longueur Totale du Segment}}$$
    - _Classification :_ Si $R_{ins} > 0.4$, l'insertion est dite **"Haute"**.

---

## 5. GESTION DE L'ERREUR ET SCORE DE CONFIANCE ($S_c$)

L'IA doit invalider les données bruitées pour éviter les faux diagnostics.

- **Validation de la Symétrie :** Si $|L_{fémur\_G} - L_{fémur\_D}| > 2\%$, rejet pour **Erreur de Parallaxe**.
- **Calcul du Score $S_c$ :** Basé sur la probabilité du Heatmap de détection.
- **Seuils de Décision :**
  - **$S_c \ge 0.90$ :** Validé (Précision Chirurgicale).
  - **$0.75 \le S_c < 0.90$ :** Incertain (Nécessite une nouvelle capture).
  - **$S_c < 0.75$ :** Rejet Automatique (Obstruction ou luminosité insuffisante).
