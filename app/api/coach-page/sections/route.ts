import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { CustomSectionItem, CustomSectionsContent, SectionType } from '@/types/coach-page';

const SECTION_TYPES = new Set<SectionType>([
  'hero', 'about', 'formulas', 'gallery', 'testimonials', 'contact', 'custom',
]);
const MAX_CUSTOM_SECTIONS = 5;

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.slice(0, max);
}

function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && values.includes(value as T)
    ? (value as T)
    : fallback;
}

function externalUrl(value: unknown): string | undefined {
  const raw = text(value, 2048)?.trim();
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeCustomContent(value: unknown): CustomSectionsContent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rawItems = (value as { items?: unknown }).items;
  if (rawItems === undefined) return { items: [] };
  if (!Array.isArray(rawItems) || rawItems.length > MAX_CUSTOM_SECTIONS) return null;

  const seen = new Set<string>();
  const items: CustomSectionItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    const id = text(item.id, 80);
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || seen.has(id)) return null;
    seen.add(id);
    items.push({
      id,
      is_enabled: item.is_enabled !== false,
      eyebrow: text(item.eyebrow, 80),
      title: text(item.title, 120),
      text: text(item.text, 2000),
      photo_url: externalUrl(item.photo_url),
      photo_frame: oneOf(item.photo_frame, ['circle', 'rounded', 'square', 'portrait_4_5', 'portrait_3_4', 'landscape_16_9', 'landscape_3_2', 'soft'] as const, 'rounded'),
      image_position: oneOf(item.image_position, ['left', 'right', 'top', 'hidden'] as const, 'right'),
      text_align: oneOf(item.text_align, ['left', 'center'] as const, 'left'),
      surface_style: oneOf(item.surface_style, ['plain', 'card'] as const, 'plain'),
      spacing: oneOf(item.spacing, ['compact', 'regular', 'generous'] as const, 'regular'),
      cta_label: text(item.cta_label, 50),
      cta_url: externalUrl(item.cta_url),
    });
  }
  return { items };
}

// ─── PUT /api/coach-page/sections ─────────────────────────────────────────────
// Upsert a single section (content + enabled state).
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, is_enabled, content, position } = body;

  if (!type || !SECTION_TYPES.has(type as SectionType)) {
    return NextResponse.json({ error: 'Missing section type' }, { status: 400 });
  }
  if (is_enabled !== undefined && typeof is_enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
  }
  if (position !== undefined && (!Number.isInteger(position) || position < 0 || position > 20)) {
    return NextResponse.json({ error: 'Invalid section position' }, { status: 400 });
  }

  const normalizedContent = type === 'custom' && content !== undefined
    ? normalizeCustomContent(content)
    : content;
  if (type === 'custom' && content !== undefined && !normalizedContent) {
    return NextResponse.json({ error: 'Invalid custom sections content' }, { status: 400 });
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

  const { data: section, error } = await supabase
    .from('coach_page_sections')
    .upsert(
      {
        coach_id: user.id,
        page_id: page.id,
        type,
        ...(is_enabled !== undefined && { is_enabled }),
        ...(content !== undefined && { content: normalizedContent }),
        ...(position !== undefined && { position }),
      },
      { onConflict: 'page_id,type' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ section });
}
