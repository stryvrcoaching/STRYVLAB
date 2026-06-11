import type { FoodItem } from "@/lib/nutrition/food-items"

export type VisibleCategoryKey = "proteins" | "carbs" | "fats" | "vegetables" | "drinks" | "supplements"
export type VisibleLeafKey =
  | "chicken" | "beef" | "pork" | "turkey" | "fish" | "seafood" | "eggs" | "dairy-protein" | "plant-protein" | "charcuterie" | "other-proteins"
  | "rice" | "pasta" | "bread" | "cereals" | "potatoes" | "legumes" | "fresh-fruits" | "dried-fruits" | "sweet-products" | "sweet-sauces"
  | "oils" | "nuts-seeds" | "avocado-olives" | "butter-spreads" | "nut-butters" | "fatty-sauces"
  | "leafy" | "cruciferous" | "roots" | "mediterranean" | "other-vegetables"
  | "water" | "hot-drinks" | "juices-smoothies" | "sodas" | "plant-milks" | "sports-drinks" | "alcohol"
  | "whey" | "gainers-bars" | "performance" | "other-supplements"

const SWEET_SNACK_BLOCKERS = [
  "vinaigre",
  "moutarde",
  "capre",
  "câpre",
  "oignon",
  "harissa",
  "mayonnaise",
  "pesto",
  "vinaigrette",
  "condiment",
]

const SWEET_PRODUCT_TERMS = [
  "sucre",
  "miel",
  "confiture",
  "chocolat",
  "biscuit",
  "cookie",
  "gateau",
  "gâteau",
  "bonbon",
  "compote",
  "granola",
  "cereal",
  "céréal",
  "barre",
  "dessert",
]

const SWEET_SAUCE_TERMS = [
  "sirop",
  "coulis",
  "ketchup",
  "caramel",
  "chocolat",
  "miel",
  "barbecue",
  "bbq",
  "glace",
  "topping",
]

const FRUIT_BLOCKERS = [
  "biscuit",
  "gateau",
  "gâteau",
  "beignet",
  "tarte",
  "dessert",
  "mousse",
  "bonbon",
  "chocolat",
  "barre",
  "sirop",
]

const CEREAL_BLOCKERS = [
  "barre",
  "biscuit",
  "gateau",
  "gâteau",
  "dessert",
  "bonbon",
  "chocolat",
  "fruit",
  "sirop",
]

const OIL_BLOCKERS = [
  "beurre",
  "margarine",
  "spreads",
  "pâte",
  "pate",
  "creme",
  "crème",
]

const COMPOSITE_MEAL_BLOCKERS = [
  "soupe",
  "bouillon",
  "potage",
  "veloute",
  "plat compose",
  "plats composes",
  "salade composee",
  "salades composees",
  "sandwich",
  "pizza",
  "quiche",
  "feuillete",
  "bouchee",
  "bouchée",
  "nem",
  "pate imperial",
  "pâté impérial",
  "burger",
  "wrap",
]

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
}

function nameHasAny(item: Pick<FoodItem, "name_fr">, keywords: string[]): boolean {
  const name = normalizeText(item.name_fr)
  return keywords.some((keyword) => name.includes(normalizeText(keyword)))
}

function hasAnyText(value: string, keywords: string[]): boolean {
  const text = normalizeText(value)
  return keywords.some((keyword) => text.includes(normalizeText(keyword)))
}

function hasWordText(value: string, keywords: string[]): boolean {
  const text = ` ${normalizeText(value)} `
  return keywords.some((keyword) => {
    const normalized = normalizeText(keyword)
    return normalized ? text.includes(` ${normalized} `) : false
  })
}

function hasWordPrefixText(value: string, keywords: string[]): boolean {
  const text = normalizeText(value)
  return keywords.some((keyword) => {
    const normalized = normalizeText(keyword)
    return normalized ? text === normalized || text.startsWith(`${normalized} `) || text.includes(` ${normalized} `) : false
  })
}

