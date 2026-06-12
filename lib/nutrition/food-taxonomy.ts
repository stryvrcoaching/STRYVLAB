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

  if (hasAnyText(item.name_fr, [
    "barre",
    "biscuit",
    "beignet",
    "brioche",
    "brownie",
    "céréales",
    "cereales",
    "chocolat au lait",
    "chocolat noir",
    "chocolat blanc",
    "cookie",
    "gaufre",
    "muffin",
    "pétales",
    "petales",
    "pain au chocolat",
    "pâtisserie",
    "patisserie",
    "tarte",
    "rocher",
    "sablé",
    "sable"
  ])) {
    return false
  }

  return hasAnyText(item.name_fr, [
    "ketchup",
    "sauce barbecue",
    "sauce bbq",
    "sauce au chocolat",
    "sirop",
    "sirop d'agave",
    "sirop d'érable",
    "sirop d'erable",
    "coulis",
    "nappage",
    "caramel liquide",
    "miel",
    "confiture"
  ])
}

function isCompositeMeal(item: FoodItem): boolean {
  return hasAnyText(item.name_fr, COMPOSITE_MEAL_BLOCKERS)
}

function isSweetProduct(item: FoodItem): boolean {
  const name = normalizeText(item.name_fr)

  if (item.category_l2 === "snacks-sales" || item.category_l2 === "boissons" || item.category_l2 === "sauces") {
    return false
  }

  if (hasAnyText(item.name_fr, [
    "apéritif",
    "aperitif",
    "salé",
    "sale",
    "crackers",
    "chips",
    "eau minérale",
    "eau minerale",
    "boisson à l'eau",
    "boisson a l'eau",
    "boisson préparée",
    "boisson preparee"
  ])) {
    return false
  }

  return SWEET_PRODUCT_TERMS.some((term) => name.includes(normalizeText(term)))
    && !SWEET_SNACK_BLOCKERS.some((term) => name.includes(normalizeText(term)))
}

function isSpecificProtein(item: FoodItem): boolean {
  return (
    nameHasAny(item, ["poulet", "chicken", "dinde", "turkey"]) ||
    nameHasAny(item, ["boeuf", "bœuf", "veau", "agneau", "mouton", "porc", "jambon", "lard", "bacon", "saucisse", "chorizo", "saucisson", "pancetta", "bresaola"]) ||
    nameHasAny(item, ["poisson", "saumon", "thon", "sardine", "maquereau", "truite", "brochet", "cabillaud", "morue", "merlan", "hareng", "anchois", "anguille", "brème", "breme"]) || hasWordPrefixText(item.name_fr, ["bar"]) ||
    nameHasAny(item, ["crabe", "araignee de mer", "araignée de mer", "homard", "langouste", "crevette", "moule", "huitre", "huître", "calamar", "seiche"]) ||
    isEggFood(item) ||
    nameHasAny(item, ["fromage", "yaourt", "skyr", "lait", "whey", "protéine", "protein"])
  )
}

function isEggFood(item: FoodItem): boolean {
  const name = normalizeText(item.name_fr)
  return /\boeufs?\b/.test(name) || name.includes("blanc d'oeuf") || name.includes("blanc d œuf")
}

function isFreshFruitFood(item: FoodItem): boolean {
  return item.category_l1 === "fruits"
    && isFruitFamilyHint(item)
    && !nameHasAny(item, FRUIT_BLOCKERS)
    && !hasAnyText(item.name_fr, [
      "sec",
      "sèche",
      "seche",
      "séchée",
      "sechee",
      "secs",
      "sèches",
      "seches",
      "moelleux",
      "réhydraté",
      "rehydrate",
      "compote",
      "coulis",
      "chips",
      "confit",
      "appertisé",
      "appertise",
      "sirop"
    ])
}

function isDriedFruitFood(item: FoodItem): boolean {
  const name = normalizeText(item.name_fr)

  if (item.category_l1 !== "fruits") return false
  if (hasAnyText(item.name_fr, ["compote", "coulis", "chips", "sirop", "appertisé", "appertise"])) return false
  if (hasAnyText(item.name_fr, ["cru", "crue", "pulpe, cru", "pulpe, crue"])) {
    return hasAnyText(item.name_fr, ["datte", "pruneau"])
  }

  return (
    /\bsecs?\b/.test(name) ||
    /\bseches?\b/.test(name) ||
    name.includes("sechee") ||
    name.includes("séché") ||
    name.includes("seche") ||
    hasAnyText(item.name_fr, [
      "abricot sec",
      "abricots secs",
      "figue sèche",
      "figue seche",
      "figues sèches",
      "figues seches",
      "raisin sec",
      "raisins secs",
      "datte",
      "dattes",
      "pruneau",
      "pruneaux",
      "cranberry séchée",
      "cranberry sechee",
      "canneberge séchée",
      "canneberge sechee"
    ])
  )
}

