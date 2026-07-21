/**
 * Photo frame / crop shapes for coach mini-site sections.
 */

export type PhotoFrameShape =
  | 'circle'
  | 'rounded'
  | 'square'
  | 'portrait_4_5'
  | 'portrait_3_4'
  | 'landscape_16_9'
  | 'landscape_3_2'
  | 'soft'

export const PHOTO_FRAME_OPTIONS: Array<{
  value: PhotoFrameShape
  label: string
  hint: string
}> = [
  { value: 'circle', label: 'Rond', hint: 'Avatar circulaire' },
  { value: 'rounded', label: 'Carré arrondi', hint: 'Coins doux' },
  { value: 'square', label: 'Carré', hint: '1:1 net' },
  { value: 'portrait_4_5', label: 'Portrait 4:5', hint: 'Format photo pro' },
  { value: 'portrait_3_4', label: 'Portrait 3:4', hint: 'Un peu plus haut' },
  { value: 'landscape_16_9', label: 'Paysage 16:9', hint: 'Large' },
  { value: 'landscape_3_2', label: 'Paysage 3:2', hint: 'Classique' },
  { value: 'soft', label: 'Arrondi libre', hint: 'Pleine largeur, coins 16px' },
]

export function normalizePhotoFrame(
  value: string | null | undefined,
  fallback: PhotoFrameShape = 'rounded',
): PhotoFrameShape {
  const ok = PHOTO_FRAME_OPTIONS.some((o) => o.value === value)
  return ok ? (value as PhotoFrameShape) : fallback
}

/** Aspect + radius classes for a frame (Tailwind). */
export function photoFrameClasses(
  shape: PhotoFrameShape,
  opts?: { size?: 'sm' | 'md' | 'lg' | 'full' },
): string {
  const size = opts?.size ?? 'full'
  const sizeBox =
    size === 'sm'
      ? 'h-16 w-16'
      : size === 'md'
        ? 'h-28 w-28 sm:h-32 sm:w-32'
        : size === 'lg'
          ? 'h-32 w-32 sm:h-36 sm:w-36'
          : 'w-full'

  switch (shape) {
    case 'circle':
      return `${size === 'full' ? 'aspect-square w-full max-w-[280px] mx-auto' : sizeBox} rounded-full`
    case 'rounded':
      return `${size === 'full' ? 'aspect-square w-full' : sizeBox} rounded-2xl`
    case 'square':
      return `${size === 'full' ? 'aspect-square w-full' : sizeBox} rounded-none`
    case 'portrait_4_5':
      return `${size === 'full' ? 'w-full' : 'w-full max-w-sm'} aspect-[4/5] rounded-2xl`
    case 'portrait_3_4':
      return `${size === 'full' ? 'w-full' : 'w-full max-w-sm'} aspect-[3/4] rounded-2xl`
    case 'landscape_16_9':
      return 'w-full aspect-[16/9] rounded-2xl'
    case 'landscape_3_2':
      return 'w-full aspect-[3/2] rounded-2xl'
    case 'soft':
    default:
      return 'w-full aspect-[4/5] rounded-2xl sm:aspect-[16/10]'
  }
}

/** Cover banner height variants (hero background). */
export type CoverFrameStyle = 'short' | 'medium' | 'tall' | 'hidden'

export const COVER_FRAME_OPTIONS: Array<{
  value: CoverFrameStyle
  label: string
}> = [
  { value: 'short', label: 'Court' },
  { value: 'medium', label: 'Moyen' },
  { value: 'tall', label: 'Haut' },
  { value: 'hidden', label: 'Masqué' },
]

/**
 * Cover banner height — taller on desktop so the photo stays readable
 * (not a thin strip showing only the top crop).
 */
export function coverFrameHeightClass(style: CoverFrameStyle | undefined): string {
  switch (style) {
    case 'short':
      return 'h-44 sm:h-52 md:h-60 lg:h-64'
    case 'tall':
      return 'h-64 sm:h-80 md:h-[22rem] lg:h-[26rem]'
    case 'hidden':
      return 'h-0'
    case 'medium':
    default:
      return 'h-56 sm:h-72 md:h-80 lg:h-96'
  }
}

export function resolveCoverHeight(coverFrame: string | number | null | undefined): number {
  if (coverFrame === undefined || coverFrame === null) {
    return 60;
  }
  if (coverFrame === 'hidden') return 0;
  if (coverFrame === 'short') return 40;
  if (coverFrame === 'medium') return 60;
  if (coverFrame === 'tall') return 80;

  const num = typeof coverFrame === 'number' ? coverFrame : parseInt(coverFrame, 10);
  if (!isNaN(num)) {
    return Math.max(0, Math.min(100, num));
  }
  return 60;
}
