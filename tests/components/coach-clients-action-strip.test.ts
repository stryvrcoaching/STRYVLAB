import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import ClientsActionStrip from '@/components/coach/ClientsActionStrip'
import ClientActionPanels from '@/components/coach/ClientActionPanels'

function flattenElements(node: React.ReactNode): React.ReactElement[] {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(flattenElements)
  if (React.isValidElement(node)) {
    return [node, ...flattenElements(node.props.children)]
  }
  return []
}

describe('ClientsActionStrip', () => {
  it('renders the four validated tiles and only makes action tiles clickable', () => {
    const onOpenWithoutFormula = vi.fn()
    const onOpenToFollow = vi.fn()

    const tree = ClientsActionStrip({
      stats: { total: 12, active: 7, withoutFormula: 3, toFollow: 4 },
      onOpenWithoutFormula,
      onOpenToFollow,
    })

    const elements = flattenElements(tree)
    const labels = elements
      .filter((element) => element.type === 'p')
      .map((element) => element.props.children)

    expect(labels).toContain('Total clients')
    expect(labels).toContain('Clients actifs')
    expect(labels).toContain('Sans formule')
    expect(labels).toContain('À suivre')

    const buttons = elements.filter((element) => element.type === 'button')
    expect(buttons).toHaveLength(2)

    const withoutFormulaButton = buttons.find((element) => element.props['aria-label'] === 'Sans formule')
    expect(withoutFormulaButton).toBeTruthy()
    withoutFormulaButton?.props.onClick()
    expect(onOpenWithoutFormula).toHaveBeenCalledTimes(1)
  })
})

describe('ClientActionPanels', () => {
  it('shows grouped to-follow items and forwards the correct action callback', () => {
    const onOpenNotifications = vi.fn()

    const tree = ClientActionPanels({
      withoutFormulaOpen: false,
      toFollowOpen: true,
      withoutFormula: [],
      toFollow: [
        {
          priorityKey: 'coach_notification:c1:actionable-notifications',
          clientId: 'c1',
          clientName: 'Lina Moreau',
          score: 62,
          priority: 'important',
          state: 'open',
          kind: 'coach_notification',
          reason: '2 notifications coach non lues',
          sourceLabel: 'Notifications',
          primaryAction: 'open_notifications',
          secondaryActions: ['open_profile', 'mark_treated'],
          planned: false,
        },
      ],
      onCloseWithoutFormula: () => {},
      onCloseToFollow: () => {},
      onHeaderWithoutFormulaClick: () => {},
      onHeaderToFollowClick: () => {},
      onOpenClient: () => {},
      onAssignFormula: () => {},
      onOpenNotifications,
      onOpenAssessments: () => {},
      onOpenKanban: () => {},
      onPlanPriority: () => {},
      onRequestPlanChoice: () => {},
      onMarkTreated: () => {},
    })

    const elements = flattenElements(tree)
    const actionButton = elements.find(
      (element) => element.type === 'button' && element.props['aria-label'] === 'Ouvrir les notifications',
    )
    const labels = elements
      .filter((element) => element.type === 'span')
      .map((element) => element.props.children)

    expect(actionButton).toBeTruthy()
    expect(labels).toContain('Échange')
    actionButton?.props.onClick()
    expect(onOpenNotifications).toHaveBeenCalledWith('c1')
  })
})
