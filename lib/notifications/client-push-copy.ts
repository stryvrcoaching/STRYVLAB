import type { ClientLang } from '@/lib/i18n/clientTranslations'

export type ClientPushCopyKey =
  | 'assessment.available'
  | 'assessment.reminder'
  | 'assessment.completed'
  | 'workout.available'
  | 'workout.updated'
  | 'nutrition.available'
  | 'nutrition.updated'
  | 'coach.message'
  | 'session.reminder'
  | 'session.overdue'
  | 'hydration.reminder'
  | 'meal.breakfast.missing'
  | 'meal.lunch.missing'
  | 'nutrition.protein.low'
  | 'checkin.morning'
  | 'checkin.evening'
  | 'checkin.morning.deferred'
  | 'checkin.evening.deferred'
  | 'level.up'
  | 'quest.sessions.completed'
  | 'quest.checkins.completed'
  | 'progress.weekly_goal.reached'
  | 'progress.weekly_goal.at_risk'
  | 'progress.personal_record'
  | 'progress.gentle_reengagement'
  | 'payment.received'
  | 'payment.reminder'
  | 'push.enabled'
  | 'generic.notification'

export type ClientPushCopyParams = {
  message?: string | null
  sessionName?: string | null
  level?: string | null
  proteinRemaining?: number | null
  exerciseName?: string | null
  weightKg?: number | null
  reps?: number | null
  remainingSessions?: number | null
  inactiveDays?: number | null
  amount?: number | null
  dueDate?: string | null
  formulaName?: string | null
}

export type ClientPushCopy = {
  title: string
  body: string
  chat?: string
}

type LocalizedCopyFactory = (
  params: ClientPushCopyParams,
) => ClientPushCopy

const LEVEL_LABELS: Record<
  string,
  Record<ClientLang, string>
> = {
  iron: {
    fr: 'Métal',
    en: 'Iron',
    es: 'Hierro',
  },
  bronze: {
    fr: 'Bronze',
    en: 'Bronze',
    es: 'Bronce',
  },
  silver: {
    fr: 'Argent',
    en: 'Silver',
    es: 'Plata',
  },
  gold: {
    fr: 'Or',
    en: 'Gold',
    es: 'Oro',
  },
  platinum: {
    fr: 'Platine',
    en: 'Platinum',
    es: 'Platino',
  },
  diamond: {
    fr: 'Diamant',
    en: 'Diamond',
    es: 'Diamante',
  },
  master: {
    fr: 'Maître',
    en: 'Master',
    es: 'Maestro',
  },
  olympian: {
    fr: 'Olympien',
    en: 'Olympian',
    es: 'Olímpico',
  },
}

