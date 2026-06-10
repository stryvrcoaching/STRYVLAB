import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button } from '../../components/ui';
import { COLORS, SPACING } from '../../constants';

export default function NutritionScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text variant="heading1" style={styles.title}>
          Nutrition
        </Text>
        <Text variant="body" color="muted" style={styles.subtitle}>
          Suivez vos apports nutritionnels
        </Text>

        <View style={styles.actions}>
          <Button
            title="Calculer macros"
            onPress={() => {/* Navigate to calculator */}}
          />
          <Button
            title="Journal alimentaire"
            onPress={() => {/* Navigate to journal */}}
            variant="secondary"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
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
    gap: SPACING.md,
  },
});