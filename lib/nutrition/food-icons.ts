import type { CategoryL1 } from "@/lib/nutrition/food-items"

export type FoodIconKey =
  | "chicken"
  | "turkey"
  | "beef"
  | "steak"
  | "pork-chop"
  | "ham"
  | "bacon"
  | "sausage"
  | "lamb-chop"
  | "roast-meat"
  | "salmon"
  | "tuna"
  | "white-fish"
  | "cod"
  | "sardines"
  | "shrimp"
  | "mussels"
  | "crab"
  | "squid"
  | "egg"
  | "egg-white"
  | "egg-white-powder"
  | "egg-yolk"
  | "egg-yolk-powder"
  | "egg-powder"
  | "quail-egg"
  | "duck-egg"
  | "goose-egg"
  | "turkey-egg"
  | "soft-boiled-egg"
  | "fried-egg"
  | "hard-boiled-egg"
  | "poached-egg"
  | "scrambled-eggs"
  | "omelette-cheese"
  | "omelette-mushroom"
  | "omelette-herbs"
  | "skyr"
  | "greek-yogurt"
  | "milk-carton"
  | "yogurt-cup"
  | "cottage-cheese"
  | "mozzarella"
  | "parmesan"
  | "feta"
  | "whey"
  | "whey-scoop"
  | "creatine"
  | "capsules"
  | "tofu"
  | "rice"
  | "wheat"
  | "pasta"
  | "oats"
  | "bread"
  | "croissant"
  | "pretzel"
  | "cereal"
  | "popcorn"
  | "granola-bar"
  | "cookie"
  | "potato"
  | "sweet-potato"
  | "quinoa"
  | "quinoa-bowl"
  | "couscous"
  | "ramen"
  | "tortilla-wrap"
  | "pancakes"
  | "waffle"
  | "lentils"
  | "beans"
  | "bulgur"
  | "buckwheat"
  | "barley"
  | "millet"
  | "polenta"
  | "tapioca"
  | "cassava"
  | "rice-noodles"
  | "gnocchi"
  | "corn"
  | "plantain"
  | "muesli"
  | "rice-cakes"
  | "cornflakes"
  | "granola"
  | "bagel"
  | "pita"
  | "brioche"
  | "rye-bread"
  | "wholegrain-bread"
  | "farro"
  | "spelt"
  | "amaranth"
  | "crackers"
  | "chickpeas"
  | "kidney-beans"
  | "black-beans"
  | "red-lentils"
  | "green-peas"
  | "taro"
  | "yam"
  | "potato-wedges"
  | "sweet-potato-fries"
  | "plantain-chips"
  | "banana"
  | "strawberries"
  | "pear"
  | "grapes"
  | "kiwi"
  | "pineapple"
  | "mango"
  | "watermelon"
  | "lemon"
  | "lime"
  | "clementine"
  | "peach"
  | "melon"
  | "plum"
  | "prune"
  | "date"
  | "fig"
  | "pomegranate"
  | "apricot"
  | "cranberry"
  | "passion-fruit"
  | "guava"
  | "persimmon"
  | "lychee"
  | "pomelo"
  | "papaya"
  | "rambutan"
  | "tamarind"
  | "avocado"
  | "olive-oil"
  | "rapeseed-oil"
  | "sunflower-oil"
  | "walnut-oil"
  | "sesame-oil"
  | "peanut-oil"
  | "palm-oil"
  | "flaxseed-oil"
  | "grape-seed-oil"
  | "almond-oil"
  | "hazelnut-oil"
  | "avocado-oil"
  | "corn-oil"
  | "soybean-oil"
  | "rice-bran-oil"
  | "camelina-oil"
  | "hemp-oil"
  | "argan-oil"
  | "mixed-oils"
  | "peanut-butter"
  | "almond-butter"
  | "cashew-butter"
  | "hazelnut-butter"
  | "pistachio-butter"
  | "hazelnut-spread"
  | "butter"
  | "cocoa-butter"
  | "shea-butter"
  | "margarine"
  | "olives"
  | "coconut"
  | "coconut-oil"
  | "lard"
  | "duck-fat"
  | "goose-fat"
  | "beef-tallow"
  | "cream"
  | "mayonnaise"
  | "tahini"
  | "peanuts"
  | "hazelnuts"
  | "cashews"
  | "pistachios"
  | "pecans"
  | "macadamia"
  | "almonds"
  | "walnuts"
  | "brazil-nuts"
  | "pine-nuts"
  | "mixed-nuts"
  | "nutmeg"
  | "chia"
  | "hemp-seeds"
  | "flax-seeds"
  | "sesame-seeds"
  | "sunflower-seeds"
  | "pumpkin-seeds"
  | "cheese"
  | "tomato"
  | "mushrooms"
  | "asparagus"
  | "cucumber"
  | "bell-pepper"
  | "onion"
  | "garlic"
  | "broccoli"
  | "salad"
  | "carrot"
  | "zucchini"
  | "spinach"
  | "eggplant"
  | "artichoke"
  | "beetroot"
  | "celery-stalk"
  | "celeriac"
  | "cabbage"
  | "brussels-sprouts"
  | "endive"
  | "fennel"
  | "leek"
  | "butternut"
  | "pumpkin"
  | "radish"
  | "black-radish"
  | "peas"
  | "chili-pepper"
  | "pak-choi"
  | "parsnip"
  | "turnip"
  | "rutabaga"
  | "apple"
  | "berries"
  | "blueberries"
  | "orange"
  | "coffee"
  | "latte"
  | "sparkling-water"
  | "espresso"
  | "cappuccino"
  | "green-tea"
  | "herbal-tea"
  | "matcha"
  | "hot-chocolate"
  | "orange-juice"
  | "apple-juice"
  | "pineapple-juice"
  | "berry-smoothie"
  | "green-smoothie"
  | "cola"
  | "lemonade"
  | "iced-tea"
  | "oat-milk"
  | "almond-milk"
  | "isotonic-drink"
  | "dark-chocolate"
  | "honey"
  | "jam"
  | "maple-syrup"
  | "sugar-cubes"
  | "ice-cream"
  | "donut"
  | "candy"
  | "tomato-sauce"
  | "pesto"
  | "mustard"
  | "ketchup"
  | "soy-sauce"
  | "hummus"
  | "burger"
  | "shaker"
  | "water"
  | "energy-drink"
  | "water-bottle"
  | "diet-soda"
  | "protein"
  | "carbs"
  | "fats"
  | "vegetables"
  | "fruits"
  | "drinks"
  | "extras"

