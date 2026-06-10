import React from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, Button } from '../../components/ui'
import { LIGHT, SPACING, BORDERS } from '../../constants/theme'
import { signOut } from '../../lib/supabase'

export default function ProfileScreen() {
  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text variant="heading1" style={styles.title}>
          Profil
        </Text>
        <Text variant="headingSection" color={LIGHT.textSecondary} style={styles.subtitle}>
          Gérez vos paramètres et données
        </Text>

        <View style={styles.actions}>
          <Button
            title="Modifier le profil"
            onPress={() => {}}
            variant="secondary"
            size="lg"
          />
          <Button
            title="Se déconnecter"
            onPress={handleSignOut}
            variant="ghost"
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
    alignItems: 'center',
  },
  title: {
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: SPACING.cardGap,
  },
})
