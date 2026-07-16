import { NextRequest, NextResponse } from 'next/server'

function isSupabaseAuthActionUrl(value: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false

  try {
    const target = new URL(value)
    const supabase = new URL(supabaseUrl)
    return target.origin === supabase.origin && target.pathname.startsWith('/auth/v1/')
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const target = formData.get('target')

  if (typeof target !== 'string' || !isSupabaseAuthActionUrl(target)) {
    return NextResponse.redirect(new URL('/client/login?error=link_expired', request.url), 303)
  }

  return NextResponse.redirect(target, 303)
}