export type FoodIconInput = {
  name_fr?: string | null
  category_l1?: CategoryL1 | string | null
  category_l2?: string | null
  icon_key?: string | null
}

const FOOD_ICON_KEYS = new Set<string>([
  "chicken",
  "turkey",
  "beef",
  "steak",
  "pork-chop",
  "ham",
  "bacon",
  "sausage",
  "lamb-chop",
  "roast-meat",
  "salmon",
  "tuna",
  "white-fish",
  "cod",
  "sardines",
  "shrimp",
  "mussels",
  "crab",
  "squid",
  "egg",
  "egg-white",
  "egg-white-powder",
  "egg-yolk",
  "egg-yolk-powder",
  "egg-powder",
  "quail-egg",
  "duck-egg",
  "goose-egg",
  "turkey-egg",
  "soft-boiled-egg",
  "fried-egg",
  "hard-boiled-egg",
  "poached-egg",
  "scrambled-eggs",
  "omelette-cheese",
  "omelette-mushroom",
  "omelette-herbs",
  "skyr",
  "greek-yogurt",
  "milk-carton",
  "yogurt-cup",
  "cottage-cheese",
  "mozzarella",
  "parmesan",
  "feta",
  "whey",
  "whey-scoop",
  "creatine",
  "capsules",
  "tofu",
  "rice",
  "wheat",
  "pasta",
  "oats",
  "bread",
  "croissant",
  "pretzel",
  "cereal",
  "popcorn",
  "granola-bar",
  "cookie",
  "potato",
  "sweet-potato",
  "quinoa",
  "quinoa-bowl",
  "couscous",
  "ramen",
  "tortilla-wrap",
  "pancakes",
  "waffle",
  "lentils",
  "beans",
  "bulgur",
  "buckwheat",
  "barley",
  "millet",
  "polenta",
  "tapioca",
  "cassava",
  "rice-noodles",
  "gnocchi",
  "corn",
  "plantain",
  "muesli",
  "rice-cakes",
  "cornflakes",
  "granola",
  "bagel",
  "pita",
  "brioche",
  "rye-bread",
  "wholegrain-bread",
  "farro",
  "spelt",
  "amaranth",
  "crackers",
  "chickpeas",
  "kidney-beans",
  "black-beans",
  "red-lentils",
  "green-peas",
  "taro",
  "yam",
  "potato-wedges",
  "sweet-potato-fries",
  "plantain-chips",
  "banana",
  "strawberries",
  "pear",
  "grapes",
  "kiwi",
  "pineapple",
  "mango",
  "watermelon",
  "lemon",
  "lime",
  "clementine",
  "peach",
  "melon",
  "plum",
  "prune",
  "date",
  "fig",
  "pomegranate",
  "apricot",
  "cranberry",
  "passion-fruit",
  "guava",
  "persimmon",
  "lychee",
  "pomelo",
  "papaya",
  "rambutan",
  "tamarind",
  "avocado",
  "olive-oil",
  "rapeseed-oil",
  "sunflower-oil",
  "walnut-oil",
  "sesame-oil",
  "peanut-oil",
  "palm-oil",
  "flaxseed-oil",
  "grape-seed-oil",
  "almond-oil",
  "hazelnut-oil",
  "avocado-oil",
  "corn-oil",
  "soybean-oil",
  "rice-bran-oil",
  "camelina-oil",
  "hemp-oil",
  "argan-oil",
  "mixed-oils",
  "peanut-butter",
  "almond-butter",
  "cashew-butter",
  "hazelnut-butter",
  "pistachio-butter",
  "hazelnut-spread",
  "butter",
  "cocoa-butter",
  "shea-butter",
  "margarine",
  "olives",
  "coconut",
  "coconut-oil",
  "lard",
  "duck-fat",
  "goose-fat",
  "beef-tallow",
  "cream",
  "mayonnaise",
  "tahini",
  "peanuts",
  "hazelnuts",
  "cashews",
  "pistachios",
  "pecans",
  "macadamia",
  "almonds",
  "walnuts",
  "brazil-nuts",
  "pine-nuts",
  "mixed-nuts",
  "nutmeg",
  "chia",
  "hemp-seeds",
  "flax-seeds",
  "sesame-seeds",
  "sunflower-seeds",
  "pumpkin-seeds",
  "cheese",
  "tomato",
  "mushrooms",
  "asparagus",
  "cucumber",
  "bell-pepper",
  "onion",
  "garlic",
  "broccoli",
  "salad",
  "carrot",
  "zucchini",
  "spinach",
  "eggplant",
  "artichoke",
  "beetroot",
  "celery-stalk",
  "celeriac",
  "cabbage",
  "brussels-sprouts",
  "endive",
  "fennel",
  "leek",
  "butternut",
  "pumpkin",
  "radish",
  "black-radish",
  "peas",
  "chili-pepper",
  "pak-choi",
  "parsnip",
  "turnip",
  "rutabaga",
  "apple",
  "berries",
  "blueberries",
  "orange",
  "coffee",
  "latte",
  "sparkling-water",
  "espresso",
  "cappuccino",
  "green-tea",
  "herbal-tea",
  "matcha",
  "hot-chocolate",
  "orange-juice",
  "apple-juice",
  "pineapple-juice",
  "berry-smoothie",
  "green-smoothie",
  "cola",
  "lemonade",
  "iced-tea",
  "oat-milk",
  "almond-milk",
  "isotonic-drink",
  "dark-chocolate",
  "honey",
  "jam",
  "maple-syrup",
  "sugar-cubes",
  "ice-cream",
  "donut",
  "candy",
  "tomato-sauce",
  "pesto",
  "mustard",
  "ketchup",
  "soy-sauce",
  "hummus",
  "burger",
  "shaker",
  "water",
  "energy-drink",
  "water-bottle",
  "diet-soda",
  "protein",
  "carbs",
  "fats",
  "vegetables",
  "fruits",
  "drinks",
  "extras",
])