export function matchesVisibleLeaf(item: FoodItem, leaf: VisibleLeafKey): boolean {
  switch (leaf) {
    case "chicken":
      return item.category_l1 === "proteins"
        && nameHasAny(item, ["poulet", "volaille"])
        && !hasAnyText(item.name_fr, [
          "chop suey",
          "quenelle",
          "saucisse",
          "knack",
          "rillettes",
          "pâté",
          "pate",
          "confit de foie",
          "préemballé",
          "preemballe"
        ])
        && !isCompositeMeal(item)
    case "beef":
      return item.category_l1 === "proteins"
        && nameHasAny(item, ["boeuf", "bœuf", "veau"])
        && !hasAnyText(item.name_fr, [
          "boeuf aux carottes",
          "bœuf aux carottes",
          "bourguignon",
          "blanquette",
          "brick",
          "fond de veau",
          "boulette",
          "farce",
          "merguez",
          "mouton",
          "agneau",
          "porc",
          "meloukhia",
          "plat à base",
          "plat a base",
          "sauce",
          "préemballé",
          "preemballe"
        ])
        && !isCompositeMeal(item)
    case "pork":
      return item.category_l1 === "proteins"
        && nameHasAny(item, [
          "porc",
          "filet mignon",
          "bacon",
          "lardon",
          "lardons",
          "jambon",
          "échine",
          "echine",
          "palette",
          "poitrine de porc",
          "travers de porc"
        ])
        && !hasAnyText(item.name_fr, [
          "boeuf",
          "bœuf",
          "veau",
          "mouton",
          "agneau",
          "volaille",
          "poulet",
          "dinde",
          "jambon de poulet",
          "jambon de dinde",
          "pélardon",
          "pelardon",
          "omelette",
          "oeuf",
          "œuf",
          "gelée",
          "gelee",
          "merguez",
          "mortadelle, porc et boeuf",
          "farce",
          "potée",
          "potee",
          "cassoulet",
          "porc au caramel",
          "saucisse",
          "chair à saucisse",
          "chair a saucisse",
          "pâté",
          "pate",
          "rillettes",
          "terrine",
          "préemballé",
          "preemballe"
        ])
        && !isCompositeMeal(item)
    case "turkey":
      return item.category_l1 === "proteins" && nameHasAny(item, ["dinde", "turkey"]) && !isCompositeMeal(item)
    case "fish":
      return item.category_l1 === "proteins"
        && item.category_l2 === "poissons"
        && !matchesVisibleLeaf(item, "seafood")
        && !hasAnyText(item.name_fr, [
          "bigorneau",
          "buccin",
          "clam",
          "palourde",
          "praire",
          "écrevisse",
          "ecrevisse",
          "escargot",
          "moule",
          "huître",
          "huitre",
          "crevette",
          "crabe",
          "calmar",
          "calamar",
          "encornet",
          "poulpe",
          "homard",
          "langouste",
          "sauce",
          "quenelle",
          "salade",
          "beignet",
          "brandade",
          "gratin",
          "préemballé",
          "preemballe"
        ])
        && !isCompositeMeal(item)
    case "seafood":
      return item.category_l1 === "proteins"
        && item.category_l2 === "poissons"
        && nameHasAny(item, [
          "crevette",
          "crabe",
          "moule",
          "huître",
          "huitre",
          "calmar",
          "calamar",
          "encornet",
          "poulpe",
          "homard",
          "langouste",
          "coquille saint-jacques",
          "saint jacques",
          "bigorneau",
          "buccin",
          "clam",
          "palourde",
          "praire",
          "écrevisse",
          "ecrevisse"
        ])
        && !hasAnyText(item.name_fr, [
          "beignet",
          "à la romaine",
          "a la romaine",
          "rillettes",
          "sauce",
          "escabèche",
          "escabeche",
          "préemballé",
          "preemballe"
        ])
        && !isCompositeMeal(item)
    case "eggs":
      return item.category_l1 === "proteins"
        && item.category_l2 === "oeufs"
        && nameHasAny(item, ["oeuf", "œuf", "oeufs", "œufs", "omelette"])
        && !hasAnyText(item.name_fr, [
          "crème",
          "creme",
          "flan",
          "pâtissier",
          "patissier",
          "tarte",
          "gâteau",
          "gateau",
          "biscuit",
          "dessert",
          "pommes",
          "garniture farine",
          "lardons",
          "jambon",
          "viande",
          "pommes de terre",
          "tortilla",
          "garnitures diverses",
          "pâtes",
          "pates",
          "nouilles"
        ])
    case "dairy-protein":
      return item.category_l1 === "proteins"
        && item.category_l2 === "laitiers"
        && !hasAnyText(item.name_fr, [
          "fromage de tête",
          "fromage de tete",
          "omelette",
          "mousse au chocolat",
          "dessert végétal",
          "dessert vegetal"
        ])
    case "plant-protein":
      return item.category_l1 === "proteins"
        && (
          item.category_l2 === "vegetales"
          || nameHasAny(item, ["tofu", "tempeh", "seitan", "protéine de soja", "proteine de soja", "soja texturé", "soja texture", "bouchées végétales", "bouchees vegetales", "émincé végétal", "emince vegetal"])
        )
        && !hasAnyText(item.name_fr, [
          "dessert",
          "fromage",
          "tartiner",
          "sucré",
          "sucre",
          "aromatisé",
          "aromatise"
        ])
    case "charcuterie":
      return item.category_l1 === "proteins"
        && nameHasAny(item, [
          "jambon",
          "salami",
          "saucisson",
          "chorizo",
          "charcut",
          "bresaola",
          "pancetta",
          "mortadelle",
          "rosette",
          "coppa"
        ])
        && !hasAnyText(item.name_fr, [
          "oeuf",
          "œuf",
          "sandwich",
          "baguette",
          "beurre",
          "spécialité végétale",
          "specialite vegetale",
          "végétale type jambon",
          "vegetale type jambon",
          "jambon en croûte",
          "jambon en croute",
          "préemballé",
          "preemballe"
        ])
        && !isCompositeMeal(item)
    case "other-proteins":
      return item.category_l1 === "proteins"
        && !isCompositeMeal(item)
        && !["laitiers", "complements", "poissons", "oeufs", "vegetales"].includes(item.category_l2 ?? "")
        && !hasAnyText(item.name_fr, [
          "fromage",
          "brie",
          "camembert",
          "comté",
          "comte",
          "gouda",
          "cheddar",
          "emmental",
          "feta",
          "chèvre",
          "chevre",
          "skyr",
          "yaourt",
          "lait",
          "petit-suisse",
          "petit suisse",
          "whey",
          "caseine",
          "caséine",
          "creatine",
          "créatine",
          "bcaa",
          "collagene",
          "collagène",
          "dessert",
          "crème",
          "creme",
          "gâteau",
          "gateau"
        ])
        && !matchesVisibleLeaf(item, "chicken")
        && !matchesVisibleLeaf(item, "beef")
        && !matchesVisibleLeaf(item, "pork")
        && !matchesVisibleLeaf(item, "turkey")
        && !matchesVisibleLeaf(item, "fish")
        && !matchesVisibleLeaf(item, "seafood")
        && !matchesVisibleLeaf(item, "eggs")
        && !matchesVisibleLeaf(item, "charcuterie")
        && !matchesVisibleLeaf(item, "dairy-protein")
        && !matchesVisibleLeaf(item, "plant-protein")
    case "rice":
      return item.category_l1 === "carbs"
        && nameHasAny(item, ["riz"])
        && !hasAnyText(item.name_fr, [
          "pâtes",
          "pates",
          "riz soufflé chocolaté",
          "riz souffle chocolate",
          "galette",
          "vermicelle"
        ])
    case "pasta":
      return item.category_l1 === "carbs" && nameHasAny(item, ["pâtes", "pates", "spaghetti", "penne", "macaroni", "tagliatelle", "gnocchi", "nouille", "nouilles"]) && !nameHasAny(item, ["pate d'amande", "pâte d'amande", "beurre de cacahuete", "beurre de cacahuète", "pate a tartiner", "pâte à tartiner", "pate brisee", "pâte brisée", "pate sablée", "pâte sablée", "pate filo", "pâte filo", "pate phyllo", "pâte phyllo", "pate de foie", "pâte de fruits", "pâte à pizza", "pate a pizza", "pâte feuilletée", "pate feuilletee"]) && !isCompositeMeal(item) && !hasAnyText(item.name_fr, ["courge spaghetti", "gnocchi à la pomme de terre", "gnocchi a la pomme de terre"])
    case "bread":
      return item.category_l1 === "carbs"
        && nameHasAny(item, ["pain", "baguette", "biscotte", "toast", "wrap", "tortilla", "bagel", "pita"])
        && !hasAnyText(item.name_fr, [
          "chips",
          "tortilla chips",
          "fruit à pain",
          "fruit a pain",
          "farine",
          "pour pains",
          "pour pain"
        ])
        && !isCompositeMeal(item)
    case "cereals":
      return item.category_l1 === "carbs"
        && nameHasAny(item, [
          "avoine",
          "flocon",
          "muesli",
          "quinoa",
          "boulgour",
          "bulgur",
          "semoule",
          "couscous",
          "polenta",
          "sarrasin",
          "orge",
          "seigle",
          "sorgho",
          "mil",
          "maïs",
          "mais",
          "blé",
          "ble",
          "épeautre",
          "epeautre",
          "céréales",
          "cereales",
          "corn flakes",
          "granola"
        ])
        && !matchesVisibleLeaf(item, "rice")
        && !matchesVisibleLeaf(item, "pasta")
        && !matchesVisibleLeaf(item, "bread")
        && !matchesVisibleLeaf(item, "potatoes")
        && !matchesVisibleLeaf(item, "legumes")
        && !hasAnyText(item.name_fr, [
          "chips",
          "tortilla",
          "gnocchi",
          "pain",
          "salade de pommes de terre",
          "tomate à la provençale",
          "tomate a la provencale",
          "dextrose",
          "maltodextrine"
        ])
        && !isCompositeMeal(item)
    case "potatoes":
      return item.category_l1 === "carbs"
        && nameHasAny(item, ["pomme de terre", "pommes de terre", "patate douce", "frite", "frites", "purée de pomme de terre", "puree de pomme de terre", "gratin dauphinois"])
        && !hasAnyText(item.name_fr, [
          "falafel",
          "boulette",
          "pois-chiche",
          "pois chiche",
          "brandade",
          "gratin de poisson",
          "parmentier de poisson",
          "poêlée",
          "poelee",
          "lardons",
          "poulet",
          "préemballé",
          "preemballe"
        ])
    case "legumes":
      return item.category_l1 === "carbs"
        && nameHasAny(item, [
          "lentille",
          "lentilles",
          "pois chiche",
          "pois chiches",
          "pois-chiche",
          "haricot blanc",
          "haricot rouge",
          "haricots noirs",
          "flageolet",
          "fève",
          "feve",
          "pois cassé",
          "pois casse",
          "lupin",
          "haricot mungo",
          "falafel"
        ])
        && !hasAnyText(item.name_fr, [
          "pâtes",
          "pates",
          "vermicelle",
          "saucisse",
          "petit salé",
          "petit sale",
          "sauce tomate",
          "préemballé",
          "preemballe"
        ])
    case "fresh-fruits":
      return isFreshFruitFood(item)
        && !hasAnyText(item.name_fr, [
          "datte",
          "dattes",
          "sec",
          "sèche",
          "seche",
          "séché",
          "seche",
          "séchée",
          "sechee",
          "bouillie",
          "cuite à l'eau",
          "cuite a l'eau",
          "rôtie",
          "rotie",
          "appertisé",
          "appertise",
          "compote",
          "coulis"
        ])
    case "dried-fruits":
      return isDriedFruitFood(item)
    case "sweet-products":
      return (item.category_l1 === "carbs" || item.category_l1 === "extras") && isSweetProduct(item)
    case "sweet-sauces":
      return item.category_l2 === "sauces"
        && nameHasAny(item, [
          "ketchup",
          "barbecue",
          "bbq",
          "sauce au chocolat",
          "sirop",
          "coulis",
          "nappage",
          "caramel liquide",
          "miel",
          "confiture"
        ])
        && !hasAnyText(item.name_fr, [
          "crêpe",
          "crepe",
          "fourrée",
          "fourree",
          "biscuit",
          "gâteau",
          "gateau",
          "barre",
          "tartelette"
        ])
    case "oils":
      return item.category_l1 === "fats" && nameHasAny(item, ["huile", "olives", "olive oil"]) && !nameHasAny(item, OIL_BLOCKERS) && !hasAnyText(item.name_fr, ["à l'huile", "a l'huile", "a l huile", "à l huile"]) && !isCompositeMeal(item) && !hasAnyText(item.name_fr, ["tomate, séchée, à l'huile", "hareng fumé, à l'huile"])
    case "nuts-seeds":
      return item.category_l1 === "fats"
        && item.category_l2 === "noix-graines"
        && !matchesVisibleLeaf(item, "nut-butters")
        && !hasAnyText(item.name_fr, [
          "beurre cacahouète",
          "beurre cacahouete",
          "beurre cacahuète",
          "beurre cacahuete",
          "pâte d'amande",
          "pate d'amande",
          "crème de marrons",
          "creme de marrons"
        ])
    case "avocado-olives":
      return item.category_l1 === "fats" && nameHasAny(item, ["avocat", "olive"]) && !isCompositeMeal(item)
    case "butter-spreads":
      return item.category_l1 === "fats" && nameHasAny(item, ["beurre", "margarine"]) && !isCompositeMeal(item)
    case "nut-butters":
      return (
          item.category_l1 === "fats"
          || item.category_l2 === "noix-graines"
          || item.category_l2 === "snacks-sucres"
        )
        && nameHasAny(item, [
          "purée d'amande",
          "puree d'amande",
          "purée de noisette",
          "puree de noisette",
          "purée de noix",
          "puree de noix",
          "purée de sésame",
          "puree de sesame",
          "tahini",
          "tahin",
          "beurre de cacahuète",
          "beurre de cacahuete",
          "beurre cacahuète",
          "beurre cacahuete",
          "beurre cacahouète",
          "beurre cacahouete",
          "beurre d'arachide"
        ])
        && !hasAnyText(item.name_fr, [
          "chocolat",
          "pâte à tartiner chocolat",
          "pate a tartiner chocolat",
          "aligot",
          "gâteau",
          "gateau",
          "crêpe",
          "crepe",
          "gaufrette",
          "pâte d'amande",
          "pate d'amande"
        ])
    case "fatty-sauces":
      return item.category_l2 === "sauces"
        && nameHasAny(item, [
          "mayonnaise",
          "aïoli",
          "aioli",
          "vinaigrette",
          "pesto",
          "béarnaise",
          "bearnaise",
          "hollandaise",
          "tartare",
          "rouille",
          "sauce blanche",
          "sauce crème",
          "sauce creme",
          "sauce au poivre",
          "sauce curry"
        ])
        && !hasAnyText(item.name_fr, [
          "poisson",
          "ravioli",
          "raviolis",
          "salade",
          "carottes râpées",
          "carottes rapees",
          "profiterole",
          "plat",
          "viande",
          "pâtes",
          "pates",
          "fast-food"
        ])
    case "leafy":
      return item.category_l1 === "vegetables"
        && nameHasAny(item, [
          "salade",
          "laitue",
          "batavia",
          "mâche",
          "mache",
          "roquette",
          "épinard",
          "epinard",
          "cresson",
          "endive",
          "scarole",
          "mesclun",
          "jeunes pousses",
          "pissenlit",
          "oseille",
          "blette",
          "chou frisé",
          "chou frise",
          "kale"
        ])
        && !hasAnyText(item.name_fr, [
          "betterave",
          "betterave rouge",
          "cébette",
          "cebette",
          "oignon",
          "oignon nouveau",
          "oignon frais",
          "laitue de mer",
          "salade de pâtes",
          "salade de pates",
          "salade végétale",
          "salade vegetale",
          "macédoine",
          "macedoine",
          "avec sauce",
          "préemballée",
          "preemballee"
        ])
        && !isCompositeMeal(item)
    case "cruciferous":
      return item.category_l1 === "vegetables"
        && nameHasAny(item, [
          "brocoli",
          "chou",
          "chou-fleur",
          "chou fleur",
          "bruxelles",
          "romanesco",
          "pak-choi",
          "pak choi",
          "bok choy",
          "chou-rave",
          "chou rave",
          "brèdes chou",
          "bredes chou"
        ])
        && !hasAnyText(item.name_fr, [
          "chayote",
          "christophine",
          "chouchou",
          "sechium edule",
          "salade",
          "soupe",
          "potage",
          "mélange",
          "melange",
          "préemballée",
          "preemballee"
        ])
        && !isCompositeMeal(item)
    case "roots":
      return item.category_l1 === "vegetables"
        && nameHasAny(item, [
          "carotte",
          "betterave",
          "navet",
          "radis",
          "panais",
          "rutabaga",
          "salsifis",
          "scorsonère",
          "scorsonere",
          "céleri-rave",
          "celeri-rave",
          "céleri rave",
          "celeri rave"
        ])
        && !hasAnyText(item.name_fr, [
          "petits pois et carottes",
          "printanière",
          "printaniere",
          "macédoine",
          "macedoine",
          "mélange",
          "melange",
          "soupe",
          "potage",
          "salade",
          "avec sauce"
        ])
        && !isCompositeMeal(item)
    case "mediterranean":
      return item.category_l1 === "vegetables"
        && nameHasAny(item, [
          "tomate",
          "courgette",
          "aubergine",
          "poivron",
          "concombre",
          "piment"
        ])
        && !hasAnyText(item.name_fr, [
          "ravioli",
          "raviolis",
          "sauce",
          "pizza",
          "tarte",
          "salade",
          "ratatouille",
          "préemballée",
          "preemballee",
          "à l'huile",
          "a l'huile"
        ])
        && !isCompositeMeal(item)
    case "other-vegetables":
      return item.category_l1 === "vegetables"
        && !matchesVisibleLeaf(item, "leafy")
        && !matchesVisibleLeaf(item, "cruciferous")
        && !matchesVisibleLeaf(item, "roots")
        && !matchesVisibleLeaf(item, "mediterranean")
        && !hasAnyText(item.name_fr, [
          "avocat",
          "banane",
          "plantain",
          "pomme de terre",
          "patate douce",
          "fruit à pain",
          "fruit a pain",
          "igname",
          "dachine",
          "kamanioc",
          "brick",
          "cake salé",
          "cake sale",
          "chips",
          "ravioli",
          "raviolis",
          "lasagne",
          "lasagnes",
          "cannelloni",
          "galette",
          "pavé",
          "pave",
          "couscous de légumes",
          "couscous de legumes",
          "légumes pour couscous",
          "legumes pour couscous",
          "petit pot",
          "plat légumes",
          "plat legumes",
          "salade de pâtes",
          "salade de pates",
          "salade végétale",
          "salade vegetale",
          "avec poisson",
          "avec viande",
          "avec féculent",
          "avec feculent",
          "avec sauce",
          "préemballée",
          "preemballee",
          "risotto",
          "riz blanc",
          "sauce",
          "spiruline",
          "papaye",
          "ti nain",
          "tomate, séchée, à l'huile",
          "tomate, sechee, a l'huile",
          "tomate, séchée, a l'huile",
          "tomate, sechee, à l'huile"
        ])
        && !isCompositeMeal(item)
    case "water":
      return item.category_l1 === "drinks"
        && item.category_l2 === "eau"
        && !hasAnyText(item.name_fr, ["eau de coco", "bouillon"])
    case "hot-drinks":
      return item.category_l1 === "drinks"
        && item.category_l2 === "chauds"
        && nameHasAny(item, ["cafe", "café", "the", "thé", "tisane", "infusion", "chicoree", "chicorée", "matcha", "macha", "rooibos", "cappuccino"])
        && !hasAnyText(item.name_fr, [
          "jus",
          "cythère",
          "cythere",
          "salade",
          "chicorée rouge",
          "chicoree rouge",
          "chicorée verte",
          "chicoree verte",
          "crue",
          "cru",
          "liégeois",
          "liegeois",
          "viennois",
          "dessert",
          "glace",
          "crème dessert",
          "creme dessert"
        ])
    case "juices-smoothies":
      return item.category_l1 === "drinks"
        && item.category_l2 === "jus-smoothies"
        && nameHasAny(item, ["jus", "nectar", "smoothie"])
        && !hasAnyText(item.name_fr, [
          "boisson gazeuse",
          "boisson plate aux fruits",
          "ananas au jus",
          "appertisé",
          "appertise",
          "boisson au soja",
          "boisson lactée",
          "boisson lactee",
          "lait"
        ])
    case "sodas":
      return (item.category_l1 === "drinks" || item.category_l2 === "boissons")
        && item.category_l2 !== "alcools"
        && hasAnyText(item.name_fr, ["boisson gazeuse", "soda", "cola", "coca", "fanta", "sprite", "limonade", "tonic", "ice tea"])
        && !hasAnyText(item.name_fr, [
          "panaché",
          "panache",
          "alcool",
          "bière",
          "biere",
          "chocolat",
          "barre",
          "biscuit",
          "gâteau",
          "gateau",
          "poudre",
          "lait chocolaté",
          "lait chocolate"
        ])
    case "plant-milks":
      return item.category_l1 === "drinks"
        && (
          item.category_l2 === "laits-vegetaux"
          || nameHasAny(item, ["lait d'avoine", "lait de soja", "lait d'amande", "lait de riz", "lait de coco", "lait vegetal", "lait végétal"])
        )
        && !hasAnyText(item.name_fr, [
          "boisson plate aux fruits",
          "jus",
          "nectar",
          "smoothie",
          "dessert",
          "crème",
          "creme"
        ])
    case "sports-drinks":
      return (item.category_l1 === "drinks" || item.category_l2 === "boissons")
        && nameHasAny(item, ["boisson isotonique", "isotonique", "boisson energetique", "boisson énergisante", "gatorade", "powerade", "electrolyte", "électrolyte"])
        && !hasAnyText(item.name_fr, ["alcool", "bière", "biere", "vin"])
    case "alcohol":
      return item.category_l1 === "drinks"
        && item.category_l2 === "alcools"
        && nameHasAny(item, ["vin", "biere", "bière", "cidre", "vodka", "whisky", "rhum", "gin", "tequila", "alcool", "apéritif", "aperitif", "saké", "sake"])
        && !hasAnyText(item.name_fr, ["sans alcool", "faiblement alcoolisée", "faiblement alcoolisee"])
    case "whey":
      return item.category_l2 === "complements"
        && nameHasAny(item, ["whey", "isolate", "isolat", "caseine", "caséine", "protein powder", "protéine", "proteine", "poudre protéinée", "poudre proteinee"])
        && !hasAnyText(item.name_fr, ["texturée", "texturee", "réhydratée", "rehydratee", "encas", "spécialité laitière", "specialite laitiere"])
    case "gainers-bars":
      return (
          item.category_l2 === "complements"
          && nameHasAny(item, ["gainer", "mass gainer", "barre protéinée", "barre prote", "protein bar", "meal replacement", "substitut de repas"])
        )
        || (
          item.category_l2 === "snacks-sucres"
          && nameHasAny(item, ["barre protéinée", "barre prote", "protein bar"])
        )
    case "performance":
      return item.category_l2 === "complements"
        && nameHasAny(item, ["creatine", "créatine", "bcaa", "eaa", "pre-workout", "maltodextrine", "electrolyte", "électrolyte", "glutamine"])
    case "other-supplements":
      return item.category_l2 === "complements"
        && !matchesVisibleLeaf(item, "whey")
        && !matchesVisibleLeaf(item, "gainers-bars")
        && !matchesVisibleLeaf(item, "performance")
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


    case "bread":
      if (hasAnyText(item.name_fr, [
        "pain blanc",
        "pain complet",
        "pain de campagne",
        "pain de seigle",
        "pain aux céréales",
        "pain aux cereales",
        "pain, baguette",
        "baguette"
      ])) score -= 45
      if (hasAnyText(item.name_fr, [
        "pain de mie",
        "biscotte",
        "wrap",
        "tortilla",
        "pita",
        "bagel"
      ])) score -= 20
      if (hasAnyText(item.name_fr, [
        "sandwich",
        "croque",
        "burger",
        "panini",
        "préemballé",
        "preemballe",
        "garni",
        "brioché",
        "brioche",
        "chips",
        "farine",
        "fruit à pain",
        "fruit a pain"
      ])) score += 55
      break

    case "cereals":
      if (hasAnyText(item.name_fr, [
        "flocon d'avoine",
        "flocons d'avoine",
        "avoine",
        "muesli nature",
        "muesli floconneux",
        "porridge",
        "quinoa",
        "boulgour",
        "semoule",
        "couscous",
        "polenta",
        "sarrasin",
        "orge",
        "seigle"
      ])) score -= 40
      if (hasAnyText(item.name_fr, [
        "céréales pour petit déjeuner",
        "cereales pour petit dejeuner",
        "special k",
        "soufflé",
        "souffle",
        "pétales",
        "petales"
      ])) score += 15
      if (hasAnyText(item.name_fr, [
        "chocolaté",
        "chocolate",
        "chocolat",
        "fourré",
        "fourre",
        "sucré",
        "sucre",
        "miel",
        "glacé",
        "glace",
        "barre",
        "biscuit",
        "gâteau",
        "gateau"
      ])) score += 45
      break

    case "potatoes":
      if (hasAnyText(item.name_fr, [
        "pomme de terre",
        "pommes de terre",
        "patate douce",
        "pomme de terre, bouillie",
        "pomme de terre, vapeur",
        "pomme de terre, cuite",
      ])) score -= 30
      if (hasAnyText(item.name_fr, [
        "frite",
        "chips",
        "gratin",
        "dauphinois",
        "rissolée",
        "rissolee",
        "prefrite",
        "préfrites",
        "purée préparée",
        "puree preparee",
      ])) score += 40
      break

    case "legumes":
      if (hasAnyText(item.name_fr, [
        "lentille",
        "pois chiche",
        "pois cassé",
        "pois casse",
        "haricot blanc",
        "haricot rouge",
        "flageolet",
        "fève",
        "feve",
        "lupin",
      ])) score -= 30
      if (hasAnyText(item.name_fr, [
        "sauce",
        "cuisiné",
        "cuisine",
        "préparé",
        "prepare",
        "cassoulet",
        "houmous",
      ])) score += 35
      break

    case "dairy-protein":
      if (hasAnyText(item.name_fr, [
        "skyr",
        "fromage blanc 0%",
        "fromage blanc nature",
        "fromage blanc entier",
        "yaourt grec nature",
        "yaourt à la grecque, nature",
        "yaourt nature",
        "yaourt, lait fermenté ou spécialité laitière, nature",
        "lait demi-écrémé",
        "lait écrémé",
        "lait entier",
        "lait fermenté à boire, nature",
        "petit-suisse",
        "petit suisse",
        "quark",
      ])) score -= 45
      if (hasAnyText(item.name_fr, [
        "lait demi",
        "lait entier",
        "lait écrémé",
        "lait ecreme",
        "lait fermenté",
        "lait fermente",
      ])) score -= 25
      if (!hasAnyText(item.name_fr, ["fromage blanc"]) && hasAnyText(item.name_fr, [
        "fromage à pâte",
        "fromage a pate",
        "fromage bleu",
        "fromage de chèvre",
        "fromage de chevre",
        "camembert",
        "maasdam",
        "coulommiers",
        "croûte",
        "croute",
      ])) score += 35
      if (hasAnyText(item.name_fr, [
        "sucré",
        "sucre",
        "aromatisé",
        "aromatise",
        "aux fruits",
        "dessert",
        "crème",
        "creme",
        "gâteau",
        "gateau",
        "glace",
        "sauce",
        "tzatziki",
      ])) score += 35
      break

    case "plant-protein":
      if (hasAnyText(item.name_fr, [
        "tofu",
        "tempeh",
        "seitan",
        "edamame",
        "protéine végétale",
        "proteine vegetale",
      ])) score -= 30
      if (hasAnyText(item.name_fr, [
        "préparé",
        "prepare",
        "pané",
        "pane",
        "burger",
        "galette",
        "nuggets",
      ])) score += 35
      break

    case "oils":
      if (hasAnyText(item.name_fr, [
        "huile d'olive",
        "huile de colza",
        "huile de tournesol",
        "huile de noix",
        "huile de lin",
        "huile d'avocat",
      ])) score -= 35
      if (hasAnyText(item.name_fr, [
        "sauce",
        "vinaigrette",
        "mayonnaise",
        "préparée",
        "preparee",
      ])) score += 45
      break

    case "nuts-seeds":
      if (hasAnyText(item.name_fr, [
        "amande",
        "noix",
        "noisette",
        "pistache",
        "cacahuète",
        "cacahuete",
        "graine de chia",
        "graine de lin",
        "graine de courge",
        "tournesol",
        "sésame",
        "sesame",
        "soja, graine",
      ])) score -= 30
      if (hasAnyText(item.name_fr, [
        "mélange apéritif",
        "melange aperitif",
        "salé",
        "sale",
        "grillé",
        "grille",
        "caramélisé",
        "caramelise",
        "enrobé",
        "enrobe",
        "chocolat",
      ])) score += 30
      break

    case "avocado-olives":
      if (hasAnyText(item.name_fr, ["avocat", "olive"])) score -= 25
      if (hasAnyText(item.name_fr, ["tapenade", "préparé", "prepare", "farci", "farcies"])) score += 35
      break

    case "butter-spreads":
      if (hasAnyText(item.name_fr, ["beurre doux", "beurre demi-sel", "beurre", "margarine"])) score -= 25
      if (hasAnyText(item.name_fr, ["allégé", "allege", "pâte à tartiner", "pate a tartiner"])) score += 30
      break

    case "nut-butters":
      if (hasAnyText(item.name_fr, [
        "beurre de cacahuète",
        "beurre de cacahuete",
        "purée d'amande",
        "puree d'amande",
        "purée de noisette",
        "puree de noisette",
        "tahini",
      ])) score -= 30
      if (hasAnyText(item.name_fr, ["sucré", "sucre", "chocolat", "pâte à tartiner", "pate a tartiner"])) score += 35
      break

    case "fatty-sauces":
      if (hasAnyText(item.name_fr, ["mayonnaise", "vinaigrette", "pesto", "tahini", "sauce"])) score -= 15
      if (hasAnyText(item.name_fr, ["allégée", "allegee", "préparée", "preparee"])) score += 10
      break



    case "whey":
      if (hasAnyText(item.name_fr, ["whey isolat", "whey isolate", "whey hydrolysée", "whey hydrolysee", "whey concentrée", "whey concentree", "whey protéine", "whey proteine"])) score -= 45
      if (hasAnyText(item.name_fr, ["protimuscle native whey"])) score -= 35
      if (hasAnyText(item.name_fr, ["caséine", "caseine"])) score -= 15
      if (hasAnyText(item.name_fr, ["protéine de pois", "proteine de pois", "protéine de riz", "proteine de riz", "isolat végétal", "isolat vegetal", "poudre protéinée", "poudre proteinee"])) score += 10
      break

    case "gainers-bars":
      if (hasAnyText(item.name_fr, ["mass gainer", "gainer"])) score -= 35
      if (hasAnyText(item.name_fr, ["barre protéinée", "barre prote", "protein bar"])) score -= 25
      break

    case "performance":
      if (hasAnyText(item.name_fr, ["créatine", "creatine"])) score -= 35
      if (hasAnyText(item.name_fr, ["bcaa", "eaa", "glutamine"])) score -= 25
      break

    case "hot-drinks":
      if (hasAnyText(item.name_fr, ["café noir", "cafe noir", "café expresso", "cafe expresso", "café allongé", "cafe allonge", "thé noir", "the noir", "thé vert", "the vert", "tisane", "infusion"])) score -= 35
      if (hasAnyText(item.name_fr, ["poudre soluble", "cappuccino au chocolat", "sucrée", "sucree"])) score += 25
      break

    case "plant-milks":
      if (hasAnyText(item.name_fr, ["non sucré", "non sucre", "nature"])) score -= 25
      if (hasAnyText(item.name_fr, ["sucrée", "sucree", "aromatisée", "aromatisee", "jus de fruits"])) score += 25
      break



    case "leafy":
      if (hasAnyText(item.name_fr, ["salade verte", "laitue", "batavia", "mâche", "mache", "roquette", "épinard", "epinard", "mesclun", "jeunes pousses"])) score -= 35
      if (hasAnyText(item.name_fr, ["purée", "puree", "appertisé", "appertise", "surgelé", "surgele", "cuit"])) score += 12
      break

    case "cruciferous":
      if (hasAnyText(item.name_fr, ["brocoli", "chou-fleur", "chou fleur", "chou de bruxelles", "chou blanc", "chou rouge", "chou vert", "romanesco"])) score -= 35
      if (hasAnyText(item.name_fr, ["purée", "puree", "appertisé", "appertise", "surgelé", "surgele"])) score += 10
      break

    case "roots":
      if (hasAnyText(item.name_fr, ["carotte", "betterave", "navet", "radis", "panais", "céleri-rave", "celeri-rave", "salsifis"])) score -= 35
      if (hasAnyText(item.name_fr, ["purée cuisinée", "puree cuisinee", "déshydratée", "deshydratee"])) score += 25
      break

    case "mediterranean":
      if (hasAnyText(item.name_fr, ["tomate, crue", "tomate cerise", "courgette", "aubergine", "poivron", "concombre"])) score -= 35
      if (hasAnyText(item.name_fr, ["concentré", "concentre", "coulis", "purée", "puree", "séchée", "sechee"])) score += 25
      break

    case "other-vegetables":
      if (hasAnyText(item.name_fr, ["champignon", "haricot vert", "poireau", "oignon", "ail", "artichaut", "asperge", "courge", "potiron", "potimarron", "céleri branche", "celeri branche", "fenouil"])) score -= 40
      if (hasAnyText(item.name_fr, ["algue", "agar", "kombu", "wakamé", "wakame", "nori", "dulse", "fucus", "goémon", "goemon", "séchée", "sechee", "poudre", "herbes de provence", "romarin", "thym", "sauge", "spiruline", "risotto", "riz blanc", "sauce"])) score += 60
      if (hasAnyText(item.name_fr, ["préemballé", "preemballe", "plat", "galette", "pavé", "pave", "lasagne", "ravioli", "couscous"])) score += 80
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
