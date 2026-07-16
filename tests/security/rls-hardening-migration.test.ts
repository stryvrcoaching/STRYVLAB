import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('assignment and priority RLS hardening migration', () => {
  it('enables RLS and revokes anonymous access on every exposed table', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260715183000_assignment_and_priority_rls.sql'),
      'utf8',
    )
    const tables = [
      'client_nutrition_protocol_assignments',
      'client_workout_program_assignments',
      'coach_client_priority_states',
    ]

    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
      expect(sql).toContain(`REVOKE ALL ON TABLE public.${table} FROM anon;`)
    }

    expect(sql).toContain('client.user_id = auth.uid()')
    expect(sql).toContain('client.coach_id = auth.uid()')
  })
})
