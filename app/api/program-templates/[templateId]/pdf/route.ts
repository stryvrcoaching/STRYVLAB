import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { generateProgramPdf } from '@/lib/pdf/program'
import {
  buildProgramPdfFilename,
  getTemplatePdfData,
} from '@/lib/program-pdf/server'

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string } },
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const data = await getTemplatePdfData(params.templateId, user)
    const includeTracking = req.nextUrl.searchParams.get('tracking') === '1'
    const pdfBuffer = await generateProgramPdf(data, { includeTracking })
    const filename = buildProgramPdfFilename(data)
    const disposition = req.nextUrl.searchParams.get('download') === '1'
      ? `attachment; filename="${filename}"`
      : `inline; filename="${filename}"`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Impossible de générer le PDF' }, { status: 400 })
  }
}
