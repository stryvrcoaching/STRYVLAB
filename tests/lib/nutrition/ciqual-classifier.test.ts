import { describe, expect, it } from 'vitest'
import { classifyCiqualRow } from '@/lib/nutrition/ciqual-classifier.mjs'

function mkRow(partial: {
  alim_ssgrp_nom_fr?: string
  alim_ssssgrp_nom_fr?: string
  Aliments?: string
}) {
  return {
    alim_ssgrp_nom_fr: partial.alim_ssgrp_nom_fr ?? '',
    alim_ssssgrp_nom_fr: partial.alim_ssssgrp_nom_fr ?? '',
    Aliments: partial.Aliments ?? '',
  }
}

describe('ciqual classifier', () => {
  it('keeps rice items in carbs', () => {
    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'pâtes, riz et céréales',
      alim_ssssgrp_nom_fr: 'pâtes, riz et céréales crus',
      Aliments: 'Riz blanc, cru',
    }))).toEqual({ category_l1: 'carbs', category_l2: 'cereales' })
  })

  it('routes fruits-only groups to fruits and ignores fruit words in snacks', () => {
    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'fruits',
      alim_ssssgrp_nom_fr: 'fruits crus',
      Aliments: 'Abricot, cru',
    }))).toEqual({ category_l1: 'fruits', category_l2: 'frais' })

    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'fruits',
      alim_ssssgrp_nom_fr: 'desserts de fruits',
      Aliments: 'Biscuit sec fourré aux fruits',
    }))).toEqual({ category_l1: 'extras', category_l2: 'snacks-sucres' })
  })

  it('splits oils from butter and margarine', () => {
    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'huiles et graisses végétales',
      alim_ssssgrp_nom_fr: '',
      Aliments: 'Huile de son de riz',
    }))).toEqual({ category_l1: 'fats', category_l2: 'huiles' })

    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'huiles et graisses végétales',
      alim_ssssgrp_nom_fr: '',
      Aliments: 'Beurre allégé 39% MG',
    }))).toEqual({ category_l1: 'fats', category_l2: 'autres-lipides' })
  })

  it('promotes obvious meat, egg and rice names even when the group is broad', () => {
    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'plats composés',
      alim_ssssgrp_nom_fr: '',
      Aliments: 'Bœuf bourguignon',
    }))).toEqual({ category_l1: 'proteins', category_l2: 'viandes' })

    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'plats composés',
      alim_ssssgrp_nom_fr: '',
      Aliments: "Blanc d'œuf",
    }))).toEqual({ category_l1: 'proteins', category_l2: 'oeufs' })

    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'plats composés',
      alim_ssssgrp_nom_fr: '',
      Aliments: 'Galette de riz soufflé',
    }))).toEqual({ category_l1: 'carbs', category_l2: 'cereales' })
  })

  it('routes composite meals to fast-food instead of ingredient families', () => {
    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'plats composés',
      alim_ssssgrp_nom_fr: '',
      Aliments: 'Salade de pâtes, végétarienne',
    }))).toEqual({ category_l1: 'extras', category_l2: 'fast-food' })

    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'plats composés',
      alim_ssssgrp_nom_fr: '',
      Aliments: 'Bouillon de volaille',
    }))).toEqual({ category_l1: 'extras', category_l2: 'fast-food' })

    expect(classifyCiqualRow(mkRow({
      alim_ssgrp_nom_fr: 'plats composés',
      alim_ssssgrp_nom_fr: '',
      Aliments: 'Pizza au chorizo ou salami',
    }))).toEqual({ category_l1: 'extras', category_l2: 'fast-food' })
  })
})
