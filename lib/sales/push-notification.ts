import type { SupabaseClient } from '@supabase/supabase-js'

type SalesPushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  badgeCount?: number
}

export async function sendSalesPartnerPush(
  db: SupabaseClient,
  partnerId: string,
  payload: SalesPushPayload,
): Promise<boolean> {
  const { data: partner, error: partnerError } = await db
    .from('sales_partners')
    .select('push_token')
    .eq('id', partnerId)
    .maybeSingle()

  if (partnerError || !partner?.push_token) {
    if (partnerError) console.error('[sales-push] lookup failed:', partnerError)
    return false
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    console.error('[sales-push] VAPID configuration missing')
    return false
  }

  try {
    const webpush = await import('web-push').then((module) => module.default ?? module)
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    await webpush.sendNotification(
      JSON.parse(partner.push_token),
      JSON.stringify(payload),
    )
    return true
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    console.error('[sales-push] send failed', {
      partnerId,
      statusCode,
      message: error instanceof Error ? error.message : String(error),
    })
    if (statusCode === 404 || statusCode === 410 || error instanceof SyntaxError) {
      await db.from('sales_partners').update({ push_token: null }).eq('id', partnerId)
    }
    return false
  }
}
