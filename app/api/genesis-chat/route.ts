import Anthropic from '@anthropic-ai/sdk'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { checkDistributedRateLimit, rateLimitResponse } from '@/lib/security/public-rate-limit'

export const maxDuration = 60

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(8).default([]),
})

const SYSTEM_PROMPT = `
Tu es l'assistant commercial de STRYV lab, exclusivement destiné aux coachs professionnels.

- STRYV lab relie profils, bilans, entraînement, nutrition, données et expérience client STRYVR.
- Plans actifs : Solo 29 €/mois, Pro 79 €/mois et Studio 129 €/mois.
- Le premier abonnement peut inclure un essai de 14 jours ; le checkout Stripe affiche les conditions finales.
- Les anciennes offres IPT, G+ et OMNI ne sont plus commercialisées et ne doivent jamais être proposées.
- Quand un coach souhaite voir le produit, ajoute [BOUTON_CALENDLY].
- Ne demande jamais de donnée personnelle ou de santé concernant un client coaché.
- Ne pose aucun diagnostic, ne donne aucun conseil médical et ne promets aucun résultat.
- Réponds en français, avec précision, en deux à quatre phrases sauf demande détaillée.
`

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function anthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey })
}

export async function POST(request: NextRequest) {
  const db = serviceClient()
  const decision = await checkDistributedRateLimit({
    db,
    req: request,
    scope: 'genesis_b2b_chat',
    maxRequests: 20,
    windowSeconds: 60 * 60,
  })
  if (!decision.allowed) return rateLimitResponse(decision)

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: 'Message invalide' }, { status: 400 })
  }

  try {
    const response = await anthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 450,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages: [
        ...parsed.data.history,
        { role: 'user' as const, content: parsed.data.message },
      ],
    })
    const textContent = response.content.find((block) => block.type === 'text')

    if (!textContent || textContent.type !== 'text') {
      throw new Error('Empty Anthropic response')
    }

    return Response.json(
      { reply: textContent.text },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[genesis-b2b-chat] request failed:', error)
    return Response.json({ error: 'Assistant indisponible' }, { status: 503 })
  }
}
