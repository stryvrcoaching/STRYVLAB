function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function inKeywords(haystack, keywords) {
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword)
    if (!normalizedKeyword) return false
    const pattern = new RegExp(`(^| )${escapeRegex(normalizedKeyword)}(?= |$)`)
    return pattern.test(haystack)
  })
}

function hasCompositeMealSignals(text) {
  return inKeywords(text, [
    'plat compose',
    'plats composes',
    'salade composee',
    'salades composees',
    'sandwich',
    'pizza',
    'quiche',
    'feuillete',
    'bouchée',
    'bouchee',
    'nems',
    'nem',
    'pate imperial',
    'pâté impérial',
    'wrap',
    'burger',
  ])
}

function hasSoupSignals(text) {
  return inKeywords(text, ['soupe', 'bouillon', 'potage', 'veloute'])
}

export function classifyCiqualRow(row) {
  const group = normalizeText(row.alim_ssgrp_nom_fr)
  const subgroup = normalizeText(row.alim_ssssgrp_nom_fr)
  const name = normalizeText(row.Aliments)
  const scope = [group, subgroup, name].filter(Boolean).join(' | ')

  if (inKeywords(scope, ['eaux'])) return { category_l1: 'drinks', category_l2: 'eau' }
  if (inKeywords(scope, ['boisson alcoolisee', 'liqueurs et alcools', 'vins', 'bieres et cidres', 'cocktails'])) {
    return { category_l1: 'drinks', category_l2: 'alcools' }
  }
  if (inKeywords(scope, ['boissons vegetales'])) return { category_l1: 'drinks', category_l2: 'laits-vegetaux' }
  if (inKeywords(scope, ['cafe the cacao', 'cafe', 'the', 'infusion', 'chicoree'])) {
    return { category_l1: 'drinks', category_l2: 'chauds' }
  }
  if (inKeywords(scope, ['jus', 'nectars', 'smoothie'])) return { category_l1: 'drinks', category_l2: 'jus-smoothies' }
  if (inKeywords(scope, ['boisson energetique', 'boisson isotoni', 'boisson a reconstituer', 'sports'])) {
    return { category_l1: 'drinks', category_l2: 'sports-drinks' }
  }
  if (inKeywords(scope, ['boissons sans alcool', 'boissons rafraichissantes lactees', 'sodas', 'colas'])) {
    return { category_l1: 'extras', category_l2: 'boissons' }
  }
  if (hasSoupSignals(scope)) {
    return { category_l1: 'extras', category_l2: 'fast-food' }
  }
  if (hasCompositeMealSignals(name)) {
    return { category_l1: 'extras', category_l2: 'fast-food' }
  }

  if (inKeywords(name, ['poulet', 'dinde', 'chicken', 'turkey'])) {
    return { category_l1: 'proteins', category_l2: 'viandes' }
  }
  if (inKeywords(name, ['boeuf', 'bœuf', 'veau', 'agneau', 'mouton', 'porc', 'jambon', 'lard', 'bacon', 'saucisse', 'chorizo', 'saucisson', 'pancetta', 'bresaola'])) {
    return { category_l1: 'proteins', category_l2: 'viandes' }
  }
  if (inKeywords(name, ['poisson', 'saumon', 'thon', 'sardine', 'maquereau', 'truite', 'bar ', 'barre', 'brochet', 'cabillaud', 'morue', 'merlan', 'hareng', 'anchois', 'anguille', 'brème', 'breme'])) {
    return { category_l1: 'proteins', category_l2: 'poissons' }
  }
  if (inKeywords(name, ['crevette', 'moule', 'calamar', 'seiche', 'saint jacques', 'saint-jacques', 'crabe', 'homard', 'langouste', 'huitre', 'huître', 'araignee de mer', 'araignée de mer'])) {
    return { category_l1: 'proteins', category_l2: 'poissons' }
  }
  if (inKeywords(name, ['oeuf', 'œuf', 'blanc d oeuf', 'blanc d’œuf', 'blanc d\'œuf', 'omelette'])) {
    return { category_l1: 'proteins', category_l2: 'oeufs' }
  }
  if (inKeywords(name, ['riz', 'rice', 'galette de riz', 'pate sans gluten a base de riz', 'pâtes sans gluten à base de riz']) && !inKeywords(name, ['huile', 'graisse', 'beurre'])) {
    return { category_l1: 'carbs', category_l2: 'cereales' }
  }
  if (inKeywords(name, ['pain', 'baguette', 'biscotte', 'wrap', 'tortilla', 'bagel']) && !hasCompositeMealSignals(name)) {
    return { category_l1: 'carbs', category_l2: 'pain' }
  }
  if (inKeywords(name, ['cereale', 'céréale', 'cereal', 'flocon', 'muesli', 'granola', 'avoine', 'porridge', 'pétales', 'petales']) && !hasCompositeMealSignals(scope)) {
    return { category_l1: 'carbs', category_l2: 'cereales' }
  }
  if (inKeywords(name, ['pomme de terre', 'patate', 'frite', 'puree', 'purée']) && !hasCompositeMealSignals(scope)) {
    return { category_l1: 'carbs', category_l2: 'fecules' }
  }
  if (inKeywords(name, ['lentille', 'pois chiche', 'pois cassé', 'pois casse', 'haricot', 'fève', 'feve', 'soja', 'lupin']) && !hasCompositeMealSignals(scope)) {
    return { category_l1: 'carbs', category_l2: 'legumineuses' }
  }

  if (inKeywords(scope, ['viandes crues', 'viandes cuites', 'bœuf', 'boeuf', 'veau', 'porc', 'agneau', 'mouton', 'gibier', 'lapin', 'canard'])) {
    return { category_l1: 'proteins', category_l2: 'viandes' }
  }
  if (inKeywords(scope, ['charcuteries', 'jambons', 'saucisses', 'pates et terrines', 'rillettes', 'saucisson'])) {
    return { category_l1: 'proteins', category_l2: 'viandes' }
  }
  if (inKeywords(scope, ['poissons crus', 'poissons cuits', 'produits a base de poissons', 'mollusques', 'crustaces', 'thon', 'saumon', 'sardine', 'anchois'])) {
    return { category_l1: 'proteins', category_l2: 'poissons' }
  }
  if (inKeywords(scope, ['œufs', 'oeufs', 'ovoproduits', 'omelettes'])) {
    return { category_l1: 'proteins', category_l2: 'oeufs' }
  }
  if (inKeywords(scope, ['fromages', 'produits laitiers frais', 'yaourts', 'yaourt', 'laits'])) {
    return { category_l1: 'proteins', category_l2: 'laitiers' }
  }
  if (inKeywords(scope, ['substitus de produits carnes', 'substituts de charcuteries', 'desserts vegetaux', 'substituts de fromages'])) {
    return { category_l1: 'proteins', category_l2: 'vegetales' }
  }

  if (inKeywords(scope, ['legumineuses'])) {
    return { category_l1: 'carbs', category_l2: 'legumineuses' }
  }
  if (inKeywords(scope, ['pates riz et cereales', 'cereales de petit dejeuner'])) {
    return { category_l1: 'carbs', category_l2: 'cereales' }
  }
  if (inKeywords(scope, ['pains et assimiles', 'pains', 'biscottes', 'pain de mie', 'tortilla', 'wrap'])) {
    return { category_l1: 'carbs', category_l2: 'pain' }
  }
  if (inKeywords(scope, ['pommes de terre et autres tubercules', 'pommes de terre', 'tubercules'])) {
    return { category_l1: 'carbs', category_l2: 'fecules' }
  }

  if (inKeywords(name, ['beurre', 'margarine']) && !inKeywords(name, ['huile'])) {
    return { category_l1: 'fats', category_l2: 'autres-lipides' }
  }
  if (inKeywords(scope, ['fruits a coque et graines oleagineuses'])) {
    return { category_l1: 'fats', category_l2: 'noix-graines' }
  }
  if (inKeywords(scope, ['huiles et graisses vegetales', 'huiles de poissons']) && !inKeywords(name, ['beurre', 'margarine'])) {
    return { category_l1: 'fats', category_l2: 'huiles' }
  }
  if (inKeywords(scope, ['margarines', 'beurres', 'autres matieres grasses'])) {
    return { category_l1: 'fats', category_l2: 'autres-lipides' }
  }

  if (inKeywords(scope, ['legumes'])) {
    if (inKeywords(scope, ['crus', 'salade', 'laitue', 'roquette', 'epinard', 'mache'])) {
      return { category_l1: 'vegetables', category_l2: 'feuilles' }
    }
    if (inKeywords(scope, ['chou', 'brocoli', 'chou fleur', 'crucif'])) {
      return { category_l1: 'vegetables', category_l2: 'cruciferes' }
    }
    return { category_l1: 'vegetables', category_l2: 'autres-legumes' }
  }
  if (inKeywords(scope, ['herbes', 'algues'])) return { category_l1: 'vegetables', category_l2: 'autres-legumes' }

  const fruitGroup = inKeywords(group, ['fruits'])
  const fruitSubgroup = inKeywords(subgroup, ['fruits crus', 'fruits secs', 'compotes', 'fruits appertises'])
  if (fruitGroup || fruitSubgroup) {
    if (inKeywords(scope, ['biscuit', 'gateau', 'gâteau', 'beignet', 'bonbon', 'chocolat', 'barre', 'cereal', 'céréal', 'granola', 'dessert', 'sauce', 'vinaigre', 'moutarde', 'ketchup'])) {
      return { category_l1: 'extras', category_l2: 'snacks-sucres' }
    }
    return { category_l1: 'fruits', category_l2: inKeywords(subgroup, ['secs', 'compotes', 'appertises']) ? 'secs' : 'frais' }
  }

  if (inKeywords(scope, ['sauces', 'condiments'])) return { category_l1: 'extras', category_l2: 'sauces' }
  if (inKeywords(scope, ['biscuits aperitifs'])) return { category_l1: 'extras', category_l2: 'snacks-sales' }
  if (inKeywords(scope, ['gateaux et patisseries', 'biscuits sucres', 'viennoiseries', 'confiseries', 'chocolats', 'glaces', 'desserts glaces', 'sorbets', 'barres cerealieres', 'confitures', 'sucres miels'])) {
    return { category_l1: 'extras', category_l2: 'snacks-sucres' }
  }
  if (inKeywords(scope, ['pizzas', 'sandwichs', 'plats composes', 'feuilletees', 'salades composees', 'soupes'])) {
    return { category_l1: 'extras', category_l2: 'fast-food' }
  }

  return { category_l1: 'extras', category_l2: 'divers' }
}
