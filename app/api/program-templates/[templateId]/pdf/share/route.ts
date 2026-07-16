import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { generateProgramPdf } from '@/lib/pdf/program'
import {
  buildProgramPdfFilename,
  getShareableTemplateRecipients,
  getTemplatePdfData,
} from '@/lib/program-pdf/server'
import { sendProgramPdfEmail } from '@/lib/email/mailer'

const bodySchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1),
  message: z.string().max(5000).optional().nullable(),
  includeTracking: z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string } },
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Destinataires invalides' }, { status: 400 })
  }

  try {
    const data = await getTemplatePdfData(params.templateId, user)
    const recipients = await getShareableTemplateRecipients(user, parsed.data.clientIds)
    const validRecipients = recipients.filter((recipient) => recipient.email)

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: 'Aucun client avec email valide sélectionné.' }, { status: 400 })
    }

    const pdfBuffer = await generateProgramPdf(data, {
      includeTracking: parsed.data.includeTracking === true,
    })
    const filename = buildProgramPdfFilename(data)

    const results = await Promise.allSettled(
      validRecipients.map((recipient) =>
        sendProgramPdfEmail({
          to: recipient.email!,
          clientFirstName: recipient.firstName || 'Client',
          coachName: data.coach.name,
          programName: data.title,
          customMessage: parsed.data.message ?? null,
          pdfBuffer,
          filename,
          fromName: data.coach.name,
        }),
      ),
    )

    const sent = results.filter((result) => result.status === 'fulfilled').length
    const failed = results.length - sent

    if (sent === 0) {
      return NextResponse.json({ error: 'Envoi impossible pour les clients sélectionnés.' }, { status: 500 })
    }

    return NextResponse.json({
      sent,
      failed,
      partial: failed > 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Impossible d’envoyer le PDF' }, { status: 400 })
  }
}
