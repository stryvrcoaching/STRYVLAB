// app/api/morpho/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildAnalysisPrompt } from '@/lib/morpho/buildAnalysisPrompt'
import { calculateStimulusAdjustments } from '@/lib/morpho/adjustments'
import { isMorphoV2 } from '@/lib/morpho/types'
import type { MorphoAnalysisResult, MorphoAnalysisResultV2 } from '@/lib/morpho/types'
import { checkDistributedRateLimit, rateLimitResponse } from '@/lib/security/public-rate-limit'

export const maxDuration = 60

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1).max(4),
  clientId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 })
  }

  const { photoIds, clientId } = body.data
  const db = service()

  // Vérifier ownership
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id, goal, fitness_level, date_of_birth, gender')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const rateLimit = await checkDistributedRateLimit({
    db,
    req,
    scope: 'coach_morpho_analyze',
    subject: user.id,
    maxRequests: 5,
    windowSeconds: 60 * 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  // Récupérer les photos et leurs storage_path + source
  const { data: photos } = await db
    .from('morpho_photos')
    .select('id, storage_path, source, position, client_id')
    .in('id', photoIds)
    .eq('client_id', clientId)

  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: 'Photos introuvables' }, { status: 404 })
  }

  // Générer les signed URLs selon la source
  const signedUrls: string[] = []
  for (const photo of photos as Array<{ id: string; storage_path: string; source: string; position: string }>) {
    const bucket = photo.source === 'assessment' ? 'assessment-photos' : 'morpho-photos'
    const { data: signed } = await db.storage
      .from(bucket)
      .createSignedUrl(photo.storage_path, 600)
    if (signed?.signedUrl) signedUrls.push(signed.signedUrl)
  }

  if (signedUrls.length === 0) {
    return NextResponse.json({ error: 'Impossible de générer les URLs photos' }, { status: 500 })
  }

  // Récupérer le contexte biométrique client
  const { data: latestSubmission } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .order('bilan_date', { ascending: false })
    .limit(1)
    .single()

  let weight_kg: number | undefined
  let height_cm: number | undefined
  let body_fat_pct: number | undefined

  if (latestSubmission) {
    const { data: bioResponses } = await db
      .from('assessment_responses')
      .select('field_key, value_number')
      .eq('submission_id', (latestSubmission as { id: string }).id)
      .in('field_key', ['weight_kg', 'height_cm', 'body_fat_pct'])

    for (const r of (bioResponses ?? []) as Array<{ field_key: string; value_number: string | null }>) {
      if (r.value_number == null) continue
      if (r.field_key === 'weight_kg') weight_kg = parseFloat(r.value_number)
      if (r.field_key === 'height_cm') height_cm = parseFloat(r.value_number)
      if (r.field_key === 'body_fat_pct') body_fat_pct = parseFloat(r.value_number)
    }
  }

  // Récupérer les blessures connues
  const { data: injuryAnnotations } = await db
    .from('metric_annotations')
    .select('label')
    .eq('client_id', clientId)
    .eq('event_type', 'injury')
    .not('body_part', 'is', null)

  const injuries = (injuryAnnotations ?? []).map((a: { label: string }) => a.label).filter(Boolean)

  const client = clientRow as {
    goal?: string; fitness_level?: string;
    date_of_birth?: string; gender?: string
  }

  const age = client.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : undefined

  const photoPositions = (photos as Array<{ position: string }>).map(p => p.position)

  const prompt = buildAnalysisPrompt({
    age,
    sex: client.gender as 'male' | 'female' | 'other' | undefined,
    goal: client.goal ?? undefined,
    weight_kg,
    height_cm,
    body_fat_pct,
    injuries,
    photo_positions: photoPositions,
  })

  // Appel OpenAI GPT-4o
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY manquant' }, { status: 500 })
  }

  const openai = new OpenAI({ apiKey })

  const imageContent = signedUrls.map(url => ({
    type: 'image_url' as const,
    image_url: { url, detail: 'high' as const },
  }))

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 3000,
    temperature: 0.2,
  })

  const raw = completion.choices[0]?.message?.content
  if (!raw) {
    return NextResponse.json({ error: 'Pas de réponse OpenAI' }, { status: 500 })
  }

  let analysisResult: MorphoAnalysisResult | MorphoAnalysisResultV2
  try {
    analysisResult = JSON.parse(raw) as MorphoAnalysisResult | MorphoAnalysisResultV2
  } catch {
    return NextResponse.json({ error: 'Réponse OpenAI non parseable' }, { status: 500 })
  }

  const isV2 = isMorphoV2(analysisResult)
  const v2 = isV2 ? (analysisResult as MorphoAnalysisResultV2) : null

  // Calculer stimulus_adjustments — v2 utilise les segments biomech
  const stimulusAdjustments = calculateStimulusAdjustments(
    {
      asymmetries: {
        arm_diff_cm: analysisResult.asymmetries.arm_diff_cm ?? undefined,
        shoulder_imbalance_cm: analysisResult.asymmetries.shoulder_imbalance_cm ?? undefined,
      },
      biomech: v2?.biomech
        ? {
            segments: v2.biomech.segments,
            postural_syndromes: v2.biomech.postural_syndromes,
            chain_assessment: v2.biomech.chain_assessment,
          }
        : undefined,
    },
    { height_cm }
  )

  // Sauvegarder dans morpho_analyses
  const today = new Date().toISOString().split('T')[0]
  const { data: savedAnalysis, error: saveError } = await db
    .from('morpho_analyses')
    .insert({
      client_id: clientId,
      analysis_date: today,
      status: 'completed',
      photo_ids: photoIds,
      analysis_result: analysisResult,
      asymmetries: {
        shoulder_imbalance_cm: analysisResult.asymmetries.shoulder_imbalance_cm,
        arm_diff_cm: analysisResult.asymmetries.arm_diff_cm,
        hip_imbalance_cm: analysisResult.asymmetries.hip_imbalance_cm,
        posture_notes: analysisResult.asymmetries.posture_notes,
      },
      stimulus_adjustments: stimulusAdjustments,
      biomech_profile: v2?.biomech ?? null,
      prompt_version: isV2 ? (v2!.meta.prompt_version) : 'v1',
      raw_payload: { prompt_response: raw },
      analyzed_by: user.id,
    })
    .select('id')
    .single()

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }

  return NextResponse.json({
    analysis_id: (savedAnalysis as { id: string }).id,
    analysis_result: analysisResult,
    stimulus_adjustments: stimulusAdjustments,
    prompt_version: isV2 ? v2!.meta.prompt_version : 'v1',
  })
}