const CATEGORY_FALLBACK: Record<string, FoodIconKey> = {
  proteins: "protein",
  carbs: "carbs",
  fats: "fats",
  vegetables: "vegetables",
  fruits: "fruits",
  drinks: "drinks",
  extras: "extras",
}

const SUBCATEGORY_FALLBACK: Record<string, FoodIconKey> = {
  viandes: "steak",
  poissons: "white-fish",
  oeufs: "egg",
  laitiers: "greek-yogurt",
  vegetales: "tofu",
  complements: "whey",
  cereales: "rice",
  fecules: "potato",
  pain: "bread",
  legumineuses: "lentils",
  feuilles: "salad",
  cruciferes: "broccoli",
  "autres-legumes": "vegetables",
  frais: "apple",
  secs: "fruits",
  huiles: "olive-oil",
  "noix-graines": "walnuts",
  "autres-lipides": "avocado",
  sauces: "tomato-sauce",
  eau: "water-bottle",
  chauds: "coffee",
  "jus-smoothies": "orange-juice",
  "laits-vegetaux": "oat-milk",
  "sports-drinks": "isotonic-drink",
}

const NAME_OVERRIDE_KEYS = new Set<FoodIconKey>([
  "banana",
  "turkey",
  "sardines",
  "white-fish",
  "coffee",
  "latte",
  "orange",
  "lime",
  "lemon",
  "grapes",
  "egg",
  "egg-white",
  "egg-white-powder",
  "egg-yolk",
  "egg-yolk-powder",
  "egg-powder",
  "quail-egg",
  "duck-egg",
  "goose-egg",
  "turkey-egg",
  "soft-boiled-egg",
  "fried-egg",
  "hard-boiled-egg",
  "poached-egg",
  "scrambled-eggs",
  "omelette-cheese",
  "omelette-mushroom",
  "omelette-herbs",
  "cheese",
  "peanut-butter",
])

const PROTEIN_ICON_KEYS = new Set<FoodIconKey>([
  "chicken", "turkey", "beef", "steak", "pork-chop", "ham", "bacon", "sausage", "lamb-chop", "roast-meat",
  "salmon", "tuna", "white-fish", "cod", "sardines", "shrimp", "mussels", "crab", "squid",
  "egg", "egg-white", "egg-white-powder", "egg-yolk", "egg-yolk-powder", "egg-powder",
  "quail-egg", "duck-egg", "goose-egg", "turkey-egg", "soft-boiled-egg", "fried-egg",
  "hard-boiled-egg", "poached-egg", "scrambled-eggs", "omelette-cheese", "omelette-mushroom",
  "omelette-herbs", "skyr", "greek-yogurt", "milk-carton", "yogurt-cup", "cottage-cheese",
  "mozzarella", "parmesan", "feta", "cheese", "whey", "whey-scoop", "creatine", "capsules", "tofu", "protein",
])

const CARB_ICON_KEYS = new Set<FoodIconKey>([
  "rice", "wheat", "pasta", "oats", "bread", "croissant", "pretzel", "cereal", "popcorn", "granola-bar", "cookie",
  "potato", "sweet-potato", "quinoa", "quinoa-bowl", "couscous", "ramen", "tortilla-wrap", "pancakes",
  "waffle", "lentils", "beans", "bulgur", "buckwheat", "barley", "millet", "polenta", "tapioca", "cassava",
  "rice-noodles", "gnocchi", "corn", "plantain", "muesli", "dark-chocolate", "honey", "jam", "maple-syrup", "sugar-cubes",
  "rice-cakes", "cornflakes", "granola", "bagel", "pita", "brioche", "rye-bread", "wholegrain-bread", "farro", "spelt", "amaranth", "crackers",
  "chickpeas", "kidney-beans", "black-beans", "red-lentils", "green-peas", "taro", "yam", "potato-wedges", "sweet-potato-fries", "plantain-chips",
  "ice-cream", "donut", "candy", "carbs",
])

const FRUIT_ICON_KEYS = new Set<FoodIconKey>([
  "banana", "strawberries", "apple", "pear", "grapes", "kiwi", "pineapple", "mango", "watermelon", "lemon", "lime",
  "clementine", "peach", "melon", "plum", "prune", "date", "fig", "pomegranate", "apricot", "cranberry",
  "passion-fruit", "guava", "persimmon", "lychee", "pomelo", "papaya", "rambutan", "tamarind", "berries", "blueberries", "orange", "fruits",
])

const FAT_ICON_KEYS = new Set<FoodIconKey>([
  "avocado", "olive-oil", "rapeseed-oil", "sunflower-oil", "walnut-oil", "sesame-oil", "peanut-oil", "palm-oil",
  "flaxseed-oil", "grape-seed-oil", "almond-oil", "hazelnut-oil", "avocado-oil", "corn-oil", "soybean-oil",
  "rice-bran-oil", "camelina-oil", "hemp-oil", "argan-oil", "mixed-oils",
  "peanut-butter", "almond-butter", "cashew-butter", "hazelnut-butter", "pistachio-butter", "hazelnut-spread",
  "butter", "cocoa-butter", "shea-butter", "margarine", "olives", "coconut", "coconut-oil",
  "lard", "duck-fat", "goose-fat", "beef-tallow", "cream", "mayonnaise", "tahini", "peanuts", "hazelnuts", "cashews", "pistachios", "pecans", "macadamia",
  "almonds", "walnuts", "brazil-nuts", "pine-nuts", "mixed-nuts", "nutmeg", "chia", "hemp-seeds",
  "flax-seeds", "sesame-seeds", "sunflower-seeds", "pumpkin-seeds", "fats",
])

const VEGETABLE_ICON_KEYS = new Set<FoodIconKey>([
  "tomato", "mushrooms", "asparagus", "cucumber", "bell-pepper", "onion", "garlic", "broccoli", "salad",
  "carrot", "zucchini", "spinach", "eggplant", "artichoke", "beetroot", "celery-stalk", "celeriac",
  "cabbage", "brussels-sprouts", "endive", "fennel", "leek", "butternut", "pumpkin", "radish",
  "black-radish", "peas", "chili-pepper", "pak-choi", "parsnip", "turnip", "rutabaga", "vegetables",
])

