import { describe, expect, it } from "vitest"
import { compareFoodSearchEntries, normalizeSearchText, resolveFoodSearchFetchLimit, scoreFoodSearchMatch } from "@/app/api/client/food-items/route"

describe("food item search ranking", () => {
  it("normalizes accents and ligatures consistently", () => {
    expect(normalizeSearchText("Œufs à l’huile")).toBe("oeufs a l’huile".normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").trim())
  })

  it("ranks exact token matches before broader token prefixes", () => {
    const query = normalizeSearchText("thon")

    const exact = scoreFoodSearchMatch("Thon nature", query)
    const prefixed = scoreFoodSearchMatch("Thonon", query)

    expect(exact).not.toBeNull()
    expect(prefixed).not.toBeNull()
    expect((exact ?? 999)).toBeLessThan(prefixed ?? 999)
  })

  it("keeps the direct ingredient above composed products for simple queries", () => {
    const query = normalizeSearchText("thon")

    const direct = scoreFoodSearchMatch("Thon au naturel", query)
    const composed = scoreFoodSearchMatch("Pizza au thon", query)

    expect(direct).not.toBeNull()
    expect(composed).not.toBeNull()
    expect((direct ?? 999)).toBeLessThan(composed ?? 999)
  })

  it("keeps the same relevance behavior for other simple ingredient queries", () => {
    const query = normalizeSearchText("poulet")

    const direct = scoreFoodSearchMatch("Poulet grillé", query)
    const composed = scoreFoodSearchMatch("Salade au poulet", query)

    expect(direct).not.toBeNull()
    expect(composed).not.toBeNull()
    expect((direct ?? 999)).toBeLessThan(composed ?? 999)
  })

  it("rejects unrelated substring noise for single-token queries", () => {
    const query = normalizeSearchText("thon")

    expect(scoreFoodSearchMatch("Bâtonnets croustillants", query)).toBeNull()
  })

  it("fetches a wider window before ranking when a generic search query is present", () => {
    expect(resolveFoodSearchFetchLimit(20, false, false)).toBe(20)
    expect(resolveFoodSearchFetchLimit(20, true, false)).toBeGreaterThan(20)
    expect(resolveFoodSearchFetchLimit(20, true, true)).toBeGreaterThan(20)
  })

  it("prioritizes recent direct matches when text proximity is comparable", () => {
    const usageById = new Map([
      ["recent", { count: 4, lastUsedAt: 200, recentRank: 0 }],
      ["older", { count: 1, lastUsedAt: 100, recentRank: 6 }],
    ])

    const directRecent = { id: "recent", name_fr: "Poulet rôti", score: scoreFoodSearchMatch("Poulet rôti", normalizeSearchText("poulet")) ?? 999 }
    const directOlder = { id: "older", name_fr: "Poulet grillé", score: scoreFoodSearchMatch("Poulet grillé", normalizeSearchText("poulet")) ?? 999 }

    expect(compareFoodSearchEntries(directRecent, directOlder, usageById)).toBeLessThan(0)
  })

  it("does not let recency beat a clearly worse text match", () => {
    const usageById = new Map([
      ["recent-composed", { count: 8, lastUsedAt: 200, recentRank: 0 }],
      ["direct", { count: 1, lastUsedAt: 100, recentRank: 9 }],
    ])

    const direct = { id: "direct", name_fr: "Thon nature", score: scoreFoodSearchMatch("Thon nature", normalizeSearchText("thon")) ?? 999 }
    const composedRecent = { id: "recent-composed", name_fr: "Pizza au thon", score: scoreFoodSearchMatch("Pizza au thon", normalizeSearchText("thon")) ?? 999 }

    expect(compareFoodSearchEntries(direct, composedRecent, usageById)).toBeLessThan(0)
  })
})
