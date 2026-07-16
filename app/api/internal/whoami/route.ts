import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { resolveInternalProductFeedbackAccess } from '@/lib/auth/internal-product-feedback-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const access = resolveInternalProductFeedbackAccess({
    userId: user.id,
    email: user.email,
  })

  return NextResponse.json({
    userId: user.id,
    email: user.email ?? null,
    productFeedbackAccess: access,
  })
}
