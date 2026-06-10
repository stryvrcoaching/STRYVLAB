import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  description: z.string().min(1).max(1000),
  submissionToken: z.string().optional(),
  submissionId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { description, submissionToken, submissionId } = body.data

  // Auth: token public OU session coach
  const supabase = await createClient()

  if (submissionToken) {
    const { data: sub } = await supabase
      .from('assessment_submissions')
      .select('id, token_expires_at')
      .eq('token', submissionToken)
      .single()
    if (!sub) return NextResponse.json({ error: 'Token invalide' }, { status: 401 })
    if (sub.token_expires_at && new Date(sub.token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expiré' }, { status: 401 })
    }
  } else if (submissionId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: sub } = await supabase
      .from('assessment_submissions')
      .select('coach_id')
      .eq('id', submissionId)
      .single()
    if (!sub || sub.coach_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
  } else {
    // Fallback: vérifie simplement qu'une session coach existe
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en nutrition sportive.
Analyse la description d'un repas et retourne UNIQUEMENT un objet JSON valide, sans markdown ni explication :
{"kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number}
Règles : valeurs entières, estimation réaliste pour des portions standards françaises.
Si la description est vague, donne une estimation conservatrice. Ne retourne jamais null.`,
        },
        {
          role: 'user',
          content: description,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    const parsed = JSON.parse(raw) as {
      kcal: number
      protein_g: number
      carbs_g: number
      fat_g: number
    }

    if (
      typeof parsed.kcal !== 'number' ||
      typeof parsed.protein_g !== 'number' ||
      typeof parsed.carbs_g !== 'number' ||
      typeof parsed.fat_g !== 'number'
    ) {
      throw new Error('Malformed GPT response')
    }

    return NextResponse.json({
      kcal: Math.round(parsed.kcal),
      protein_g: Math.round(parsed.protein_g),
      carbs_g: Math.round(parsed.carbs_g),
      fat_g: Math.round(parsed.fat_g),
    })
  } catch {
    return NextResponse.json({ error: 'Analyse impossible — réessayez' }, { status: 500 })
  }
}
