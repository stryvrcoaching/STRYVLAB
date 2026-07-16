'use server'

import React from 'react'
import { Document, Image as PDFImage, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import {
  buildNutritionProtocolPdfFilename,
  formatNutritionRoleLabel,
  type NutritionProtocolPdfDay,
  type NutritionProtocolPdfDocumentData,
} from '@/lib/nutrition-protocol-pdf/model'
import { computePlanMealsTotals, roundPlanTotals } from '@/lib/nutrition/protocol-builder'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 32,
    color: '#171717',
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    paddingBottom: 12,
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: 24,
    height: 24,
    marginRight: 8,
    objectFit: 'contain',
  },
  eyebrow: {
    fontSize: 8,
    color: '#8f8f8f',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  title: {
    marginTop: 6,
    fontSize: 26,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
  },
  meta: {
    marginTop: 10,
    fontSize: 10,
    color: '#4b4b4b',
  },
  intro: {
    marginTop: 6,
    fontSize: 11,
    color: '#3f3f3f',
    lineHeight: 1.5,
  },
  dayCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 14,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#eef8f4',
    color: '#16684f',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  dayTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  stat: {
    width: '25%',
    paddingRight: 8,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 7,
    color: '#6f6f6f',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: {
    marginTop: 3,
    fontSize: 12,
    color: '#171717',
    fontFamily: 'Helvetica-Bold',
  },
  mealBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#efefef',
  },
  mealTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#171717',
    marginBottom: 4,
  },
  mealItem: {
    fontSize: 9,
    color: '#4b4b4b',
    marginBottom: 2,
  },
  recommendations: {
    marginTop: 8,
    fontSize: 9,
    color: '#4b4b4b',
    lineHeight: 1.5,
  },
})

const STRYVR_SILVER_LOGO = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stryvlab.com'}/logo/logo-stryvr-silver.png`

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function renderDay(day: NutritionProtocolPdfDay) {
  const planTotals = roundPlanTotals(computePlanMealsTotals(day.meal_plan))
  return (
    <View key={day.id} style={styles.dayCard} wrap={false}>
      <View style={styles.dayHeader}>
        <View>
          <Text style={styles.dayTitle}>{day.name}</Text>
          <Text style={styles.meta}>
            {formatNutritionRoleLabel(day.role)}
            {day.carb_cycle_type ? ` · Carb cycle ${day.carb_cycle_type}` : ''}
            {day.cycle_sync_phase ? ` · ${day.cycle_sync_phase}` : ''}
          </Text>
        </View>
        <Text style={styles.dayBadge}>{`Jour ${day.position + 1}`}</Text>
      </View>

      <View style={styles.macroGrid}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Calories</Text>
          <Text style={styles.statValue}>{day.calories != null ? `${day.calories} kcal` : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Protéines</Text>
          <Text style={styles.statValue}>{day.protein_g != null ? `${day.protein_g} g` : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Glucides</Text>
          <Text style={styles.statValue}>{day.carbs_g != null ? `${day.carbs_g} g` : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Lipides</Text>
          <Text style={styles.statValue}>{day.fat_g != null ? `${day.fat_g} g` : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Hydratation</Text>
          <Text style={styles.statValue}>{day.hydration_ml != null ? `${day.hydration_ml} ml` : '—'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Plan repas</Text>
          <Text style={styles.statValue}>{day.meal_plan.length} repas</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Kcal planifiées</Text>
          <Text style={styles.statValue}>{planTotals.calories ? `${planTotals.calories} kcal` : '—'}</Text>
        </View>
      </View>

      {day.meal_plan.length > 0 ? (
        <View style={styles.mealBlock}>
          {day.meal_plan.map((meal) => (
            <View key={String(meal.id)} style={{ marginBottom: 6 }}>
              <Text style={styles.mealTitle}>{meal.title}</Text>
              {meal.items.length > 0 ? (
                meal.items.map((item) => (
                  <Text key={item.id} style={styles.mealItem}>
                    {`${item.food.name_fr} — ${Math.round(item.quantity_g)} g`}
                  </Text>
                ))
              ) : (
                <Text style={styles.mealItem}>Aucun aliment configuré</Text>
              )}
            </View>
          ))}
        </View>
      ) : null}

      {day.recommendations ? (
        <Text style={styles.recommendations}>{day.recommendations}</Text>
      ) : null}
    </View>
  )
}

function NutritionProtocolPdfDocument({ data }: { data: NutritionProtocolPdfDocumentData }) {
  return (
    <Document title={buildNutritionProtocolPdfFilename(data)}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <PDFImage src={STRYVR_SILVER_LOGO} style={styles.logo} />
            <Text style={styles.eyebrow}>STRYV · Protocole nutritionnel</Text>
          </View>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>
            {`Coach : ${data.coach.name}`}
            {data.client ? ` · Client : ${[data.client.firstName, data.client.lastName].filter(Boolean).join(' ')}` : ''}
            {` · Édité le ${formatDate(data.generatedAt)}`}
          </Text>
          <Text style={styles.intro}>
            {data.notes?.trim() || 'Document nutritionnel structuré pour guider l’exécution alimentaire, les repères macro et l’organisation des repas.'}
          </Text>
        </View>

        {data.days.map(renderDay)}
      </Page>
    </Document>
  )
}

export async function generateNutritionProtocolPdf(data: NutritionProtocolPdfDocumentData) {
  return renderToBuffer(<NutritionProtocolPdfDocument data={data} />)
}