const DRINK_ICON_KEYS = new Set<FoodIconKey>([
  "coffee", "latte", "sparkling-water", "espresso", "cappuccino", "green-tea", "herbal-tea", "matcha",
  "hot-chocolate", "orange-juice", "apple-juice", "pineapple-juice", "berry-smoothie", "green-smoothie",
  "cola", "lemonade", "iced-tea", "oat-milk", "almond-milk", "isotonic-drink", "shaker", "water",
  "energy-drink", "water-bottle", "diet-soda", "drinks",
])

const SAUCE_ICON_KEYS = new Set<FoodIconKey>([
  "tomato-sauce", "pesto", "mustard", "ketchup", "soy-sauce", "hummus",
])

function isIconAllowedForFood(key: FoodIconKey, food?: FoodIconInput | null) {
  const category = String(food?.category_l1 ?? "")
  const subcategory = String(food?.category_l2 ?? "")
  const normalizedName = normalizeFoodText(food?.name_fr ?? "")
  const starchyFoodName = /\b(patate douce|sweet potato|igname|yam|taro|dachine|malanga|manioc|cassava|yuca|yucca|plantain)\b/.test(normalizedName)
  if (!category) return true
  if (category === "extras") return true

  if (starchyFoodName && CARB_ICON_KEYS.has(key)) return true

  if (category === "proteins") return PROTEIN_ICON_KEYS.has(key)
  if (category === "carbs") return CARB_ICON_KEYS.has(key) || FRUIT_ICON_KEYS.has(key)
  if (category === "fruits") return FRUIT_ICON_KEYS.has(key)
  if (category === "fats") return FAT_ICON_KEYS.has(key) || SAUCE_ICON_KEYS.has(key)
  if (category === "vegetables") return VEGETABLE_ICON_KEYS.has(key) || key === "avocado"
  if (category === "drinks") return DRINK_ICON_KEYS.has(key) || FRUIT_ICON_KEYS.has(key) || key === "milk-carton" || key === "latte"

  if (subcategory === "sauces") return SAUCE_ICON_KEYS.has(key) || FAT_ICON_KEYS.has(key)
  return true
}

