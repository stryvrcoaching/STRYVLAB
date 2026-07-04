import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { generateNutritionProtocolPdf } from '@/lib/pdf/nutrition-protocol'
import {
  buildNutritionProtocolPdfFilename,
  getNutritionProtocolPdfData,
} from '@/lib/nutrition-protocol-pdf/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ protocolId: string }> },
) {
  const { protocolId } = await params
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const data = await getNutritionProtocolPdfData(protocolId, user)
    const pdfBuffer = await generateNutritionProtocolPdf(data)
    const filename = buildNutritionProtocolPdfFilename(data)
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
