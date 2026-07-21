import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { CoachPageRenderer } from "@/components/coach-page/CoachPageRenderer";
import { CoachPageTracker } from "@/components/coach-page/CoachPageTracker";
import type {
  CoachPagePublicData,
  HeroContent,
} from "@/types/coach-page";
import { resolveHeroDisplayName } from "@/types/coach-page";

/**
 * Service-role client for public page reads only.
 * Avoids anon RLS gaps (e.g. coach_profiles has no public SELECT) while
 * still projecting a minimal public-safe field set.
 */
function createPublicReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env for public coach page");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getCoachPageData(
  slug: string,
): Promise<CoachPagePublicData | null> {
  const supabase = createPublicReadClient();

  const { data: page } = await supabase
    .from("coach_pages")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!page) return null;

  const [{ data: sections }, { data: allFormulas }, { data: profile }] =
    await Promise.all([
      supabase
        .from("coach_page_sections")
        .select("*")
        .eq("page_id", page.id)
        .eq("is_enabled", true)
        .order("position", { ascending: true }),
      // Load all active formulas — visibility filtered below (show_on_page
      // and/or formula_ids in the formulas section content).
      supabase
        .from("coach_formulas")
        .select(
          "id, name, description, price_eur, billing_cycle, duration_months, features, color, show_on_page",
        )
        .eq("coach_id", page.coach_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("coach_profiles")
        .select("full_name, brand_name, logo_url")
        .eq("coach_id", page.coach_id)
        .maybeSingle(),
    ]);

  const enabledSections = sections ?? [];
  const formulasSection = enabledSections.find((s) => s.type === "formulas");
  const selectedIds = Array.isArray(
    (formulasSection?.content as { formula_ids?: unknown } | null)?.formula_ids,
  )
    ? ((formulasSection?.content as { formula_ids: string[] }).formula_ids ?? [])
    : [];

  const active = (allFormulas ?? []).map((f) => ({
    ...f,
    features: Array.isArray(f.features) ? f.features : [],
  }));

  // Priority: explicit selection in section → show_on_page flags → all active
  // (so a published page never empties while the builder preview still shows formulas)
  let visibleFormulas = active;
  if (selectedIds.length > 0) {
    const selected = active.filter((f) => selectedIds.includes(f.id));
    visibleFormulas = selected.length > 0 ? selected : active.filter((f) => f.show_on_page);
  } else {
    const flagged = active.filter((f) => f.show_on_page);
    visibleFormulas = flagged.length > 0 ? flagged : active;
  }

  return {
    page,
    sections: enabledSections,
    formulas: visibleFormulas,
    profile: {
      full_name: profile?.full_name,
      brand_name: profile?.brand_name,
      logo_url: profile?.logo_url,
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCoachPageData(slug);

  if (!data) {
    return { title: "Page introuvable" };
  }

  const heroSection = data.sections.find((s) => s.type === "hero");
  const content = heroSection?.content as HeroContent | undefined;
  const coachName = resolveHeroDisplayName(content, data.profile, slug);
  const tagline =
    content?.tagline ?? `Coaching personnalisé avec ${coachName}`;
  const ogImage =
    content?.cover_photo_url ||
    content?.profile_photo_url ||
    data.profile.logo_url ||
    undefined;

  return {
    title: `${coachName} | Coaching`,
    description: content?.subtitle?.slice(0, 160) || tagline,
    robots: data.page.is_private
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: coachName,
      description: tagline,
      type: "profile",
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: coachName,
      description: tagline,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function CoachPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCoachPageData(slug);

  if (!data) notFound();

  return (
    <>
      <CoachPageTracker slug={slug} />
      <CoachPageRenderer
        formulas={data.formulas}
        page={data.page}
        profile={data.profile}
        sections={data.sections}
        showFooter
        slug={slug}
      />
    </>
  );
}
