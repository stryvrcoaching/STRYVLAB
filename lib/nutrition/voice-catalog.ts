type CatalogLikeItem = {
  id: string
  name_fr: string
  category_l1?: string | null
  category_l2?: string | null
  kcal_per_100g?: number | null
  protein_per_100g?: number | null
  carbs_per_100g?: number | null
  fat_per_100g?: number | null
  fiber_per_100g?: number | null
  client_id?: string | null
}

export function normalizeVoiceCatalogText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function tokenizeVoiceCatalogText(value: string): string[] {
  return normalizeVoiceCatalogText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function hasAnyText(value: string, keywords: string[]): boolean {
  const normalized = normalizeVoiceCatalogText(value)
  return keywords.some((keyword) => normalized.includes(normalizeVoiceCatalogText(keyword)))
}

type VoiceCatalogSignals = {
  families: Set<string>
  modifiers: Set<string>
  forms: Set<string>
  percentages: number[]
}

function extractVoiceCatalogSignals(transcript: string): VoiceCatalogSignals {
  const normalized = normalizeVoiceCatalogText(transcript)
  const families = new Set<string>()
  const modifiers = new Set<string>()
  const forms = new Set<string>()
  const percentages = Array.from(normalized.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g))
    .map((match) => Number(match[1]?.replace(",", ".")))
    .filter((value) => Number.isFinite(value))

  if (hasAnyText(normalized, ["honey rings", "anneaux au miel", "cereales au miel", "cereals au miel", "miel rings", "céréales", "cereales", "muesli", "granola", "flocon", "pétale", "petale", "soufflé", "souffle"])) {
    families.add("cereals")
  }
  if (hasAnyText(normalized, ["petit suisse", "petits suisses", "fromage blanc", "yaourt", "yogurt", "skyr", "quark", "lait", "milk"])) {
    families.add("dairy")
  }
  if (hasAnyText(normalized, ["poulet", "boeuf", "bœuf", "porc", "dinde", "saumon", "thon", "poisson", "oeuf", "œuf", "crevette", "tofu", "tempeh", "whey", "protéine", "proteine", "isolate", "isolat"])) {
    families.add("proteins")
  }
  if (hasAnyText(normalized, ["riz", "pates", "pâtes", "pain", "wrap", "tortilla", "bagel", "biscotte", "semoule", "avoine", "quinoa", "pomme de terre", "patate", "lentille", "haricot", "pois chiche", "couscous"])) {
    families.add("carbs")
  }
  if (hasAnyText(normalized, ["huile", "beurre", "beurre de cacahuete", "beurre de cacahuète", "peanut butter", "avocat", "noix", "graines", "amande", "cacahuete", "cacahuète", "olive", "margarine"])) {
    families.add("fats")
  }
  if (hasAnyText(normalized, ["salade", "epinard", "épinard", "brocoli", "chou", "carotte", "tomate", "concombre", "poivron", "courgette", "champignon", "asperge"])) {
    families.add("vegetables")
  }
  if (hasAnyText(normalized, ["pomme", "banane", "kiwi", "fraise", "framboise", "orange", "mangue", "raisin", "ananas", "pêche", "peche", "compote"])) {
    families.add("fruits")
  }
  if (hasAnyText(normalized, ["eau", "coffee", "cafe", "café", "the", "thé", "jus", "smoothie", "soda", "cola", "sprite", "biere", "bière", "vin", "boisson", "lait"])) {
    families.add("drinks")
  }
  if (hasAnyText(normalized, ["sauce", "ketchup", "moutarde", "mayonnaise", "pesto", "vinaigrette", "sirop", "caramel", "miel"])) {
    families.add("sauces")
  }

  if (hasAnyText(normalized, ["maigre", "ecreme", "écrémé", "demi ecreme", "demi-écrémé", "partiellement ecreme", "light", "allege", "allégé"])) modifiers.add("lean")
  if (hasAnyText(normalized, ["entier", "whole", "full fat", "40%"])) modifiers.add("whole")
  if (hasAnyText(normalized, ["4%", "4 %", "4 pour cent"])) modifiers.add("4pct")
  if (hasAnyText(normalized, ["0%", "0 %", "zero pour cent", "0 pour cent"])) modifiers.add("0pct")
  if (hasAnyText(normalized, ["10%", "10 %", "dix pour cent"])) modifiers.add("10pct")
  if (hasAnyText(normalized, ["cru", "crue", "raw"])) modifiers.add("raw")
  if (hasAnyText(normalized, ["cuit", "cuite", "cooked", "grille", "grillé", "poele", "poêlé", "rôti", "roti", "frit", "vapeur"])) modifiers.add("cooked")
  if (hasAnyText(normalized, ["miel", "honey"])) modifiers.add("honey")
  if (hasAnyText(normalized, ["whey", "isolate", "isolat", "proteine", "protéine", "protein"])) forms.add("protein-powder")
  if (hasAnyText(normalized, ["beurre de cacahuete", "beurre de cacahuète", "peanut butter"])) forms.add("peanut-butter")
  if (hasAnyText(normalized, ["rings", "anneaux", "boules", "flakes", "flakes", "puffs", "billes", "pétales", "petales"])) forms.add("cereal-shape")
  if (hasAnyText(normalized, ["petit suisse", "petits suisses", "fromage blanc", "yaourt", "skyr", "quark"])) forms.add("dairy-cup")
  if (hasAnyText(normalized, ["lait", "milk"])) forms.add("milk")
  if (hasAnyText(normalized, ["poulet", "boeuf", "bœuf", "porc", "dinde", "poisson", "oeuf", "œuf"])) forms.add("protein")

  return { families, modifiers, forms, percentages }
}

