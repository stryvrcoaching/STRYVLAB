export const COACH_INBOX_PREFERENCE_KEYS = [
  "notif_inbox_assessments",
  "notif_inbox_training",
  "notif_inbox_messages",
  "notif_inbox_checkins",
  "notif_inbox_nutrition",
  "notif_inbox_health_progress",
  "notif_inbox_administrative",
] as const;

export type CoachInboxPreferenceKey = (typeof COACH_INBOX_PREFERENCE_KEYS)[number];
export type CoachInboxPreferences = Record<CoachInboxPreferenceKey, boolean>;

export const DEFAULT_COACH_INBOX_PREFERENCES: CoachInboxPreferences = {
  notif_inbox_assessments: true,
  notif_inbox_training: true,
  notif_inbox_messages: true,
  notif_inbox_checkins: true,
  notif_inbox_nutrition: true,
  notif_inbox_health_progress: true,
  notif_inbox_administrative: true,
};

type CoachInboxNotification = {
  category: string | null | undefined;
  subcategory?: string | null;
};

/**
 * Critical alerts stay visible whatever the coach preference. The same mapping
 * accepts persisted categories and categories already prepared for the UI.
 */
export function getCoachInboxPreferenceKey(
  notification: CoachInboxNotification,
): CoachInboxPreferenceKey | null {
  const category = notification.category ?? "";
  const subcategory = notification.subcategory ?? "";

  if (["critical", "safety", "out_of_scope", "pattern_inquiry"].includes(category)) {
    return null;
  }

  if (["assessment"].includes(category)) return "notif_inbox_assessments";
  if (["training", "program_signal"].includes(category)) return "notif_inbox_training";
  if (["nutrition", "nutrition_trend"].includes(category)) return "notif_inbox_nutrition";
  if (["recovery", "recovery_flag", "progress", "weight_off_track"].includes(category)) {
    return "notif_inbox_health_progress";
  }
  if (category === "admin") return "notif_inbox_administrative";
  if (category === "feedback") return "notif_inbox_messages";

  if (category === "engagement") {
    if (subcategory === "coach_message_reply") return "notif_inbox_messages";
    if (["session_skip", "session_not_done"].includes(subcategory)) {
      return "notif_inbox_training";
    }
    if (subcategory === "reward_redemption") return "notif_inbox_administrative";
  }

  return "notif_inbox_checkins";
}

export function isCoachInboxNotificationEnabled(
  notification: CoachInboxNotification,
  preferences?: Partial<CoachInboxPreferences> | null,
) {
  const preferenceKey = getCoachInboxPreferenceKey(notification);
  return preferenceKey === null || preferences?.[preferenceKey] !== false;
}
