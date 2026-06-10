import React from 'react'
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, Button } from '../../components/ui'
import { LIGHT, BORDERS, SPACING, ACCENT, TYPOGRAPHY } from '../../constants/theme'
import { useMotorState } from '../../lib/queries/useMotorState'
import { getCurrentUser } from '../../lib/supabase'

export default function HomeScreen() {
  const [user, setUser] = React.useState<any>(null)

  React.useEffect(() => {
    getCurrentUser().then(setUser)
  }, [])

  const { data: motorState, isLoading } = useMotorState(
    user?.id || '',
    new Date().toISOString().split('T')[0],
  )

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HEADER ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text variant="headingSection" color={LIGHT.textSecondary}>
            Bonjour
          </Text>
          <Text variant="heading1" color={LIGHT.textPrimary} style={styles.name}>
            {user?.email ? user.email.split('@')[0] : 'Bienvenue'}
          </Text>
        </View>

        {/* ─── STAT CARDS ─────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardHalf]}>
            {isLoading ? (
              <View style={styles.skeleton} />
            ) : (
              <Text variant="metricLarge" color={ACCENT} style={styles.statValue}>
                {String(motorState?.readiness_score ?? '—')}
              </Text>
            )}
            <Text variant="labelSecondary" color={LIGHT.textSecondary}>
              Readiness score
            </Text>
          </View>

          <View style={[styles.statCard, styles.statCardHalf]}>
            {isLoading ? (
              <View style={styles.skeleton} />
            ) : (
              <Text variant="metricLarge" color={LIGHT.textPrimary} style={styles.statValue}>
                {String(motorState?.fatigue_level ?? 0)}
              </Text>
            )}
            <Text variant="labelSecondary" color={LIGHT.textSecondary}>
              Niveau de fatigue
            </Text>
          </View>
        </View>

        {/* ─── ACTIONS ─────────────────────────────────────────────── */}
        <View style={styles.actions}>
          <Button
            title="Commencer l'entraînement"
            onPress={() => {}}
            variant="primary"
            size="lg"
          />
          <Button
            title="Voir le programme nutritionnel"
            onPress={() => {}}
            variant="secondary"
            size="lg"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LIGHT.surfaceBase,
  },
  scroll: {
    paddingHorizontal: SPACING.pageH,
    paddingTop: SPACING.lg,
    paddingBottom: 100,  // clearance tab bar
    gap: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.sm,
  },
  name: {
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.cardGap,
  },
  statCard: {
    backgroundColor: LIGHT.surfaceCard,
    borderRadius: BORDERS.radius.xl,
    padding: SPACING.lg,
  },
  statCardHalf: {
    flex: 1,
  },
  statValue: {
    marginBottom: 4,
  },
  skeleton: {
    height: 40,
    width: 60,
    backgroundColor: LIGHT.surfaceElevated,
    borderRadius: BORDERS.radius.md,
    marginBottom: 4,
  },
  actions: {
    gap: SPACING.cardGap,
  },
})
