import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { SectionType } from '@/types/coach-page';

// ─── GET /api/coach-page ──────────────────────────────────────────────────────
// Returns the authenticated coach's page + sections.
// Creates a default page if none exists yet.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch or create coach page
  let { data: page, error } = await supabase
    .from('coach_pages')
    .select('*')
    .eq('coach_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Auto-create if first visit
  if (!page) {
    // Generate a slug from coach profile
    const { data: profile } = await supabase
      .from('coach_profiles')
      .select('full_name, brand_name')
      .eq('coach_id', user.id)
      .maybeSingle();

    const baseName = profile?.brand_name || profile?.full_name || user.email?.split('@')[0] || 'mon-coaching';
    const slug = await generateUniqueSlug(supabase, baseName);

    const { data: newPage, error: createError } = await supabase
      .from('coach_pages')
      .insert({
        coach_id: user.id,
        slug,
        is_published: false,
        accent_color: '#1f8a65',
        font_choice: 'lufga',
        bg_choice: 'dark',
      })
      .select()
      .single();

    if (createError || !newPage) {
      return NextResponse.json({ error: createError?.message ?? 'Create failed' }, { status: 500 });
    }

    // Create default sections
    const defaultSections: SectionType[] = ['hero', 'about', 'formulas', 'gallery', 'testimonials', 'custom', 'contact'];
    await supabase.from('coach_page_sections').insert(
      defaultSections.map((type, i) => ({
        coach_id: user.id,
        page_id: newPage.id,
        type,
        is_enabled: ['hero', 'about', 'contact'].includes(type),
        position: i,
        content: {},
      }))
    );

    page = newPage;
  }

  // Fetch sections
  const { data: sections } = await supabase
    .from('coach_page_sections')
    .select('*')
    .eq('page_id', page.id)
    .order('position', { ascending: true });

  return NextResponse.json({ page, sections: sections ?? [] });
}

// ─── PUT /api/coach-page ──────────────────────────────────────────────────────
// Updates page settings (slug, accent, font, bg, published, private).
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { slug, accent_color, font_choice, bg_choice, is_published, is_private } = body;

  // Validate slug uniqueness if changing
  if (slug) {
    const { data: existing } = await supabase
      .from('coach_pages')
      .select('id, coach_id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing && existing.coach_id !== user.id) {
      return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
    }
  }

  const { data: updated, error } = await supabase
    .from('coach_pages')
    .update({
      ...(slug !== undefined && { slug }),
      ...(accent_color !== undefined && { accent_color }),
      ...(font_choice !== undefined && { font_choice }),
      ...(bg_choice !== undefined && { bg_choice }),
      ...(is_published !== undefined && { is_published }),
      ...(is_private !== undefined && { is_private }),
    })
    .eq('coach_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ page: updated });
}

// ─── Helper ────────────────────────────────────────────────────────────────────
async function generateUniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, base: string): Promise<string> {
  const clean = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  let slug = clean;
  let attempt = 0;
  while (true) {
    const { data } = await supabase.from('coach_pages').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    attempt++;
    slug = `${clean}-${attempt}`;
  }
}