function isProteinFamilyHint(item: FoodItem): boolean {
  return hasAnyText(item.name_fr, [
    "poulet",
    "chicken",
    "dinde",
    "turkey",
    "boeuf",
    "bœuf",
    "veau",
    "agneau",
    "mouton",
    "porc",
    "jambon",
    "lard",
    "bacon",
    "saucisse",
    "chorizo",
    "salami",
    "saucisson",
    "pancetta",
    "bresaola",
    "poisson",
    "saumon",
    "thon",
    "sardine",
    "maquereau",
    "truite",
    "bar",
    "brochet",
    "cabillaud",
    "morue",
    "merlan",
    "hareng",
    "anchois",
    "anguille",
    "brème",
    "breme",
    "crabe",
    "araignee de mer",
    "araignée de mer",
    "homard",
    "langouste",
    "crevette",
    "moule",
    "huitre",
    "huître",
    "calamar",
    "seiche",
    "oeuf",
    "œuf",
    "blanc d'oeuf",
    "blanc d'œuf",
    "fromage",
    "yaourt",
    "skyr",
    "lait",
    "whey",
    "protéine",
    "protein",
  ])
}

function isCarbFamilyHint(item: FoodItem): boolean {
  return hasAnyText(item.name_fr, [
    "riz",
    "pate",
    "pâtes",
    "spaghetti",
    "penne",
    "macaroni",
    "tagliatelle",
    "gnocchi",
    "pain",
    "baguette",
    "biscotte",
    "galette",
    "cereale",
    "céréale",
    "muesli",
    "granola",
    "flocon",
    "avoine",
    "porridge",
    "pomme de terre",
    "patate",
    "lentille",
    "pois chiche",
    "pois cassé",
    "haricot",
    "fève",
    "soja",
  ])
}

function isFruitFamilyHint(item: FoodItem): boolean {
  return hasAnyText(item.name_fr, [
    "pomme",
    "poire",
    "banane",
    "orange",
    "mandarine",
    "clémentine",
    "citron",
    "fraise",
    "framboise",
    "myrtille",
    "mure",
    "mûre",
    "kiwi",
    "ananas",
    "mangue",
    "pêche",
    "peche",
    "abricot",
    "raisin",
    "melon",
    "pastèque",
    "pasteque",
    "cerise",
    "figue",
    "datte",
    "compote",
    "salade de fruits",
  ])
}

function isSweetSauce(item: FoodItem): boolean {
  const name = normalizeText(item.name_fr)
  return SWEET_SAUCE_TERMS.some((term) => name.includes(normalizeText(term))) && !SWEET_SNACK_BLOCKERS.some((term) => name.includes(normalizeText(term)))
}

function isCompositeMeal(item: FoodItem): boolean {
  return hasAnyText(item.name_fr, COMPOSITE_MEAL_BLOCKERS)
}

function isSweetProduct(item: FoodItem): boolean {
  const name = normalizeText(item.name_fr)
  return SWEET_PRODUCT_TERMS.some((term) => name.includes(normalizeText(term))) && !SWEET_SNACK_BLOCKERS.some((term) => name.includes(normalizeText(term)))
}

function isSpecificProtein(item: FoodItem): boolean {
  return (
    nameHasAny(item, ["poulet", "chicken", "dinde", "turkey"]) ||
    nameHasAny(item, ["boeuf", "bœuf", "veau", "agneau", "mouton", "porc", "jambon", "lard", "bacon", "saucisse", "chorizo", "saucisson", "pancetta", "bresaola"]) ||
    nameHasAny(item, ["poisson", "saumon", "thon", "sardine", "maquereau", "truite", "brochet", "cabillaud", "morue", "merlan", "hareng", "anchois", "anguille", "brème", "breme"]) || hasWordPrefixText(item.name_fr, ["bar"]) ||
    nameHasAny(item, ["crabe", "araignee de mer", "araignée de mer", "homard", "langouste", "crevette", "moule", "huitre", "huître", "calamar", "seiche"]) ||
    nameHasAny(item, ["oeuf", "œuf", "blanc d'oeuf", "blanc d'œuf"]) ||
    nameHasAny(item, ["fromage", "yaourt", "skyr", "lait", "whey", "protéine", "protein"])
  )
}

