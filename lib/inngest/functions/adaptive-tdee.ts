import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcAdaptiveTdee } from '@/lib/nutrition/adaptiveTdee'
import { collectWeightSamples, collectAvgIntake, collectClientSignals } from '@/lib/nutrition/weightSamples'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Nightly at 04:00 UTC — processes only protocols with tdee_auto_enabled = true.
// NEVER rescales protocol days automatically — only records the new TDEE and
// notifies the coach. The coach must confirm via PUT /apply-adaptive-tdee.
export const adaptiveTdeeFunction = inngest.createFunction(
  {
    id: 'nutrition-adaptive-tdee-nightly',
    retries: 2,
    triggers: [{ cron: '0 4 * * *' }],
  },
  async ({ step }: { step: any }) => {
    const protocols = await step.run('fetch-auto-protocols', async () => {
      const db = svc()
      const { data, error } = await db
        .from('nutrition_protocols')
        .select('id, client_id, coach_id, name, tdee_reference, nutrition_protocol_days(id, calories, position)')
        .eq('status', 'shared')
        .eq('tdee_auto_enabled', true)
      if (error) throw new Error(`fetch-auto-protocols: ${error.message}`)
      return data ?? []
    })

    const results = await Promise.allSettled(
      (protocols as any[]).map((protocol) =>
        step.run(`process-protocol-${protocol.id}`, async () => {
          const db = svc()
          const clientId: string = protocol.client_id
          const protocolId: string = protocol.id
          const coachId: string = protocol.coach_id
          const protocolName: string = protocol.name ?? ''
          const days: any[] = protocol.nutrition_protocol_days ?? []

          const day1Cal = [...days].sort((a, b) => a.position - b.position)[0]?.calories ?? 2000
          const tdeeReference: number = protocol.tdee_reference ?? day1Cal

          const { samples: weightSamples, windowDays, tooShort, anchoredToProtocol } =
            await collectWeightSamples(db, clientId, 14, 4, protocolName)

          if (tooShort) {
            return { skipped: true, reason: 'window_too_short_since_protocol_start', windowDays, protocolId }
          }

          if (weightSamples.length < 2) {
            return { skipped: true, reason: 'insufficient_weight_samples', protocolId, weightSamples: weightSamples.length }
          }

          const cutoffDate = (() => {
            const d = new Date()
            d.setDate(d.getDate() - windowDays)
            return d.toISOString().slice(0, 10)
          })()

          const [{ avgIntakeKcal, caloriesSource, trackedDays }, { gender, cyclePhases, cycleConfidence }] =
            await Promise.all([
              collectAvgIntake(db, clientId, windowDays, tdeeReference),
              collectClientSignals(db, clientId, cutoffDate),
            ])

          const result = calcAdaptiveTdee({
            weightSamples,
            avgIntakeKcal,
            caloriesSource,
            windowDays,
            trackedDays,
            gender: gender as any,
            cyclePhases,
            cycleConfidence,
            anchoredToProtocol,
          })

          if (result.confidence === 'low') {
            return { skipped: true, reason: 'low_confidence', confidenceScore: result.confidenceScore, protocolId }
          }

          const deltaKcal = result.tdeeAdaptive - tdeeReference

          // Record history — protocol_updated always false (coach confirms manually)
          await db.from('nutrition_tdee_history').insert({
            protocol_id:        protocolId,
            client_id:          clientId,
            tdee_formula:       tdeeReference,
            tdee_adaptive:      result.tdeeAdaptive,
            delta_kcal:         deltaKcal,
            weight_samples:     weightSamples.length,
            calories_source:    caloriesSource,
            avg_intake_kcal:    avgIntakeKcal,
            weight_delta_kg:    result.weightDeltaKg,
            protocol_updated:   false,
            confidence:         result.confidence,
            confidence_score:   result.confidenceScore,
            confidence_reasons: result.confidenceReasons,
          })

          // Update tdee_adaptive on protocol (display value) — but DO NOT rescale days
          await db.from('nutrition_protocols').update({
            tdee_adaptive:    result.tdeeAdaptive,
            tdee_adaptive_at: new Date().toISOString(),
            tdee_data_source: caloriesSource === 'protocol' ? 'formula_proxy' : 'weight_delta',
          }).eq('id', protocolId)

          // Only notify if delta is meaningful
          if (Math.abs(deltaKcal) < 100) {
            return { recorded: true, reason: 'delta_below_notification_threshold', deltaKcal, protocolId }
          }

          const { data: clientRow } = await db
            .from('coach_clients')
            .select('first_name')
            .eq('id', clientId)
            .single()
          const firstName = (clientRow as any)?.first_name ?? 'Client'
          const sign = deltaKcal > 0 ? '+' : ''

          // Notify coach — they need to review and confirm applying the new TDEE
          await db.from('coach_client_notifications').insert({
            coach_id:   coachId,
            client_id:  clientId,
            type:       'tdee_coach_alert',
            title:      `TDEE ${firstName} recalculé — action requise`,
            body:       `Nouveau TDEE : ${result.tdeeAdaptive} kcal (${sign}${deltaKcal} vs référence). Confirmez l'application dans Nutrition Studio.`,
            payload:    { action_url: `/coach/clients/${clientId}/protocoles/nutrition` },
          })

          return {
            recorded:    true,
            protocolId,
            tdeeAdaptive: result.tdeeAdaptive,
            deltaKcal,
            windowDays,
            weightSamples: weightSamples.length,
          }
        })
      )
    )

    return { processed: (protocols as any[]).length, results: results.map(r => r.status) }
  }
)
