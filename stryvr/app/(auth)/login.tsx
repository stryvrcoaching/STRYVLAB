import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, Button, Input } from '../../components/ui'
import { LIGHT, BORDERS, SPACING, ACCENT, TYPOGRAPHY } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { router } from 'expo-router'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.replace('/(tabs)')
    } catch (error: unknown) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* ─── HEADER ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text
            variant="metricLarge"
            color={ACCENT}
            style={styles.logo}
          >
            STRYVR
          </Text>
          <Text variant="headingSection" color={LIGHT.textSecondary}>
            Connectez-vous à votre compte
          </Text>
        </View>

        {/* ─── FORM ────────────────────────────────────────────────── */}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <Button
            title="Se connecter"
            onPress={handleLogin}
            loading={loading}
            size="lg"
          />
        </View>

      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT.surfaceBase,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.pageH,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  logo: {
    letterSpacing: 2,
  },
  form: {
    gap: SPACING.sm,
  },
})
