import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { generateNutritionProtocolPdf } from '@/lib/pdf/nutrition-protocol'
import {
  buildNutritionProtocolPdfFilename,
  getNutritionProtocolPdfData,
} from '@/lib/nutrition-protocol-pdf/server'
import { sendNutritionProtocolPdfEmail } from '@/lib/email/mailer'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'

const bodySchema = z.object({
  message: z.string().max(5000).optional().nullable(),
  includeTracking: z.boolean().optional(),
})

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ protocolId: string }> },
) {
  const { protocolId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
  }

  try {
    const data = await getNutritionProtocolPdfData(protocolId, user)
    if (!data.client?.email) {
      return NextResponse.json({ error: "Ce client n'a pas d'adresse email." }, { status: 400 })
    }

    const pdfBuffer = await generateNutritionProtocolPdf(data)
    const filename = buildNutritionProtocolPdfFilename(data)

    await sendNutritionProtocolPdfEmail({
      to: data.client.email,
      clientFirstName: data.client.firstName || 'Client',
      coachName: data.coach.name,
      protocolName: data.title,
      customMessage: parsed.data.message ?? null,
      pdfBuffer,
      filename,
      fromName: data.coach.name,
    })

    if (data.client?.id) {
      await createClientAppNotification(service(), {
        clientId: data.client.id,
        coachId: user.id,
        type: 'program_updated',
        copyKey: 'nutrition.available',
        actionUrl: '/client/nutrition',
        pushKind: 'program',
        pushTag: `stryv-nutrition-pdf-share-${protocolId}`,
        payload: { protocol_id: protocolId },
      })
    }

    return NextResponse.json({ sent: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Impossible d’envoyer le PDF' }, { status: 400 })
  }
}
