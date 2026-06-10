// @deprecated — use /api/client/chat/messages instead (Chat Release 1 Bloc D)
// 308 Permanent Redirect — clients qui cachent les redirects ne réessaient pas (acceptable route interne)
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL('/api/client/chat/messages', req.url), 308)
}
