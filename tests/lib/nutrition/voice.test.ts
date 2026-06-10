import { describe, it, expect } from 'vitest'
import { cleanTranscript } from '@/lib/nutrition/voice'

describe('cleanTranscript', () => {
  it('lowercases input', () => {
    expect(cleanTranscript('POULET GRILLÉ', 'fr')).toBe('poulet grillé')
  })

  it('removes French filler words', () => {
    expect(cleanTranscript("euh donc j'ai mangé voilà du poulet en fait", 'fr'))
      .toBe("j'ai mangé du poulet")
  })

  it('removes English filler words', () => {
    expect(cleanTranscript('um so I had like chicken you know', 'en'))
      .toBe('i had chicken')
  })

  it('removes Spanish filler words', () => {
    expect(cleanTranscript('eh bueno comí pues pollo', 'es'))
      .toBe('comí pollo')
  })

  it('normalizes written French numbers to digits', () => {
    expect(cleanTranscript('deux cents grammes de riz et une demi pomme', 'fr'))
      .toBe('200 g de riz et 0.5 pomme')
  })

  it('normalizes unit words to abbreviations', () => {
    expect(cleanTranscript("150 grammes de poulet et 250 millilitres d'eau", 'fr'))
      .toBe("150 g de poulet et 250 ml d'eau")
  })

  it('collapses multiple spaces', () => {
    expect(cleanTranscript('poulet   grillé    riz', 'fr')).toBe('poulet grillé riz')
  })

  it('trims leading/trailing whitespace', () => {
    expect(cleanTranscript('  poulet  ', 'fr')).toBe('poulet')
  })
})
