import React from 'react'
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native'
import { LIGHT, TYPOGRAPHY } from '../../constants/theme'

type Variant =
  | 'metricHero'      // 64px/700 — scores (83, 48)
  | 'metricLarge'     // 40px/700 — valeurs importantes (37.7, 8.1)
  | 'metricMedium'    // 32px/600
  | 'metricSmall'     // 22px/700 — mini sparklines
  | 'headingPage'     // 17px/600 — titre page centré
  | 'headingSection'  // 15px/400 — label section card
  | 'labelPrimary'    // 15px/600 — valeurs quali ("Medium")
  | 'labelSecondary'  // 13px/400 — sous-labels
  | 'labelSmall'      // 11px/400 — delta, axes
  | 'unit'            // 17px/400 — unité inline
  | 'qualifier'       // 17px/400 — qualificatif inline
  // Compat
  | 'heading1'
  | 'heading2'
  | 'body'
  | 'caption'
  | 'label'

interface TextProps extends RNTextProps {
  variant?: Variant
  color?: string
  style?: TextStyle
}

const VARIANT_STYLES: Record<Variant, TextStyle> = {
  metricHero: {
    fontSize: TYPOGRAPHY.fontSize.metricHero,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontVariant: ['tabular-nums'],
    lineHeight: TYPOGRAPHY.fontSize.metricHero * 1.0,
  },
  metricLarge: {
    fontSize: TYPOGRAPHY.fontSize.metricLarge,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontVariant: ['tabular-nums'],
    lineHeight: TYPOGRAPHY.fontSize.metricLarge * 1.05,
  },
  metricMedium: {
    fontSize: TYPOGRAPHY.fontSize.metricMedium,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
  metricSmall: {
    fontSize: TYPOGRAPHY.fontSize.metricSmall,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  headingPage: {
    fontSize: TYPOGRAPHY.fontSize.headingPage,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  headingSection: {
    fontSize: TYPOGRAPHY.fontSize.headingSection,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  labelPrimary: {
    fontSize: TYPOGRAPHY.fontSize.labelPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  labelSecondary: {
    fontSize: TYPOGRAPHY.fontSize.labelSecondary,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  labelSmall: {
    fontSize: TYPOGRAPHY.fontSize.labelSmall,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  unit: {
    fontSize: TYPOGRAPHY.fontSize.unit,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  qualifier: {
    fontSize: TYPOGRAPHY.fontSize.qualifier,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  // Compat
  heading1: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  heading2: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  body: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.base * 1.5,
  },
  caption: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  label: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color,
  style,
  children,
  ...props
}) => {
  return (
    <RNText
      style={[
        VARIANT_STYLES[variant],
        { color: color ?? LIGHT.textPrimary },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  )
}