function familyBoost(candidate: CatalogLikeItem, family: string): number {
  const name = normalizeVoiceCatalogText(candidate.name_fr)
  const categoryL1 = candidate.category_l1 ?? ""
  const categoryL2 = candidate.category_l2 ?? ""

  switch (family) {
    case "cereals":
      return categoryL1 === "carbs" && hasAnyText(name, ["cereale", "céréale", "muesli", "granola", "flocon", "pétale", "petale", "rings", "anneaux", "souffle", "soufflé"])
        ? 45
        : hasAnyText(name, ["cereale", "céréale", "muesli", "granola", "flocon", "pétale", "petale", "rings", "anneaux"])
          ? 30
          : 0
    case "dairy":
      return categoryL1 === "proteins" && categoryL2 === "laitiers"
        ? 45
        : hasAnyText(name, ["petit suisse", "petit-suisse", "fromage blanc", "yaourt", "skyr", "quark", "lait", "fromage frais"])
          ? 35
          : 0
    case "proteins":
      return categoryL1 === "proteins" && !hasAnyText(name, ["lait", "yaourt", "skyr", "fromage blanc", "petit suisse"])
        ? 30
          : hasAnyText(name, ["poulet", "boeuf", "bœuf", "porc", "dinde", "saumon", "thon", "oeuf", "œuf", "crevette", "tofu", "tempeh", "whey", "isolate", "isolat"])
          ? 40
          : 0
    case "carbs":
      return categoryL1 === "carbs"
        ? 35
        : hasAnyText(name, ["riz", "pates", "pain", "wrap", "tortilla", "bagel", "semoule", "avoine", "quinoa", "patate", "lentille", "couscous"])
          ? 30
          : 0
    case "fats":
      return categoryL1 === "fats"
        ? 35
        : hasAnyText(name, ["huile", "beurre", "avocat", "noix", "graines", "amande", "cacahuete", "cacahuète", "olive", "margarine"])
          ? 30
          : 0
    case "vegetables":
      return categoryL1 === "vegetables"
        ? 35
        : hasAnyText(name, ["salade", "epinard", "épinard", "brocoli", "chou", "carotte", "tomate", "concombre", "poivron", "courgette", "champignon"])
          ? 30
          : 0
    case "fruits":
      return categoryL1 === "fruits"
        ? 35
        : hasAnyText(name, ["pomme", "banane", "kiwi", "fraise", "framboise", "orange", "mangue", "raisin", "ananas", "compote"])
          ? 30
          : 0
    case "drinks":
      return categoryL1 === "drinks"
        ? 35
        : hasAnyText(name, ["eau", "cafe", "café", "the", "thé", "jus", "smoothie", "soda", "cola", "biere", "bière", "vin", "boisson", "lait"])
          ? 30
          : 0
    case "sauces":
      return hasAnyText(name, ["sauce", "ketchup", "moutarde", "mayonnaise", "pesto", "vinaigrette", "sirop", "caramel", "miel"])
        ? 35
        : 0
    default:
      return 0
  }
}

