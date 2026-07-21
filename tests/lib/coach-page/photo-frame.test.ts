import { describe, expect, it } from 'vitest'
import {
  coverFrameHeightClass,
  normalizePhotoFrame,
  photoFrameClasses,
  resolveCoverHeight,
} from '@/lib/coach-page/photo-frame'

describe('photo-frame', () => {
  it('normalizes unknown frames to fallback', () => {
    expect(normalizePhotoFrame(undefined, 'circle')).toBe('circle')
    expect(normalizePhotoFrame('nope', 'rounded')).toBe('rounded')
    expect(normalizePhotoFrame('portrait_4_5')).toBe('portrait_4_5')
  })

  it('returns circle classes', () => {
    expect(photoFrameClasses('circle', { size: 'lg' })).toContain('rounded-full')
  })

  it('returns cover height classes', () => {
    expect(coverFrameHeightClass('tall')).toContain('h-64')
    expect(coverFrameHeightClass('medium')).toContain('lg:h-96')
    expect(coverFrameHeightClass('short')).toContain('h-44')
    expect(coverFrameHeightClass('hidden')).toBe('h-0')
  })

  it('resolves cover height percentages', () => {
    expect(resolveCoverHeight('hidden')).toBe(0)
    expect(resolveCoverHeight('short')).toBe(40)
    expect(resolveCoverHeight('medium')).toBe(60)
    expect(resolveCoverHeight('tall')).toBe(80)
    expect(resolveCoverHeight(undefined)).toBe(60)
    expect(resolveCoverHeight(55)).toBe(55)
    expect(resolveCoverHeight('75')).toBe(75)
  })
})
