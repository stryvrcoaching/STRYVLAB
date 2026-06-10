import type { CyclePhase } from '@/lib/cycle/cycleEngine'

export type CycleContext = 'nutrition' | 'training'

export interface PhaseContent {
  title: string
  subtitle: string
  bullets: string[]
  impact: string
}

export const PHASE_CONTENT: Record<CyclePhase, Record<CycleContext, PhaseContent>> = {
  follicular: {
    nutrition: {
      title: 'Phase folliculaire',
      subtitle: "J6–J13 · Sensibilité à l'insuline élevée",
      bullets: [
        "Tes glucides sont mieux utilisés pour l'énergie et la récupération musculaire.",
        "Bonne période pour maintenir tes apports sans dépasser — la perte de gras est naturellement facilitée.",
        'Appétit souvent modéré. Écoute tes signaux de faim.',
      ],
      impact: 'Calories neutres · Glucides bien tolérés · Période optimale déficit',
    },
    training: {
      title: 'Phase folliculaire',
      subtitle: 'J6–J13 · Énergie en progression',
      bullets: [
        "Force et endurance s'améliorent progressivement. Profite de cette fenêtre pour progresser.",
        'Récupération plus rapide entre les séances.',
        "Bonne phase pour augmenter les charges ou l'intensité.",
      ],
      impact: 'Force ↑ · Récupération ↑ · Endurance ↑',
    },
  },
  ovulatory: {
    nutrition: {
      title: 'Phase ovulatoire',
      subtitle: 'J14–J16 · Performances maximales',
      bullets: [
        "Pic d'œstrogènes — ton métabolisme est à son meilleur.",
        "Maintiens tes apports : c'est ta meilleure période pour performer sans sur-manger.",
        'Hydratation normale suffisante.',
      ],
      impact: 'Calories neutres · Métabolisme optimal · Phase optimale déficit',
    },
    training: {
      title: 'Phase ovulatoire',
      subtitle: 'J14–J16 · Pic de performance',
      bullets: [
        'Force, coordination et explosivité au maximum.',
        'Idéal pour les PRs et les séances les plus intenses.',
        'Profite de cette fenêtre courte — elle dure 2 à 3 jours.',
      ],
      impact: 'Force max · Coordination ↑ · Énergie max',
    },
  },
  luteal: {
    nutrition: {
      title: 'Phase lutéale',
      subtitle: 'J17–J28 · Besoins augmentés',
      bullets: [
        "Métabolisme légèrement accéléré (+5%). Tes besoins caloriques sont naturellement plus élevés.",
        "La rétention d'eau peut masquer la progression sur la balance — c'est normal et temporaire.",
        "Privilégie les glucides complexes pour soutenir l'énergie et limiter les fringales.",
      ],
      impact: 'Calories ↑ · Protéines ↑ · Glucides ↑ · Hydratation ↑',
    },
    training: {
      title: 'Phase lutéale',
      subtitle: 'J17–J28 · Énergie variable',
      bullets: [
        'Énergie plus variable selon les jours — écoute ton corps.',
        'Les séances modérées à intenses sont bien tolérées en début de phase.',
        'En fin de phase, privilégie la récupération active et la mobilité.',
      ],
      impact: 'Énergie variable · Récupération ↑ · Fin de phase : intensité ↓',
    },
  },
  menstrual: {
    nutrition: {
      title: 'Menstruation',
      subtitle: 'J1–J5 · Soutien et récupération',
      bullets: [
        'Besoins en fer augmentés — intègre des sources de fer héminique (viande rouge, lentilles).',
        'Oméga-3 anti-inflammatoires recommandés pour réduire les douleurs.',
        "Ne coupe pas les calories pendant cette phase — ton corps a besoin de ressources.",
      ],
      impact: 'Fer ↑ · Oméga-3 ↑ · Hydratation ↑ · Ne pas réduire les calories',
    },
    training: {
      title: 'Menstruation',
      subtitle: 'J1–J5 · Phase de récupération',
      bullets: [
        'Phase de récupération naturelle. Le mouvement léger est bénéfique.',
        'Favorise le yoga, le stretching et la mobilité plutôt que les séances lourdes.',
        "Si tu te sens bien, une séance modérée reste possible — écoute ton corps.",
      ],
      impact: 'Intensité ↓ · Mobilité ↑ · Récupération active recommandée',
    },
  },
}
