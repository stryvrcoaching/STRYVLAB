import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return routeFiles(path)
    return entry.name === 'route.ts' ? [path] : []
  })
}

describe('service-role client routes', () => {
  it('declare an explicit coach-to-client ownership guard', () => {
    const root = join(process.cwd(), 'app/api/clients')
    const ownershipMarkers = [
      'coachOwnsClient',
      'resolveClientResourceAccess',
      'resolveClientAccessRole',
      'assertCoachOwnsClient',
      'verifySubmissionOwnership',
      'resolveProtocol',
      'getNutritionProtocolPdfData',
      ".eq('coach_id', user.id)",
      '.eq("coach_id", user.id)',
    ]

    const missingGuard = routeFiles(root).filter((path) => {
      const source = readFileSync(path, 'utf8')
      if (!source.includes('SUPABASE_SERVICE_ROLE_KEY') || !source.includes('clientId')) return false
      return !ownershipMarkers.some((marker) => source.includes(marker))
    })

    expect(missingGuard).toEqual([])
  })
})
