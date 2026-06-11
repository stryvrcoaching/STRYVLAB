import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { matchesVisibleLeaf, sortVisibleLeafItems, type VisibleLeafKey } from "../lib/nutrition/food-taxonomy"
import type { FoodItem } from "../lib/nutrition/food-items"

for (const envFile of [".env.local", ".env"]) {
  if (!fs.existsSync(envFile)) continue

  const content = fs.readFileSync(envFile, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "")
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("❌ Variables Supabase manquantes")
  console.error("NEXT_PUBLIC_SUPABASE_URL:", Boolean(url))
  console.error("SUPABASE_SERVICE_ROLE_KEY:", Boolean(serviceKey))
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const TOP = Number(process.argv.find((arg) => arg.startsWith("--top="))?.split("=")[1] ?? 120)
const ONLY = process.argv.find((arg) => arg.startsWith("--only="))?.split("=")[1]

type GroupKey = "proteins" | "carbs" | "fats" | "vegetables" | "drinks" | "supplements"

const CATEGORY_FETCH_SCOPE: Record<GroupKey, string[]> = {
  proteins: ["proteins", "extras"],
  carbs: ["carbs", "fruits", "extras"],
  fats: ["fats", "extras"],
  vegetables: ["vegetables"],
  drinks: ["drinks", "extras"],
  supplements: ["proteins", "extras"],
}

const GROUPS: Array<{
  key: GroupKey
  label: string
  leaves: Array<{ key: VisibleLeafKey; label: string }>
}> = [
  {
    key: "proteins",
    label: "PROTÉINES",
    leaves: [
      { key: "chicken", label: "Poulet" },
      { key: "beef", label: "Bœuf" },
      { key: "pork", label: "Porc" },
      { key: "turkey", label: "Dinde" },
      { key: "fish", label: "Poisson" },
      { key: "seafood", label: "Fruits de mer" },
      { key: "eggs", label: "Œufs" },
      { key: "dairy-protein", label: "Produits laitiers" },
      { key: "plant-protein", label: "Protéines végétales" },
      { key: "charcuterie", label: "Charcuterie" },
      { key: "other-proteins", label: "Autres protéines" },
    ],
  },
  {
    key: "carbs",
    label: "GLUCIDES",
    leaves: [
      { key: "rice", label: "Riz" },
      { key: "pasta", label: "Pâtes" },
      { key: "bread", label: "Pain" },
      { key: "cereals", label: "Céréales" },
      { key: "potatoes", label: "Pommes de terre" },
      { key: "legumes", label: "Légumineuses" },
      { key: "fresh-fruits", label: "Fruits frais" },
      { key: "dried-fruits", label: "Fruits secs" },
      { key: "sweet-products", label: "Produits sucrés" },
      { key: "sweet-sauces", label: "Sauces sucrées" },
    ],
  },
  {
    key: "fats",
    label: "LIPIDES",
    leaves: [
      { key: "oils", label: "Huiles" },
      { key: "nuts-seeds", label: "Noix / graines" },
      { key: "avocado-olives", label: "Avocat / olives" },
      { key: "butter-spreads", label: "Beurres / margarines" },
      { key: "nut-butters", label: "Purées d’oléagineux" },
      { key: "fatty-sauces", label: "Sauces grasses" },
    ],
  },
  {
    key: "vegetables",
    label: "LÉGUMES",
    leaves: [
      { key: "leafy", label: "Feuilles" },
      { key: "cruciferous", label: "Crucifères" },
      { key: "roots", label: "Racines" },
      { key: "mediterranean", label: "Méditerranéens" },
      { key: "other-vegetables", label: "Autres légumes" },
    ],
  },
  {
    key: "drinks",
    label: "BOISSONS",
    leaves: [
      { key: "water", label: "Eau" },
      { key: "hot-drinks", label: "Café / thé" },
      { key: "juices-smoothies", label: "Jus / smoothies" },
      { key: "sodas", label: "Sodas" },
      { key: "plant-milks", label: "Laits végétaux" },
      { key: "sports-drinks", label: "Boissons sportives" },
      { key: "alcohol", label: "Alcool" },
    ],
  },
  {
    key: "supplements",
    label: "COMPLÉMENTS",
    leaves: [
      { key: "whey", label: "Whey" },
      { key: "gainers-bars", label: "Gainers / barres" },
      { key: "performance", label: "Performance" },
      { key: "other-supplements", label: "Autres compléments" },
    ],
  },
]

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeRow(row: any): FoodItem {
  return {
    id: String(row.id),
    name_fr: row.name_fr ?? "",
    category_l1: row.category_l1,
    category_l2: row.category_l2 ?? "",
    item_key: row.item_key ?? null,
    kcal_per_100g: toNumber(row.kcal_per_100g),
    protein_per_100g: toNumber(row.protein_per_100g),
    carbs_per_100g: toNumber(row.carbs_per_100g),
    fat_per_100g: toNumber(row.fat_per_100g),
    fiber_per_100g: toNumber(row.fiber_per_100g),
    source: row.source ?? "internal",
    is_verified: Boolean(row.is_verified),
  }
}

async function fetchAllFoodItems(): Promise<FoodItem[]> {
  const pageSize = 1000
  let offset = 0
  const all: FoodItem[] = []

  while (true) {
    const { data, error } = await supabase
      .from("food_items")
      .select(`
        id,
        name_fr,
        category_l1,
        category_l2,
        item_key,
        kcal_per_100g,
        protein_per_100g,
        carbs_per_100g,
        fat_per_100g,
        fiber_per_100g,
        source,
        is_verified
      `)
      .order("name_fr")
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(error.message)
    }

    const page = (data ?? []).map(normalizeRow)
    all.push(...page)

    if (page.length < pageSize) break
    offset += pageSize

    if (offset > 10000) {
      throw new Error("Safety stop: plus de 10000 aliments récupérés")
    }
  }

  return all
}

