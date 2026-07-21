'use client';

/**
 * Live character counter under builder text fields.
 */
export function FieldCharCount({
  value,
  max,
  className,
}: {
  value: string;
  max: number;
  className?: string;
}) {
  const len = value.length;
  const near = len >= max * 0.9;
  const full = len >= max;

  return (
    <p
      className={className}
      style={{
        fontSize: '11px',
        marginTop: '4px',
        textAlign: 'right',
        marginBottom: 0,
        color: full
          ? 'rgba(239,68,68,0.85)'
          : near
            ? 'rgba(245,158,11,0.85)'
            : 'rgba(255,255,255,0.35)',
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-live="polite"
    >
      {len} / {max}
    </p>
  );
}

/** Testimonials body: ~50 words more than previous 400 (~300 chars). */
export const LIMITS = {
  testimonialName: 60,
  testimonialText: 700,
  heroDisplayName: 80,
  heroTagline: 100,
  heroSubtitle: 280,
  aboutText: 1500,
  sectionEyebrow: 80,
  sectionTitle: 120,
  sectionSubtitle: 280,
  customEyebrow: 80,
  customTitle: 120,
  customText: 2000,
  ctaLabel: 50,
} as const;
