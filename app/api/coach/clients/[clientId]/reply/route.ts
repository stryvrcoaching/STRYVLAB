import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({
  content: z.string().min(1).max(2000),
})

// POST /api/coach/clients/[clientId]/reply
// Insère un message de réponse du coach dans chat_messages (from_coach_human=true)
// et résout toutes les notifications pending associées au client
export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const db = service()

  // Vérifier que ce client appartient bien au coach
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  // Insérer le message du coach dans le chat client
  const { data: message, error: msgError } = await db
    .from('chat_messages')
    .insert({
      client_id:        params.clientId,
      role:             'assistant',
      content:          body.data.content,
      message_type:     'text',
      from_coach_human: true,
    })
    .select('id, role, content, message_type, from_coach_human, created_at')
    .single()

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 })

  // Résoudre toutes les notifications pending pour ce client
  await db
    .from('coach_notifications')
    .update({ status: 'resolved', updated_at: new Date().toISOString() })
    .eq('coach_id', user.id)
    .eq('client_id', params.clientId)
    .eq('status', 'pending')

  return NextResponse.json({ message }, { status: 201 })
}
