import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { SectionType } from '@/types/coach-page';

// ─── PATCH /api/coach-page/sections/reorder ───────────────────────────────────
// Batch-updates position for all sections.
// Body: { order: SectionType[] }  — full ordered list of section types
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { order }: { order: SectionType[] } = await request.json();

  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: 'Invalid order array' }, { status: 400 });
  }

  // Get the coach's page id
  const { data: page } = await supabase
    .from('coach_pages')
    .select('id')
    .eq('coach_id', user.id)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  // Batch update positions
  const updates = order.map((type, position) =>
    supabase
      .from('coach_page_sections')
      .update({ position })
      .eq('page_id', page.id)
      .eq('type', type)
      .eq('coach_id', user.id)
  );

  const results = await Promise.all(updates);
  const firstError = results.find(r => r.error);
  if (firstError?.error) {
    return NextResponse.json({ error: firstError.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
