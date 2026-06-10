// STRYVR Design System v3.0
// Source: docs/DESIGN_SYSTEM_V3.0_STRYVR_NATIVE.md

// ─── ACCENT (invariant light + dark) ───────────────────────────────────────
export const ACCENT = '#FF6116'
export const ACCENT_SOFT = 'rgba(255,97,22,0.30)'

// ─── LIGHT MODE (défaut) ────────────────────────────────────────────────────
export const LIGHT = {
  surfaceBase:     '#F3F3F3',                 // fond app
  surfaceCard:     '#FFFFFF',                 // cards — contraste seul, zéro bordure
  surfaceTabBar:   'rgba(235,235,235,0.92)',  // fond tab bar + blur
  surfaceElevated: '#EBEBEB',                 // inputs, chevron container, hover

  textPrimary:     '#000000',                 // métriques héros, titres
  textSecondary:   '#767676',                 // labels, unités, qualificatifs
  textTertiary:    '#ABABAB',                 // placeholders, metadata

  borderSubtle:    'rgba(0,0,0,0.06)',        // séparateurs internes
  arcTrack:        '#D8D8D8',                 // arc fond inactif — gris visible, PAS transparent

  tabActiveBg:     '#000000',                 // rectangle radius-sm tab active
  tabActiveIcon:   '#FFFFFF',
  tabInactiveIcon: '#767676',

  deltaPositive:   '#FF6116',                 // delta +% sparklines + barre
  deltaNegative:   '#000000',                 // delta -% sparklines + barre
} as const

// ─── DARK MODE ──────────────────────────────────────────────────────────────
export const DARK = {
  surfaceBase:     '#0A0A0A',
  surfaceCard:     '#141414',
  surfaceTabBar:   'rgba(14,14,14,0.92)',
  surfaceElevated: '#1E1E1E',

  textPrimary:     '#FFFFFF',
  textSecondary:   '#8A8A8A',
  textTertiary:    '#4A4A4A',

  borderSubtle:    'rgba(255,255,255,0.06)',
  arcTrack:        'rgba(255,255,255,0.12)',

  tabActiveBg:     '#FFFFFF',
  tabActiveIcon:   '#000000',
  tabInactiveIcon: '#5A5A5A',

  deltaPositive:   '#FF6116',
  deltaNegative:   '#FFFFFF',
} as const

// ─── SLEEP STAGES ───────────────────────────────────────────────────────────
export const SLEEP = {
  awake: '#FF6116',
  rem:   '#1A1A1A',
  light: '#767676',
  deep:  '#3A3A3A',
} as const

// ─── STATUTS SÉMANTIQUES ────────────────────────────────────────────────────
export const STATUS = {
  good:     '#34C759',
  warning:  '#FF9F0A',
  critical: '#FF3B30',
  neutral:  '#767676',
} as const

// ─── COLORS (compatibilité composants existants) ────────────────────────────
export const COLORS = {
  background:      LIGHT.surfaceBase,
  surface:         LIGHT.surfaceCard,
  card:            LIGHT.surfaceCard,
  input:           LIGHT.surfaceElevated,

  textPrimary:     LIGHT.textPrimary,
  textSecondary:   LIGHT.textSecondary,
  textMuted:       LIGHT.textSecondary,
  textPlaceholder: LIGHT.textTertiary,
  placeholder:     LIGHT.textTertiary,
  white:           '#FFFFFF',
  black:           '#000000',

  primary:         ACCENT,
  primaryHover:    '#E5561A',
  accent:          ACCENT,

  border:          LIGHT.borderSubtle,
  borderSubtle:    LIGHT.borderSubtle,

  error:           STATUS.critical,
  warning:         STATUS.warning,
  success:         STATUS.good,
} as const

// ─── TYPOGRAPHIE ────────────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  // Police : Urbanist — chargée via useFonts() dans app/_layout.tsx
  fontFamily: {
    regular:  'Urbanist_400Regular',
    medium:   'Urbanist_500Medium',
    semibold: 'Urbanist_600SemiBold',
    bold:     'Urbanist_700Bold',
  },

  fontSize: {
    // Métriques numériques — tabular-nums obligatoire
    metricHero:     64,
    metricLarge:    40,
    metricMedium:   32,
    metricSmall:    22,
    // UI
    headingPage:    17,
    headingSection: 15,
    labelPrimary:   15,
    labelSecondary: 13,
    labelSmall:     11,
    unit:           17,
    qualifier:      17,
    // Compat
    xs: 11, sm: 13, base: 15, md: 17,
    lg: 20, xl: 24, '2xl': 28, '3xl': 32,
  },

  fontWeight: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },

  lineHeight: {
    tight:   1.0,
    normal:  1.4,
    relaxed: 1.6,
    // Compat
    xs: 14, sm: 18, base: 22, md: 24, lg: 28, xl: 32,
  },
} as const

// ─── ESPACEMENT ─────────────────────────────────────────────────────────────
export const SPACING = {
  xs:      4,
  sm:      8,
  md:      16,
  lg:      24,
  xl:      32,
  pageH:   20,  // marge horizontale page
  cardGap: 12,  // gap entre cards
  space: {
    1: 4, 2: 8, 3: 12, 4: 16, 5: 20,
    6: 24, 8: 32, 10: 40, 12: 48,
  },
} as const

// ─── BORDURES & ARRONDIS ────────────────────────────────────────────────────
export const BORDERS = {
  radius: {
    none: 0,       // sleep stages — rectangles purs, zéro radius
    sm:   8,       // tab active, date picker, chevron container, chips
    md:   12,      // inputs, cards petites
    lg:   16,      // cards standards
    xl:   20,      // cards larges (Readiness, Sleep, Body Temp)
    '2xl': 24,     // cards hero, panels
    full: 9999,    // avatar, dots
  },
  width: {
    subtle: 0.5,
    normal: 1,
    thick:  2,
  },
} as const

// ─── TAB BAR ────────────────────────────────────────────────────────────────
export const TAB_BAR = {
  height:       60,
  safeArea:     34,   // iOS safe area bottom
  activeSize:   48,   // rectangle quasi-carré tab active
  activeRadius: BORDERS.radius.sm,  // 8px — PAS pill
  iconSize:     22,
} as const
