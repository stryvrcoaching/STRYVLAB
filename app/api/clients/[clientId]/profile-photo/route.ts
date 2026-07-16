import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientResourceAccess } from '@/lib/security/client-resource-access'

const clientIdSchema = z.string().uuid()

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: Request,
  { params }: { params: { clientId: string } },
) {
  const parsedClientId = clientIdSchema.safeParse(params.clientId)
  if (!parsedClientId.success) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 404 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = serviceClient()
  const access = await resolveClientResourceAccess({
    db,
    userId: user.id,
    clientId: parsedClientId.data,
  })
  if (!access) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 404 })
  }

  const { data: image, error } = await db.storage
    .from('profile-photos')
    .download(`${access.clientId}/avatar`)

  if (error || !image) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 404 })
  }

  return new NextResponse(await image.arrayBuffer(), {
    headers: {
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline',
      'Content-Type': image.type || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
