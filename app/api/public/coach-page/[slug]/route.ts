import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { CoachPagePublicData } from '@/types/coach-page';

// ─── GET /api/public/coach-page/[slug] ────────────────────────────────────────
// Public (no auth required). Returns full page data for rendering.
// Service role + minimal projection: coach_profiles has no anon public SELECT.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch page
  const { data: page, error: pageError } = await supabase
    .from('coach_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (pageError || !page) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch sections
  const { data: sections } = await supabase
    .from('coach_page_sections')
    .select('*')
    .eq('page_id', page.id)
    .eq('is_enabled', true)
    .order('position', { ascending: true });

  // Fetch formulas shown on page
  const { data: formulas } = await supabase
    .from('coach_formulas')
    .select('id, name, description, price_eur, billing_cycle, duration_months, features, color, show_on_page')
    .eq('coach_id', page.coach_id)
    .eq('show_on_page', true)
    .eq('is_active', true);

  // Fetch minimal coach profile
  const { data: profile } = await supabase
    .from('coach_profiles')
    .select('full_name, brand_name, logo_url')
    .eq('coach_id', page.coach_id)
    .maybeSingle();

  const data: CoachPagePublicData = {
    page,
    sections: sections ?? [],
    formulas: (formulas ?? []).map((f) => ({
      ...f,
      features: Array.isArray(f.features) ? f.features : [],
    })),
    profile: {
      full_name: profile?.full_name,
      brand_name: profile?.brand_name,
      logo_url: profile?.logo_url,
    },
  };

  return NextResponse.json(data, {
    headers: {
      // Allow CDN caching for public pages (1 min stale, 5 min cache)
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