const NAME_PATTERNS: Array<[FoodIconKey, RegExp]> = [
  ["espresso", /\b(espresso|expresso|ristretto)\b/],
  ["cappuccino", /\b(cappuccino|macchiato|cafe latte|cafe au lait)\b/],
  ["matcha", /\b(matcha|macha)\b/],
  ["green-tea", /\b(the vert|green tea)\b/],
  ["herbal-tea", /\b(tisane|infusion|rooibos|camomille|verveine)\b/],
  ["iced-tea", /\b(the glace|iced tea|ice tea)\b/],
  ["hot-chocolate", /\b(chocolat chaud|cacao chaud|boisson au cacao)\b/],
  ["orange-juice", /\b(jus d.?orange|orange pressee)\b/],
  ["apple-juice", /\b(jus de pomme|apple juice)\b/],
  ["pineapple-juice", /\b(jus d.?ananas|pineapple juice)\b/],
  ["berry-smoothie", /\b(smoothie).*(fruits? rouges?|fraise|framboise|myrtille|mure|cassis|berry)\b/],
  ["green-smoothie", /\b(smoothie).*(vert|epinard|kiwi|celeri|concombre|green)\b/],
  ["berry-smoothie", /\b(smoothie aux fruits?|smoothie de fruits?|berry smoothie)\b/],
  ["cola", /\b(cola|coca|coca.?cola|pepsi)\b/],
  ["lemonade", /\b(limonade|lemonade|citronnade)\b/],
  ["oat-milk", /\b(lait|boisson).*(avoine|oat)\b/],
  ["almond-milk", /\b(lait|boisson).*(amande|almond)\b/],
  ["isotonic-drink", /\b(boisson sport|boisson isotonique|isotonique|electrolyte|electrolytes|sports? drink)\b/],
  ["coffee", /\b(cafe|coffee|americano|cafe filtre|filtre)\b/],
  ["burger", /\b(pizza|sandwich|burger|kebab|tacos|hot.?dog|panini|croque|quiche|lasagnes?|cannellonis|nems?|samoussa|feuillet[eé]|friand|bouch[eé]e|p[aâ]t[eé] imp[eé]rial|paupiette|brochette|soupe|bouillon|potage|velout[eé])\b/],
  ["plantain-chips", /\b(chips? de banane plantain|plantain chips?)\b/],
  ["plantain", /\b(banane plantain|plantain)\b/],
  ["sardines", /\b(oeufs? de saumon|œufs? de saumon|roe|caviar)\b/],
  ["egg-white-powder", /\b(blanc d.?oeuf|blanc d.?œuf|egg white).*\b(en poudre|poudre)\b/],
  ["egg-yolk-powder", /\b(jaune d.?oeuf|jaune d.?œuf|egg yolk).*\b(en poudre|poudre)\b/],
  ["egg-powder", /\b(oeufs?|œufs?|egg).*\b(en poudre|poudre)\b/],
  ["quail-egg", /\b(oeufs?|œufs?) de caille\b/],
  ["duck-egg", /\b(oeufs?|œufs?) de cane\b/],
  ["goose-egg", /\b(oeufs?|œufs?) d.?oie\b/],
  ["turkey-egg", /\b(oeufs?|œufs?) de dinde\b/],
  ["omelette-cheese", /\bomelette au fromage\b/],
  ["omelette-mushroom", /\bomelette aux champignons?\b/],
  ["omelette-herbs", /\bomelette aux fines herbes\b/],
  ["scrambled-eggs", /\b(oeufs?|œufs?),? brouill[eé]s?\b/],
  ["poached-egg", /\b(oeufs?|œufs?),? poch[eé]s?\b/],
  ["fried-egg", /\b(oeufs?|œufs?),? (au plat|frits?)\b/],
  ["soft-boiled-egg", /\b(oeufs?|œufs?),? [aà] la coque\b/],
  ["hard-boiled-egg", /\b(oeufs?|œufs?),? durs?\b/],
  ["egg-yolk", /\bjaune d.?oeuf|jaune d.?œuf|egg yolk\b/],
  ["egg-white", /\bblanc d.?oeuf|blanc d.?œuf|egg white|albumine\b/],
  ["egg", /\b(omelette|oeufs? de|œufs? de|oeufs?,|œufs?,|oeufs? entiers?|œufs? entiers?|oeufs? crus?|œufs? crus?|egg)\b/],
  ["garlic", /\b(ail|garlic)\b/],
  ["sausage", /\b(andouille|andouillette)\b/],
  ["white-fish", /\b(anguille|grenadier|hoki|hoki de nouvelle.?zelande|frog|grenouille)\b/],
  ["mussels", /\b(escargot|escargots)\b/],
  ["diet-soda", /\b(alcool|aperitif|aperitif anise|vin|biere|cidre|vodka|whisky|rhum|gin|tequila|sake|cocktail|spritz|champagne)\b/],
  ["milk-carton", /\b(boisson infantile|lait infantile|lait 1er age|lait 2e age|preparation pour nourrissons?|cereales lactees)\b/],
  ["yogurt-cup", /\b(creme aux oeufs|creme caramel|flan|dessert lacte|petit pot de creme|creme chocolat|creme vanille)\b/],
  ["whey-scoop", /\b((collagene|bcaa|eaa|glutamine|poudre de proteines?|proteines? en poudre).*\bpoudre\b|\bpoudre\b.*(collagene|bcaa|eaa|glutamine|proteines?))\b/],
  ["carbs", /\b(amidon|fecule|cornstarch|starch)\b/],
  ["chicken", /\b(poulet|chicken|volaille|aile|ailes|pilons?|cuisse|cuisses|haut de cuisse|blanc de poulet|nuggets?|cordon bleu)\b/],
  ["turkey", /\b(dinde|turkey|escalope de dinde|filet de dinde)\b/],
  ["pork-chop", /\b(porc|pork|cote de porc|cotelette de porc|filet mignon|echine|échine)\b/],
  ["ham", /\b(jambon|ham|prosciutto|coppa|speck)\b/],
  ["bacon", /\b(bacon|lard|lardon|lardons|poitrine fumee|poitrine fumée)\b/],
  ["sausage", /\b(saucisse|saucisson|chorizo|merguez|boudin|hot.?dog|knack|chipolata)\b/],
  ["lamb-chop", /\b(agneau|mouton|lamb|cote d.?agneau|côte d.?agneau|gigot)\b/],
  ["roast-meat", /\b(roast beef|rosbif|roti de boeuf|rôti de boeuf|roti de veau|rôti de veau|rillettes?|charcuterie)\b/],
  ["beef", /\b(boeuf|bœuf|beef|veal|veau)\b/],
  ["steak", /\b(steak|entrecote|entrecôte|bavette|filet|rumsteck|onglet|faux-filet|tournedos|hach[eé]|viande hach[eé]e)\b/],
  ["salmon", /\b(saumon|salmon|truite|trout)\b/],
  ["sardines", /\b(sardine|sardines|hareng|anchois|anchovy|anchovies)\b/],
  ["tuna", /\b(thon|tuna|maquereau|mackerel)\b/],
  ["crab", /\b(crabe|crab|homard|lobster)\b/],
  ["mussels", /\b(moule|moules|huitre|huître|huitres|huîtres|palourde|palourdes|coquille saint-jacques|saint jacques|mussel|oyster|clam)\b/],
  ["squid", /\b(calamar|calamars|encornet|encornets|poulpe|octopus|squid|seiche|surimi)\b/],
  ["shrimp", /\b(crevette|crevettes|shrimp|gambas|langoustine|langoustines)\b/],
  ["cod", /\b(cabillaud|morue|cod)\b/],
  ["white-fish", /\b(colin|merlu|lieu|sole|dorade|bar|tilapia|poisson|lotte|raie|fl[eé]tan|eglefin|églefin|perche|turbot|anguille|grenadier|hoki)\b/],
  ["egg-white", /\b(blanc d.?oeuf|blanc d.?œuf|egg white|albumine)\b/],
  ["egg-yolk", /\b(jaune d.?oeuf|jaune d.?œuf|egg yolk)\b/],
  ["egg", /\b(oeuf|œuf|egg|omelette)\b/],
  ["skyr", /\b(skyr|petit suisse)\b/],
  ["milk-carton", /\b(lait demi.?ecreme|lait ecreme|lait entier|milk|lait)\b/],
  ["yogurt-cup", /\b(yaourt|yogourt|yogurt|kefir|kéfir)\b/],
  ["cottage-cheese", /\b(cottage|ricotta|faisselle|fromage blanc)\b/],
  ["greek-yogurt", /\b(yaourt grec|yogourt grec|greek yogurt)\b/],
  ["mozzarella", /\b(mozzarella|burrata)\b/],
  ["parmesan", /\b(parmesan|parmigiano|pecorino|comt[eé]|emmental|gruy[eè]re|cheddar)\b/],
  ["feta", /\b(feta|chèvre|chevre|halloumi)\b/],
  ["cheese", /\b(fromage|cheese|camembert|brie|raclette|reblochon|fromage bleu|bleu d.?auvergne|roquefort)\b/],
  ["creatine", /\b(creatine|créatine)\b/],
  ["capsules", /\b(omega.?3|om[eé]ga.?3|vitamine|vitamin|capsule|gelule|g[eé]lule|comprim[eé]|pre.?workout)\b/],
  ["whey-scoop", /\b(whey|proteine|protéine|isolate|isolat|cas[eé]ine|gainer|mass gainer)\b/],
  ["whey", /\b(protein bar|barre prot[eé]in[eé]e)\b/],
  ["tofu", /\b(tofu|tempeh|seitan|soja textur[eé]|edamame|falafel|galette v[eé]g[eé]tale)\b/],
  ["rice-cakes", /\b(galettes? de riz|rice cakes?)\b/],
  ["cornflakes", /\b(corn flakes?|cornflakes?)\b/],
  ["granola", /\b(granola(?! bar))\b/],
  ["bagel", /\b(bagel|bagels)\b/],
  ["pita", /\b(pita|pain pita)\b/],
  ["brioche", /\b(brioche|brioches)\b/],
  ["rye-bread", /\b(pain de seigle|seigle|rye bread)\b/],
  ["wholegrain-bread", /\b(pain complet|pain aux c[eé]r[eé]ales|whole.?grain bread)\b/],
  ["farro", /\b(farro|emmer)\b/],
  ["spelt", /\b([eé]peautre|spelt)\b/],
  ["wheat", /\b(bl[eé] de khorasan|bl[eé] dur|bl[eé] germ[eé]|bl[eé] tendre|froment|wheat|durum|kamut)\b/],
  ["amaranth", /\b(amarante|amaranth)\b/],
  ["crackers", /\b(crackers?|crispbread)\b/],
  ["rice-noodles", /\b(nouilles? de riz|vermicelles? de riz|rice noodles?)\b/],
  ["gnocchi", /\b(gnocchi|gnocchis)\b/],
  ["chickpeas", /\b(pois chiches?|chickpeas?)\b/],
  ["kidney-beans", /\b(haricots? rouges?|red kidney beans?)\b/],
  ["black-beans", /\b(haricots? noirs?|black beans?)\b/],
  ["red-lentils", /\b(lentilles? corail|lentilles? rouges?|red lentils?)\b/],
  ["green-peas", /\b(petits pois|pois verts?|green peas?)\b/],
  ["taro", /\b(taro|dachine|malanga)\b/],
  ["yam", /\b(igname|yam)\b/],
  ["potato-wedges", /\b(pommes? de terre en quartiers?|potato wedges?)\b/],
  ["sweet-potato-fries", /\b(frites? de patate douce|sweet potato fries?)\b/],
  ["bulgur", /\b(boulgour|bulgur)\b/],
  ["buckwheat", /\b(sarrasin|kasha|buckwheat)\b/],
  ["barley", /\b(orge|orge perl[eé]e|barley)\b/],
  ["millet", /\b(millet)\b/],
  ["polenta", /\b(polenta|farine de ma[iï]s)\b/],
  ["tapioca", /\b(tapioca|perles de tapioca)\b/],
  ["cassava", /\b(manioc|cassava|yuca|yucca)\b/],
  ["corn", /\b([eé]pi de ma[iï]s|ma[iï]s doux|corn on the cob|sweet corn)\b/],
  ["muesli", /\b(muesli)\b/],
  ["rice", /\b(riz|rice|ebly|grain entier|grains entiers)\b/],
  ["ramen", /\b(ramen|udon|soba|nouilles? instantan[eé]es|noodles? instant)\b/],
  ["pasta", /\b(pate|pâtes|pasta|spaghetti|tagliatelle|macaroni|penne|fusilli|lasagne|ravioli|gnocchi|nouilles?|noodles?|vermicelle)\b/],
  ["cereal", /\b(cereales|céréales|all.?bran|special k|weetabix|cereal|cereals)\b/],
  ["granola-bar", /\b(granola bar|barre de c[eé]r[eé]ales|barre c[eé]r[eé]ales|barre granola)\b/],
  ["oats", /\b(avoine|flocon|porridge|oat)\b/],
  ["pancakes", /\b(pancake|pancakes|crepe|cr[eê]pe)\b/],
  ["waffle", /\b(gaufre|waffle)\b/],
  ["croissant", /\b(croissant|pain au chocolat|viennoiserie|chausson aux pommes)\b/],
  ["pretzel", /\b(bretzel|pretzel)\b/],
  ["tortilla-wrap", /\b(tortilla|wrap|burrito|fajita)\b/],
  ["bread", /\b(pain|baguette|toast|blini|galette|chapati|naan|pain de mie)\b/],
  ["sweet-potato", /\b(patate douce|sweet potato)\b/],
  ["potato", /\b(pomme de terre|pdt|potato|frites?|pur[eé]e de pomme de terre|pur[eé]e de pdt|chips|gnocchi de pomme de terre)\b/],
  ["quinoa-bowl", /\b(quinoa)\b/],
  ["couscous", /\b(couscous|semoule)\b/],
  ["quinoa", /\b(quinoa grain|quinoa rouge|quinoa blanc|quinoa tricolore)\b/],
  ["lentils", /\b(lentille|lentil|pois casse|dahl|dal)\b/],
  ["beans", /\b(haricot|pois chiche|chickpea|bean|f[eè]ve|flageolet|azuki|lupin)\b/],
  ["popcorn", /\b(pop.?corn|mais souffl[eé]|maïs souffl[eé])\b/],
  ["popcorn", /\b(mais|maïs|corn|souffl[eé])\b/],
  ["tortilla-wrap", /\b(taco shell)\b/],
  ["almond-oil", /\b(huile d.?amande|almond oil)\b/],
  ["hazelnut-oil", /\b(huile de noisette|hazelnut oil)\b/],
  ["avocado-oil", /\b(huile d.?avocat|avocado oil)\b/],
  ["corn-oil", /\b(huile de ma[iï]s|corn oil)\b/],
  ["soybean-oil", /\b(huile de soja|soybean oil|soy oil)\b/],
  ["rice-bran-oil", /\b(huile de son de riz|rice bran oil)\b/],
  ["camelina-oil", /\b(huile de cameline|camelina oil)\b/],
  ["hemp-oil", /\b(huile de chanvre|hemp oil)\b/],
  ["argan-oil", /\b(huile d.?argan|huile d.?argane|argan oil)\b/],
  ["mixed-oils", /\b(huile combin[eé]e|m[eé]lange d.?huiles?|mixed oils?|oil blend)\b/],
  ["grape-seed-oil", /\b(huile de p[eé]pins? de raisin|grape seed oil|grapeseed oil)\b/],
  ["banana", /\b(banane|banana)\b/],
  ["strawberries", /\b(fraise|fraises|strawberry|strawberries)\b/],
  ["pear", /\b(poire|pear)\b/],
  ["grapes", /\b(raisin|raisins|grape|grapes)\b/],
  ["kiwi", /\b(kiwi|kiwis)\b/],
  ["pineapple", /\b(ananas|pineapple)\b/],
  ["mango", /\b(mangue|mango)\b/],
  ["watermelon", /\b(pasteque|past[eè]que|watermelon)\b/],
  ["lime", /\b(citron vert|lime)\b/],
  ["lemon", /\b(citron jaune|citron|lemon)\b/],
  ["clementine", /\b(clementine|clémentine|mandarine|tangerine)\b/],
  ["peach", /\b(peche|pêche|nectarine|brugnon|peach)\b/],
  ["melon", /\b(melon|cantaloup|honeydew)\b/],
  ["plum", /\b(prune fraiche|prune fraîche|prune jaune|prune rouge|mirabelle|reine.?claude|plum)\b/],
  ["prune", /\b(pruneau|prune seche|prune sèche|pruneaux|prune)\b/],
  ["date", /\b(datte|dattes|date fruit|dates)\b/],
  ["fig", /\b(figue|figues|fig)\b/],
  ["pomegranate", /\b(grenade|pomegranate)\b/],
  ["apricot", /\b(abricot|apricot)\b/],
  ["cranberry", /\b(canneberge|cranberry|cranberries)\b/],
  ["passion-fruit", /\b(fruit de la passion|passion fruit|maracudja|maracuja)\b/],
  ["guava", /\b(goyave|guava)\b/],
  ["persimmon", /\b(kaki|persimmon)\b/],
  ["lychee", /\b(litchi|lychee|lychee)\b/],
  ["pomelo", /\b(pomelo|pamplemousse|grapefruit)\b/],
  ["papaya", /\b(papaye|papaya)\b/],
  ["rambutan", /\b(ramboutan|rambutan)\b/],
  ["tamarind", /\b(tamarin|tamarind)\b/],
  ["blueberries", /\b(myrtille|myrtilles|blueberry|blueberries)\b/],
  ["berries", /\b(framboise|framboises|mure|mûre|mures|mûres|cassis|groseille|groseilles|berry|berries)\b/],
  ["orange", /\b(orange|jus d.?orange)\b/],
  ["apple", /\b(pomme|apple|cerise|compote)\b/],
  ["hazelnut-spread", /\b(p[aâ]te a tartiner|pate a tartiner|tartiner).*(noisette|chocolat)|\b(chocolat|cacao).*(noisette|praline)\b/],
  ["peanut-butter", /\b(beurre|pur[eé]e|p[aâ]te)\s+(de\s+|d['’])?(cacahu[eè]tes?|cacahou[eè]tes?|arachide|peanut)|peanut butter\b/],
  ["coconut-oil", /\b(huile de coco|coconut oil)\b/],
  ["rapeseed-oil", /\b(huile de colza|huile de canola|canola oil|rapeseed oil)\b/],
  ["sunflower-oil", /\b(huile de tournesol|sunflower oil)\b/],
  ["walnut-oil", /\b(huile de noix|walnut oil)\b/],
  ["sesame-oil", /\b(huile de s[eé]same|sesame oil)\b/],
  ["peanut-oil", /\b(huile d.?arachide|huile de cacahu[eè]te|peanut oil)\b/],
  ["palm-oil", /\b(huile de palme|graisse de palme|palmiste|palm oil)\b/],
  ["flaxseed-oil", /\b(huile de lin|flaxseed oil|linseed oil)\b/],
  ["grape-seed-oil", /\b(huile de p[eé]pins? de raisin|grape seed oil|grapeseed oil)\b/],
  ["almond-butter", /\bp[aâ]te d.?amande\b/],
  ["tahini", /\b(tahini|tahin|beurre de s[eé]same|pur[eé]e de s[eé]same|p[aâ]te de s[eé]same)\b/],
  ["almond-butter", /\b(beurre|pur[eé]e|p[aâ]te)\s+(d['’])?(amande|amandes|almond)\b/],
  ["cashew-butter", /\b(beurre|pur[eé]e|p[aâ]te)\s+(de\s+)?(noix de cajou|cashew|cashews)\b/],
  ["hazelnut-butter", /\b(beurre|pur[eé]e|p[aâ]te)\s+(de\s+)?(noisette|noisettes|hazelnut|hazelnuts)\b/],
  ["pistachio-butter", /\b(beurre|pur[eé]e|p[aâ]te)\s+(de\s+)?(pistache|pistaches|pistachio|pistachios)\b/],
  ["cocoa-butter", /\b(beurre de cacao|huile de cacao|cocoa butter|cacao butter)\b/],
  ["shea-butter", /\b(beurre de karit[eé]|huile de karit[eé]|shea butter)\b/],
  ["lard", /\b(saindoux|lard|graisse de porc|pork fat)\b/],
  ["duck-fat", /\b(graisse de canard|duck fat)\b/],
  ["goose-fat", /\b(graisse d.?oie|goose fat)\b/],
  ["beef-tallow", /\b(suif|graisse de boeuf|graisse de bœuf|beef tallow|tallow)\b/],
  ["cream", /\b(cr[eè]me fra[iî]che|cr[eè]me liquide|cr[eè]me enti[eè]re|heavy cream|sour cream)\b/],
  ["butter", /\b(beurre|butter|ghee)\b/],
  ["margarine", /\b(margarine)\b/],
  ["mayonnaise", /\b(mayonnaise|mayo)\b/],
  ["olive-oil", /\b(huile|olive oil|oil|vinaigrette)\b/],
  ["olives", /\b(olive|olives)\b/],
  ["mustard", /\b(moutarde|mustard)\b/],
  ["avocado", /\b(avocat|avocado|guacamole)\b/],
  ["coconut", /\b(noix de coco|coco|coconut)\b/],
  ["mixed-nuts", /\b(fruits? [aà] coques?)\b/],
  ["peanuts", /\b(cacahu[eè]tes?|arachide|peanuts?)\b/],
  ["hazelnuts", /\b(noisette|noisettes|hazelnuts?)\b/],
  ["cashews", /\b(noix de cajou|cashew|cashews)\b/],
  ["pistachios", /\b(pistache|pistaches|pistachios?)\b/],
  ["pecans", /\b(pecan|p[eé]can|noix de p[eé]can)\b/],
  ["macadamia", /\b(macadamia)\b/],
  ["pine-nuts", /\b(pignon|pignons|pine nuts?)\b/],
  ["almonds", /\b(amande|amandes|almonds?)\b/],
  ["brazil-nuts", /\b(brazil nut|noix du br[eé]sil|noix d.?amazonie)\b/],
  ["walnuts", /\b(noix,|noix cerneau|cerneaux de noix|noix fra[iî]che|noix s[eé]ch[eé]e|walnuts?)\b/],
  ["nutmeg", /\b(noix de muscade|muscade|nutmeg)\b/],
  ["chia", /\b(chia)\b/],
  ["hemp-seeds", /\b(chanvre|ch[eè]nevis|hemp seeds?)\b/],
  ["flax-seeds", /\b(graine de lin|graines de lin|lin|flax)\b/],
  ["sesame-seeds", /\b(graine de s[eé]same|graines de s[eé]same|s[eé]same|sesame)\b/],
  ["sunflower-seeds", /\b(graine de tournesol|graines de tournesol|tournesol|sunflower)\b/],
  ["pumpkin-seeds", /\b(graine de courge|graines de courge|courge|pumpkin seed)\b/],
  ["ketchup", /\b(ketchup)\b/],
  ["pesto", /\b(pesto)\b/],
  ["soy-sauce", /\b(sauce soja|soy sauce|tamari)\b/],
  ["hummus", /\b(houmous|hummus)\b/],
  ["tomato-sauce", /\b(sauce tomate|tomato sauce|salsa|passata|coulis|bolognaise|sauce barbecue|bbq)\b/],
  ["mushrooms", /\b(champignon|champignons|mushroom|mushrooms)\b/],
  ["asparagus", /\b(asperge|asperges|asparagus)\b/],
  ["cucumber", /\b(concombre|cucumber)\b/],
  ["bell-pepper", /\b(poivron|pepper|bell pepper)\b/],
  ["onion", /\b(oignon|oignons|onion|onions|echalote|échalote)\b/],
  ["garlic", /\b(ail|garlic)\b/],
  ["eggplant", /\b(aubergine|eggplant)\b/],
  ["artichoke", /\b(artichaut|artichoke)\b/],
  ["beetroot", /\b(betterave|beetroot|beet)\b/],
  ["celery-stalk", /\b(celeri branche|céleri branche|celery stalk|celery)\b/],
  ["celeriac", /\b(celeri rave|céleri rave|celeriac)\b/],
  ["brussels-sprouts", /\b(chou de bruxelles|choux de bruxelles|brussels sprouts?)\b/],
  ["cabbage", /\b(chou|choux|cabbage|kale)\b/],
  ["endive", /\b(endive|chicoree|chicorée)\b/],
  ["fennel", /\b(fenouil|fennel)\b/],
  ["leek", /\b(poireau|leek)\b/],
  ["butternut", /\b(butternut|doubeurre|courge doubeurre)\b/],
  ["pumpkin", /\b(potiron|potimarron|citrouille|giraumon|pumpkin)\b/],
  ["black-radish", /\b(radis noir|black radish)\b/],
  ["radish", /\b(radis|radish)\b/],
  ["peas", /\b(petits pois|pois gourmand|pois mange.?tout|green peas|pea pod|peas)\b/],
  ["chili-pepper", /\b(piment|chili|chilli|chile pepper)\b/],
  ["pak-choi", /\b(pak choi|pak.?choi|bok choy|pe tsai)\b/],
  ["parsnip", /\b(panais|parsnip)\b/],
  ["turnip", /\b(navet|turnip)\b/],
  ["rutabaga", /\b(rutabaga|swede)\b/],
  ["tomato", /\b(tomate|tomato|ratatouille)\b/],
  ["broccoli", /\b(brocoli|broccoli|cauliflower|fleur|chou-fleur)\b/],
  ["salad", /\b(salade|laitue|roquette|lettuce|m[aâ]che|mesclun|cresson)\b/],
  ["carrot", /\b(carotte|carrot)\b/],
  ["zucchini", /\b(courgette|zucchini|courge)\b/],
  ["spinach", /\b(epinard|épinard|spinach|blette|chard|oseille)\b/],
  ["latte", /\b(latte|lait|milk|milkshake|lait demi.?ecreme|lait entier|lait ecreme)\b/],
  ["donut", /\b(donut|doughnut|beignet)\b/],
  ["ice-cream", /\b(glace|ice cream|sorbet|gelato)\b/],
  ["candy", /\b(bonbon|candy|guimauve|marshmallow)\b/],
  ["cookie", /\b(cookie|biscuit|brownie|g[aâ]teau|cake|muffin|tarte|pie)\b/],
  ["dark-chocolate", /\b(chocolat|chocolate|cacao)\b/],
  ["jam", /\b(confiture|jam|marmelade)\b/],
  ["maple-syrup", /\b(sirop d.?erable|érable|maple syrup|agave)\b/],
  ["sugar-cubes", /\b(sucre|sugar|sucre blanc|sucre roux)\b/],
  ["honey", /\b(miel|honey|sirop)\b/],
  ["burger", /\b(burger|pizza|sandwich|fast food|kebab|tacos|quiche|croque|panini|hot.?dog|burrito|lasagnes?|nems?|samoussa|sushi|poke bowl)\b/],
  ["energy-drink", /\b(energy drink|red bull|monster|boisson [eé]nergisante)\b/],
  ["diet-soda", /\b(soda|zero|light)\b/],
  ["shaker", /\b(shaker|smoothie)\b/],
  ["sparkling-water", /\b(eau gazeuse|eau petillante|eau minerale gazeuse|sparkling water|perrier|badoit|san pellegrino)\b/],
  ["water-bottle", /\b(eau plate|eau minerale|eau de source|eau|water)\b/],
]

function normalizeFoodText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
}

export function isFoodIconKey(value: string | null | undefined): value is FoodIconKey {
  return Boolean(value && FOOD_ICON_KEYS.has(value))
}

export function resolveFoodIconKey(food?: FoodIconInput | null): FoodIconKey {
  const normalizedName = normalizeFoodText(food?.name_fr ?? "")

  if (/\b(patate douce|sweet potato|igname|yam|taro|dachine|malanga|manioc|cassava|yuca|yucca|plantain)\b/.test(normalizedName)) {
    for (const [key, pattern] of NAME_PATTERNS) {
      if (CARB_ICON_KEYS.has(key) && pattern.test(normalizedName)) return key
    }
  }

  if (isFoodIconKey(food?.icon_key)) {
    if (food.icon_key === "apple" && /\b(myrtille|myrtilles|blueberry|blueberries)\b/.test(normalizedName)) {
      return "blueberries"
    }
    return food.icon_key
  }

  for (const [key, pattern] of NAME_PATTERNS) {
    if (!pattern.test(normalizedName)) continue
    if (NAME_OVERRIDE_KEYS.has(key) || isIconAllowedForFood(key, food)) return key
  }

  const subcategoryFallback = food?.category_l2 ? SUBCATEGORY_FALLBACK[food.category_l2] : null
  if (subcategoryFallback) return subcategoryFallback

  return CATEGORY_FALLBACK[String(food?.category_l1 ?? "")] ?? "extras"
}
