// ─── Coach Page Types ──────────────────────────────────────────────────────────
// Shared between the builder (dashboard) and the public render (/p/[slug])

export type FontChoice = 'lufga' | 'barlow' | 'inter';
/** Page background presets — includes light themes for the public mini-site */
export type BgChoice = 'dark' | 'charcoal' | 'slate' | 'light' | 'paper';

export type SectionType =
  | 'hero'
  | 'about'
  | 'formulas'
  | 'gallery'
  | 'testimonials'
  | 'contact'
  /** A container for up to five coach-authored content blocks. */
  | 'custom';

// ─── Section content shapes ────────────────────────────────────────────────────

/** Photo crop / frame shape — see lib/coach-page/photo-frame.ts */
export type PhotoFrameShape =
  | 'circle'
  | 'rounded'
  | 'square'
  | 'portrait_4_5'
  | 'portrait_3_4'
  | 'landscape_16_9'
  | 'landscape_3_2'
  | 'soft';

export type CoverFrameStyle = 'short' | 'medium' | 'tall' | 'hidden';

/** Shared presentation controls for every content-oriented page section. */
export type SectionTextAlign = 'left' | 'center';
export type SectionSurfaceStyle = 'plain' | 'card';
export type SectionSpacing = 'compact' | 'regular' | 'generous';

export interface SectionPresentation {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  text_align?: SectionTextAlign;
  surface_style?: SectionSurfaceStyle;
  spacing?: SectionSpacing;
}

export type AboutMediaPosition = 'left' | 'right' | 'top';

const DEFAULT_SECTION_PRESENTATIONS: Partial<Record<SectionType, SectionPresentation>> = {
  about: { title: 'À propos' },
  formulas: {
    eyebrow: 'Formules',
    title: 'Mes offres de coaching.',
    subtitle: 'Des cadres d’accompagnement clairs, pour choisir le bon niveau d’intensité.',
  },
  gallery: { title: 'Galerie' },
  testimonials: {
    eyebrow: 'Témoignages',
    title: 'Ce qu’ils en disent.',
    subtitle: 'Des retours clients pour donner du contexte — pas des preuves inventées.',
  },
  contact: { title: 'Me contacter', subtitle: 'Choisis le canal le plus simple pour démarrer.' },
};

/**
 * Keeps current pages pleasant before a coach customises their section, while
 * allowing an empty string to deliberately hide any default heading.
 */
export function resolveSectionPresentation(
  type: SectionType,
  value?: SectionPresentation,
): SectionPresentation {
  return { ...(DEFAULT_SECTION_PRESENTATIONS[type] ?? {}), ...(value ?? {}) };
}

export interface HeroContent {
  /**
   * Nom affiché en grand sous la photo (H1).
   * Si vide / absent → repli sur brand_name puis full_name du profil Pro.
   * Personnalisable depuis la config Accueil sans toucher aux paramètres compte.
   */
  display_name?: string;
  tagline?: string;
  subtitle?: string;
  profile_photo_url?: string;
  cover_photo_url?: string;
  /**
   * Opacité de la photo de couverture (0–100).
   * Défaut historique : 30 (équivalent à opacity-30).
   */
  cover_opacity?: number;
  /**
   * Début vertical du fondu bas (0–100 % depuis le haut).
   * Zone au-dessus = photo nette ; en dessous = dégradé vers le fond de page.
   * 100 = pas de fondu (photo entière nette) · défaut 48.
   */
  cover_fade_start?: number;
  /** Cadre photo de profil */
  profile_frame?: PhotoFrameShape;
  /** Hauteur bandeau couverture */
  cover_frame?: CoverFrameStyle;
}

/** Default cover photo opacity (matches former Tailwind `opacity-30`). */
export const DEFAULT_COVER_OPACITY = 30;

/** Default vertical start of the bottom fade (matches former ~48% clear band). */
export const DEFAULT_COVER_FADE_START = 48;

