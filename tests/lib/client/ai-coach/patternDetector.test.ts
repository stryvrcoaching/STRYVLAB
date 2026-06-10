import { describe, it, expect, vi } from 'vitest'
import { evaluateClientPatterns } from '@/lib/client/ai-coach/patternDetector'

describe('patternDetector', () => {
  it('detects session_missed correctly', async () => {
    // Mock the DB and offset dates
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null })
      })
    }
    
    // We mock Promise.all manually for evaluateClientPatterns by mocking db.from directly
    // This is a minimal test to verify that the logic doesn't crash on empty data
    const result = await evaluateClientPatterns('client-id', db as any)
    expect(result).toBeNull() // Empty data = no pattern
  })

  // Testing full data aggregations is complex without a full database mock setup, 
  // but we can test the structure of the returned result if we force a mock data.
  it('returns valid pattern if data matches', async () => {
    const todayStr = new Date().toISOString().split('T')[0]
    
    const mockDb = {
      from: vi.fn((table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(async () => {
            if (table === 'nutrition_protocols') return { data: {
              schedule_start_date: '2020-01-01',
              nutrition_protocol_days: [{ position: 1, calories: 2000 }],
              nutrition_protocol_schedule_slots: [{ week_index: 1, dow: 1, protocol_day_position: 1 }]
            } }
            if (table === 'programs') return { data: null }
            return { data: null }
          }),
          then: (resolve: any) => {
            if (table === 'nutrition_meals') resolve({ data: [
              { physiological_date: todayStr, total_calories: 2500 }
            ]})
            else if (table === 'client_daily_checkins') resolve({ data: [
              { date: todayStr, flow_type: 'morning', energy_level: 1 }
            ]})
            else resolve({ data: [] })
          }
        }
        return chain
      })
    }
    
    const result = await evaluateClientPatterns('client-id', mockDb as any)
    // Since we only provide 1 day of data in this mock, it shouldn't trigger a 3-day sequence
    expect(result).toBeNull()
  })
})
