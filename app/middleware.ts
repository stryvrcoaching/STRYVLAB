import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 🔒 protéger l’analyse IPT réelle
  if (pathname.startsWith('/ipt/run')) {
    const access = request.cookies.get('stryv_access')?.value;

    if (!access) {
      const url = request.nextUrl.clone();
      url.pathname = '/ipt/pre-analyse';
      url.searchParams.set('mode', 'ipt');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/ipt/run/:path*'],
};
