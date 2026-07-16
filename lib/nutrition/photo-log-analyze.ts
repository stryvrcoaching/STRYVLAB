import OpenAI from "openai"
import type { CategoryL1, MealType } from "@/lib/nutrition/food-items"
import type {
  PhotoMealAmbiguityTag,
  PhotoMealAnalysisMode,
  PhotoMealAnalysisSummary,
  PhotoMealNutritionSource,
  PhotoMealConfidenceBreakdown,
  PhotoMealPhotoEvidence,
  PhotoMealPhotoKind,
  PhotoMealPhotoRole,
  PhotoMealScaleReading,
  PhotoMealScaleReadingScope,
} from "@/lib/nutrition/photo-log-types"
import { applyScaleReadingEvidence } from "@/lib/nutrition/photo-log-evidence"
import { applyPackagingPostProcessing } from "@/lib/nutrition/photo-log-packaging"
import { enrichPackagingAnalysisFromBarcode } from "@/lib/nutrition/photo-log-product-lookup"
import { hasMeaningfulMacros, isMacroEnergyIncoherent } from "@/lib/nutrition/photo-log-nutrition-consistency"
import { scoreVoiceCatalogCandidate } from "@/lib/nutrition/voice-catalog"

export interface AnalyzePhotoMealInput {
  photoUrls: string[]
  photoEvidence?: PhotoMealPhotoEvidence[]
  manualWeightG?: number | null
  manualDetail?: string | null
  personalFoodHints?: PhotoMealPersonalFoodHint[]
}

interface AnalyzePhotoMealPerf {
  totalMs: number
  llmMs: number
  scaleReadMs: number | null
}

export interface PhotoMealPersonalFoodHint {
  id: string
  name_fr: string
  category_l1: CategoryL1
  category_l2?: string | null
  item_key?: string | null
  kcal_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

const ANALYSIS_IMAGE_DETAIL: "low" | "high" = "high"

export class PhotoMealModelParseError extends Error {
  constructor(message = "analysis_parse_failed") {
    super(message)
    this.name = "PhotoMealModelParseError"
  }
}

function parseModelJson(raw: string | null | undefined): Record<string, any> {
  const source = String(raw ?? "").trim()
  const candidates = [
    source,
    source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim(),
    source.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ]

  for (const candidate of candidates) {
    const cleaned = candidate
      .replace(/,\s*([}\]])/g, "$1")
      .trim()
    if (!cleaned) continue
    try {
      return JSON.parse(cleaned) as Record<string, any>
    } catch {}
  }

  throw new PhotoMealModelParseError()
}

