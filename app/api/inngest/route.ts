import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { checkinStreakEvaluateFunction } from '@/lib/inngest/functions/checkin-streak-evaluate'
import { pointsLevelUpdateFunction } from '@/lib/inngest/functions/points-level-update'
import { checkinStreakExpireFunction } from '@/lib/inngest/functions/checkin-streak-expire'
import { checkinReminderSendFunction } from '@/lib/inngest/functions/checkin-reminder-send'
import { mealAnalyzeFunction } from '@/lib/inngest/functions/meal-analyze'
import { adaptiveTdeeFunction } from '@/lib/inngest/functions/adaptive-tdee'
import { chatArchiveFunction } from '@/lib/inngest/functions/chat-archive'
import { chatMorningBriefFunction } from '@/lib/inngest/functions/chat-morning-brief'
import { chatEveningBriefFunction } from '@/lib/inngest/functions/chat-evening-brief'
import { checkinDeferReminderFunction } from '@/lib/inngest/functions/checkin-defer-reminder'
import { assessmentAutomationsFunction } from '@/lib/inngest/functions/assessment-automations'
import { assessmentPendingRemindersFunction } from '@/lib/inngest/functions/assessment-pending-reminders'
import { nutritionProgressionEvaluateFunction } from '@/lib/inngest/functions/nutrition-progression-evaluate'
import {
  trainingEngagementRemindersFunction,
  trainingProgressionNotificationsFunction,
} from '@/lib/inngest/functions/training-progression-notifications'
import { appointmentRemindersFunction } from '@/lib/inngest/functions/appointment-reminders'
import { clientEngagementRemindersFunction } from '@/lib/inngest/functions/client-engagement-reminders'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkinStreakEvaluateFunction,
    pointsLevelUpdateFunction,
    checkinStreakExpireFunction,
    checkinReminderSendFunction,
    mealAnalyzeFunction,
    adaptiveTdeeFunction,
    chatArchiveFunction,
    chatMorningBriefFunction,
    chatEveningBriefFunction,
    checkinDeferReminderFunction,
    assessmentAutomationsFunction,
    assessmentPendingRemindersFunction,
    nutritionProgressionEvaluateFunction,
    trainingProgressionNotificationsFunction,
    trainingEngagementRemindersFunction,
    appointmentRemindersFunction,
    clientEngagementRemindersFunction,
  ],
})
