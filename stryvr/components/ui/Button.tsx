import React from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleSheet,
  Text,
} from 'react-native'
import { ACCENT, LIGHT, BORDERS, TYPOGRAPHY } from '../../constants/theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  title: string
  onPress: () => void
  variant?: Variant
  size?: Size
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
}

const VARIANT_CONTAINER: Record<Variant, ViewStyle> = {
  primary: {
    backgroundColor: ACCENT,
  },
  secondary: {
    backgroundColor: LIGHT.surfaceElevated,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: '#FF3B30',
  },
}

const VARIANT_TEXT: Record<Variant, TextStyle> = {
  primary:     { color: '#FFFFFF' },
  secondary:   { color: LIGHT.textPrimary },
  ghost:       { color: ACCENT },
  destructive: { color: '#FFFFFF' },
}

const SIZE_CONTAINER: Record<Size, ViewStyle> = {
  sm: { height: 36, paddingHorizontal: 12 },
  md: { height: 48, paddingHorizontal: 20 },
  lg: { height: 56, paddingHorizontal: 24 },
}

const SIZE_TEXT: Record<Size, TextStyle> = {
  sm: { fontSize: TYPOGRAPHY.fontSize.sm },
  md: { fontSize: TYPOGRAPHY.fontSize.base },
  lg: { fontSize: TYPOGRAPHY.fontSize.md },
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        VARIANT_CONTAINER[variant],
        SIZE_CONTAINER[size],
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : ACCENT}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            SIZE_TEXT[size],
            VARIANT_TEXT[variant],
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BORDERS.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
})
