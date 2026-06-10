import { describe, it, expect } from 'vitest'
import { buildTimeline, type TimelineSource, type TimelineEntry } from '@/lib/client/smart/timelineBuilder'

describe('buildTimeline', () => {
  const ISO = (h: number, m = 0) => `2026-05-17T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`

  it('returns empty array when no data', () => {
    const r = buildTimeline({ meals: [], waterLogs: [], session: null, activities: [], checkins: [] })
    expect(r).toEqual([])
  })

  it('orders entries chronologically by start time', () => {
    const src: TimelineSource = {
      meals: [
        { id: 'm1', logged_at: ISO(13), title: 'Déjeuner', meal_type: 'lunch', kcal: 620, protein_g: 42, carbs_g: 58, fat_g: 18 },
        { id: 'm2', logged_at: ISO(7,30), title: 'Petit-déjeuner', meal_type: 'breakfast', kcal: 450, protein_g: 28, carbs_g: 50, fat_g: 12 },
      ],
      waterLogs: [],
      session: null,
      activities: [],
      checkins: [],
    }
    const r = buildTimeline(src)
    expect(r[0].id).toBe('m2')
    expect(r[1].id).toBe('m1')
  })

  it('aggregates water logs into time-of-day buckets', () => {
    const src: TimelineSource = {
      meals: [],
      waterLogs: [
        { logged_at: ISO(7), amount_ml: 250 },
        { logged_at: ISO(9), amount_ml: 500 },
      ],
      session: null,
      activities: [],
      checkins: [],
    }
    const r = buildTimeline(src, 'UTC')
    const water = r.filter(e => e.kind === 'water')
    expect(water.length).toBe(1) // morning bucket aggregated
    expect(water[0].title).toContain('matin')
    expect(water[0].subtitle).toContain('750')
  })

  it('includes session if present', () => {
    const src: TimelineSource = {
      meals: [],
      waterLogs: [],
      session: {
        id: 's1',
        completed_at: ISO(11),
        title: 'Push Force',
        duration_min: 58,
        exercises_count: 8,
      },
      activities: [],
      checkins: [],
    }
    const r = buildTimeline(src)
    expect(r.find(e => e.kind === 'workout')?.title).toBe('Push Force')
  })

  it('includes activity logs with custom_label when provided', () => {
    const src: TimelineSource = {
      meals: [],
      waterLogs: [],
      session: null,
      activities: [{
        id: 'a1', started_at: ISO(18), activity_type: 'other', custom_label: 'Tennis',
        duration_min: 60, intensity: 6,
      }],
      checkins: [],
    }
    const r = buildTimeline(src)
    expect(r[0].title).toBe('Tennis')
    expect(r[0].kind).toBe('activity')
  })
})