function normalizeDynamicValue(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function formatFallbackLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function resolveLevelLabel(
  rawLevel: string | null | undefined,
  lang: ClientLang,
): string {
  const normalized = normalizeDynamicValue(rawLevel)?.toLowerCase()

  if (!normalized) {
    return lang === 'fr'
      ? 'suivant'
      : lang === 'es'
        ? 'siguiente'
        : 'next'
  }

  return (
    LEVEL_LABELS[normalized]?.[lang]
    ?? formatFallbackLabel(normalized)
  )
}

const copy: Record<
  ClientPushCopyKey,
  Record<ClientLang, LocalizedCopyFactory>
> = {
  'assessment.available': {
    fr: () => ({
      title: 'Ton bilan est disponible',
      body: 'Tu peux le compléter depuis l’application.',
    }),
    en: () => ({
      title: 'Your assessment is available',
      body: 'You can complete it in the app.',
    }),
    es: () => ({
      title: 'Tu evaluación está disponible',
      body: 'Puedes completarla desde la aplicación.',
    }),
  },

  'assessment.reminder': {
    fr: () => ({
      title: 'Ton bilan est toujours à compléter',
      body: 'Prends quelques minutes pour le terminer et garder ton suivi à jour.',
    }),
    en: () => ({
      title: 'Your assessment is still pending',
      body: 'Take a few minutes to complete it and keep your tracking up to date.',
    }),
    es: () => ({
      title: 'Tu evaluación sigue pendiente',
      body: 'Tómate unos minutos para completarla y mantener tu seguimiento al día.',
    }),
  },

  'assessment.completed': {
    fr: () => ({
      title: 'Bilan complété',
      body: 'Ton bilan a bien été enregistré.',
    }),
    en: () => ({
      title: 'Assessment completed',
      body: 'Your assessment has been saved.',
    }),
    es: () => ({
      title: 'Evaluación completada',
      body: 'Tu evaluación se ha guardado.',
    }),
  },

  'workout.available': {
    fr: () => ({
      title: 'Ton programme est disponible',
      body: 'Retrouve tes séances et enregistre tes performances.',
    }),
    en: () => ({
      title: 'Your training program is available',
      body: 'View your sessions and log your performance.',
    }),
    es: () => ({
      title: 'Tu programa de entrenamiento está disponible',
      body: 'Consulta tus sesiones y registra tu rendimiento.',
    }),
  },

  'workout.updated': {
    fr: () => ({
      title: 'Ton programme a été mis à jour',
      body: 'Consulte les changements dans tes séances.',
    }),
    en: () => ({
      title: 'Your training program has been updated',
      body: 'View the changes in your sessions.',
    }),
    es: () => ({
      title: 'Tu programa de entrenamiento se ha actualizado',
      body: 'Consulta los cambios en tus sesiones.',
    }),
  },

  'nutrition.available': {
    fr: () => ({
      title: 'Ton protocole nutritionnel est disponible',
      body: 'Retrouve tes objectifs et suis ton alimentation.',
    }),
    en: () => ({
      title: 'Your nutrition plan is available',
      body: 'View your targets and track your nutrition.',
    }),
    es: () => ({
      title: 'Tu plan nutricional está disponible',
      body: 'Consulta tus objetivos y registra tu alimentación.',
    }),
  },

  'nutrition.updated': {
    fr: () => ({
      title: 'Ton protocole nutritionnel a été mis à jour',
      body: 'Consulte tes nouveaux objectifs dans l’application.',
    }),
    en: () => ({
      title: 'Your nutrition plan has been updated',
      body: 'View your updated targets in the app.',
    }),
    es: () => ({
      title: 'Tu plan nutricional se ha actualizado',
      body: 'Consulta tus nuevos objetivos en la aplicación.',
    }),
  },

  'coach.message': {
    fr: ({ message }) => ({
      title: 'Message de ton coach',
      body: normalizeDynamicValue(message) ?? '',
    }),
    en: ({ message }) => ({
      title: 'Message from your coach',
      body: normalizeDynamicValue(message) ?? '',
    }),
    es: ({ message }) => ({
      title: 'Mensaje de tu coach',
      body: normalizeDynamicValue(message) ?? '',
    }),
  },

  'session.reminder': {
    fr: ({ sessionName }) => ({
      title: 'Séance prévue aujourd’hui',
      body: normalizeDynamicValue(sessionName)
        ? `« ${normalizeDynamicValue(sessionName)} » est disponible dans ton programme.`
        : 'Ta séance est disponible dans ton programme.',
    }),
    en: ({ sessionName }) => ({
      title: 'Session scheduled for today',
      body: normalizeDynamicValue(sessionName)
        ? `“${normalizeDynamicValue(sessionName)}” is available in your program.`
        : 'Your session is available in your program.',
    }),
    es: ({ sessionName }) => ({
      title: 'Sesión prevista para hoy',
      body: normalizeDynamicValue(sessionName)
        ? `«${normalizeDynamicValue(sessionName)}» está disponible en tu programa.`
        : 'Tu sesión está disponible en tu programa.',
    }),
  },

  'hydration.reminder': {
    fr: () => ({
      title: 'Pense à t’hydrater',
      body: 'Ajoute ton eau pour suivre ta cible du jour.',
    }),
    en: () => ({
      title: 'Remember to hydrate',
      body: 'Log your water to track today’s target.',
    }),
    es: () => ({
      title: 'Recuerda hidratarte',
      body: 'Registra tu agua para seguir el objetivo de hoy.',
    }),
  },

  'session.overdue': {
    fr: ({ sessionName }) => ({
      title: 'Ta séance est toujours en attente',
      body: normalizeDynamicValue(sessionName)
        ? `« ${normalizeDynamicValue(sessionName)} » n’est pas encore complétée.`
        : 'Ta séance prévue aujourd’hui n’est pas encore complétée.',
    }),
    en: ({ sessionName }) => ({
      title: 'Your session is still pending',
      body: normalizeDynamicValue(sessionName)
        ? `“${normalizeDynamicValue(sessionName)}” has not been completed yet.`
        : 'Your scheduled session has not been completed yet.',
    }),
    es: ({ sessionName }) => ({
      title: 'Tu sesión sigue pendiente',
      body: normalizeDynamicValue(sessionName)
        ? `«${normalizeDynamicValue(sessionName)}» aún no está completada.`
        : 'Tu sesión prevista aún no está completada.',
    }),
  },

  'meal.breakfast.missing': {
    fr: () => ({ title: 'Petit-déjeuner non renseigné', body: 'Pense à ajouter ton petit-déjeuner pour garder ton suivi à jour.' }),
    en: () => ({ title: 'Breakfast not logged', body: 'Add your breakfast to keep your tracking up to date.' }),
    es: () => ({ title: 'Desayuno sin registrar', body: 'Añade tu desayuno para mantener tu seguimiento al día.' }),
  },

  'meal.lunch.missing': {
    fr: () => ({ title: 'Déjeuner non renseigné', body: 'Pense à ajouter ton déjeuner pour garder ton suivi à jour.' }),
    en: () => ({ title: 'Lunch not logged', body: 'Add your lunch to keep your tracking up to date.' }),
    es: () => ({ title: 'Comida sin registrar', body: 'Añade tu comida para mantener tu seguimiento al día.' }),
  },

  'nutrition.protein.low': {
    fr: ({ proteinRemaining }) => ({
      title: 'Protéines à compléter',
      body: proteinRemaining && proteinRemaining > 0
        ? `Il te reste environ ${Math.round(proteinRemaining)} g de protéines à répartir aujourd’hui.`
        : 'Vérifie tes apports en protéines pour la journée.',
    }),
    en: ({ proteinRemaining }) => ({
      title: 'Protein to catch up',
      body: proteinRemaining && proteinRemaining > 0
        ? `You have about ${Math.round(proteinRemaining)} g of protein left for today.`
        : 'Check your protein intake for today.',
    }),
    es: ({ proteinRemaining }) => ({
      title: 'Proteínas por completar',
      body: proteinRemaining && proteinRemaining > 0
        ? `Te quedan unos ${Math.round(proteinRemaining)} g de proteínas para hoy.`
        : 'Revisa tus proteínas para hoy.',
    }),
  },

  'checkin.morning': {
    fr: () => ({
      title: 'Check-in du matin',
      body: 'Comment s’est passée ta nuit ?',
    }),
    en: () => ({
      title: 'Morning check-in',
      body: 'How did you sleep?',
    }),
    es: () => ({
      title: 'Check-in de la mañana',
      body: '¿Cómo dormiste?',
    }),
  },

  'checkin.evening': {
    fr: () => ({
      title: 'Check-in du soir',
      body: 'Comment te sens-tu ce soir ?',
    }),
    en: () => ({
      title: 'Evening check-in',
      body: 'How are you feeling this evening?',
    }),
    es: () => ({
      title: 'Check-in de la noche',
      body: '¿Cómo te sientes esta noche?',
    }),
  },

  'checkin.morning.deferred': {
    fr: () => ({
      title: 'Check-in du matin',
      body: 'Tu peux le compléter quand tu es prêt.',
      chat: 'Ton check-in du matin reste disponible depuis le bouton Check-in.',
    }),
    en: () => ({
      title: 'Morning check-in',
      body: 'You can complete it when you are ready.',
      chat: 'Your morning check-in is still available from the Check-in button.',
    }),
    es: () => ({
      title: 'Check-in de la mañana',
      body: 'Puedes completarlo cuando estés listo.',
      chat: 'Tu check-in de la mañana sigue disponible desde el botón Check-in.',
    }),
  },

  'checkin.evening.deferred': {
    fr: () => ({
      title: 'Check-in du soir',
      body: 'Tu peux le compléter quand tu es prêt.',
      chat: 'Ton check-in du soir reste disponible depuis le bouton Check-in.',
    }),
    en: () => ({
      title: 'Evening check-in',
      body: 'You can complete it when you are ready.',
      chat: 'Your evening check-in is still available from the Check-in button.',
    }),
    es: () => ({
      title: 'Check-in de la noche',
      body: 'Puedes completarlo cuando estés listo.',
      chat: 'Tu check-in de la noche sigue disponible desde el botón Check-in.',
    }),
  },

  'level.up': {
    fr: ({ level }) => ({
      title: 'Nouveau niveau atteint',
      body: `Tu as atteint le niveau ${resolveLevelLabel(level, 'fr')}.`,
    }),
    en: ({ level }) => ({
      title: 'New level reached',
      body: `You reached the ${resolveLevelLabel(level, 'en')} level.`,
    }),
    es: ({ level }) => ({
      title: 'Nuevo nivel alcanzado',
      body: `Has alcanzado el nivel ${resolveLevelLabel(level, 'es')}.`,
    }),
  },

  'quest.sessions.completed': {
    fr: () => ({
      title: 'Quête hebdomadaire accomplie',
      body: '3 séances complétées cette semaine · +100 points.',
    }),
    en: () => ({
      title: 'Weekly quest completed',
      body: '3 sessions completed this week · +100 points.',
    }),
    es: () => ({
      title: 'Misión semanal completada',
      body: '3 sesiones completadas esta semana · +100 puntos.',
    }),
  },

  'quest.checkins.completed': {
    fr: () => ({
      title: 'Quête hebdomadaire accomplie',
      body: '5 check-ins complétés cette semaine · +50 points.',
    }),
    en: () => ({
      title: 'Weekly quest completed',
      body: '5 check-ins completed this week · +50 points.',
    }),
    es: () => ({
      title: 'Misión semanal completada',
      body: '5 check-ins completados esta semana · +50 puntos.',
    }),
  },

  'progress.weekly_goal.reached': {
    fr: () => ({
      title: 'Objectif hebdomadaire atteint',
      body: 'Belle régularité : ton objectif de séances de la semaine est atteint.',
    }),
    en: () => ({
      title: 'Weekly goal reached',
      body: 'Great consistency: you reached your weekly session goal.',
    }),
    es: () => ({
      title: 'Objetivo semanal alcanzado',
      body: 'Buena constancia: has alcanzado tu objetivo semanal de sesiones.',
    }),
  },

  'progress.weekly_goal.at_risk': {
    fr: ({ remainingSessions }) => ({
      title: 'Ton objectif de la semaine est encore accessible',
      body: remainingSessions && remainingSessions > 1
        ? `Il reste ${remainingSessions} séances pour atteindre ton objectif cette semaine.`
        : 'Il reste une séance pour atteindre ton objectif cette semaine.',
    }),
    en: ({ remainingSessions }) => ({
      title: 'Your weekly goal is still within reach',
      body: remainingSessions && remainingSessions > 1
        ? `${remainingSessions} sessions remain to reach your goal this week.`
        : 'One session remains to reach your goal this week.',
    }),
    es: ({ remainingSessions }) => ({
      title: 'Tu objetivo semanal sigue a tu alcance',
      body: remainingSessions && remainingSessions > 1
        ? `Te quedan ${remainingSessions} sesiones para alcanzar tu objetivo esta semana.`
        : 'Te queda una sesión para alcanzar tu objetivo esta semana.',
    }),
  },

  'progress.personal_record': {
    fr: ({ exerciseName, weightKg, reps }) => ({
      title: 'Nouveau record personnel',
      body: normalizeDynamicValue(exerciseName) && weightKg && reps
        ? `${normalizeDynamicValue(exerciseName)} : ${weightKg} kg × ${reps} reps.`
        : 'Tu viens de dépasser ta meilleure performance enregistrée.',
    }),
    en: ({ exerciseName, weightKg, reps }) => ({
      title: 'New personal record',
      body: normalizeDynamicValue(exerciseName) && weightKg && reps
        ? `${normalizeDynamicValue(exerciseName)}: ${weightKg} kg × ${reps} reps.`
        : 'You just beat your best recorded performance.',
    }),
    es: ({ exerciseName, weightKg, reps }) => ({
      title: 'Nuevo récord personal',
      body: normalizeDynamicValue(exerciseName) && weightKg && reps
        ? `${normalizeDynamicValue(exerciseName)}: ${weightKg} kg × ${reps} repeticiones.`
        : 'Acabas de superar tu mejor rendimiento registrado.',
    }),
  },

  'progress.gentle_reengagement': {
    fr: ({ inactiveDays }) => ({
      title: 'Ton suivi peut reprendre quand tu veux',
      body: inactiveDays && inactiveDays > 0
        ? `Aucune activité n’a été renseignée depuis ${inactiveDays} jours. Reprends simplement par ce qui te convient aujourd’hui.`
        : 'Reprends simplement par ce qui te convient aujourd’hui.',
    }),
    en: ({ inactiveDays }) => ({
      title: 'Your tracking can resume whenever you are ready',
      body: inactiveDays && inactiveDays > 0
        ? `No activity has been logged for ${inactiveDays} days. Start again with what works for you today.`
        : 'Start again with what works for you today.',
    }),
    es: ({ inactiveDays }) => ({
      title: 'Puedes retomar tu seguimiento cuando quieras',
      body: inactiveDays && inactiveDays > 0
        ? `No se ha registrado actividad en ${inactiveDays} días. Retoma con lo que te convenga hoy.`
        : 'Retoma con lo que te convenga hoy.',
    }),
  },

  'payment.received': {
    fr: () => ({
      title: 'Paiement confirmé',
      body: 'Ton paiement a bien été enregistré.',
    }),
    en: () => ({
      title: 'Payment confirmed',
      body: 'Your payment has been recorded.',
    }),
    es: () => ({
      title: 'Pago confirmado',
      body: 'Tu pago se ha registrado.',
    }),
  },

  'payment.reminder': {
    fr: ({ amount, dueDate, formulaName }) => ({
      title: 'Rappel de paiement',
      body: [
        formulaName ? `${formulaName}` : 'Ton accompagnement',
        amount != null ? `· ${Number(amount).toFixed(0)} €` : null,
        dueDate ? `· échéance ${dueDate}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    }),
    en: ({ amount, dueDate, formulaName }) => ({
      title: 'Payment reminder',
      body: [
        formulaName ? `${formulaName}` : 'Your coaching',
        amount != null ? `· ${Number(amount).toFixed(0)} €` : null,
        dueDate ? `· due ${dueDate}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    }),
    es: ({ amount, dueDate, formulaName }) => ({
      title: 'Recordatorio de pago',
      body: [
        formulaName ? `${formulaName}` : 'Tu coaching',
        amount != null ? `· ${Number(amount).toFixed(0)} €` : null,
        dueDate ? `· vence ${dueDate}` : null,
      ]
        .filter(Boolean)
        .join(' '),
    }),
  },

  'push.enabled': {
    fr: () => ({
      title: 'Notifications activées',
      body: 'Cet appareil recevra désormais les notifications STRYVR.',
    }),
    en: () => ({
      title: 'Notifications enabled',
      body: 'This device will now receive STRYVR notifications.',
    }),
    es: () => ({
      title: 'Notificaciones activadas',
      body: 'Este dispositivo recibirá ahora las notificaciones de STRYVR.',
    }),
  },

  'generic.notification': {
    fr: ({ message }) => ({
      title: 'Nouvelle notification',
      body: normalizeDynamicValue(message) ?? '',
    }),
    en: ({ message }) => ({
      title: 'New notification',
      body: normalizeDynamicValue(message) ?? '',
    }),
    es: ({ message }) => ({
      title: 'Nueva notificación',
      body: normalizeDynamicValue(message) ?? '',
    }),
  },
}

export function getClientPushCopy(
  key: ClientPushCopyKey,
  lang: ClientLang,
  params: ClientPushCopyParams = {},
): ClientPushCopy {
  return copy[key][lang](params)
}