const PROMPT = `Tu analyses une seule session alimentaire multimodale.
Retourne UNIQUEMENT un JSON valide avec cette forme :
{
  "analysis_mode": "plate|packaging|barcode|receipt|hybrid",
  "meal_type": "breakfast|lunch|dinner|snack",
  "source_context": "plate_home_v1|product_packaging_v1|product_barcode_v1|restaurant_receipt_v1|product_hybrid_v1",
  "scale_weight_g": 0,
  "scale_weight_confidence": 0,
  "confidence_breakdown": {
    "capture": 0,
    "ocr": 0,
    "quantity": 0,
    "nutrition": 0
  },
  "product_reference": {
    "brand": "QNT Life",
    "name_fr": "Light Digest Whey Protein",
    "canonical_name_fr": "QNT Life Light Digest Whey Protein",
    "product_type": "whey|snack|boisson|plat_prepare|autre",
    "serving_size_g": 40,
    "serving_label": "40 g",
    "barcode_text": null,
    "evidence": "court texte",
    "save_to_personal_library": true
  },
  "photo_timeline": [
    { "index": 1, "role": "before_meal|after_meal_leftovers|separate_weighing|receipt|packaging_front|nutrition_label|barcode|detail|unknown", "evidence": "court texte" }
  ],
  "scale_readings": [
    { "photo_index": 1, "grams": 104, "scope": "meal_total|component|unknown", "food_name": "Blanc d'oeuf", "confidence": 0.94, "evidence": "104 g lisible" }
  ],
  "leftovers_estimate": {
    "detected": false,
    "grams_estimate": null,
    "confidence": 0,
    "rationale": "court texte"
  },
  "components": [
    {
      "name_fr": "Riz cuit",
      "category_hint": "carbs",
      "grams_estimate": 0,
      "quantity_unit": "g|ml|serving",
      "unit_count": null,
      "kcal_per_100g": 0,
      "protein_per_100g": 0,
      "carbs_per_100g": 0,
      "fat_per_100g": 0,
      "fiber_per_100g": 0,
      "ambiguity_tags": ["cooked_vs_raw"],
      "rationale": "court texte",
      "edible_yield_ratio": 1,
      "catalog_metadata": {
        "item_key": "photo-guided-packaging-qnt-life-light-digest-whey-protein",
        "reusable": true,
        "brand": "QNT Life",
        "canonical_name_fr": "QNT Life Light Digest Whey Protein"
      }
    }
  ],
  "ambiguity_tags": ["hidden_fats"],
  "leftovers_recommended": false,
  "vision_notes": "court texte"
}

Regles:
- Commence par classifier la session:
  - plate: vraie assiette / vrai repas a estimer.
  - packaging: photos d'emballage, etiquette nutritionnelle, complement, produit conditionne.
  - barcode: session centree sur un code-barres ou une reference produit.
  - receipt: ticket de caisse, ticket de commande, récapitulatif restaurant ou liste d'articles consommés.
  - hybrid: plusieurs familles de preuves décrivent le même repas: assiette/plateau + ticket, emballage + aliment pesé, packaging + ajout utilisateur, ou produit + consommation composée.
- Si les photos montrent surtout un packaging, une etiquette nutritionnelle, un tableau de valeurs ou un complement, NE traite PAS cela comme une assiette.
- En mode packaging/barcode, ignore les logiques de restes, de poids assiette et de repartition d'assiette. Le but est d'identifier le produit, lire l'etiquette et calculer les quantites explicites.
- En mode packaging/barcode/hybrid:
  - remonte product_reference avec marque, nom produit et nom canonique si lisibles.
  - components doit contenir les elements reellement loggables pour la session finale.
  - si l'utilisateur precise une quantite du produit (ex: 40 g de poudre), utilise-la pour grams_estimate du produit principal.
  - si l'utilisateur precise un ajout standard (ex: 250 ml de lait demi-ecreme, eau), ajoute-le comme composant distinct.
  - derive kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g depuis l'etiquette si visible.
  - si le tableau est lisible et la quantite explicite, confidence_breakdown.nutrition et quantity doivent etre eleves.
- En mode receipt:
  - transcris chaque ligne alimentaire réellement consommable comme un composant distinct; ignore frais, remises, sacs et lignes non alimentaires.
  - utilise les quantités du ticket et le texte utilisateur; un article x2 ne doit pas être compté une seule fois.
  - si une photo du plateau ou du repas accompagne le ticket, fusionne les preuves, confirme les variantes et ne double-compte jamais le même article.
  - pour une chaîne de restauration identifiable, utilise les valeurs nutritionnelles officielles connues quand elles sont fiables; sinon utilise une estimation prudente et signale-le dans rationale.
  - si le poids de portion est inconnu, utilise grams_estimate=100 par article, quantity_unit="serving", et encode les macros d'un article entier dans les champs par 100 g afin que le total final corresponde à une portion; pour x2 utilise grams_estimate=200. Explique ce choix dans rationale.
- En mode hybrid, décide pour chaque composant quelle photo fournit l'identité, quelle photo fournit la quantité et quelle photo fournit la nutrition. Le résultat final est une fusion, jamais une concaténation aveugle.
- Si une vraie assiette contient aussi un packaging visible servant d'indice pour un ingredient annexe (ex: pot de beurre light, margarine, sauce, lait, yaourt), garde analysis_mode="plate". N'utilise pas ce packaging comme produit principal: utilise-le uniquement pour nommer et calculer l'ingredient correspondant.
- Pour un packaging d'ingredient annexe, reporte l'indice dans le rationale du composant concerne. Exemple: "Matiere grasse identifiee via packaging Vitelma light visible".
- Si le packaging d'ingredient annexe est lisible mais sans tableau nutritionnel lisible, mets nutrition_source="catalog_fallback". Si le tableau est lisible, mets nutrition_source="label_read".
- Si une liste d'aliments personnels est fournie et qu'un packaging/nom visible correspond a l'un d'eux, utilise exactement cet aliment personnel: nom, macros/100 g, categorie et item_key. Ne retourne pas un libelle generique comme "Poudre proteinee" si la marque/personnalisation est identifiable.
- Si le produit doit etre sauvegarde dans la bibliotheque perso, renseigne save_to_personal_library a true.
- Pour une salade rose/blanche, salade russe, piemontaise, macedoine, coleslaw ou salade avec sauce cremeuse visible, ajoute hidden_fats et n'utilise jamais une densite de salade nature. Si la sauce est inconnue, indique clairement l'ambiguite dans rationale.
- Toutes les photos appartiennent au meme repas, meme si elles montrent des moments differents ou des aliments peses separement.
- Commence par classer chaque photo dans photo_timeline:
  - before_meal: assiette avant de manger.
  - after_meal_leftovers: meme assiette apres le repas, restes, os, peaux, grains, morceaux non consommes.
  - separate_weighing: un ingredient ou sous-ensemble pese seul sur balance.
  - receipt: ticket de caisse, ticket de commande ou récapitulatif.
  - packaging_front: face avant d'un emballage.
  - nutrition_label: tableau nutritionnel ou liste d'ingrédients.
  - barcode: code-barres lisible.
  - detail: zoom, angle supplementaire, preuve d'un aliment cache.
  - unknown: role impossible a deduire.
- Si des photos avant et apres existent, estime les quantites CONSOMMEES: quantite initiale visible moins restes visibles.
- Si le poids des restes correspond clairement aux os ou déchets d'un seul composant pesé avant le repas, soustrais ce poids de ce composant dans grams_estimate. Ne conserve pas le poids initial comme quantité consommée.
- Si les photos apres montrent os, arêtes, peaux ou coquilles, utilise-les pour deduire les aliments presents initialement meme s'ils etaient caches avant.
- Si une photo montre un aliment pese separement, ajoute une entrée scale_readings avec scope="component", le nom de l'aliment et le poids lu, puis associe exactement ce poids au composant. Additionne ensuite les ingrédients comme un seul repas final.
- Dans une série de photos sur balance, distingue explicitement deux workflows: (1) tare entre chaque ajout, où l'écran donne directement le poids du nouvel ingrédient même si les aliments précédents restent dans le bol; (2) poids cumulatif, où le nouvel ingrédient vaut la différence entre deux lectures. Une valeur qui baisse ou devient non monotone indique généralement une nouvelle tare.
- Le témoin « T » confirme qu'une tare est active mais ne suffit pas seul à dire si elle a été refaite entre deux photos. Croise la lecture, la taille visuelle du nouvel aliment et les photos précédentes. Ne conclus jamais qu'un gros morceau de poulet pèse 16 g uniquement parce que 139 - 123 = 16.
- Une photo plus tardive avec davantage d'aliments intacts est une étape d'assemblage, pas un reste. Utilise after_meal_leftovers uniquement si le repas est visiblement entamé, réduit, ou remplacé par des os, peaux, miettes ou déchets.
- Pour chaque photo de pesée dont l'écran est lisible, crée une entrée scale_readings distincte. N'omets pas les dernières photos d'une longue série.
- Pour les ingredients peses separement, ne pose pas d'ambiguite cru/cuit si l'aliment est visiblement sec et pret a peser tel quel: flocons d'avoine, muesli, granola, cereales, pain, toast, biscotte. Le poids lu est deja le poids consomme/loggable.
- Si des pesées séparées montrent des parties d'œuf distinctes, retourne des composants distincts. Exemple: blancs visibles + poids 104 g => "Blanc d'oeuf" 104 g; jaunes visibles + poids 22 g => "Jaune d'oeuf" 22 g. Ne regroupe pas en "œufs entiers" dans ce cas.
- Si plusieurs photos montrent le meme aliment ou la meme assiette, ne double-compte pas. Croise les angles pour confirmer.
- Examine toutes les photos pour lire la balance, surtout les vues de cote, zooms, photos apres repas et pesées fractionnées.
- scale_weight_g represente uniquement le poids total initial de l'assiette/du repas si ce poids global est visible. N'utilise pas scale_weight_g pour une pesee separee d'un seul ingredient.
- Chaque affichage de balance exploitable doit aussi apparaître dans scale_readings avec son index photo. Utilise scope="meal_total" uniquement pour le poids global du repas, scope="component" pour un aliment pesé seul, et scope="unknown" si le périmètre est incertain.
- Plusieurs pesées séparées ne doivent jamais être additionnées dans scale_weight_g et ne doivent jamais déclencher une mise à l'échelle globale des composants.
- Pour une pesee separee, mets le poids lu dans grams_estimate du composant correspondant, avec ambiguity_tags: ["partial_weight"] si ce poids ne couvre qu'une partie du repas.
- Si un poids balance est partiellement coupe mais inferable par les chiffres visibles, renseigne scale_weight_g avec une confiance moderee. Exemple: si les chiffres visibles permettent de lire 392 g meme avec le haut coupe, retourne scale_weight_g: 392 et scale_weight_confidence autour de 0.65-0.8.
- Ne mets scale_unreadable que si aucun nombre exploitable n'est distinguable sur aucune photo.
- Sois conservateur. Si un detail n'est pas visible, marque l'ambiguite au lieu d'inventer.
- Traite l'information utilisateur comme un signal fort. Si le texte precise un aliment, une quantite ou un etat de cuisson, fusionne-le avec les photos et ajuste l'estimation en consequence.
- Si le texte utilisateur contredit clairement l'image, signale l'ambiguite au lieu d'imposer une lecture fragile.
- Pour les aliments comptables visibles (oeufs, morceaux de plantain, ailes/cuisses), renseigne unit_count quand le nombre est clair.
- Pour une assiette avec plusieurs portions de protéines visiblement différentes, retourne un composant par protéine. Ne fusionne jamais automatiquement porc, poulet, poisson ou bœuf sous un même libellé.
- N'utilise pas un libellé générique comme « viande », « protéine », « aliment » ou « accompagnement » si l'espèce ou le type est visuellement identifiable. Si le type reste réellement indéterminable, garde un libellé prudent, baisse component_confidence sous 0.55 et explique l'incertitude dans rationale afin d'empêcher une validation silencieuse.
- Pour un haut de cuisse, une cuisse ou une aile de poulet avec os, estime la partie comestible et ajoute non_edible_parts. Ne compte jamais l'os comme viande consommée.
- Le choclo est un épi de maïs à gros grains : classe-le comme maïs cuit, pas comme légume générique.
- Ne crée pas une carotte, un féculent ou un légume supplémentaire sur une simple couleur de sauce. Un composant doit correspondre à une portion distincte réellement visible.
- Distingue une patate douce d'une pomme de terre classique lorsque les deux sont visibles. Si la sauce de mijoté recouvre les aliments, ajoute hidden_fats et signale l'incertitude plutôt que d'inventer une composition précise.
- grams_estimate doit representer la quantite comestible retenue pour le log. Si after_meal_leftovers existe, grams_estimate = portion consommee, pas portion initiale.
- category_hint doit etre l'un de: proteins, carbs, vegetables, fruits, fats, drinks, extras.
- ambiguity_tags autorises: scale_unreadable, cooked_vs_raw, non_edible_parts, hidden_fats, partial_weight.
- Si os/coquilles/dechets probables ou restes visibles mais non quantifiables, leftovers_recommended = true.
- Si une sauce ou une cuisson grasse est probable, ajoute hidden_fats.`

