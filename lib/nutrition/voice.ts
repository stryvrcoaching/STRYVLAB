import type { CategoryL1, MealType } from './food-items'

export type VoiceConfidence = 'high' | 'medium' | 'low'

export interface VoiceItem {
  name: string
  quantity_g: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  confidence: VoiceConfidence
  food_item_id?: string
  is_new: boolean
  category_l1?: CategoryL1
  category_l2?: string
}

export interface VoiceParseResult {
  items: VoiceItem[]
  meal_type: MealType
  raw_transcript: string
  clean_transcript: string
}

// ── Filler word maps ─────────────────────────────────────────────────────────
const FILLERS: Record<string, RegExp> = {
  // Use (?:^|\s) / (?=\s|$) for accented words that break \b word boundaries
  fr: /(?:^|\s)(?:euh|donc|voil[aà]|en fait|genre|alors|bon|ben)(?=\s|$)/gi,
  en: /\b(um|uh|so|like|well|you know)\b/gi,
  es: /(?:^|\s)(?:eh|bueno|pues|o sea)(?=\s|$)/gi,
}

// ── Written numbers → digits (French) ───────────────────────────────────────
const FR_NUMBERS: Array<[RegExp, string]> = [
  [/\bmille\b/gi, '1000'],
  [/\bcinq cents\b/gi, '500'],
  [/\bquatre cents\b/gi, '400'],
  [/\btrois cents\b/gi, '300'],
  [/\bdeux cents\b/gi, '200'],
  [/\bcent cinquante\b/gi, '150'],
  [/\bcent\b/gi, '100'],
  [/\bquatre-vingt-dix\b/gi, '90'],
  [/\bquatre-vingts?\b/gi, '80'],
  [/\bsoixante-dix\b/gi, '70'],
  [/\bsoixante\b/gi, '60'],
  [/\bciquante\b/gi, '50'],
  [/\bquarante\b/gi, '40'],
  [/\btrente\b/gi, '30'],
  [/\bvingt\b/gi, '20'],
  [/\bdix\b/gi, '10'],
  [/\bneuf\b/gi, '9'],
  [/\bhuit\b/gi, '8'],
  [/\bsept\b/gi, '7'],
  [/\bsix\b/gi, '6'],
  [/\bcinq\b/gi, '5'],
  [/\bquatre\b/gi, '4'],
  [/\btrois\b/gi, '3'],
  [/\bdeux\b/gi, '2'],
  [/\bun\b/gi, '1'],
  [/\bune demi\b/gi, '0.5'],
  [/\bun quart\b/gi, '0.25'],
]

// ── Unit normalizations ──────────────────────────────────────────────────────
const UNITS: Array<[RegExp, string]> = [
  [/\bkilogrammes?\b/gi, 'kg'],
  [/\bgrammes?\b/gi, 'g'],
  [/\bmillilitres?\b/gi, 'ml'],
  [/\bcentilitres?\b/gi, 'cl'],
  [/\blitres?\b/gi, 'L'],
]

export function cleanTranscript(raw: string, lang: string): string {
  let text = raw.toLowerCase()

  const fillerRe = FILLERS[lang] ?? FILLERS['fr']
  text = text.replace(fillerRe, '')

  if (lang === 'fr') {
    for (const [re, digit] of FR_NUMBERS) {
      text = text.replace(re, digit)
    }
  }

  for (const [re, abbr] of UNITS) {
    text = text.replace(re, abbr)
  }

  return text.replace(/\s+/g, ' ').trim()
}

type VoiceCategorySuggestion = {
  category_l1: CategoryL1
  category_l2: string
}