function modifierCompatibility(candidateName: string, transcript: string): number {
  const name = normalizeVoiceCatalogText(candidateName)
  const transcriptText = normalizeVoiceCatalogText(transcript)
  const signals = extractVoiceCatalogSignals(transcriptText)
  let score = 0

  if (signals.modifiers.has("lean")) {
    if (hasAnyText(name, ["maigre", "ecreme", "écrémé", "demi ecreme", "demi-écrémé", "partiellement ecreme", "0%", "4%", "allégé", "allege"])) score += 40
    if (hasAnyText(name, ["entier", "40%"])) score -= 60
  }
  if (signals.modifiers.has("whole")) {
    if (hasAnyText(name, ["entier", "40%"])) score += 35
    if (hasAnyText(name, ["maigre", "ecreme", "écrémé", "0%", "4%"])) score -= 40
  }
  if (signals.modifiers.has("4pct")) {
    if (hasAnyText(name, ["4%"])) score += 70
    if (hasAnyText(name, ["40%"])) score -= 120
  }
  if (signals.modifiers.has("0pct")) {
    if (hasAnyText(name, ["0%"])) score += 70
    if (hasAnyText(name, ["4%", "10%", "40%"])) score -= 80
  }
  if (signals.modifiers.has("10pct")) {
    if (hasAnyText(name, ["10%"])) score += 35
    if (hasAnyText(name, ["0%", "4%", "40%"])) score -= 35
  }
  if (signals.modifiers.has("raw")) {
    if (hasAnyText(name, ["cru", "crue", "raw"])) score += 18
    if (hasAnyText(name, ["cuit", "cuite", "cooked", "grille", "poele", "rôti", "roti", "frit"])) score -= 25
  }
  if (signals.modifiers.has("cooked")) {
    if (hasAnyText(name, ["cuit", "cuite", "cooked", "grille", "poele", "rôti", "roti", "frit"])) score += 18
    if (hasAnyText(name, ["cru", "crue", "raw"])) score -= 20
  }
  if (signals.modifiers.has("honey")) {
    if (hasAnyText(name, ["honey", "miel"])) score += 20
  }
  return score
}

function percentCompatibility(candidateName: string, transcript: string): number {
  const candidatePercents = new Set(Array.from(normalizeVoiceCatalogText(candidateName).matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)).map((match) => Number(match[1]?.replace(",", "."))).filter((value) => Number.isFinite(value)))
  const transcriptPercents = new Set(Array.from(normalizeVoiceCatalogText(transcript).matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)).map((match) => Number(match[1]?.replace(",", "."))).filter((value) => Number.isFinite(value)))
  if (candidatePercents.size === 0 || transcriptPercents.size === 0) return 0
  const candidateValues = Array.from(candidatePercents)
  const transcriptValues = Array.from(transcriptPercents)
  if (candidateValues.some((value) => transcriptValues.includes(value))) return 50
  return -120
}