const SCALE_PROMPT = `Lis uniquement le poids affiche par la balance sur ces photos.
Retourne UNIQUEMENT un JSON valide:
{
  "scale_weight_g": 0,
  "scale_weight_confidence": 0,
  "evidence": "court texte"
}

Regles:
- Concentre-toi sur l'ecran LCD, notamment les zones bleues en bas des photos.
- Si les chiffres sont partiellement coupes mais inferables, retourne le poids avec confiance moderee.
- Exemple: si on distingue 3, 9 et 2 sur l'ecran, retourne 392 et une confiance 0.65-0.8.
- Si aucun poids exploitable n'est visible, retourne 0 et confiance 0.`

const PACKAGING_RESCUE_PROMPT = `Tu analyses uniquement un produit emballé.
Retourne UNIQUEMENT un JSON valide avec cette forme :
{
  "analysis_mode": "packaging|barcode|hybrid",
  "source_context": "product_packaging_v1|product_barcode_v1|product_hybrid_v1",
  "product_reference": {
    "brand": "texte ou null",
    "name_fr": "texte ou null",
    "canonical_name_fr": "texte ou null",
    "product_type": "whey|snack|boisson|plat_prepare|autre",
    "serving_size_g": 0,
    "serving_label": "texte ou null",
    "barcode_text": "texte ou null",
    "evidence": "court texte"
  },
  "components": [
    {
      "name_fr": "nom produit",
      "category_hint": "proteins|carbs|vegetables|fruits|fats|drinks|extras",
      "grams_estimate": 0,
      "kcal_per_100g": 0,
      "protein_per_100g": 0,
      "carbs_per_100g": 0,
      "fat_per_100g": 0,
      "fiber_per_100g": 0,
      "ambiguity_tags": [],
      "rationale": "court texte"
    }
  ],
  "vision_notes": "court texte"
}

Règles :
- Le produit est emballé. Ne le traite pas comme une assiette.
- Analyse chaque image séparément avant de fusionner les informations.
- Priorité absolue : marque, nom, code-barres, poids unitaire, portion, tableau nutritionnel.
- Si une image contient un tableau nutritionnel, calories, glucides et lipides doivent venir du tableau, pas de la face avant.
- Un claim frontal comme "14 g protein" ne permet jamais d'inférer calories, glucides ou lipides.
- Pour une barre, si le poids net est 55 g et la face avant indique 14 g protein, alors protein_per_100g est environ 25,5 g, mais les autres macros doivent venir du tableau ou rester à 0 si illisibles.
- Si un code-barres est visible, transcris-le exactement dans barcode_text.
- Si le tableau montre une colonne 100 g et une colonne par barre/portion, retourne les macros par 100 g dans le composant et le poids unitaire dans serving_size_g.
- Si seule la portion/barre est lisible mais que le poids de la portion est visible, convertis en valeurs pour 100 g.
- Ne confonds jamais lipides totaux et acides gras saturés.
- Ne confonds jamais les valeurs par portion/barre avec les valeurs par 100 g.
- Si les deux colonnes sont visibles, la colonne 100 g est prioritaire. La colonne portion/barre sert de contrôle.
- Vérifie la cohérence énergétique : kcal ≈ protéines*4 + glucides*4 + lipides*9 (+ fibres*2 si visibles). Si ce n’est pas cohérent, relis le tableau et corrige.
- Si la face avant indique un claim utile (ex: "14 g protein") et que le poids unitaire est visible, utilise-le comme fallback si le tableau est partiel.
- Si un seul produit emballé est visible, retourne toujours au moins un composant principal.
- N’utilise zéro partout que si vraiment aucune lecture exploitable n’est possible.`

