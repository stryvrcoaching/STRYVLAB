import { FieldCondition, ResponseMap } from '@/types/assessment'

/**
 * Évalue si un champ doit s'afficher selon sa condition `show_if`.
 * Retourne true si pas de condition (toujours visible).
 *
 * allResponses : ResponseMap complète (tous blocs)
 * La recherche de `field_key` est globale — parcourt tous les blocs.
 */
export function evaluateCondition(
  condition: FieldCondition | undefined,
  allResponses: ResponseMap,
): boolean {
  if (!condition) return true

  // Chercher la valeur du champ déclencheur dans tous les blocs
  let triggerValue: string | number | string[] | boolean | undefined
  for (const blockResponses of Object.values(allResponses)) {
    if (condition.field_key in blockResponses) {
      triggerValue = blockResponses[condition.field_key]
      break
    }
  }

  switch (condition.operator) {
    case 'not_empty':
      return triggerValue !== undefined && triggerValue !== '' && triggerValue !== null

    case 'eq':
      return String(triggerValue ?? '') === String(condition.value ?? '')

    case 'neq':
      return String(triggerValue ?? '') !== String(condition.value ?? '')

    case 'includes':
      if (Array.isArray(triggerValue)) {
        return triggerValue.includes(condition.value ?? '')
      }
      return String(triggerValue ?? '') === String(condition.value ?? '')

    default:
      return true
  }
}