function scoreAgainstSignals(candidate: CatalogLikeItem, transcript: string): number {
  const signals = extractVoiceCatalogSignals(transcript)
  let score = 0

  for (const family of signals.families) {
    score += familyBoost(candidate, family)
  }

  score += modifierCompatibility(candidate.name_fr, transcript)
  score += percentCompatibility(candidate.name_fr, transcript)

  if (signals.families.size === 0 && signals.modifiers.size === 0 && signals.forms.size === 0) {
    return score
  }

  const candidateName = normalizeVoiceCatalogText(candidate.name_fr)
  const candidateForms = Array.from(signals.forms)
  if (candidateForms.includes("cereal-shape") && hasAnyText(candidateName, ["rings", "anneaux", "pétale", "petale", "flakes", "flocon", "boule", "ball", "puff"])) score += 25
  if (candidateForms.includes("dairy-cup") && hasAnyText(candidateName, ["petit suisse", "fromage blanc", "yaourt", "skyr", "quark", "fromage frais"])) score += 20
  if (candidateForms.includes("milk") && hasAnyText(candidateName, ["lait"])) score += 20
  if (candidateForms.includes("protein") && hasAnyText(candidateName, ["poulet", "boeuf", "bœuf", "porc", "dinde", "saumon", "thon", "oeuf", "œuf", "crevette", "tofu", "tempeh", "whey"])) score += 20
  if (candidateForms.includes("protein-powder") && hasAnyText(candidateName, ["whey", "isolate", "isolat", "proteine", "protein", "addict"])) score += 45
  if (candidateForms.includes("peanut-butter") && hasAnyText(candidateName, ["beurre de cacahuete", "beurre de cacahuète", "peanut butter", "lidl"])) score += 45

  return score
}

export function scoreVoiceCatalogCandidate(transcript: string, candidate: CatalogLikeItem): number {
  const normalizedTranscript = normalizeVoiceCatalogText(transcript)
  const normalizedCandidate = normalizeVoiceCatalogText(candidate.name_fr)
  if (!normalizedTranscript || !normalizedCandidate) return 0

  const queryTokens = tokenizeVoiceCatalogText(transcript)
  const candidateTokens = tokenizeVoiceCatalogText(candidate.name_fr)
  let score = 0

  if (normalizedCandidate === normalizedTranscript) score += 100
  else if (normalizedCandidate.includes(normalizedTranscript)) score += 90
  else if (normalizedTranscript.includes(normalizedCandidate)) score += 82

  for (const queryToken of queryTokens) {
    if (candidateTokens.includes(queryToken)) score += 16
    else if (candidateTokens.some((candidateToken) => candidateToken.startsWith(queryToken))) score += 12
    else if (candidateTokens.some((candidateToken) => candidateToken.includes(queryToken))) score += 6
  }

  score += Math.min(candidateTokens.length, queryTokens.length)
  score += Math.min(candidateTokens.length, 3) * 2
  score += scoreAgainstSignals(candidate, transcript)
  return score
}

export function describeVoiceCatalogContext(transcript: string): string {
  const signals = extractVoiceCatalogSignals(transcript)
  const lines: string[] = []
  if (signals.families.size) lines.push(`familles=${Array.from(signals.families).join(",")}`)
  if (signals.modifiers.size) lines.push(`modificateurs=${Array.from(signals.modifiers).join(",")}`)
  if (signals.forms.size) lines.push(`formes=${Array.from(signals.forms).join(",")}`)
  if (signals.percentages.length) lines.push(`pourcentages=${Array.from(new Set(signals.percentages)).join(",")}`)
  return lines.join(" | ")
}

export function buildVoiceCatalogPrompt(items: CatalogLikeItem[], transcript: string, clientId: string): string {
  const ranked = items
    .map((item) => ({
      item,
      score: (item.client_id === clientId ? 45 : 0) + scoreVoiceCatalogCandidate(transcript, item),
    }))
    .filter(({ item, score }) => item.client_id === clientId || score >= 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)

  if (ranked.length === 0) return ""

  return [
    "Catalogue disponible à privilégier si cohérent avec le texte utilisateur :",
    ...ranked.map(({ item }) => `- ${item.name_fr} (id: ${item.id})`),
  ].join("\n")
}