const PLATE_RESCUE_PROMPT = `Tu analyses une vraie assiette visible qui a été mal estimée à 0 kcal.
Retourne UNIQUEMENT un JSON valide avec cette forme :
{
  "analysis_mode": "plate",
  "source_context": "plate_home_v1",
  "meal_type": "breakfast|lunch|dinner|snack",
  "scale_weight_g": 0,
  "scale_weight_confidence": 0,
  "confidence_breakdown": {
    "capture": 0,
    "ocr": 0,
    "quantity": 0,
    "nutrition": 0
  },
  "photo_timeline": [
    { "index": 1, "role": "before_meal|after_meal_leftovers|separate_weighing|detail|unknown", "evidence": "court texte" }
  ],
  "components": [
    {
      "name_fr": "Riz cuit",
      "category_hint": "proteins|carbs|vegetables|fruits|fats|drinks|extras",
      "grams_estimate": 0,
      "unit_count": null,
      "kcal_per_100g": 0,
      "protein_per_100g": 0,
      "carbs_per_100g": 0,
      "fat_per_100g": 0,
      "fiber_per_100g": 0,
      "ambiguity_tags": [],
      "rationale": "court texte"
    }
  ],
  "ambiguity_tags": [],
  "leftovers_recommended": false,
  "vision_notes": "court texte"
}

Règles :
- Une assiette visible avec riz, viande, avocat, légumes, sauce ou restes ne peut jamais valoir 0 kcal.
- Si la photo montre une assiette avant repas, estime les portions consommables avec des valeurs nutritionnelles standards.
- Si la photo montre surtout des restes, estime seulement ce qui reste visible comme consommé si aucun avant repas n'est fourni, et marque leftovers_recommended=true.
- Ne retourne components vide que si aucune nourriture n'est visible.
- Ne mets pas kcal/protéines/glucides/lipides à 0 pour un aliment comestible reconnu.
- Si la quantité exacte manque, utilise une estimation prudente et component_confidence faible à modérée.
- Sépare les aliments principaux : féculent, protéine, avocat/matières grasses, légumes, sauce visible.
- Pour une salade rose/blanche ou crémeuse, marque hidden_fats et estime une densité prudente de sauce, pas une salade nature.
- grams_estimate représente la quantité comestible retenue pour le log.`

function isCategory(value: string): value is CategoryL1 {
  return ["proteins", "carbs", "vegetables", "fruits", "fats", "drinks", "extras"].includes(value)
}

function isMealType(value: string): value is MealType {
  return ["breakfast", "lunch", "dinner", "snack"].includes(value)
}

function isPhotoKind(value: string): value is PhotoMealPhotoKind {
  return ["context", "top", "side", "scale_zoom", "leftovers"].includes(value)
}

function isPhotoRole(value: string): value is PhotoMealPhotoRole {
  return [
    "before_meal",
    "after_meal_leftovers",
    "separate_weighing",
    "receipt",
    "packaging_front",
    "nutrition_label",
    "barcode",
    "detail",
    "unknown",
  ].includes(value)
}

function isAmbiguityTag(value: string): value is PhotoMealAmbiguityTag {
  return ["scale_unreadable", "cooked_vs_raw", "non_edible_parts", "hidden_fats", "partial_weight"].includes(value)
}

function isAnalysisMode(value: string): value is PhotoMealAnalysisMode {
  return ["plate", "packaging", "barcode", "receipt", "hybrid"].includes(value)
}

function isScaleReadingScope(value: string): value is PhotoMealScaleReadingScope {
  return ["meal_total", "component", "unknown"].includes(value)
}

function isNutritionSource(value: string): value is PhotoMealNutritionSource {
  return ["label_read", "user_note", "catalog_fallback", "visual_estimate", "clarification", "manual_addition", "default"].includes(value)
}

function normalizeAmbiguityTags(value: unknown): PhotoMealAmbiguityTag[] {
  if (!Array.isArray(value)) return []
  return value.map((tag) => String(tag)).filter(isAmbiguityTag)
}

function normalizeConfidenceBreakdown(value: unknown): PhotoMealConfidenceBreakdown | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const clamp = (input: unknown) => {
    const parsed = Number(input)
    if (!Number.isFinite(parsed)) return 0
    return Math.max(0, Math.min(1, parsed))
  }
  return {
    capture: clamp(raw.capture),
    ocr: clamp(raw.ocr),
    quantity: clamp(raw.quantity),
    nutrition: clamp(raw.nutrition),
  }
}

function buildPhotoEvidence(photoUrls: string[], photoEvidence?: PhotoMealPhotoEvidence[]) {
  if (photoEvidence?.length) {
    return photoEvidence
      .filter((photo) => photo.signed_url)
      .map((photo, index) => ({
        index: Number(photo.index) > 0 ? Number(photo.index) : index + 1,
        kind: isPhotoKind(String(photo.kind)) ? photo.kind : ("context" as const),
        signed_url: photo.signed_url,
      }))
      .sort((a, b) => a.index - b.index)
  }

  return photoUrls.map((signed_url, index) => ({
    index: index + 1,
    kind: "context" as const,
    signed_url,
  }))
}

function buildPersonalFoodHintsText(personalFoodHints?: PhotoMealPersonalFoodHint[]) {
  // Personal catalog entries are deliberately not sent to the vision model for
  // plate analysis: they bias visual identification toward familiar foods.
  return (personalFoodHints ?? []).length > 0
    ? "Le catalogue personnel sera utilisé uniquement après classification, pour un produit emballé explicitement identifié ou un nom écrit par l'utilisateur. Il ne doit jamais influencer l'identification visuelle d'une assiette."
    : "Aucun aliment personnel fourni."
}

function normalizedTokens(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
}

function hasExplicitPersonalNameMatch(componentContext: string, hintName: string) {
  const componentTokens = new Set(normalizedTokens(componentContext))
  const hintTokens = normalizedTokens(hintName)
  if (hintTokens.length === 0) return false
  const overlap = hintTokens.filter((token) => componentTokens.has(token)).length
  return overlap >= Math.min(hintTokens.length, 2)
}

export function applyPersonalFoodHintMatches(
  analysis: PhotoMealAnalysisSummary,
  personalFoodHints?: PhotoMealPersonalFoodHint[],
) {
  const hints = personalFoodHints ?? []
  if (hints.length === 0 || analysis.components.length === 0) return analysis

  const productContext = [
    analysis.manual_detail,
    analysis.product_reference?.brand,
    analysis.product_reference?.name_fr,
    analysis.product_reference?.canonical_name_fr,
  ].filter(Boolean).join(" ")
  const isProductMode = analysis.analysis_mode === "packaging" || analysis.analysis_mode === "barcode" || analysis.analysis_mode === "hybrid"
  const usedHints = new Set<string>()

  return {
    ...analysis,
    components: analysis.components.map((component) => {
      const componentContext = [
        component.name_fr,
        component.rationale,
        component.catalog_metadata?.brand,
        component.catalog_metadata?.canonical_name_fr,
        isProductMode ? productContext : "",
      ].filter(Boolean).join(" ")

      const match = hints
        .map((hint) => ({
          hint,
          score:
            scoreVoiceCatalogCandidate(componentContext, hint) +
            scoreVoiceCatalogCandidate(component.name_fr, hint) * 0.5,
        }))
        .filter(({ hint, score }) => {
          if (usedHints.has(hint.id)) return false
          if (isProductMode) return score >= 65
          return Boolean(analysis.manual_detail?.trim()) && hasExplicitPersonalNameMatch(analysis.manual_detail, hint.name_fr)
        })
        .sort((a, b) => b.score - a.score)[0]?.hint

      if (!match) return component
      usedHints.add(match.id)

      const personalRationale = `Aliment personnel reconnu: ${match.name_fr}.`
      const rationale = component.rationale?.includes(personalRationale)
        ? component.rationale
        : component.rationale
          ? `${component.rationale} ${personalRationale}`
          : personalRationale

      return {
        ...component,
        name_fr: match.name_fr,
        category_hint: match.category_l1,
        kcal_per_100g: match.kcal_per_100g,
        protein_per_100g: match.protein_per_100g,
        carbs_per_100g: match.carbs_per_100g,
        fat_per_100g: match.fat_per_100g,
        fiber_per_100g: match.fiber_per_100g,
        nutrition_source: "catalog_fallback" as const,
        component_confidence: Math.max(component.component_confidence ?? 0, 0.88),
        catalog_metadata: {
          item_key: match.item_key ?? component.catalog_metadata?.item_key ?? null,
          reusable: true,
          brand: component.catalog_metadata?.brand ?? analysis.product_reference?.brand ?? null,
          canonical_name_fr: match.name_fr,
        },
        rationale,
      }
    }),
  }
}

