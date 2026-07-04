import { describe, expect, it } from 'vitest'
import { scoreVoiceCatalogCandidate } from '@/lib/nutrition/voice-catalog'

describe('voice catalog scoring', () => {
  it('prefers the branded cereal over a generic cereal term', () => {
    const transcript = "j'ai mangé des céréales Honey Rings au miel en forme d'anneaux"
    const honeyRings = {
      id: '1',
      name_fr: 'Honey Rings',
      category_l1: 'carbs',
    }
    const genericCereal = {
      id: '2',
      name_fr: 'Céréales',
      category_l1: 'carbs',
    }

    expect(scoreVoiceCatalogCandidate(transcript, honeyRings))
      .toBeGreaterThan(scoreVoiceCatalogCandidate(transcript, genericCereal))
  })

  it('prefers the 4 percent dairy item over the 40 percent version', () => {
    const transcript = 'deux petits suisses de 60 grammes, petits suisses maigres avec 4% de matière grasse'
    const preciseDairy = {
      id: '3',
      name_fr: 'Petit Suisse 4%',
      category_l1: 'proteins',
      category_l2: 'laitiers',
    }
    const wholeDairy = {
      id: '4',
      name_fr: 'Petit Suisse entier (40%)',
      category_l1: 'proteins',
      category_l2: 'laitiers',
    }

    expect(scoreVoiceCatalogCandidate(transcript, preciseDairy))
      .toBeGreaterThan(scoreVoiceCatalogCandidate(transcript, wholeDairy))
  })

  it('scores protein context above unrelated families', () => {
    const transcript = '150 g de poulet grillé avec riz et brocoli'
    const chicken = {
      id: '5',
      name_fr: 'Poulet grillé',
      category_l1: 'proteins',
    }
    const cereal = {
      id: '6',
      name_fr: 'Céréales au chocolat',
      category_l1: 'carbs',
    }

    expect(scoreVoiceCatalogCandidate(transcript, chicken))
      .toBeGreaterThan(scoreVoiceCatalogCandidate(transcript, cereal))
  })

  it('prefers a personal whey isolate brand over generic protein powder', () => {
    const transcript = '30 grammes de whey protéine isolate de la marque Addict'
    const addictWhey = {
      id: '7',
      name_fr: 'Addict Nutrition Isola Whey',
      category_l1: 'proteins',
      category_l2: 'complements',
    }
    const genericWhey = {
      id: '8',
      name_fr: 'Poudre protéinée',
      category_l1: 'proteins',
      category_l2: 'complements',
    }

    expect(scoreVoiceCatalogCandidate(transcript, addictWhey))
      .toBeGreaterThan(scoreVoiceCatalogCandidate(transcript, genericWhey))
  })

  it('prefers branded peanut butter over generic butter', () => {
    const transcript = '10 grammes de beurre de cacahuète Lidl'
    const lidlPeanutButter = {
      id: '9',
      name_fr: 'Beurre de cacahuète Lidl',
      category_l1: 'fats',
      category_l2: 'autres-lipides',
    }
    const genericButter = {
      id: '10',
      name_fr: 'Beurre',
      category_l1: 'fats',
      category_l2: 'autres-lipides',
    }

    expect(scoreVoiceCatalogCandidate(transcript, lidlPeanutButter))
      .toBeGreaterThan(scoreVoiceCatalogCandidate(transcript, genericButter))
  })
})
