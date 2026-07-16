"use client"

import { useEffect, useRef } from "react"
import { type CheckinFlow, type CheckinData, type FlowStep, buildCheckinSummary } from "@/lib/client/checkin/flows"
import { type ChatMessage, type InteractiveMetadata } from "@/components/client/ChatBubble"
import { formatSleepHours } from "@/lib/client/checkin/sleepTimeFormat"
import { useClientT } from "@/components/client/ClientI18nProvider"

export interface CheckinFlowHandle {
  handleInteract: (messageId: string, key: string, value: number) => void
  handleSkip: (messageId: string, key: string) => void
}

export interface CheckinFlowProgress {
  collected: Record<string, number>
  stepIndex: number
}

interface ActiveCheckinFlowProps {
  flow: CheckinFlow
  hasSessionToday: boolean
  clientFirstName?: string | null
  initialProgress?: CheckinFlowProgress | null
  onAddMessage: (msg: ChatMessage) => void
  onUpdateMessage: (id: string, metaPatch: Partial<InteractiveMetadata>) => void
  onComplete: (data: CheckinData, summary: string, flowType: 'morning' | 'evening') => void
  onHandle: (h: CheckinFlowHandle) => void
  onProgress: (progress: CheckinFlowProgress) => void
}

function makeId() {
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const RHR_EDUCATION_KEY = 'checkin_rhr_education_seen_v1'

function buildInteractiveMessage(step: FlowStep): ChatMessage {
  const meta: InteractiveMetadata = {
    component: step.component,
    key: step.key,
    question: step.question,
    helperText: step.helperText,
    options: step.options,
    min: step.min,
    max: step.max,
    step: step.step,
    unit: step.unit,
    optional: step.optional,
    answered: false,
  }
  return {
    id: makeId(),
    role: 'assistant',
    content: step.question,
    message_type: 'interactive',
    metadata: meta,
    created_at: new Date().toISOString(),
  }
}

export function ActiveCheckinFlow({
  flow,
  hasSessionToday,
  clientFirstName,
  initialProgress,
  onAddMessage,
  onUpdateMessage,
  onComplete,
  onHandle,
  onProgress,
}: ActiveCheckinFlowProps) {
  const { lang, t } = useClientT()
  const collectedRef = useRef<Record<string, number>>(initialProgress?.collected ?? {})
  const stepIndexRef = useRef(initialProgress?.stepIndex ?? 0)
  const rhrEducationShownRef = useRef(false)

  function shouldShowRhrEducation(): boolean {
    if (rhrEducationShownRef.current) return false
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(RHR_EDUCATION_KEY) !== '1'
  }

  function markRhrEducationSeen() {
    rhrEducationShownRef.current = true
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RHR_EDUCATION_KEY, '1')
    }
  }

  function getVisibleSteps(): FlowStep[] {
    const ctx = { ...collectedRef.current, __has_session_today: hasSessionToday ? 1 : 0 }
    return flow.steps.filter(s => !s.condition || s.condition(ctx))
  }

  function addNextStep() {
    const visibleSteps = getVisibleSteps()
    const idx = stepIndexRef.current

    if (idx >= visibleSteps.length) {
      // All steps done — build CheckinData + summary
      const c = collectedRef.current
      const data: CheckinData = {}
      if (c.sleep_hours     !== undefined) data.sleep_hours     = c.sleep_hours
      if (c.sleep_quality   !== undefined) data.sleep_quality   = c.sleep_quality
      if (c.energy_level    !== undefined) data.energy_level    = c.energy_level
      if (c.stress_level    !== undefined) data.stress_level    = c.stress_level
      if (c.weight_kg       !== undefined) data.weight_kg       = c.weight_kg
      if (c.rhr_morning     !== undefined) data.rhr_morning     = c.rhr_morning
      if (c.hunger_level    !== undefined) data.hunger_level    = c.hunger_level
      if (c.muscle_soreness !== undefined) data.muscle_soreness = c.muscle_soreness
      if (c.daily_steps      !== undefined) data.daily_steps      = c.daily_steps

      const summary = buildCheckinSummary(lang, flow.type, data)
      onComplete(data, summary, flow.type)
      return
    }

    const step = visibleSteps[idx]

    if (step.key === 'rhr_morning' && shouldShowRhrEducation()) {
      markRhrEducationSeen()
      onAddMessage({
        id: makeId(),
        role: 'assistant',
        content: t('checkin.rhr.education'),
        message_type: 'text',
        created_at: new Date().toISOString(),
      })
      setTimeout(() => onAddMessage(buildInteractiveMessage(step)), 450)
      return
    }

    onAddMessage(buildInteractiveMessage(step))
  }

  // Build the handle once and expose it via onHandle
  const handle: CheckinFlowHandle = {
    handleInteract(messageId, key, value) {
      onUpdateMessage(messageId, { answered: true })
      collectedRef.current[key] = value

      // Display label for user bubble
      const visibleSteps = getVisibleSteps()
      const step = visibleSteps.find(s => s.key === key)
      let display = String(value)
      if (step?.component === 'chips') {
        const opt = step.options?.find(o => o.value === value)
        display = opt ? `${opt.emoji ?? ''} ${opt.label}`.trim() : display
      } else if (step?.component === 'time') {
        display = formatSleepHours(value)
      } else if (step?.unit) {
        display = `${value}${step.unit}`
      }

      onAddMessage({
        id: makeId(),
        role: 'user',
        content: display,
        message_type: 'quick_reply',
        created_at: new Date().toISOString(),
      })

      stepIndexRef.current += 1
      onProgress({
        collected: { ...collectedRef.current },
        stepIndex: stepIndexRef.current,
      })
      setTimeout(() => addNextStep(), 400)
    },

    handleSkip(messageId, _key) {
      onUpdateMessage(messageId, { answered: true })
      onAddMessage({
        id: makeId(),
        role: 'user',
        content: t('checkin.action.skip'),
        message_type: 'quick_reply',
        created_at: new Date().toISOString(),
      })
      stepIndexRef.current += 1
      onProgress({
        collected: { ...collectedRef.current },
        stepIndex: stepIndexRef.current,
      })
      setTimeout(() => addNextStep(), 400)
    },
  }

  // Start the flow on mount
  useEffect(() => {
    onHandle(handle)

    const greeting: ChatMessage = {
      id: makeId(),
      role: 'assistant',
        content: stepIndexRef.current > 0
          ? (clientFirstName
          ? t('checkin.resume.named', { name: clientFirstName })
          : t('checkin.resume.generic'))
        : (clientFirstName
          ? `${clientFirstName}, ${flow.greeting}`
          : flow.greeting),
      message_type: 'text',
      created_at: new Date().toISOString(),
    }
    onAddMessage(greeting)
    setTimeout(() => addNextStep(), 600)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update handle reference whenever deps change
  useEffect(() => {
    onHandle(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSessionToday])

  return null
}