async function readScaleWeightFromPhotos(photoUrls: string[]) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 180,
    messages: [
      { role: "system", content: SCALE_PROMPT },
      {
        role: "user",
        content: photoUrls.map<OpenAI.Chat.ChatCompletionContentPart>((url) => ({
          type: "image_url",
          image_url: { url, detail: "high" },
        })),
      },
    ],
  })

  const parsed = parseModelJson(response.choices[0]?.message?.content) as Record<string, unknown>
  const weight = Number(parsed.scale_weight_g ?? 0)
  const confidence = Number(parsed.scale_weight_confidence ?? 0)
  return {
    scale_weight_g: Number.isFinite(weight) && weight > 0 ? weight : null,
    scale_weight_confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
  }
}

function hasPackagingMacroFailure(analysis: PhotoMealAnalysisSummary) {
  if (!analysis.analysis_mode || !["packaging", "barcode", "hybrid"].includes(analysis.analysis_mode)) return false
  if (analysis.components.length === 0) return true

  const allMissingOrEmpty = analysis.components.every((component) => {
    const hasQuantity = Number(component.grams_estimate ?? 0) > 0
    const hasNutrition =
      Number(component.kcal_per_100g ?? 0) > 0 ||
      Number(component.protein_per_100g ?? 0) > 0 ||
      Number(component.carbs_per_100g ?? 0) > 0 ||
      Number(component.fat_per_100g ?? 0) > 0
    return !hasQuantity || !hasNutrition
  })

  if (allMissingOrEmpty) return true

  return analysis.components.some((component) => {
    if (!hasMeaningfulMacros(component)) return false
    return isMacroEnergyIncoherent(component, {
      lowRatio: 0.78,
      highRatio: 1.22,
      absoluteToleranceKcal: 30,
    })
  })
}

function hasGenericPackagingPrimary(analysis: PhotoMealAnalysisSummary) {
  if (analysis.product_reference) return false
  const primaryName = String(analysis.components[0]?.name_fr ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
  return ["mais", "corn", "produit emballe", "aliment emballe", "snack", "chips"].includes(primaryName)
}

function hasPlateMacroFailure(analysis: PhotoMealAnalysisSummary) {
  if (analysis.analysis_mode && analysis.analysis_mode !== "plate") return false
  if (analysis.components.length === 0) return true

  return analysis.components.every((component) => {
    const hasQuantity = Number(component.grams_estimate ?? 0) > 0 || Number(component.unit_count ?? 0) > 0
    const hasNutrition =
      Number(component.kcal_per_100g ?? 0) > 0 ||
      Number(component.protein_per_100g ?? 0) > 0 ||
      Number(component.carbs_per_100g ?? 0) > 0 ||
      Number(component.fat_per_100g ?? 0) > 0
    return !hasQuantity || !hasNutrition
  })
}

function getPackagingSignalScore(analysis: PhotoMealAnalysisSummary) {
  const components = Array.isArray(analysis.components) ? analysis.components : []
  const primary = components[0] ?? null
  const product = analysis.product_reference ?? null

  let score = 0
  if (components.length > 0) score += 2
  if (components.some((component) => Number(component.grams_estimate ?? 0) > 0)) score += 2
  if (components.some((component) => Number(component.kcal_per_100g ?? 0) > 0)) score += 2
  if (components.some((component) => Number(component.protein_per_100g ?? 0) > 0)) score += 1
  if (components.some((component) => Number(component.carbs_per_100g ?? 0) > 0)) score += 1
  if (components.some((component) => Number(component.fat_per_100g ?? 0) > 0)) score += 1
  if (components.some((component) => Number(component.fiber_per_100g ?? 0) > 0)) score += 2
  if (product?.barcode_text) score += 1
  if (Number(product?.serving_size_g ?? 0) > 0) score += 1
  if (product?.canonical_name_fr || product?.name_fr) score += 1
  if (primary && hasMeaningfulMacros(primary) && !isMacroEnergyIncoherent(primary, { absoluteToleranceKcal: 30 })) {
    score += 2
  }
  if (primary && hasMeaningfulMacros(primary) && isMacroEnergyIncoherent(primary, { absoluteToleranceKcal: 30 })) {
    score -= 6
  }

  return score
}

function shouldRunPackagingRescuePass(analysis: PhotoMealAnalysisSummary, _photoCount: number) {
  if (!analysis.analysis_mode || !["packaging", "barcode", "hybrid"].includes(analysis.analysis_mode)) return false
  // Toujours rescuer si l'analyse principale a clairement échoué (0 kcal, composants vides)
  if (hasPackagingMacroFailure(analysis)) return true
  if (hasGenericPackagingPrimary(analysis)) return true
  if (!analysis.product_reference && _photoCount >= 2 && analysis.components.some((component) => component.nutrition_source !== "label_read")) {
    return true
  }
  // P2-2 : évaluer la qualité de l'analyse — rescue seulement si insuffisant (<6 signaux sur 16 max)
  // Avant : photoCount >= 2 déclenchait systématiquement un appel gpt-4o inutile de 3-8s
  const currentScore = getPackagingSignalScore(analysis)
  if (currentScore < 6) return true
  // Rescue ciblé : code-barres détecté mais macros incohérentes (l'étiquette a peut-être mal été lue)
  if (analysis.product_reference?.barcode_text) {
    const primary = analysis.components[0]
    if (primary && hasMeaningfulMacros(primary) && isMacroEnergyIncoherent(primary, { absoluteToleranceKcal: 30 })) return true
  }
  return false
}

export function shouldPromoteWeakPlateToPackaging(analysis: PhotoMealAnalysisSummary) {
  if (analysis.analysis_mode !== "plate") return false
  if (analysis.components.length > 0) return false
  if (analysis.product_reference) return false
  if (Number(analysis.scale_weight_g ?? 0) > 0) return false

  const timeline = Array.isArray(analysis.photo_timeline) ? analysis.photo_timeline : []
  if (timeline.length === 0) return false

  const normalizedEvidence = timeline
    .map((item) => String(item.evidence ?? ""))
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

  const detailCount = timeline.filter((item) => item.role === "detail").length
  const hasPackagingEvidence = [
    "etiquette",
    "nutritionnelle",
    "code-barres",
    "code barres",
    "barcode",
    "emballage",
    "barre proteinee",
    "protein bar",
    "canette",
    "packaging",
    "supplement",
    "complement",
  ].some((token) => normalizedEvidence.includes(token))

  const onlyNonMealRoles = timeline.every((item) =>
    item.role === "detail" || item.role === "unknown" || item.role === "before_meal",
  )

  return hasPackagingEvidence && onlyNonMealRoles && detailCount >= Math.max(1, timeline.length - 1)
}

async function readPackagingRescueFromPhotos({
  photoUrls,
  manualDetail,
}: {
  photoUrls: string[]
  manualDetail?: string | null
}) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 900,
    messages: [
      { role: "system", content: PACKAGING_RESCUE_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: manualDetail?.trim()
              ? `Information utilisateur à fusionner : ${manualDetail.trim()}`
              : "Aucune information utilisateur fournie.",
          },
          ...photoUrls.map<OpenAI.Chat.ChatCompletionContentPart>((url) => ({
            type: "image_url",
            image_url: { url, detail: "high" },
          })),
        ],
      },
    ],
  })

  return parseModelJson(response.choices[0]?.message?.content)
}

