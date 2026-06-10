import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { parseCsvText, autoDetectMappings, buildPreview } from '@/lib/csv-import/detect'

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const text = await file.text()
  const parsed = parseCsvText(text)

  if (parsed.columns.length === 0) {
    return NextResponse.json({ error: 'Fichier vide ou illisible' }, { status: 400 })
  }

  const mappings = autoDetectMappings(parsed.columns)
  const preview = buildPreview(parsed, mappings).slice(0, 5)

  return NextResponse.json({
    columns: parsed.columns,
    dateColumnIndex: parsed.dateColumnIndex,
    mappings,
    preview,
    totalRows: buildPreview(parsed, mappings).length,
  })
}