const VOICE_CATEGORY_PATTERNS: Array<{
  category_l1: CategoryL1
  category_l2: string
  patterns: RegExp[]
}> = [
  {
    category_l1: "drinks",
    category_l2: "eau",
    patterns: [/\beau\b/i, /\bwater\b/i, /\bperrier\b/i, /\bsan pellegrino\b/i],
  },
  {
    category_l1: "drinks",
    category_l2: "chauds",
    patterns: [/\bcafe\b/i, /\bcafé\b/i, /\bth[eé]\b/i, /\binfusion\b/i],
  },
  {
    category_l1: "drinks",
    category_l2: "jus-smoothies",
    patterns: [/\bjus\b/i, /\bsmoothie\b/i, /\bshake\b/i],
  },
  {
    category_l1: "drinks",
    category_l2: "laits-vegetaux",
    patterns: [/\blait\b/i, /\bsoy\b/i, /\bavoine\b/i, /\bamande\b/i],
  },
  {
    category_l1: "fruits",
    category_l2: "frais",
    patterns: [/\bpomme\b/i, /\bbanane\b/i, /\bkiwi\b/i, /\bfraise\b/i, /\bframboise\b/i, /\borange\b/i],
  },
  {
    category_l1: "vegetables",
    category_l2: "feuilles",
    patterns: [/\bsalade\b/i, /\bepinard\b/i, /\bépinard\b/i, /\broquette\b/i, /\blaitue\b/i],
  },
  {
    category_l1: "vegetables",
    category_l2: "cruciferes",
    patterns: [/\bbrocoli\b/i, /\bchou\b/i, /\bchoux\b/i, /\bchou-fleur\b/i],
  },
  {
    category_l1: "vegetables",
    category_l2: "autres-legumes",
    patterns: [/\bcarotte\b/i, /\bcourgette\b/i, /\btomate\b/i, /\bpoivron\b/i, /\bconcombre\b/i],
  },
  {
    category_l1: "proteins",
    category_l2: "oeufs",
    patterns: [/\boeuf\b/i, /\bœuf\b/i, /\bomelette\b/i],
  },
  {
    category_l1: "proteins",
    category_l2: "viandes",
    patterns: [/\bpoulet\b/i, /\bdinde\b/i, /\bsteak\b/i, /\bboeuf\b/i, /\bbœuf\b/i, /\bjambon\b/i],
  },
  {
    category_l1: "proteins",
    category_l2: "poissons",
    patterns: [/\bsaumon\b/i, /\bthon\b/i, /\btruite\b/i, /\bcrevette\b/i, /\bpoisson\b/i],
  },
  {
    category_l1: "proteins",
    category_l2: "laitiers",
    patterns: [/\byaourt\b/i, /\bskyr\b/i, /\bfromage blanc\b/i, /\bfromage\b/i],
  },
  {
    category_l1: "carbs",
    category_l2: "cereales",
    patterns: [/\briz\b/i, /\bavoine\b/i, /\bquinoa\b/i, /\bsemoule\b/i, /\bcereale\b/i],
  },
  {
    category_l1: "carbs",
    category_l2: "fecules",
    patterns: [/\bpomme de terre\b/i, /\bpates?\b/i, /\bpâtes?\b/i, /\bgnocchi\b/i],
  },
  {
    category_l1: "carbs",
    category_l2: "pain",
    patterns: [/\bpain\b/i, /\btortilla\b/i, /\bwrap\b/i, /\bbaguette\b/i],
  },
  {
    category_l1: "carbs",
    category_l2: "legumineuses",
    patterns: [/\blentille\b/i, /\bpois chiche\b/i, /\bharicot\b/i, /\bpois\b/i],
  },
  {
    category_l1: "fats",
    category_l2: "huiles",
    patterns: [/\bhuile\b/i, /\bhuile d'?olive\b/i],
  },
  {
    category_l1: "fats",
    category_l2: "noix-graines",
    patterns: [/\bamande\b/i, /\bnoix\b/i, /\bgraines?\b/i, /\bcajou\b/i, /\bnoisette\b/i],
  },
  {
    category_l1: "fats",
    category_l2: "autres-lipides",
    patterns: [/\bavocat\b/i, /\bbeurre\b/i, /\bpur[eé]e d'amande\b/i, /\bpeanut butter\b/i],
  },
]

export function guessVoiceFoodCategory(name: string): VoiceCategorySuggestion | null {
  const label = name.trim().toLowerCase()
  if (!label) return null

  for (const group of VOICE_CATEGORY_PATTERNS) {
    if (group.patterns.some((pattern) => pattern.test(label))) {
      return {
        category_l1: group.category_l1,
        category_l2: group.category_l2,
      }
    }
  }

  return null
}