async function readPlateRescueFromPhotos({
  photoUrls,
  manualDetail,
}: {
  photoUrls: string[]
  manualDetail?: string | null
}) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 1100,
    messages: [
      { role: "system", content: PLATE_RESCUE_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: manualDetail?.trim()
              ? `Information utilisateur à fusionner : ${manualDetail.trim()}`
              : "Aucune information utilisateur fournie.",
          },
          ...photoUrls.map<OpenAI.Chat.ChatCompletionContentPart>((url) => ({
            type: "image_url",
            image_url: { url, detail: "high" },
          })),
        ],
      },
    ],
  })

  return parseModelJson(response.choices[0]?.message?.content)
}

export async function analyzePhotoMeal({
  photoUrls,
  photoEvidence,
  manualWeightG,
  manualDetail,
  personalFoodHints,
}: AnalyzePhotoMealInput): Promise<{ analysis: PhotoMealAnalysisSummary; perf: AnalyzePhotoMealPerf }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("ai_unavailable")
  }

  const startedAt = Date.now()
  const evidence = buildPhotoEvidence(photoUrls, photoEvidence)
  const content: OpenAI.Chat.ChatCompletionContentPart[] = evidence.flatMap((photo) => [
    {
      type: "text",
      text: `Photo ${photo.index}. Contexte technique: ${photo.kind}. scale_zoom signifie que la lecture de balance est une preuve prioritaire à extraire; leftovers signifie que la photo vise des restes. Pour context/top/side, classe librement le rôle réel d'après l'image.`,
    },
    {
      type: "image_url",
      image_url: {
        url: photo.signed_url,
        detail: ANALYSIS_IMAGE_DETAIL,
      },
    },
  ])

  const llmStartedAt = Date.now()
  const response = await getOpenAI().chat.completions.create({
    // gpt-4o : meilleures capacités vision pour assiettes complexes et emballages
    model: "gpt-4o",
    response_format: { type: "json_object" },
    temperature: 0.1,
    // 2500 tokens : évite la troncature JSON sur les repas à 5+ composants
    max_tokens: 2500,
    messages: [
      { role: "system", content: PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: manualWeightG ? `Poids saisi manuellement: ${manualWeightG} g` : "Aucun poids manuel fourni." },
          { type: "text", text: manualDetail?.trim() ? `Information utilisateur a fusionner avec les photos: ${manualDetail.trim()}` : "Aucune information utilisateur fournie." },
          { type: "text", text: buildPersonalFoodHintsText(personalFoodHints) },
          { type: "text", text: `Nombre de photos dans cette session: ${evidence.length}. Elles peuvent représenter un repas, un plateau, un ticket, un emballage, un tableau nutritionnel, un code-barres, des restes, des zooms ou des ingrédients pesés séparément. Toutes décrivent une seule consommation finale.` },
          ...content,
        ],
      },
    ],
  })
  const llmMs = Date.now() - llmStartedAt

  const raw = response.choices[0]?.message?.content ?? "{}"
  const parsed = parseModelJson(raw)

  const mealType = isMealType(String(parsed.meal_type)) ? (parsed.meal_type as MealType) : "lunch"
  const analysisMode = isAnalysisMode(String(parsed.analysis_mode)) ? (parsed.analysis_mode as PhotoMealAnalysisMode) : "plate"
  const components = Array.isArray(parsed.components) ? parsed.components : []
  const photoTimeline = Array.isArray(parsed.photo_timeline) ? parsed.photo_timeline : []
  const scaleReadings: PhotoMealScaleReading[] = (Array.isArray(parsed.scale_readings) ? parsed.scale_readings : [])
    .map((reading: Record<string, unknown>) => ({
      photo_index: Math.max(1, Number(reading.photo_index ?? 0) || 1),
      grams: Math.max(0, Number(reading.grams ?? 0)),
      scope: isScaleReadingScope(String(reading.scope)) ? String(reading.scope) as PhotoMealScaleReadingScope : "unknown",
      food_name: reading.food_name ? String(reading.food_name) : null,
      confidence: Number.isFinite(Number(reading.confidence))
        ? Math.max(0, Math.min(1, Number(reading.confidence)))
        : 0,
      evidence: reading.evidence ? String(reading.evidence) : null,
    }))
    .filter((reading: PhotoMealScaleReading) => reading.grams > 0)
  const leftoversEstimate = parsed.leftovers_estimate && typeof parsed.leftovers_estimate === "object"
    ? parsed.leftovers_estimate
    : null
  let scaleWeightG = Number(parsed.scale_weight_g ?? 0) > 0 ? Number(parsed.scale_weight_g) : null
  let scaleWeightConfidence = Number.isFinite(Number(parsed.scale_weight_confidence))
    ? Math.max(0, Math.min(1, Number(parsed.scale_weight_confidence)))
    : null
  let ambiguityTags = normalizeAmbiguityTags(parsed.ambiguity_tags)
  let scaleReadMs: number | null = null

  const hasSeparateWeighingEvidence =
    photoTimeline.some((item) => isPhotoRole(String(item.role)) && item.role === "separate_weighing") ||
    scaleReadings.some((reading) => reading.scope === "component")

  if (
    analysisMode === "plate" &&
    !hasSeparateWeighingEvidence &&
    (!scaleWeightG || (scaleWeightConfidence ?? 0) < 0.55 || ambiguityTags.includes("scale_unreadable")) &&
    photoUrls.length > 1
  ) {
    const scaleStartedAt = Date.now()
    const focusedScale = await readScaleWeightFromPhotos(photoUrls).catch(() => null)
    scaleReadMs = Date.now() - scaleStartedAt
    if (focusedScale?.scale_weight_g && (focusedScale.scale_weight_confidence ?? 0) >= 0.55) {
      scaleWeightG = focusedScale.scale_weight_g
      scaleWeightConfidence = focusedScale.scale_weight_confidence
      ambiguityTags = ambiguityTags.filter((tag) => tag !== "scale_unreadable")
    }
  }

  let normalized: PhotoMealAnalysisSummary = {
    meal_type: mealType,
    analysis_mode: analysisMode,
    source_context:
      typeof parsed.source_context === "string" && parsed.source_context.trim().length > 0
        ? parsed.source_context
        : analysisMode === "packaging"
          ? "product_packaging_v1"
          : analysisMode === "barcode"
            ? "product_barcode_v1"
            : analysisMode === "receipt"
              ? "restaurant_receipt_v1"
            : analysisMode === "hybrid"
              ? "product_hybrid_v1"
              : "plate_home_v1",
    scale_weight_g: scaleWeightG,
    scale_weight_confidence: scaleWeightConfidence,
    manual_weight_g: manualWeightG ?? null,
    manual_detail: manualDetail?.trim() || null,
    confidence_breakdown: normalizeConfidenceBreakdown(parsed.confidence_breakdown),
    product_reference:
      parsed.product_reference && typeof parsed.product_reference === "object"
        ? {
            brand: parsed.product_reference.brand ? String(parsed.product_reference.brand) : null,
            name_fr: parsed.product_reference.name_fr ? String(parsed.product_reference.name_fr) : null,
            canonical_name_fr: parsed.product_reference.canonical_name_fr
              ? String(parsed.product_reference.canonical_name_fr)
              : null,
            product_type: parsed.product_reference.product_type ? String(parsed.product_reference.product_type) : null,
            serving_size_g:
              Number(parsed.product_reference.serving_size_g) > 0
                ? Number(parsed.product_reference.serving_size_g)
                : null,
            serving_label: parsed.product_reference.serving_label ? String(parsed.product_reference.serving_label) : null,
            barcode_text: parsed.product_reference.barcode_text ? String(parsed.product_reference.barcode_text) : null,
            evidence: parsed.product_reference.evidence ? String(parsed.product_reference.evidence) : null,
            save_to_personal_library:
              typeof parsed.product_reference.save_to_personal_library === "boolean"
                ? Boolean(parsed.product_reference.save_to_personal_library)
                : null,
          }
        : null,
    photo_timeline: photoTimeline.map((item) => ({
      index: Math.max(1, Number(item.index ?? 0) || 1),
      role: isPhotoRole(String(item.role)) ? item.role : "unknown",
      evidence: item.evidence ? String(item.evidence) : null,
    })),
    scale_readings: scaleReadings,
    leftovers_estimate: leftoversEstimate
      ? {
          detected: Boolean(leftoversEstimate.detected),
          grams_estimate: Number(leftoversEstimate.grams_estimate) > 0 ? Number(leftoversEstimate.grams_estimate) : null,
          confidence: Number.isFinite(Number(leftoversEstimate.confidence))
            ? Math.max(0, Math.min(1, Number(leftoversEstimate.confidence)))
            : null,
          rationale: leftoversEstimate.rationale ? String(leftoversEstimate.rationale) : null,
        }
      : null,
    components: components.map((component) => ({
      name_fr: String(component.name_fr ?? "Ingredient inconnu"),
      category_hint: isCategory(String(component.category_hint)) ? component.category_hint : "extras",
      grams_estimate: Math.max(0, Number(component.grams_estimate ?? 0)),
      quantity_unit: ["g", "ml", "serving"].includes(String(component.quantity_unit))
        ? component.quantity_unit
        : null,
      unit_count: Number(component.unit_count) > 0 ? Number(component.unit_count) : null,
      kcal_per_100g: Math.max(0, Number(component.kcal_per_100g ?? 0)),
      protein_per_100g: Math.max(0, Number(component.protein_per_100g ?? 0)),
      carbs_per_100g: Math.max(0, Number(component.carbs_per_100g ?? 0)),
      fat_per_100g: Math.max(0, Number(component.fat_per_100g ?? 0)),
      fiber_per_100g: Math.max(0, Number(component.fiber_per_100g ?? 0)),
      ambiguity_tags: normalizeAmbiguityTags(component.ambiguity_tags),
      rationale: component.rationale ? String(component.rationale) : null,
      edible_yield_ratio:
        Number(component.edible_yield_ratio) > 0 && Number(component.edible_yield_ratio) <= 1
          ? Number(component.edible_yield_ratio)
          : null,
      nutrition_source: isNutritionSource(String(component.nutrition_source)) ? component.nutrition_source : null,
      component_confidence:
        Number.isFinite(Number(component.component_confidence))
          ? Math.max(0, Math.min(1, Number(component.component_confidence)))
          : null,
      catalog_metadata:
        component.catalog_metadata && typeof component.catalog_metadata === "object"
          ? {
              item_key: component.catalog_metadata.item_key ? String(component.catalog_metadata.item_key) : null,
              reusable:
                typeof component.catalog_metadata.reusable === "boolean"
                  ? Boolean(component.catalog_metadata.reusable)
                  : null,
              brand: component.catalog_metadata.brand ? String(component.catalog_metadata.brand) : null,
              canonical_name_fr: component.catalog_metadata.canonical_name_fr
                ? String(component.catalog_metadata.canonical_name_fr)
                : null,
            }
          : null,
    })),
    ambiguity_tags: ambiguityTags,
    leftovers_recommended: Boolean(parsed.leftovers_recommended),
    vision_notes: parsed.vision_notes ? String(parsed.vision_notes) : null,
  }

  if (shouldPromoteWeakPlateToPackaging(normalized)) {
    normalized.analysis_mode = "packaging"
    normalized.source_context = "product_packaging_v1"
    normalized.vision_notes =
      normalized.vision_notes ??
      "Produit emballé reclassé automatiquement après détection d’étiquette et de code-barres."
  }

  if (photoUrls.length > 0 && hasPlateMacroFailure(normalized) && normalized.analysis_mode === "plate") {
    const plateRescue = await readPlateRescueFromPhotos({
      photoUrls,
      manualDetail,
    }).catch(() => null)

    if (plateRescue && typeof plateRescue === "object") {
      const rescueComponents = Array.isArray(plateRescue.components) ? plateRescue.components : []
      const rescueTimeline = Array.isArray(plateRescue.photo_timeline) ? plateRescue.photo_timeline : normalized.photo_timeline ?? []

      const rescueNormalized: PhotoMealAnalysisSummary = {
        ...normalized,
        meal_type: isMealType(String(plateRescue.meal_type)) ? plateRescue.meal_type : normalized.meal_type,
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: Number(plateRescue.scale_weight_g) > 0 ? Number(plateRescue.scale_weight_g) : normalized.scale_weight_g,
        scale_weight_confidence: Number.isFinite(Number(plateRescue.scale_weight_confidence))
          ? Math.max(0, Math.min(1, Number(plateRescue.scale_weight_confidence)))
          : normalized.scale_weight_confidence,
        confidence_breakdown: normalizeConfidenceBreakdown(plateRescue.confidence_breakdown) ?? normalized.confidence_breakdown,
        photo_timeline: rescueTimeline.map((item) => ({
          index: Math.max(1, Number(item.index ?? 0) || 1),
          role: isPhotoRole(String(item.role)) ? item.role : "unknown",
          evidence: item.evidence ? String(item.evidence) : null,
        })),
        components: rescueComponents.map((component) => ({
          name_fr: String(component.name_fr ?? "Ingredient visible"),
          category_hint: isCategory(String(component.category_hint)) ? component.category_hint : "extras",
          grams_estimate: Math.max(0, Number(component.grams_estimate ?? 0)),
          quantity_unit: ["g", "ml", "serving"].includes(String(component.quantity_unit))
            ? component.quantity_unit
            : null,
          unit_count: Number(component.unit_count) > 0 ? Number(component.unit_count) : null,
          kcal_per_100g: Math.max(0, Number(component.kcal_per_100g ?? 0)),
          protein_per_100g: Math.max(0, Number(component.protein_per_100g ?? 0)),
          carbs_per_100g: Math.max(0, Number(component.carbs_per_100g ?? 0)),
          fat_per_100g: Math.max(0, Number(component.fat_per_100g ?? 0)),
          fiber_per_100g: Math.max(0, Number(component.fiber_per_100g ?? 0)),
          ambiguity_tags: normalizeAmbiguityTags(component.ambiguity_tags),
          rationale: component.rationale ? String(component.rationale) : "Assiette réestimée après résultat nul.",
          edible_yield_ratio: null,
          nutrition_source: "visual_estimate",
          component_confidence: 0.68,
          catalog_metadata: null,
        })),
        ambiguity_tags: normalizeAmbiguityTags(plateRescue.ambiguity_tags),
        leftovers_recommended: Boolean(plateRescue.leftovers_recommended),
        vision_notes:
          typeof plateRescue.vision_notes === "string" && plateRescue.vision_notes.trim().length > 0
            ? plateRescue.vision_notes
            : "Assiette réestimée automatiquement après résultat nul.",
      }

      if (!hasPlateMacroFailure(rescueNormalized)) {
        normalized = rescueNormalized
      }
    }
  }

  if (shouldRunPackagingRescuePass(normalized, photoUrls.length)) {
    const packagingRescue = await readPackagingRescueFromPhotos({
      photoUrls,
      manualDetail,
    }).catch(() => null)

    if (packagingRescue && typeof packagingRescue === "object") {
      const rescueComponents = Array.isArray(packagingRescue.components) ? packagingRescue.components : []
      const rescueProductReference =
        packagingRescue.product_reference && typeof packagingRescue.product_reference === "object"
          ? packagingRescue.product_reference
          : null

      const rescueNormalized: PhotoMealAnalysisSummary = {
        ...normalized,
        components: rescueComponents.length > 0 ? rescueComponents.map((component) => ({
          name_fr: String(component.name_fr ?? "Produit emballé"),
          category_hint: isCategory(String(component.category_hint)) ? component.category_hint : "extras",
          grams_estimate: Math.max(0, Number(component.grams_estimate ?? 0)),
          quantity_unit: ["g", "ml", "serving"].includes(String(component.quantity_unit))
            ? component.quantity_unit
            : null,
          unit_count: Number(component.unit_count) > 0 ? Number(component.unit_count) : null,
          kcal_per_100g: Math.max(0, Number(component.kcal_per_100g ?? 0)),
          protein_per_100g: Math.max(0, Number(component.protein_per_100g ?? 0)),
          carbs_per_100g: Math.max(0, Number(component.carbs_per_100g ?? 0)),
          fat_per_100g: Math.max(0, Number(component.fat_per_100g ?? 0)),
          fiber_per_100g: Math.max(0, Number(component.fiber_per_100g ?? 0)),
          ambiguity_tags: normalizeAmbiguityTags(component.ambiguity_tags),
          rationale: component.rationale ? String(component.rationale) : "Produit emballé reconstruit depuis l’étiquette.",
          edible_yield_ratio: null,
          nutrition_source: "label_read",
          component_confidence: 0.9,
          catalog_metadata: null,
        })) : normalized.components,
        product_reference: rescueProductReference ? {
          brand: rescueProductReference.brand ? String(rescueProductReference.brand) : normalized.product_reference?.brand ?? null,
          name_fr: rescueProductReference.name_fr ? String(rescueProductReference.name_fr) : normalized.product_reference?.name_fr ?? null,
          canonical_name_fr: rescueProductReference.canonical_name_fr
            ? String(rescueProductReference.canonical_name_fr)
            : normalized.product_reference?.canonical_name_fr ?? null,
          product_type: rescueProductReference.product_type
            ? String(rescueProductReference.product_type)
            : normalized.product_reference?.product_type ?? null,
          serving_size_g:
            Number(rescueProductReference.serving_size_g) > 0
              ? Number(rescueProductReference.serving_size_g)
              : normalized.product_reference?.serving_size_g ?? null,
          serving_label: rescueProductReference.serving_label
            ? String(rescueProductReference.serving_label)
            : normalized.product_reference?.serving_label ?? null,
          barcode_text: rescueProductReference.barcode_text
            ? String(rescueProductReference.barcode_text)
            : normalized.product_reference?.barcode_text ?? null,
          evidence: rescueProductReference.evidence
            ? String(rescueProductReference.evidence)
            : normalized.product_reference?.evidence ?? null,
          save_to_personal_library: normalized.product_reference?.save_to_personal_library ?? null,
        } : normalized.product_reference,
        vision_notes:
          typeof packagingRescue.vision_notes === "string" && packagingRescue.vision_notes.trim().length > 0
            ? packagingRescue.vision_notes
            : normalized.vision_notes,
      }

      const currentScore = getPackagingSignalScore(normalized)
      const rescueScore = getPackagingSignalScore(rescueNormalized)
      if (hasPackagingMacroFailure(normalized) || hasGenericPackagingPrimary(normalized) || rescueScore > currentScore) {
        normalized = rescueNormalized
      }
    }
  }

  normalized = applyPersonalFoodHintMatches(normalized, personalFoodHints)
  normalized = applyScaleReadingEvidence(normalized)

  const packaged = applyPackagingPostProcessing(normalized, photoUrls.length)
  const enriched = await enrichPackagingAnalysisFromBarcode(packaged)
  const reconciled = applyPersonalFoodHintMatches(enriched, personalFoodHints)

  return {
    analysis: applyPackagingPostProcessing(reconciled, photoUrls.length),
    perf: {
      totalMs: Date.now() - startedAt,
      llmMs,
      scaleReadMs,
    },
  }
}