/** Resolve the public H1 name for the hero section. */
export function resolveHeroDisplayName(
  content: Pick<HeroContent, "display_name"> | null | undefined,
  profile: { full_name?: string | null; brand_name?: string | null },
  fallback = "Coach",
): string {
  const custom = content?.display_name?.trim();
  if (custom) return custom;
  const brand = profile.brand_name?.trim();
  if (brand) return brand;
  const full = profile.full_name?.trim();
  if (full) return full;
  return fallback;
}

/** Clamp cover opacity to 0–100 (default 30). */
export function resolveCoverOpacity(
  content: Pick<HeroContent, "cover_opacity"> | null | undefined,
): number {
  const n = content?.cover_opacity;
  if (typeof n !== "number" || Number.isNaN(n)) return DEFAULT_COVER_OPACITY;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Clamp cover fade start to 0–100 (default 48). */
export function resolveCoverFadeStart(
  content: Pick<HeroContent, "cover_fade_start"> | null | undefined,
): number {
  const n = content?.cover_fade_start;
  if (typeof n !== "number" || Number.isNaN(n)) return DEFAULT_COVER_FADE_START;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * CSS linear-gradient for the hero cover bottom fade.
 * `fadeStart` = % from top that stays fully transparent (photo readable).
 * At 100, returns null (no overlay).
 */
export function buildCoverFadeGradient(fadeStart: number): string | null {
  const start = Math.min(100, Math.max(0, fadeStart));
  if (start >= 100) return null;

  // Soft ramp from clear → page bg under the fade start line
  const range = Math.max(1, 100 - start);
  const mid = Math.round(start + range * 0.4);
  const late = Math.round(start + range * 0.75);

  return [
    "linear-gradient(to bottom,",
    `transparent 0%,`,
    `transparent ${start}%,`,
    `color-mix(in srgb, var(--cp-bg) 28%, transparent) ${mid}%,`,
    `color-mix(in srgb, var(--cp-bg) 72%, transparent) ${late}%,`,
    `var(--cp-bg) 100%)`,
  ].join(" ");
}

export interface AboutContent {
  text?: string;
  photo_url?: string;
  /** Cadre de la photo à propos */
  photo_frame?: PhotoFrameShape;
  /** Layout of the photo in relation to the text. */
  media_position?: AboutMediaPosition;
  presentation?: SectionPresentation;
}

export interface FormulasContent {
  formula_ids?: string[];
  cta_label?: string;
  cta_url?: string;
  presentation?: SectionPresentation;
}

export interface GalleryContent {
  photo_urls?: string[];
  /** Cadre commun à toutes les photos de la galerie */
  photo_frame?: PhotoFrameShape;
  presentation?: SectionPresentation;
}

export interface TestimonialItem {
  id: string;
  name: string;
  text: string;
  avatar_url?: string;
}

export interface TestimonialsContent {
  items?: TestimonialItem[];
  /** Cadre des avatars témoignages */
  avatar_frame?: PhotoFrameShape;
  presentation?: SectionPresentation;
}

export interface ContactContent {
  email?: string;
  instagram?: string;
  cal_url?: string;
  whatsapp?: string;
  custom_cta_label?: string;
  presentation?: SectionPresentation;
}

/** One coach-authored block inside the optional custom sections area. */
export interface CustomSectionItem {
  id: string;
  is_enabled?: boolean;
  eyebrow?: string;
  title?: string;
  text?: string;
  photo_url?: string;
  photo_frame?: PhotoFrameShape;
  /** Image placement on desktop. `hidden` keeps the photo without displaying it. */
  image_position?: 'left' | 'right' | 'top' | 'hidden';
  text_align?: SectionTextAlign;
  surface_style?: SectionSurfaceStyle;
  spacing?: SectionSpacing;
  cta_label?: string;
  cta_url?: string;
}

export interface CustomSectionsContent {
  items?: CustomSectionItem[];
}

export type SectionContent =
  | HeroContent
  | AboutContent
  | FormulasContent
  | GalleryContent
  | TestimonialsContent
  | ContactContent
  | CustomSectionsContent;

// ─── DB rows ──────────────────────────────────────────────────────────────────

export interface CoachPage {
  id: string;
  coach_id: string;
  slug: string;
  is_published: boolean;
  is_private: boolean;
  accent_color: string;
  font_choice: FontChoice;
  bg_choice: BgChoice;
  created_at: string;
  updated_at: string;
}

export interface CoachPageSection {
  id: string;
  coach_id: string;
  page_id: string;
  type: SectionType;
  is_enabled: boolean;
  position: number;
  content: SectionContent;
  created_at: string;
  updated_at: string;
}

// ─── Formula (public-safe subset) ────────────────────────────────────────────

export interface PublicFormula {
  id: string;
  name: string;
  description?: string | null;
  price_eur: number;
  billing_cycle: 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  duration_months?: number | null;
  features: string[];
  color: string;
  show_on_page: boolean;
}

// ─── Aggregated public data ───────────────────────────────────────────────────

export interface CoachPagePublicData {
  page: CoachPage;
  sections: CoachPageSection[];
  formulas: PublicFormula[];
  /** Coach profile minimal */
  profile: {
    full_name?: string | null;
    brand_name?: string | null;
    logo_url?: string | null;
  };
}

// ─── Builder state ────────────────────────────────────────────────────────────

export interface BuilderSection {
  type: SectionType;
  is_enabled: boolean;
  position: number;
  content: SectionContent;
  /** true when unsaved changes exist */
  isDirty?: boolean;
}

export interface BuilderState {
  page: Omit<CoachPage, 'id' | 'coach_id' | 'created_at' | 'updated_at'> & { id?: string };
  sections: BuilderSection[];
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

// ─── Section metadata (labels, icons) ────────────────────────────────────────

export const SECTION_META: Record<SectionType, { label: string; description: string }> = {
  hero: {
    label: 'Accueil',
    description: 'Photo, nom principal, accroche',
  },
  about: {
    label: 'À propos',
    description: 'Texte de présentation et photo',
  },
  formulas: {
    label: 'Formules',
    description: 'Tes offres de coaching',
  },
  gallery: {
    label: 'Galerie',
    description: 'Jusqu\'à 6 photos',
  },
  testimonials: {
    label: 'Témoignages',
    description: 'Avis de tes clients',
  },
  contact: {
    label: 'Contact',
    description: 'Email, réseaux, lien de réservation',
  },
  custom: {
    label: 'Sections personnalisées',
    description: 'Jusqu’à 5 blocs avec photo, texte et mise en page',
  },
};

export const DEFAULT_SECTIONS_ORDER: SectionType[] = [
  'hero',
  'about',
  'formulas',
  'gallery',
  'testimonials',
  'custom',
  'contact',
];

// ─── Theme helpers ────────────────────────────────────────────────────────────

export const BG_VALUES: Record<BgChoice, string> = {
  dark: '#121212',
  charcoal: '#181818',
  slate: '#0a0a0a',
  light: '#f4f4f2',
  paper: '#ffffff',
};

export const BG_LABELS: Record<BgChoice, string> = {
  dark: 'Sombre — Flat Dark',
  charcoal: 'Sombre — Surface',
  slate: 'Sombre — Profond',
  light: 'Clair — Gris doux',
  paper: 'Clair — Blanc papier',
};

export const LIGHT_BG_CHOICES: BgChoice[] = ['light', 'paper'];

export function isLightBg(bg: BgChoice): boolean {
  return LIGHT_BG_CHOICES.includes(bg);
}

export const FONT_LABELS: Record<FontChoice, string> = {
  lufga: 'Lufga (interface)',
  barlow: 'Barlow (titres sport)',
  inter: 'Lufga (défaut plateforme)',
};

export const PRESET_ACCENT_COLORS = [
  '#1f8a65', // Vert Émeraude (Accent principal)
  '#217356', // Vert hover
  '#3d7070', // Petrol
  '#a89060', // Gold
  '#9d7052', // Copper
  '#6a6a6a', // Gris clair
  '#525252', // Gris moyen
];
