export type FeedbackEntityType =
  | "session"
  | "exercise"
  | "set"
  | "checkin"
  | "morpho"
  | "bilan"

export type FeedbackEmoji = "👍" | "💪" | "✅" | "🔥" | "❓"
export type FeedbackAuthorType = "client" | "coach"

export const FEEDBACK_EMOJIS: FeedbackEmoji[] = ["👍", "💪", "✅", "🔥", "❓"]

export interface FeedbackReaction {
  id: string
  feedback_id: string
  author_type: FeedbackAuthorType
  author_id: string
  emoji: FeedbackEmoji
  reply_text: string | null
  created_at: string
}

export interface CoachFeedback {
  id: string
  coach_id: string
  client_id: string
  entity_type: FeedbackEntityType
  entity_id: string
  entity_label: string | null
  body: string
  created_at: string
  reactions: FeedbackReaction[]
}

export const ENTITY_TYPE_LABEL: Record<FeedbackEntityType, string> = {
  session: "🏋️ Séance",
  exercise: "💪 Exercice",
  set: "💪 Set",
  checkin: "📊 Check-in",
  morpho: "📷 Morpho",
  bilan: "📋 Bilan",
}
