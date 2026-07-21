import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()

describe('client engagement reminder scheduling', () => {
  it('registers the five-minute client reminder function with Inngest', () => {
    const functionSource = readFileSync(
      resolve(root, 'lib/inngest/functions/client-engagement-reminders.ts'),
      'utf8',
    )
    const routeSource = readFileSync(resolve(root, 'app/api/inngest/route.ts'), 'utf8')

    expect(functionSource).toContain("id: 'client-engagement-reminders'")
    expect(functionSource).toContain("cron: '*/5 * * * *'")
    expect(routeSource).toContain('clientEngagementRemindersFunction')
  })
})
