'use server'

import React from 'react'
import {
  Document,
  Image as PDFImage,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import {
  formatPrescription,
  formatSessionSubtitle,
  type PdfExercise,
  type PdfProgramDocumentData,
  type PdfSession,
} from '@/lib/program-pdf/model'

export interface ProgramPdfOptions {
  includeTracking?: boolean
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 32,
    color: '#171717',
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  cover: {
    padding: 0,
    borderRadius: 0,
    backgroundColor: '#ffffff',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    marginBottom: 16,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrap: {
    marginLeft: 12,
  },
  logo: {
    width: 34,
    height: 34,
    objectFit: 'contain',
  },
  eyebrow: {
    fontSize: 8,
    color: '#8f8f8f',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
  },
  coverHero: {
    minHeight: 610,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  coverHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  coverHeroMark: {
    width: 26,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#1f8a65',
    marginRight: 10,
  },
  coverHeroLabel: {
    fontSize: 8,
    color: '#1f8a65',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontFamily: 'Helvetica-Bold',
  },
  coverHeroTitle: {
    fontSize: 30,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.12,
  },
  coverHeroLead: {
    marginTop: 12,
    fontSize: 12,
    color: '#3d3d3d',
    lineHeight: 1.5,
  },
  date: {
    fontSize: 8,
    color: '#8f8f8f',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  lead: {
    fontSize: 12,
    color: '#3d3d3d',
    lineHeight: 1.55,
    marginTop: 8,
    marginBottom: 16,
  },
  coverGrid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },
  coverMain: {
    flex: 1.45,
    marginRight: 16,
  },
  coverSide: {
    flex: 1,
  },
  coverMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  coverPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#eef8f4',
    color: '#16684f',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginRight: 6,
    marginBottom: 6,
  },
  infoCard: {
    flex: 1,
    marginTop: 0,
    marginBottom: 10,
    marginRight: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f7f7f7',
  },
  infoCardLast: {
    flex: 1,
    marginTop: 0,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f7f7f7',
  },
  summaryCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f7f7f7',
  },
  infoLabel: {
    fontSize: 7,
    color: '#1f8a65',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 13,
    color: '#171717',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 9,
    color: '#4b4b4b',
    lineHeight: 1.5,
  },
  statRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d6d6d6',
    marginRight: 8,
  },
  statBoxLast: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d6d6d6',
  },
  statValue: {
    fontSize: 18,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 7,
    color: '#6f6f6f',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  infoSubtle: {
    marginTop: 8,
    fontSize: 8,
    color: '#6a6a6a',
  },
  sessionCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  sessionBadge: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#1f8a65',
    color: '#ffffff',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  sessionTitle: {
    fontSize: 16,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  sessionSub: {
    fontSize: 9,
    color: '#6a6a6a',
    marginBottom: 10,
  },
  sessionNotes: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    fontSize: 9,
    color: '#4b4b4b',
    lineHeight: 1.5,
  },
  exerciseCard: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#efefef',
  },
  exerciseInner: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#f7f7f7',
  },
  exerciseHeader: {
    flexDirection: 'row',
  },
  exerciseMediaWrap: {
    width: 70,
    marginRight: 12,
  },
  exerciseImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    objectFit: 'cover',
  },
  exerciseFallback: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#eeeeee',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  exerciseFallbackText: {
    fontSize: 7,
    color: '#7a7a7a',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  exerciseBody: {
    flex: 1,
  },
  exerciseIndex: {
    fontSize: 7.5,
    color: '#6a6a6a',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 11,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  exercisePrescription: {
    fontSize: 9,
    color: '#2f2f2f',
    lineHeight: 1.45,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  exerciseNotes: {
    marginTop: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    fontSize: 8.5,
    color: '#656565',
    lineHeight: 1.4,
  },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#777777',
  },
  trackingIntro: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  trackingCoverHero: {
    minHeight: 580,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  trackingCoverEyebrow: {
    fontSize: 8,
    color: '#1f8a65',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 10,
    fontFamily: 'Helvetica-Bold',
  },
  trackingCoverTitle: {
    fontSize: 28,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.12,
  },
  trackingCoverSub: {
    marginTop: 10,
    fontSize: 11.5,
    color: '#3d3d3d',
    lineHeight: 1.45,
  },
  trackingCoverGrid: {
    marginTop: 12,
    flexDirection: 'row',
  },
  trackingCoverCard: {
    flex: 1,
    padding: 10,
    minHeight: 74,
    justifyContent: 'flex-start',
    borderRadius: 14,
    backgroundColor: '#f7f7f7',
    marginRight: 10,
  },
  trackingCoverCardLast: {
    flex: 1,
    padding: 10,
    minHeight: 74,
    justifyContent: 'flex-start',
    borderRadius: 14,
    backgroundColor: '#f7f7f7',
  },
  trackingCoverLabel: {
    fontSize: 7,
    color: '#1f8a65',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 7,
    fontFamily: 'Helvetica-Bold',
  },
  trackingCoverValue: {
    fontSize: 14,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.2,
  },
  trackingCoverValueTight: {
    fontSize: 11.5,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.2,
  },
  trackingCoverSubtle: {
    marginTop: 4,
    fontSize: 8,
    color: '#666666',
    lineHeight: 1.35,
  },
  trackingCoverNotes: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#f7f7f7',
  },
  trackingCoverNoteText: {
    fontSize: 9.5,
    color: '#3f3f3f',
    lineHeight: 1.5,
  },
  trackingEyebrow: {
    fontSize: 8,
    color: '#1f8a65',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    fontFamily: 'Helvetica-Bold',
  },
  trackingTitle: {
    fontSize: 18,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  trackingText: {
    fontSize: 9,
    color: '#4b4b4b',
    lineHeight: 1.5,
  },
  trackingExercise: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  trackingExerciseHeader: {
    marginBottom: 8,
  },
  trackingExerciseLabel: {
    fontSize: 7.5,
    color: '#1f8a65',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  trackingExerciseName: {
    fontSize: 11,
    color: '#111111',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  trackingPrescription: {
    fontSize: 8.5,
    color: '#666666',
  },
  trackingTable: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 10,
    overflow: 'hidden',
  },
  trackingRow: {
    flexDirection: 'row',
    minHeight: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  trackingRowLast: {
    flexDirection: 'row',
    minHeight: 24,
  },
  trackingHeaderCell: {
    flex: 1,
    padding: 6,
    backgroundColor: '#f2f2f2',
    fontSize: 7,
    color: '#6f6f6f',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 1,
    borderRightColor: '#d9d9d9',
  },
  trackingHeaderCellLast: {
    flex: 1.3,
    padding: 6,
    backgroundColor: '#f2f2f2',
    fontSize: 7,
    color: '#6f6f6f',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: 'Helvetica-Bold',
  },
  trackingCell: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    color: '#111111',
    borderRightWidth: 1,
    borderRightColor: '#e5e5e5',
  },
  trackingCellLast: {
    flex: 1.3,
    padding: 6,
    fontSize: 8,
    color: '#111111',
  },
  sessionFeedback: {
    marginTop: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  feedbackLine: {
    marginTop: 8,
    height: 22,
    borderBottomWidth: 1,
    borderBottomColor: '#c9c9c9',
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

function exerciseMedia(exercise: PdfExercise) {
  if (exercise.imageUrl) {
    return (
      <View style={styles.exerciseMediaWrap}>
        <PDFImage src={exercise.imageUrl} style={styles.exerciseImage} />
      </View>
    )
  }

  return (
    <View style={styles.exerciseMediaWrap}>
      <View style={styles.exerciseFallback}>
        <Text style={styles.exerciseFallbackText}>Exercice</Text>
      </View>
    </View>
  )
}

function programSummarySentence(data: PdfProgramDocumentData) {
  const parts = [data.goalLabel, data.levelLabel].filter(Boolean)
  return parts.join(' · ') || 'Programme d’entraînement personnalisé'
}

function coachContact(data: PdfProgramDocumentData) {
  return [data.coach.email, data.coach.phone].filter(Boolean).join(' · ')
}

function displayExerciseName(name: string) {
  return name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function trackingSetCount(exercise: PdfExercise) {
  if (typeof exercise.sets === 'number' && exercise.sets > 0) return Math.min(exercise.sets, 8)
  return 4
}

function trackingRows(exercise: PdfExercise) {
  return Array.from({ length: trackingSetCount(exercise) }, (_, index) => index + 1)
}

function TrackingSessionPage({
  data,
  session,
  index,
}: {
  data: PdfProgramDocumentData
  session: PdfSession
  index: number
}) {
  return (
    <Page key={`tracking-${session.id}`} size="A4" style={styles.page}>
      <View style={styles.trackingIntro}>
        <Text style={styles.trackingEyebrow}>{`Carnet de suivi · Bloc ${index + 1}`}</Text>
        <Text style={styles.trackingTitle}>{`Séance ${index + 1} · ${session.name}`}</Text>
        <Text style={styles.trackingText}>
          Notez vos charges, répétitions réalisées, RIR réel et remarques directement sur cette page.
        </Text>
      </View>

      {session.exercises.map((exercise) => (
        <View key={`tracking-${exercise.id}`} style={styles.trackingExercise} wrap={false}>
          <View style={styles.trackingExerciseHeader}>
            <Text style={styles.trackingExerciseLabel}>
              {`Bloc ${index + 1} · Exercice ${exercise.position + 1}`}
            </Text>
            <Text style={styles.trackingExerciseName}>{displayExerciseName(exercise.name)}</Text>
            <Text style={styles.trackingPrescription}>
              {formatPrescription(exercise) || 'Prescription à définir'}
            </Text>
          </View>

          <View style={styles.trackingTable}>
            <View style={styles.trackingRow}>
              <Text style={styles.trackingHeaderCell}>Série</Text>
              <Text style={styles.trackingHeaderCell}>Charge</Text>
              <Text style={styles.trackingHeaderCell}>Reps</Text>
              <Text style={styles.trackingHeaderCell}>RIR</Text>
              <Text style={styles.trackingHeaderCellLast}>Notes</Text>
            </View>
            {trackingRows(exercise).map((setNumber, rowIndex, rows) => (
              <View
                key={setNumber}
                style={rowIndex === rows.length - 1 ? styles.trackingRowLast : styles.trackingRow}
              >
                <Text style={styles.trackingCell}>{String(setNumber)}</Text>
                <Text style={styles.trackingCell}> </Text>
                <Text style={styles.trackingCell}> </Text>
                <Text style={styles.trackingCell}> </Text>
                <Text style={styles.trackingCellLast}> </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.sessionFeedback} wrap={false}>
        <Text style={styles.trackingExerciseLabel}>Feedback séance</Text>
        <Text style={styles.infoText}>Énergie · douleur ou gêne · progression · consignes à revoir</Text>
        <View style={styles.feedbackLine} />
        <View style={styles.feedbackLine} />
        <View style={styles.feedbackLine} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Carnet de suivi imprimable</Text>
        <Text style={styles.footerText}>{data.title}</Text>
      </View>
    </Page>
  )
}

function TrackingCoverPage({
  data,
  totalExercises,
}: {
  data: PdfProgramDocumentData
  totalExercises: number
}) {
  const athleteName = data.client
    ? `${data.client.firstName} ${data.client.lastName}`.trim()
    : 'Template prêt à partager'

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.trackingCoverHero}>
        <Text style={styles.trackingCoverEyebrow}>Carnet de suivi imprimable</Text>
        <Text style={styles.trackingCoverTitle}>Carnet de suivi</Text>
        <Text style={styles.trackingCoverSub}>
          {`${data.title} · Notez vos charges, répétitions, RIR réel et remarques séance après séance.`}
        </Text>

        <View style={styles.trackingCoverGrid}>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Programme</Text>
            <Text style={styles.trackingCoverValue}>{data.title}</Text>
          </View>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Athlète</Text>
            <Text style={styles.trackingCoverValue}>{athleteName}</Text>
          </View>
          <View style={styles.trackingCoverCardLast}>
            <Text style={styles.trackingCoverLabel}>Coach</Text>
            <Text style={styles.trackingCoverValue}>{data.coach.name}</Text>
          </View>
        </View>

        <View style={styles.trackingCoverGrid}>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Séances</Text>
            <Text style={styles.trackingCoverValue}>{String(data.sessions.length)}</Text>
          </View>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Exercices</Text>
            <Text style={styles.trackingCoverValue}>{String(totalExercises)}</Text>
          </View>
          <View style={styles.trackingCoverCardLast}>
            <Text style={styles.trackingCoverLabel}>Généré le</Text>
            <Text style={styles.trackingCoverValue}>{formatDate(data.generatedAt)}</Text>
          </View>
        </View>

        <View style={styles.trackingCoverNotes}>
          <Text style={styles.trackingCoverLabel}>Mode d’utilisation</Text>
          <Text style={styles.trackingCoverNoteText}>
            Remplissez les lignes après chaque série. Les notes permettent de garder le contexte :
            sensation, douleur, marge réelle, technique ou consigne à revoir avec le coach.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>STRYV Lab · Carnet de suivi</Text>
        <Text style={styles.footerText}>{data.title}</Text>
      </View>
    </Page>
  )
}

function ProgramCoverPage({
  data,
  totalExercises,
  summary,
}: {
  data: PdfProgramDocumentData
  totalExercises: number
  summary: string
}) {
  const athleteName = data.client
    ? `${data.client.firstName} ${data.client.lastName}`.trim()
    : 'Template prêt à partager'
  const goalValue = data.goalLabel || 'Programme d’entraînement'
  const levelValue = data.levelLabel || 'Niveau non défini'
  const durationValue = data.weeks ? `${data.weeks} semaines` : formatDate(data.generatedAt)
  const coachDetails = coachContact(data)

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.trackingCoverHero}>
        <View style={styles.brandLeft}>
          <PDFImage src={STRYVR_SILVER_LOGO} style={styles.logo} />
          <Text style={styles.trackingCoverEyebrow}>Programme d’entraînement</Text>
        </View>
        <Text style={styles.trackingCoverTitle}>{data.title}</Text>
        <Text style={styles.trackingCoverSub}>{summary}</Text>

        <View style={styles.trackingCoverGrid}>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Objectif</Text>
            <Text style={styles.trackingCoverValue}>{goalValue}</Text>
            <Text style={styles.trackingCoverSubtle}>{levelValue}</Text>
          </View>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Athlète</Text>
            <Text style={styles.trackingCoverValue}>{athleteName}</Text>
          </View>
          <View style={styles.trackingCoverCardLast}>
            <Text style={styles.trackingCoverLabel}>Coach</Text>
            <Text style={styles.trackingCoverValueTight}>{data.coach.name}</Text>
            {coachDetails ? <Text style={styles.trackingCoverSubtle}>{coachDetails}</Text> : null}
          </View>
        </View>

        <View style={styles.trackingCoverGrid}>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Séances</Text>
            <Text style={styles.trackingCoverValue}>
              {data.frequency ? String(data.frequency) : String(data.sessions.length)}
            </Text>
          </View>
          <View style={styles.trackingCoverCard}>
            <Text style={styles.trackingCoverLabel}>Exercices</Text>
            <Text style={styles.trackingCoverValue}>{String(totalExercises)}</Text>
          </View>
          <View style={styles.trackingCoverCardLast}>
            <Text style={styles.trackingCoverLabel}>{data.weeks ? 'Durée' : 'Généré le'}</Text>
            <Text style={styles.trackingCoverValue}>{durationValue}</Text>
          </View>
        </View>

        <View style={styles.trackingCoverNotes}>
          <Text style={styles.trackingCoverLabel}>Vue d'ensemble</Text>
          <Text style={styles.trackingCoverNoteText}>
            Chaque bloc présente les exercices, la prescription, le temps de repos, l'intensité et les
            consignes utiles.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>STRYV Lab · Programme PDF</Text>
        <Text style={styles.footerText}>
          {data.sourceType === 'template' ? 'Template programme' : 'Programme client'}
        </Text>
      </View>
    </Page>
  )
}

function ProgramDocument({
  data,
  options = {},
}: {
  data: PdfProgramDocumentData
  options?: ProgramPdfOptions
}) {
  const title = data.client
    ? `${data.title} — ${data.client.firstName} ${data.client.lastName}`.trim()
    : data.title

  const totalExercises = data.sessions.reduce((total, session) => total + session.exercises.length, 0)

  const summary = programSummarySentence(data)

  return (
    <Document title={title}>
      <ProgramCoverPage data={data} totalExercises={totalExercises} summary={summary} />

      {data.sessions.map((session, index) => (
        <Page key={session.id} size="A4" style={styles.page}>
          <View style={styles.sessionCard}>
            <Text style={styles.sessionBadge}>{`Bloc ${index + 1}`}</Text>
            <Text style={styles.sessionTitle}>{`Séance ${index + 1} · ${session.name}`}</Text>
            <Text style={styles.sessionSub}>{formatSessionSubtitle(session)}</Text>

            {session.notes ? <Text style={styles.sessionNotes}>{session.notes}</Text> : null}

            {session.exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseCard} wrap={false}>
                <View style={styles.exerciseInner}>
                  <View style={styles.exerciseHeader}>
                    {exerciseMedia(exercise)}
                    <View style={styles.exerciseBody}>
                      <Text style={styles.exerciseIndex}>{`Exercice ${exercise.position + 1}`}</Text>
                      <Text style={styles.exerciseName}>{displayExerciseName(exercise.name)}</Text>
                      <Text style={styles.exercisePrescription}>
                        {formatPrescription(exercise) || 'Prescription à définir'}
                      </Text>
                    </View>
                  </View>

                  {exercise.notes ? (
                    <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Document généré automatiquement par STRYV Lab</Text>
            <Text style={styles.footerText}>{`Bloc ${index + 1} / ${data.sessions.length}`}</Text>
          </View>
        </Page>
      ))}

      {options.includeTracking ? (
        <TrackingCoverPage data={data} totalExercises={totalExercises} />
      ) : null}

      {options.includeTracking
        ? data.sessions.map((session, index) => (
            <TrackingSessionPage
              key={`tracking-page-${session.id}`}
              data={data}
              session={session}
              index={index}
            />
          ))
        : null}
    </Document>
  )
}

export async function generateProgramPdf(data: PdfProgramDocumentData, options?: ProgramPdfOptions) {
  return renderToBuffer(<ProgramDocument data={data} options={options} />)
}
