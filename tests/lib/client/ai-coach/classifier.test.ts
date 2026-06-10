import { describe, it, expect } from 'vitest'
import { evaluateSilentEscalation } from '@/lib/client/ai-coach/classifier'

describe('Silent Escalation Classifier', () => {
  it('detects safety_health keywords', () => {
    const res = evaluateSilentEscalation("J'ai très mal au dos depuis hier")
    expect(res.shouldEscalate).toBe(true)
    expect(res.reason).toBe('safety_health')
    expect(res.matchedKeywords).toContain('mal au dos')
  })

  it('detects safety_mental keywords', () => {
    const res = evaluateSilentEscalation("Je suis vraiment déprimé en ce moment")
    expect(res.shouldEscalate).toBe(true)
    expect(res.reason).toBe('safety_mental')
    expect(res.matchedKeywords).toContain('déprimé')
  })

  it('detects out_of_scope_protocol keywords', () => {
    const res = evaluateSilentEscalation("Je veux changer d'objectif s'il te plaît")
    expect(res.shouldEscalate).toBe(true)
    expect(res.reason).toBe('out_of_scope_protocol')
    expect(res.matchedKeywords).toContain("changer d'objectif")
  })

  it('detects out_of_scope_prediction keywords', () => {
    const res = evaluateSilentEscalation("Dans combien de temps je vais voir des résultats ?")
    expect(res.shouldEscalate).toBe(true)
    expect(res.reason).toBe('out_of_scope_prediction')
    expect(res.matchedKeywords[0].toLowerCase()).toBe('dans combien de temps')
  })

  it('ignores false positives via exceptions', () => {
    const res = evaluateSilentEscalation("J'ai mal mangé hier soir")
    expect(res.shouldEscalate).toBe(false)
    expect(res.reason).toBeNull()
  })

  it('passes normal messages', () => {
    const res = evaluateSilentEscalation("J'ai fait ma séance, c'était super")
    expect(res.shouldEscalate).toBe(false)
    expect(res.reason).toBeNull()
  })
})
