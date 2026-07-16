export const FEEDBACK_WORKSPACES = ['client_pwa', 'platform_web'] as const
export type FeedbackWorkspace = (typeof FEEDBACK_WORKSPACES)[number]

export const FEEDBACK_CATEGORIES = ['bug', 'usability', 'suggestion'] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export const FEEDBACK_PRIORITIES = ['low', 'medium', 'critical'] as const
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number]

export const FEEDBACK_STATUSES = ['new', 'reviewed', 'planned', 'done', 'dismissed'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_EMOJIS = ['👍', '🔥', '👏', '💪', '❤️'] as const
export type FeedbackEmoji = (typeof FEEDBACK_EMOJIS)[number]

export interface CoachFeedbackReaction {
  id: string
  emoji: FeedbackEmoji
  reply_text: string | null
  author_type: 'coach' | 'client'
  created_at: string
}

export interface CoachFeedback {
  id: string
  body: string
  created_at: string
  reactions: CoachFeedbackReaction[]
}