export function matchesVisibleLeaf(item: FoodItem, leaf: VisibleLeafKey): boolean {
  switch (leaf) {
    case "chicken":
      return item.category_l1 === "proteins" && nameHasAny(item, ["poulet", "chicken", "volaille", "poularde"]) && !isCompositeMeal(item)
    case "beef":
      return item.category_l1 === "proteins" && nameHasAny(item, ["boeuf", "bœuf", "steak", "veau", "hach", "entrecote", "entrecôte", "rumsteck", "bavette", "bourguignon", "braise"]) && !isCompositeMeal(item)
    case "pork":
      return item.category_l1 === "proteins" && nameHasAny(item, ["porc", "jambon", "lard", "bacon", "saucisse", "filet mignon", "rôti de porc", "roti de porc"]) && !isCompositeMeal(item)
    case "turkey":
      return item.category_l1 === "proteins" && nameHasAny(item, ["dinde", "turkey"]) && !isCompositeMeal(item)
    case "fish":
      return item.category_l1 === "proteins" && (hasAnyText(item.name_fr, ["poisson", "saumon", "thon", "sardine", "maquereau", "truite", "brochet", "cabillaud", "morue", "merlan", "hareng", "anchois", "anguille", "brème", "breme", "filet de poisson"]) || hasWordPrefixText(item.name_fr, ["bar"])) && !isCompositeMeal(item)
    case "seafood":
      return item.category_l1 === "proteins" && nameHasAny(item, ["crevette", "moule", "calamar", "seiche", "saint-jacques", "crabe", "homard", "langouste", "huitre", "huître", "araignee de mer", "araignée de mer"]) && !isCompositeMeal(item)
    case "eggs":
      return item.category_l1 === "proteins" && nameHasAny(item, ["oeuf", "œuf", "blanc d'oeuf", "blanc d'œuf", "omelette", "œufs", "oeufs"]) && !isCompositeMeal(item)
    case "dairy-protein":
      return item.category_l1 === "proteins" && nameHasAny(item, ["fromage", "yaourt", "skyr", "lait", "petit-suisse", "petit suisse", "quark"])
    case "plant-protein":
      return item.category_l1 === "proteins" && nameHasAny(item, ["tofu", "tempeh", "seitan", "soja", "soya", "edamame", "protéine végétale", "proteine vegetale"])
    case "charcuterie":
      return item.category_l1 === "proteins" && nameHasAny(item, ["jambon", "salami", "saucisson", "chorizo", "charcut", "bresaola", "pancetta"])
    case "other-proteins":
      return item.category_l1 === "proteins" && !isSpecificProtein(item) && !isCompositeMeal(item)
    case "rice":
      return item.category_l1 === "carbs" && nameHasAny(item, ["riz", "rice", "galette de riz", "galette de riz soufflé", "pate sans gluten a base de riz", "pâtes sans gluten à base de riz"]) && !hasWordPrefixText(item.name_fr, ["chorizo"])
    case "pasta":
      return item.category_l1 === "carbs" && nameHasAny(item, ["pate", "pâtes", "spaghetti", "penne", "macaroni", "tagliatelle", "gnocchi"]) && !nameHasAny(item, ["pate d'amande", "pâte d'amande", "beurre de cacahuete", "beurre de cacahuète", "pate a tartiner", "pâte à tartiner", "pate brisee", "pâte brisée", "pate sablée", "pâte sablée", "pate filo", "pâte filo", "pate phyllo", "pâte phyllo", "pate de foie", "pâté"]) && !isCompositeMeal(item) && !hasAnyText(item.name_fr, ["courge spaghetti", "gnocchi à la pomme de terre", "gnocchi a la pomme de terre", "pâte feuilletée", "pate feuilletee"])
    case "bread":
      return item.category_l1 === "carbs" && nameHasAny(item, ["pain", "baguette", "biscotte", "toast", "wrap", "tortilla", "bagel"]) && !isCompositeMeal(item)
    case "cereals":
      return item.category_l1 === "carbs" && (nameHasAny(item, ["cereale", "céréale", "cereal", "flocon", "muesli", "granola", "porridge", "avoine", "petales", "pétales"]) || item.category_l2 === "cereales") && !nameHasAny(item, CEREAL_BLOCKERS) && !isCompositeMeal(item)
    case "potatoes":
      return item.category_l1 === "carbs" && nameHasAny(item, ["pomme de terre", "patate", "frite", "puree", "purée", "gratin dauphinois"]) && !isCompositeMeal(item)
    case "legumes":
      return item.category_l1 === "carbs" && nameHasAny(item, ["lentille", "pois chiche", "pois cassé", "pois casse", "haricot", "fève", "feve", "soja", "lupin", "flageolet"]) && !isCompositeMeal(item) && !hasAnyText(item.name_fr, ["haricot beurre", "courge doubeurre", "butternut"])
    case "fresh-fruits":
      return item.category_l1 === "fruits" && isFruitFamilyHint(item) && !nameHasAny(item, FRUIT_BLOCKERS) && !isCompositeMeal(item)
    case "dried-fruits":
      return item.category_l1 === "fruits" && hasAnyText(item.name_fr, ["raisin sec", "abricot sec", "figue seche", "dattes", "pruneau", "cranberry", "canneberge"]) && !isCompositeMeal(item)
    case "sweet-products":
      return (item.category_l1 === "carbs" || item.category_l1 === "extras") && isSweetProduct(item)
    case "sweet-sauces":
      return (item.category_l1 === "extras" || item.category_l1 === "carbs") && isSweetSauce(item)
    case "oils":
      return item.category_l1 === "fats" && nameHasAny(item, ["huile", "olives", "olive oil"]) && !nameHasAny(item, OIL_BLOCKERS) && !hasAnyText(item.name_fr, ["à l'huile", "a l'huile", "a l huile", "à l huile"]) && !isCompositeMeal(item) && !hasAnyText(item.name_fr, ["tomate, séchée, à l'huile", "hareng fumé, à l'huile"])
    case "nuts-seeds":
      return item.category_l1 === "fats" && nameHasAny(item, ["noix", "graine", "amande", "noisette", "pistache", "cacahuete", "cacahuète", "chia", "lin", "sésame", "sesame"]) && !isCompositeMeal(item)
    case "avocado-olives":
      return item.category_l1 === "fats" && nameHasAny(item, ["avocat", "olive"]) && !isCompositeMeal(item)
    case "butter-spreads":
      return item.category_l1 === "fats" && nameHasAny(item, ["beurre", "margarine"]) && !isCompositeMeal(item)
    case "nut-butters":
      return (item.category_l1 === "fats" || item.category_l1 === "extras") && nameHasAny(item, ["cacahuete", "cacahuète", "amande", "noisette", "pistache", "beurre de", "puree", "purée", "tahini"]) && !isCompositeMeal(item)
    case "fatty-sauces":
      return (item.category_l1 === "fats" || item.category_l1 === "extras") && (item.category_l2 === "sauces" || nameHasAny(item, ["mayonnaise", "pesto", "vinaigrette", "tahini", "sauce"])) && !isCompositeMeal(item)
    case "leafy":
      return item.category_l1 === "vegetables" && item.category_l2 === "feuilles"
    case "cruciferous":
      return item.category_l1 === "vegetables" && item.category_l2 === "cruciferes"
    case "roots":
      return item.category_l1 === "vegetables" && nameHasAny(item, ["carotte", "betterave", "navet", "radis", "panais"])
    case "mediterranean":
      return item.category_l1 === "vegetables" && nameHasAny(item, ["courgette", "aubergine", "poivron", "tomate", "concombre"])
    case "other-vegetables":
      return item.category_l1 === "vegetables"
    case "water":
      return item.category_l1 === "drinks" && item.category_l2 === "eau"
    case "hot-drinks":
      return item.category_l1 === "drinks" && nameHasAny(item, ["cafe", "café", "the", "thé", "tisane", "infusion", "chicoree", "chicorée", "matcha", "rooibos"])
    case "juices-smoothies":
      return item.category_l1 === "drinks" && nameHasAny(item, ["jus", "nectar", "smoothie", "jus de", "jus d"])
    case "sodas":
      return (item.category_l1 === "drinks" && item.category_l2 === "boissons") || nameHasAny(item, ["coca", "cola", "fanta", "sprite", "soda", "ice tea"])
    case "plant-milks":
      return item.category_l1 === "drinks" && nameHasAny(item, ["lait d'avoine", "lait de soja", "lait d'amande", "lait vegetal", "lait végétal"])
    case "sports-drinks":
      return item.category_l1 === "drinks" && nameHasAny(item, ["boisson energetique", "boisson energétique", "boisson isotonique", "isotonique", "gatorade", "powerade"])
    case "alcohol":
      return item.category_l1 === "drinks" && nameHasAny(item, ["vin", "biere", "bière", "cidre", "vodka", "whisky", "rhum", "gin", "tequila", "alcool"])
    case "whey":
      return (item.category_l2 === "complements" || item.category_l1 === "proteins") && nameHasAny(item, ["whey", "isolate", "caseine", "caséine", "protein", "protéine"])
    case "gainers-bars":
      return (item.category_l2 === "complements" || item.category_l1 === "extras" || item.category_l1 === "proteins") && nameHasAny(item, ["gainer", "barre", "protein bar", "barre prote", "meal replacement"])
    case "performance":
      return item.category_l2 === "complements" && nameHasAny(item, ["creatine", "créatine", "bcaa", "eaa", "pre-workout", "maltodextrine", "electrolyte", "électrolyte"])
    case "other-supplements":
      return item.category_l2 === "complements"
    default:
      return false
  }
}