function formatItem(item: FoodItem, index: number): string {
  const verified = item.is_verified ? "verified" : "not-verified"
  return `${String(index + 1).padStart(3, "0")}. ${item.name_fr} | ${item.category_l1} > ${item.category_l2} | ${Math.round(item.kcal_per_100g)} kcal | P ${item.protein_per_100g} / G ${item.carbs_per_100g} / L ${item.fat_per_100g} | ${item.source} | ${verified}`
}

async function main() {
  const foods = await fetchAllFoodItems()

  const md: string[] = []
  const json: any[] = []

  md.push(`# Audit visible food leaves`)
  md.push("")
  md.push(`Total food_items récupérés : ${foods.length}`)
  md.push(`Top affiché par feuille : ${TOP}`)
  md.push(`Filtre : ${ONLY ?? "toutes les feuilles"}`)
  md.push("")

  for (const group of GROUPS) {
    if (ONLY && group.key !== ONLY && !group.leaves.some((leaf) => leaf.key === ONLY)) continue

    md.push(`\n# ${group.label}`)
    md.push("")

    const scopedFoods = foods.filter((item) => CATEGORY_FETCH_SCOPE[group.key].includes(item.category_l1))

    for (const leaf of group.leaves) {
      if (ONLY && group.key !== ONLY && leaf.key !== ONLY) continue

      const visible = sortVisibleLeafItems(
        scopedFoods.filter((item) => matchesVisibleLeaf(item, leaf.key)),
        leaf.key
      )

      md.push(`\n## ${leaf.label} (${leaf.key}) — ${visible.length} aliments`)
      md.push("")
      md.push(`Scope source : ${CATEGORY_FETCH_SCOPE[group.key].join(", ")}`)
      md.push("")
      md.push("```txt")
      for (const [index, item] of visible.slice(0, TOP).entries()) {
        md.push(formatItem(item, index))
      }
      if (visible.length > TOP) {
        md.push(`... +${visible.length - TOP} autres`)
      }
      md.push("```")
      md.push("")

      json.push({
        group: group.key,
        groupLabel: group.label,
        leaf: leaf.key,
        leafLabel: leaf.label,
        count: visible.length,
        top: visible.slice(0, TOP),
      })
    }
  }

  const outMd = path.join("tmp", "food-visible-leaves-audit.md")
  const outJson = path.join("tmp", "food-visible-leaves-audit.json")

  fs.writeFileSync(outMd, md.join("\n"))
  fs.writeFileSync(outJson, JSON.stringify(json, null, 2))

  console.log(`✅ Rapport Markdown : ${outMd}`)
  console.log(`✅ Rapport JSON : ${outJson}`)
}

main().catch((error) => {
  console.error("❌ Audit failed:", error)
  process.exit(1)
})
