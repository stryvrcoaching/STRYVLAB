export type DrinkType = "water" | "espresso" | "coffee" | "lungo" | "tea"
export type DrinkLogKind = "all" | "water" | "caffeine"

export type DrinkPreset = {
  drinkType: DrinkType
  label: string
  shortLabel: string
  baseAmountMl: number
  baseCaffeineMg: number
  accent: string
  cupCount: 1 | 2 | 3
  strengthLabel: string
}

export const DRINK_PRESETS: Record<DrinkType, DrinkPreset> = {
  water: {
    drinkType: "water",
    label: "Eau",
    shortLabel: "Eau",
    baseAmountMl: 250,
    baseCaffeineMg: 0,
    accent: "#60a5fa",
    cupCount: 1,
    strengthLabel: "hydratation",
  },
  espresso: {
    drinkType: "espresso",
    label: "Espresso",
    shortLabel: "Espresso",
    baseAmountMl: 40,
    baseCaffeineMg: 80,
    accent: "#c08457",
    cupCount: 1,
    strengthLabel: "concentré",
  },
  coffee: {
    drinkType: "coffee",
    label: "Café",
    shortLabel: "Café",
    baseAmountMl: 180,
    baseCaffeineMg: 95,
    accent: "#c08457",
    cupCount: 2,
    strengthLabel: "classique",
  },
  lungo: {
    drinkType: "lungo",
    label: "Lungo",
    shortLabel: "Lungo",
    baseAmountMl: 120,
    baseCaffeineMg: 110,
    accent: "#c08457",
    cupCount: 3,
    strengthLabel: "allongé",
  },
  tea: {
    drinkType: "tea",
    label: "Thé",
    shortLabel: "Thé",
    baseAmountMl: 250,
    baseCaffeineMg: 35,
    accent: "#34d399",
    cupCount: 1,
    strengthLabel: "infusé",
  },
}

const CAFFEINATED_TYPES: Exclude<DrinkType, "water">[] = ["espresso", "coffee", "lungo", "tea"]

export function isCaffeinatedDrinkType(type: DrinkType): type is Exclude<DrinkType, "water"> {
  return CAFFEINATED_TYPES.includes(type as Exclude<DrinkType, "water">)
}

export function getDrinkPreset(drinkType: DrinkType): DrinkPreset {
  return DRINK_PRESETS[drinkType]
}

export function estimateCaffeineMg(drinkType: DrinkType, amountMl: number): number {
  if (drinkType === "water") return 0
  const preset = DRINK_PRESETS[drinkType]
  const safeAmount = Math.max(1, amountMl)
  return Math.max(0, Math.round(preset.baseCaffeineMg * (safeAmount / preset.baseAmountMl)))
}

export function inferDrinkTypeFromFoodItem(input: { name_fr: string; category_l1: string; category_l2: string | null }): DrinkType {
  const name = input.name_fr.toLowerCase()
  const category = `${input.category_l1 ?? ""} ${input.category_l2 ?? ""}`.toLowerCase()

  if (input.category_l1 !== "drinks") return "water"
  if (/espresso|expresso/.test(name)) return "espresso"
  if (/lungo/.test(name)) return "lungo"
  if (/(th[eé]|tisane|infusion|rooibos|camomille)/.test(name) || /(th[eé]|tisane|infusion|rooibos|camomille)/.test(category)) return "tea"
  if (/cafe|coffee|cappuccino|latte|macchiato|ristretto/.test(name)) return "coffee"
  if (/chauds?/.test(category)) return "coffee"
  return "water"
}