function getVisibleLeafSortScore(item: FoodItem, leaf: VisibleLeafKey): number {
  const name = normalizeText(item.name_fr)
  let score = 100

  const source = (item as { source?: string | null }).source
  const isVerified = (item as { is_verified?: boolean }).is_verified

  if (source === "internal") score -= 4
  if (isVerified) score -= 4

  if (isCompositeMeal(item)) score += 80

  switch (leaf) {
    case "rice":
      if (name.startsWith("riz ") || name.startsWith("riz,")) score -= 35
      if (hasAnyText(item.name_fr, [
        "riz basmati",
        "riz blanc",
        "riz complet",
        "riz brun",
        "riz rouge",
        "riz sauvage",
        "riz thai",
        "riz thaï",
        "riz jasmin",
        "mélange de variétés",
        "melange de varietes",
      ])) score -= 30
      if (hasAnyText(item.name_fr, ["cuit", "cuit, non salé", "cuite"])) score -= 8
      if (hasAnyText(item.name_fr, ["cru", "sec", "sèche", "seche"])) score += 6
      if (hasAnyText(item.name_fr, [
        "galette",
        "soufflé",
        "souffle",
        "vermicelle",
        "farine",
        "amidon",
        "pâtes",
        "pates",
      ])) score += 45
      break

    case "chicken":
      if (hasAnyText(item.name_fr, [
        "poulet, filet",
        "filet de poulet",
        "blanc de poulet",
        "poulet blanc",
        "poulet, poitrine",
        "poulet, viande",
        "poulet, cuisse",
        "cuisse de poulet",
        "poulet, pilon",
        "poulet, aile",
        "haut de cuisse",
        "escalope",
      ])) score -= 40
      if (hasAnyText(item.name_fr, ["cuit", "rôti", "roti", "sauté", "saute", "poêlé", "poele"])) score -= 8
      if (hasAnyText(item.name_fr, [
        "coeur",
        "cœur",
        "foie",
        "gésier",
        "gesier",
        "abat",
        "graisse",
        "peau",
      ])) score += 55
      if (hasAnyText(item.name_fr, [
        "jambon",
        "allumette",
        "dés",
        "des",
        "haché",
        "hache",
        "rillettes",
        "nuggets",
        "croquette",
        "panée",
        "pane",
        "mariné",
        "marine",
      ])) score += 35
      break

    case "pasta":
      if (hasAnyText(item.name_fr, ["pâtes", "pates", "spaghetti", "penne", "macaroni", "tagliatelle"])) score -= 25
      if (hasAnyText(item.name_fr, ["cuites", "cuit", "non salées", "non salees"])) score -= 8
      if (hasAnyText(item.name_fr, ["salade", "plat", "préemballé", "preemballe", "farcie", "farcies"])) score += 45
      break

    case "eggs":
      if (hasAnyText(item.name_fr, ["oeuf, cru", "œuf, cru", "oeuf, cuit", "œuf, cuit", "blanc d'oeuf", "blanc d'œuf"])) score -= 35
      if (hasAnyText(item.name_fr, ["omelette", "brouillé", "brouille", "préemballé", "preemballe"])) score += 25
      break

    case "beef":
    case "pork":
    case "turkey":
    case "fish":
    case "seafood":
      if (hasAnyText(item.name_fr, ["filet", "viande", "steak", "escalope", "pavé", "pave", "cuisse"])) score -= 25
      if (hasAnyText(item.name_fr, ["foie", "coeur", "cœur", "rognon", "abat", "graisse", "peau"])) score += 45
      if (hasAnyText(item.name_fr, ["pané", "pane", "nuggets", "rillettes", "saucisse", "jambon", "salami", "chorizo"])) score += 35
      break

    default:
      break
  }

  return score
}

export function sortVisibleLeafItems(items: FoodItem[], leaf: VisibleLeafKey): FoodItem[] {
  return [...items].sort((a, b) => {
    const scoreDiff = getVisibleLeafSortScore(a, leaf) - getVisibleLeafSortScore(b, leaf)
    if (scoreDiff !== 0) return scoreDiff
    return a.name_fr.localeCompare(b.name_fr, "fr", { sensitivity: "base" })
  })
}
