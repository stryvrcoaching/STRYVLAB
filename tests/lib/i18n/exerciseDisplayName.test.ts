import { describe, expect, it } from 'vitest'
import { createExerciseNameResolver } from '@/lib/i18n/exerciseDisplayName'

describe('createExerciseNameResolver', () => {
  it('uses a catalogue ID translation before the legacy French-name key', () => {
    const resolve = createExerciseNameResolver('es', [
      { exerciseId: 'catalog-leg-extension', name: 'Extensión de piernas en máquina' },
      { exerciseId: 'Leg extension', name: 'Extensión de piernas' },
    ])

    expect(resolve('Leg extension', 'catalog-leg-extension')).toBe('Extensión de piernas en máquina')
  })

  it('uses the legacy French-name key when a programme has no catalogue ID', () => {
    const resolve = createExerciseNameResolver('es', [
      { exerciseId: 'Développé couché barre', name: 'Press de banca con barra' },
    ])

    expect(resolve('Développé couché barre')).toBe('Press de banca con barra')
  })

  it('uses the reviewed Spanish fallback while a catalogue row is still missing', () => {
    const resolve = createExerciseNameResolver('es', [])

    expect(resolve('Leg extension')).toBe('Extensión de piernas')
  })
})
