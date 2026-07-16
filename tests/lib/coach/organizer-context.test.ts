import {
  getContextCopy,
  getContextDraft,
  getCurrentClientIdFromPath,
  getHelpContent,
  getOrderedPresets,
  getRecommendationCopy,
  getRecommendedPresetId,
} from '@/lib/coach/organizer-context'

describe('organizer-context', () => {
  it('returns nutrition recommendation copy for both mode', () => {
    expect(getRecommendationCopy('both')).toEqual({
      title: 'Alerte + tâche',
      body: "Utilise ce mode si tu veux un rappel à une date précise et une action visible dans ton dashboard.",
    })
  })

  it('detects client id from coach client routes', () => {
    expect(getCurrentClientIdFromPath('/coach/clients/client-42/protocoles/nutrition')).toBe('client-42')
    expect(getCurrentClientIdFromPath('/dashboard')).toBe('')
  })

  it('returns workout studio context and preset', () => {
    const pathname = '/coach/clients/client-1/protocoles/entrainement'

    expect(getContextCopy(pathname)).toEqual({
      title: 'Organisation entraînement',
      body: "Tu es dans Workout Studio. Ici, l'outil sert surtout à programmer un ajustement d'entraînement, un point progression ou un rappel de décision coach.",
    })
    expect(getRecommendedPresetId(pathname)).toBe('training-adjustment')
  })

  it('returns bilan draft copy for current client', () => {
    expect(getContextDraft('/coach/clients/client-1/data/bilans', 'Lina Moreau')).toEqual({
      title: 'Bilan à traiter Lina Moreau',
      note: 'Traiter le bilan de Lina Moreau, préparer le retour et décider de la prochaine action coach.',
    })
  })

  it('prioritizes recommended preset first in ordered list', () => {
    const ordered = getOrderedPresets('performance-review')

    expect(ordered[0]?.id).toBe('performance-review')
    expect(ordered.some((preset) => preset.id === 'nutrition-follow-up')).toBe(true)
  })

  it('returns nutrition-specific help content', () => {
    const help = getHelpContent('/coach/clients/client-1/protocoles/nutrition')

    expect(help.title).toBe("Comment utiliser l'organisation ici")
    expect(help.items[0]).toContain('Suivi nutrition')
    expect(help.footer).toContain('client courant est détecté automatiquement')
  })

  it('returns bilan-specific help content', () => {
    const help = getHelpContent('/coach/clients/client-1/data/bilans')

    expect(help.intro).toContain('ne pas laisser une analyse sans suite concrète')
    expect(help.items[0]).toContain('Bilan à traiter')
  })

  it('returns performance-specific help content', () => {
    const help = getHelpContent('/coach/clients/client-1/data/performances')

    expect(help.intro).toContain('lecture coach claire')
    expect(help.items[0]).toContain('Point progression')
  })

  it('returns workout-specific help content', () => {
    const help = getHelpContent('/coach/clients/client-1/protocoles/entrainement')

    expect(help.intro).toContain("décision sur l'entraînement")
    expect(help.items[0]).toContain('Ajustement entraînement')
  })

  it('returns default help content for generic pages', () => {
    const help = getHelpContent('/coach/settings')

    expect(help.title).toBe('À quoi sert cet outil')
    expect(help.items).toHaveLength(3)
  })
})
