export interface SimulationScenarioLike {
  scenario_key?: string | null
  scenario_label?: string | null
}

export interface SimulationScenarioOption {
  key: string
  label: string
}

const DEFAULT_SCENARIO_KEY = 'default'
const DEFAULT_SCENARIO_LABEL = "Scénario principal"

export function normalizeScenarioKey(value?: string | null): string {
  return value?.trim() || DEFAULT_SCENARIO_KEY
}

export function normalizeScenarioLabel(value?: string | null, fallbackIndex?: number): string {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  if (typeof fallbackIndex === 'number' && fallbackIndex > 0) return `Scénario ${fallbackIndex}`
  return DEFAULT_SCENARIO_LABEL
}

export function collectSimulationScenarios(preps: SimulationScenarioLike[]): SimulationScenarioOption[] {
  const seen = new Map<string, SimulationScenarioOption>()

  for (const prep of preps) {
    const key = normalizeScenarioKey(prep.scenario_key)
    if (!seen.has(key)) {
      seen.set(key, {
        key,
        label: normalizeScenarioLabel(prep.scenario_label, seen.size === 0 ? undefined : seen.size + 1),
      })
    }
  }

  if (seen.size === 0) {
    seen.set(DEFAULT_SCENARIO_KEY, { key: DEFAULT_SCENARIO_KEY, label: DEFAULT_SCENARIO_LABEL })
  }

  return Array.from(seen.values())
}

export function createNextScenarioOption(existing: SimulationScenarioOption[]): SimulationScenarioOption {
  const count = existing.filter((scenario) => scenario.key !== DEFAULT_SCENARIO_KEY).length + 1
  return {
    key: `scenario-${Date.now()}-${count}`,
    label: `Scénario ${count}`,
  }
}
