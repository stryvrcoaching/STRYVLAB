import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FoodIcon } from '@/components/nutrition/FoodIcon'
import * as foodIcons from '@/lib/nutrition/food-icons'
import { resolveFoodIconKey } from '@/lib/nutrition/food-icons'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => React.createElement('img', props),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FoodIcon', () => {
  it('resolves lipid names to their specific icon before generic fat fallbacks', () => {
    expect(resolveFoodIconKey({
      name_fr: "Beurre de cacahuètes 100% Lidl",
      category_l1: 'fats',
      category_l2: 'noix-graines',
    })).toBe('peanut-butter')

    expect(resolveFoodIconKey({
      name_fr: "Huile d'olive vierge extra",
      category_l1: 'fats',
      category_l2: 'huiles',
    })).toBe('olive-oil')

    expect(resolveFoodIconKey({
      name_fr: 'Avocat',
      category_l1: 'fats',
      category_l2: 'autres-lipides',
    })).toBe('avocado')

    expect(resolveFoodIconKey({
      name_fr: 'Olives vertes',
      category_l1: 'fats',
      category_l2: 'autres-lipides',
    })).toBe('olives')

    expect(resolveFoodIconKey({
      name_fr: 'Huile de coco',
      category_l1: 'fats',
      category_l2: 'huiles',
    })).toBe('coconut-oil')

    expect(resolveFoodIconKey({
      name_fr: 'Mayonnaise',
      category_l1: 'extras',
      category_l2: 'sauces',
    })).toBe('mayonnaise')

    expect(resolveFoodIconKey({
      name_fr: "Purée d'amande complète",
      category_l1: 'fats',
      category_l2: 'noix-graines',
    })).toBe('almond-butter')

    expect(resolveFoodIconKey({
      name_fr: 'Purée de noix de cajou',
      category_l1: 'fats',
      category_l2: 'noix-graines',
    })).toBe('cashew-butter')

    expect(resolveFoodIconKey({
      name_fr: 'Beurre de sésame',
      category_l1: 'fats',
      category_l2: 'noix-graines',
    })).toBe('tahini')

    expect(resolveFoodIconKey({
      name_fr: 'Graines de courge',
      category_l1: 'fats',
      category_l2: 'noix-graines',
    })).toBe('pumpkin-seeds')

    expect(resolveFoodIconKey({
      name_fr: 'Huile de colza',
      category_l1: 'fats',
      category_l2: 'huiles',
    })).toBe('rapeseed-oil')

    expect(resolveFoodIconKey({
      name_fr: 'Huile de tournesol',
      category_l1: 'fats',
      category_l2: 'huiles',
    })).toBe('sunflower-oil')

    expect(resolveFoodIconKey({
      name_fr: 'Huile de noix',
      category_l1: 'fats',
      category_l2: 'huiles',
    })).toBe('walnut-oil')

    expect(resolveFoodIconKey({
      name_fr: 'Huile de pépins de raisin',
      category_l1: 'fats',
      category_l2: 'huiles',
    })).toBe('grape-seed-oil')

    expect(resolveFoodIconKey({
      name_fr: 'Graisse de canard',
      category_l1: 'fats',
      category_l2: 'autres-lipides',
    })).toBe('duck-fat')

    expect(resolveFoodIconKey({
      name_fr: 'Pâte à tartiner chocolat et noisette',
      category_l1: 'fats',
      category_l2: 'noix-graines',
    })).toBe('hazelnut-spread')
  })

  it('keeps nuts and nut-adjacent words assigned to the right visual family', () => {
    const examples = [
      [{ name_fr: 'Noix, cerneau, séchée', category_l1: 'fats', category_l2: 'noix-graines' }, 'walnuts'],
      [{ name_fr: "Noix du Brésil ou noix d'Amazonie, sans sel ajouté", category_l1: 'fats', category_l2: 'noix-graines' }, 'brazil-nuts'],
      [{ name_fr: 'Fruits à coques et cacahuète, sans sel ajouté (aliment moyen)', category_l1: 'fats', category_l2: 'noix-graines' }, 'mixed-nuts'],
      [{ name_fr: 'Amande, avec peau, sans sel ajouté', category_l1: 'fats', category_l2: 'noix-graines' }, 'almonds'],
      [{ name_fr: 'Noix de cajou, grillée, salée', category_l1: 'fats', category_l2: 'noix-graines' }, 'cashews'],
      [{ name_fr: 'Noix de pécan, sans sel ajouté', category_l1: 'fats', category_l2: 'noix-graines' }, 'pecans'],
      [{ name_fr: 'Noix de macadamia, sans sel ajouté', category_l1: 'fats', category_l2: 'noix-graines' }, 'macadamia'],
      [{ name_fr: 'Pignon de pin', category_l1: 'fats', category_l2: 'noix-graines' }, 'pine-nuts'],
      [{ name_fr: 'Noix de muscade', category_l1: 'fats', category_l2: 'noix-graines' }, 'nutmeg'],
      [{ name_fr: 'Chanvre ou chènevis, graine décortiquée', category_l1: 'fats', category_l2: 'noix-graines' }, 'hemp-seeds'],
      [{ name_fr: 'Noix de coco, chair, fraîche', category_l1: 'fats', category_l2: 'noix-graines' }, 'coconut'],
      [{ name_fr: "Huile d'amande", category_l1: 'fats', category_l2: 'huiles' }, 'almond-oil'],
      [{ name_fr: 'Huile de noisette', category_l1: 'fats', category_l2: 'huiles' }, 'hazelnut-oil'],
      [{ name_fr: "Huile d'avocat", category_l1: 'fats', category_l2: 'huiles' }, 'avocado-oil'],
      [{ name_fr: 'Huile de maïs', category_l1: 'fats', category_l2: 'huiles' }, 'corn-oil'],
      [{ name_fr: 'Huile de soja', category_l1: 'fats', category_l2: 'huiles' }, 'soybean-oil'],
      [{ name_fr: 'Huile de son de riz', category_l1: 'fats', category_l2: 'huiles' }, 'rice-bran-oil'],
      [{ name_fr: 'Huile de cameline', category_l1: 'fats', category_l2: 'huiles' }, 'camelina-oil'],
      [{ name_fr: 'Huile de chanvre', category_l1: 'fats', category_l2: 'huiles' }, 'hemp-oil'],
      [{ name_fr: "Huile d'argan ou d'argane", category_l1: 'fats', category_l2: 'huiles' }, 'argan-oil'],
      [{ name_fr: "Huile combinée, mélange d'huile d'olive et de graines", category_l1: 'fats', category_l2: 'huiles' }, 'mixed-oils'],
      [{ name_fr: 'Coquille Saint-Jacques, noix, crue', category_l1: 'proteins', category_l2: 'poissons' }, 'mussels'],
      [{ name_fr: 'Boeuf, gîte à la noix, cru', category_l1: 'proteins', category_l2: 'viandes' }, 'beef'],
      [{ name_fr: 'Pomme de terre noisette, surgelée, cuite', category_l1: 'carbs', category_l2: 'fecules' }, 'potato'],
    ] as const

    for (const [food, icon] of examples) {
      expect(resolveFoodIconKey(food)).toBe(icon)
    }
  })

  it('renders generated transparent lipid assets at the shared visual scale', () => {
    const html = renderToStaticMarkup(React.createElement(FoodIcon, {
      food: {
        name_fr: "Beurre de cacahuètes 100% Lidl",
        category_l1: 'fats',
        category_l2: 'noix-graines',
      },
      size: 34,
    }))

    expect(html).toContain('/food-icons-v19-transparent/peanut-butter.png')
    expect(html).toContain('width="44"')
    expect(html).toContain('height="44"')
  })

  it('keeps the primary food ahead of broad preparation or ingredient words', () => {
    const examples = [
      ['Ail rôti/cuit au four', 'garlic'],
      ['Andouille de Guéméné', 'sausage'],
      ['Andouillette à cuire', 'sausage'],
      ["Anguille, bouillie/cuite à l'eau", 'white-fish'],
      ['Escargots en sauce au beurre persillé', 'mussels'],
      ['Grenadier bleu ou hoki de Nouvelle-Zélande, cru', 'white-fish'],
      ['Grenouille', 'white-fish'],
      ['Oeuf de dinde', 'turkey-egg'],
      ['Omelette aux lardons', 'egg'],
      ['Tarte normande aux pommes', 'cookie'],
      ['Crème caramel, rayon frais', 'yogurt-cup'],
      ['Petit pot de crème chocolat vanille', 'yogurt-cup'],
      ['Boisson infantile céréales lactées aux fruits', 'milk-carton'],
      ['Collagène en poudre', 'whey-scoop'],
      ['BCAA en poudre', 'whey-scoop'],
      ['Glutamine en poudre', 'whey-scoop'],
      ['Amidon de maïs ou fécule de maïs', 'carbs'],
    ] as const

    for (const [name, icon] of examples) {
      expect(resolveFoodIconKey({ name_fr: name, category_l1: 'extras', category_l2: 'autres' })).toBe(icon)
    }
  })

  it('assigns precise egg icons across species, components and cooking methods', () => {
    const examples = [
      ["Blanc d'œuf", 'egg-white'],
      ["Oeuf, blanc (blanc d'oeuf), cru", 'egg-white'],
      ["Oeuf, blanc (blanc d'oeuf), cuit", 'egg-white'],
      ["Oeuf, blanc (blanc d'oeuf), en poudre", 'egg-white-powder'],
      ["Oeuf, cru", 'egg'],
      ["Oeuf d'oie, cru", 'goose-egg'],
      ["Oeuf de caille, cru", 'quail-egg'],
      ["Oeuf de cane, cru", 'duck-egg'],
      ["Oeuf de dinde, cru", 'turkey-egg'],
      ["Œuf entier", 'egg'],
      ["Oeuf, à la coque", 'soft-boiled-egg'],
      ["Oeuf, au plat, frit, salé", 'fried-egg'],
      ["Oeuf, au plat, sans matière grasse", 'fried-egg'],
      ["Oeuf, dur", 'hard-boiled-egg'],
      ["Oeuf, en poudre", 'egg-powder'],
      ["Oeuf, jaune (jaune d'oeuf), cru", 'egg-yolk'],
      ["Oeuf, jaune (jaune d'oeuf), cuit", 'egg-yolk'],
      ["Oeuf, jaune (jaune d'oeuf), en poudre", 'egg-yolk-powder'],
      ["Oeuf, poché", 'poached-egg'],
      ["Oeuf, brouillé, avec matière grasse", 'scrambled-eggs'],
      ["Omelette au fromage", 'omelette-cheese'],
      ["Omelette aux champignons", 'omelette-mushroom'],
      ["Omelette aux fines herbes", 'omelette-herbs'],
    ] as const

    for (const [name, icon] of examples) {
      expect(resolveFoodIconKey({
        name_fr: name,
        category_l1: 'proteins',
        category_l2: 'oeufs',
      })).toBe(icon)
    }
  })

  it('assigns precise drink icons before generic beverage fallbacks', () => {
    const examples = [
      ["Eau minérale naturelle", 'eau', 'water-bottle'],
      ["Eau gazeuse Perrier", 'eau', 'sparkling-water'],
      ["Espresso sans sucre", 'chauds', 'espresso'],
      ["Cappuccino", 'chauds', 'cappuccino'],
      ["Thé vert", 'chauds', 'green-tea'],
      ["Tisane camomille", 'chauds', 'herbal-tea'],
      ["Matcha", 'chauds', 'matcha'],
      ["Chocolat chaud", 'chauds', 'hot-chocolate'],
      ["Jus d'orange, pur jus", 'jus-smoothies', 'orange-juice'],
      ["Jus de pomme", 'jus-smoothies', 'apple-juice'],
      ["Jus d'ananas, pur jus", 'jus-smoothies', 'pineapple-juice'],
      ["Smoothie fruits rouges", 'jus-smoothies', 'berry-smoothie'],
      ["Myrtilles fraîches", 'fruits', 'blueberries'],
      ["Smoothie vert épinard kiwi", 'jus-smoothies', 'green-smoothie'],
      ["Cola classique", 'sodas', 'cola'],
      ["Limonade artisanale", 'sodas', 'lemonade'],
      ["Thé glacé au citron", 'sodas', 'iced-tea'],
      ["Boisson à l'avoine", 'laits-vegetaux', 'oat-milk'],
      ["Lait d'amande", 'laits-vegetaux', 'almond-milk'],
      ["Boisson isotonique", 'sports-drinks', 'isotonic-drink'],
    ] as const

    for (const [name, categoryL2, icon] of examples) {
      expect(resolveFoodIconKey({
        name_fr: name,
        category_l1: 'drinks',
        category_l2: categoryL2,
      })).toBe(icon)
    }

    expect(resolveFoodIconKey({
      name_fr: 'Myrtilles fraîches',
      category_l1: 'fruits',
      category_l2: 'fruits',
      icon_key: 'apple',
    })).toBe('blueberries')
  })

  it('does not let cross-category words override the official food family', () => {
    const examples = [
      [{ name_fr: "Igname, épluchée, bouillie/cuite à l'eau", category_l1: 'carbs', category_l2: 'fecules' }, 'yam'],
      [{ name_fr: 'Pomme de terre, purée, avec lait et beurre, non salée', category_l1: 'carbs', category_l2: 'fecules' }, 'potato'],
      [{ name_fr: 'Chicorée rouge, crue', category_l1: 'vegetables', category_l2: 'feuilles' }, 'endive'],
      [{ name_fr: 'Grenadier bleu ou hoki de Nouvelle-Zélande, cru', category_l1: 'proteins', category_l2: 'poissons' }, 'white-fish'],
      [{ name_fr: 'Macédoine ou cocktail ou salade de fruits, au sirop', category_l1: 'fruits', category_l2: 'secs' }, 'fruits'],
      [{ name_fr: "Jus d'ananas, pur jus", category_l1: 'drinks', category_l2: 'jus-smoothies' }, 'pineapple-juice'],
      [{ name_fr: 'Pizza jambon fromage, préemballée', category_l1: 'extras', category_l2: 'fast-food' }, 'burger'],
      [{ name_fr: 'Patate douce, pulpe blanchie, surgelée', category_l1: 'vegetables', category_l2: 'autres légumes' }, 'sweet-potato'],
      [{ name_fr: "Frites de patate douce (cuites à l'huile)", category_l1: 'fats', category_l2: 'fecules' }, 'sweet-potato-fries'],
      [{ name_fr: 'Farine de pulpe de patate douce', category_l1: 'vegetables', category_l2: 'autres légumes' }, 'sweet-potato'],
      [{ name_fr: 'Igname, épluchée, bouillie', category_l1: 'vegetables', category_l2: 'fecules' }, 'yam'],
      [{ name_fr: 'Patate douce, pulpe cuite à la vapeur', category_l1: 'vegetables', category_l2: 'autres légumes' }, 'sweet-potato'],
      [{ name_fr: "Frites de patate douce (cuites à l'huile)", category_l1: 'fats', category_l2: 'fecules' }, 'sweet-potato-fries'],
    ] as const

    for (const [food, icon] of examples) {
      expect(resolveFoodIconKey(food)).toBe(icon)
    }
  })

  it('falls back to a safe palette when the resolved key has no palette entry at runtime', () => {
    vi.spyOn(foodIcons, 'resolveFoodIconKey').mockReturnValue('unknown-runtime-key' as never)

    const html = renderToStaticMarkup(React.createElement(FoodIcon, { iconKey: 'anything' }))

    expect(html).toContain('radial-gradient')
    expect(html).not.toContain('undefined')
  })

  it('assigns distinct carbohydrate icons before generic grain fallbacks', () => {
    const examples = [
      ['Boulgour cuit', 'bulgur'],
      ['Sarrasin cuit', 'buckwheat'],
      ['Orge perlée cuite', 'barley'],
      ['Millet cuit', 'millet'],
      ['Polenta cuite', 'polenta'],
      ['Perles de tapioca', 'tapioca'],
      ['Manioc bouilli', 'cassava'],
      ['Nouilles de riz cuites', 'rice-noodles'],
      ['Gnocchi de pomme de terre', 'gnocchi'],
      ['Épi de maïs', 'corn'],
      ['Banane plantain', 'plantain'],
      ['Muesli aux fruits secs', 'muesli'],
      ['Galettes de riz', 'rice-cakes'],
      ['Corn flakes', 'cornflakes'],
      ['Granola croustillant', 'granola'],
      ['Bagel nature', 'bagel'],
      ['Pain pita complet', 'pita'],
      ['Brioche tressée', 'brioche'],
      ['Pain de seigle', 'rye-bread'],
      ['Pain complet aux céréales', 'wholegrain-bread'],
      ['Farro cuit', 'farro'],
      ['Épeautre cuit', 'spelt'],
      ['Amarante cuite', 'amaranth'],
      ['Crackers aux céréales', 'crackers'],
      ['Pois chiches cuits', 'chickpeas'],
      ['Haricots rouges cuits', 'kidney-beans'],
      ['Haricots noirs cuits', 'black-beans'],
      ['Lentilles corail cuites', 'red-lentils'],
      ['Petits pois cuits', 'green-peas'],
      ['Taro cru', 'taro'],
      ['Igname cuite', 'yam'],
      ['Pommes de terre en quartiers', 'potato-wedges'],
      ['Frites de patate douce', 'sweet-potato-fries'],
      ['Chips de banane plantain', 'plantain-chips'],
      ['Blé de Khorasan, cru', 'wheat'],
      ['Blé dur entier, cru', 'wheat'],
      ['Blé germé, cru', 'wheat'],
      ['Blé tendre entier ou froment, cru', 'wheat'],
    ] as const

    for (const [name, icon] of examples) {
      expect(resolveFoodIconKey({ name_fr: name, category_l1: 'carbs', category_l2: 'fecules' })).toBe(icon)
    }
  })

  it('keeps distinct fruit visuals for strawberries and berries', () => {
    expect(resolveFoodIconKey({ name_fr: 'Fraises fraîches', category_l1: 'fruits', category_l2: 'fruits' })).toBe('strawberries')
    expect(resolveFoodIconKey({ name_fr: 'Framboises fraîches', category_l1: 'fruits', category_l2: 'fruits' })).toBe('berries')
  })
})
