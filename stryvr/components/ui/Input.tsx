import React, { useState } from 'react'
import { TextInput, View, TextInputProps, ViewStyle, TextStyle, StyleSheet } from 'react-native'
import { LIGHT, BORDERS, SPACING, TYPOGRAPHY, ACCENT } from '../../constants/theme'
import { Text } from './Text'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
  suffix?: string
  containerStyle?: ViewStyle
  inputStyle?: TextStyle
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  suffix,
  containerStyle,
  inputStyle,
  ...props
}) => {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          variant="labelSmall"
          color={LIGHT.textSecondary}
          style={styles.label}
        >
          {label.toUpperCase()}
        </Text>
      )}
      <View style={[
        styles.inputWrapper,
        focused && styles.inputWrapperFocused,
        !!error && styles.inputWrapperError,
      ]}>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={LIGHT.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {suffix && (
          <Text variant="unit" color={LIGHT.textSecondary} style={styles.suffix}>
            {suffix}
          </Text>
        )}
      </View>
      {error && (
        <Text variant="labelSmall" color="#FF3B30" style={styles.message}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text variant="labelSmall" color={LIGHT.textTertiary} style={styles.message}>
          {hint}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIGHT.surfaceElevated,
    borderRadius: BORDERS.radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: SPACING.md,
    height: 52,
  },
  inputWrapperFocused: {
    borderColor: ACCENT,
  },
  inputWrapperError: {
    borderColor: '#FF3B30',
  },
  input: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: LIGHT.textPrimary,
    paddingVertical: 0,
  },
  suffix: {
    marginLeft: SPACING.xs,
  },
  message: {
    marginTop: 4,
    letterSpacing: 0.3,
  },
})
