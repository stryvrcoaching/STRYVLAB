import type { CyclePhase } from '@/lib/cycle/cycleEngine'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

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

const PHASE_CONTENT_BY_LANG: Record<ClientLang, Record<CyclePhase, Record<CycleContext, PhaseContent>>> = {
  fr: PHASE_CONTENT,
  en: {
    follicular: {
      nutrition: {
        title: 'Follicular phase',
        subtitle: 'D6–D13 · High insulin sensitivity',
        bullets: [
          'Your carbs are used more efficiently for energy and muscle recovery.',
          'A good period to maintain your intake without overshooting. Fat loss is naturally easier.',
          'Appetite is often moderate. Listen to your hunger cues.',
        ],
        impact: 'Neutral calories · Carbs well tolerated · Optimal deficit window',
      },
      training: {
        title: 'Follicular phase',
        subtitle: 'D6–D13 · Rising energy',
        bullets: [
          'Strength and endurance improve progressively. Use this window to push progression.',
          'Faster recovery between sessions.',
          'A good phase to increase loads or intensity.',
        ],
        impact: 'Strength ↑ · Recovery ↑ · Endurance ↑',
      },
    },
    ovulatory: {
      nutrition: {
        title: 'Ovulatory phase',
        subtitle: 'D14–D16 · Peak performance',
        bullets: [
          'Estrogen peaks and your metabolism performs at its best.',
          'Keep your intake steady. This is your best phase to perform without overeating.',
          'Normal hydration is usually enough.',
        ],
        impact: 'Neutral calories · Optimal metabolism · Optimal deficit window',
      },
      training: {
        title: 'Ovulatory phase',
        subtitle: 'D14–D16 · Performance peak',
        bullets: [
          'Strength, coordination, and explosiveness are at their highest.',
          'Ideal for PRs and your hardest sessions.',
          'Make the most of this short window. It usually lasts 2 to 3 days.',
        ],
        impact: 'Max strength · Coordination ↑ · Max energy',
      },
    },
    luteal: {
      nutrition: {
        title: 'Luteal phase',
        subtitle: 'D17–D28 · Higher needs',
        bullets: [
          'Metabolism is slightly faster (+5%). Your calorie needs are naturally higher.',
          'Water retention can hide scale progress. This is normal and temporary.',
          'Prioritize complex carbs to support energy and limit cravings.',
        ],
        impact: 'Calories ↑ · Protein ↑ · Carbs ↑ · Hydration ↑',
      },
      training: {
        title: 'Luteal phase',
        subtitle: 'D17–D28 · Variable energy',
        bullets: [
          'Energy can vary more from day to day. Listen to your body.',
          'Moderate to hard sessions are usually well tolerated early in the phase.',
          'At the end of the phase, favor active recovery and mobility.',
        ],
        impact: 'Variable energy · Recovery ↑ · End of phase: intensity ↓',
      },
    },
    menstrual: {
      nutrition: {
        title: 'Menstrual phase',
        subtitle: 'D1–D5 · Support and recovery',
        bullets: [
          'Iron needs are higher. Include iron-rich foods like red meat or lentils.',
          'Anti-inflammatory omega-3s can help reduce discomfort.',
          'Do not cut calories during this phase. Your body needs resources.',
        ],
        impact: 'Iron ↑ · Omega-3 ↑ · Hydration ↑ · Do not reduce calories',
      },
      training: {
        title: 'Menstrual phase',
        subtitle: 'D1–D5 · Recovery phase',
        bullets: [
          'This is a natural recovery phase. Light movement is beneficial.',
          'Favor yoga, stretching, and mobility over very heavy sessions.',
          'If you feel good, a moderate session can still work. Listen to your body.',
        ],
        impact: 'Intensity ↓ · Mobility ↑ · Active recovery recommended',
      },
    },
  },
  es: {
    follicular: {
      nutrition: {
        title: 'Fase folicular',
        subtitle: 'D6–D13 · Alta sensibilidad a la insulina',
        bullets: [
          'Tus carbohidratos se utilizan mejor para la energía y la recuperación muscular.',
          'Es un buen periodo para mantener tus aportes sin pasarte. La pérdida de grasa se facilita de forma natural.',
          'El apetito suele ser moderado. Escucha tus señales de hambre.',
        ],
        impact: 'Calorías neutras · Carbohidratos bien tolerados · Fase óptima para el déficit',
      },
      training: {
        title: 'Fase folicular',
        subtitle: 'D6–D13 · Energía en aumento',
        bullets: [
          'La fuerza y la resistencia mejoran progresivamente. Aprovecha esta ventana para progresar.',
          'Recuperación más rápida entre sesiones.',
          'Buena fase para aumentar cargas o intensidad.',
        ],
        impact: 'Fuerza ↑ · Recuperación ↑ · Resistencia ↑',
      },
    },
    ovulatory: {
      nutrition: {
        title: 'Fase ovulatoria',
        subtitle: 'D14–D16 · Rendimiento máximo',
        bullets: [
          'El estrógeno alcanza su pico y tu metabolismo rinde al máximo.',
          'Mantén tus aportes. Es tu mejor fase para rendir sin comer de más.',
          'Una hidratación normal suele ser suficiente.',
        ],
        impact: 'Calorías neutras · Metabolismo óptimo · Fase óptima para el déficit',
      },
      training: {
        title: 'Fase ovulatoria',
        subtitle: 'D14–D16 · Pico de rendimiento',
        bullets: [
          'La fuerza, la coordinación y la explosividad están al máximo.',
          'Ideal para PRs y para las sesiones más intensas.',
          'Aprovecha esta ventana corta. Suele durar 2 o 3 días.',
        ],
        impact: 'Fuerza máxima · Coordinación ↑ · Energía máxima',
      },
    },
    luteal: {
      nutrition: {
        title: 'Fase lútea',
        subtitle: 'D17–D28 · Necesidades aumentadas',
        bullets: [
          'El metabolismo se acelera ligeramente (+5%). Tus necesidades calóricas son naturalmente más altas.',
          'La retención de agua puede ocultar el progreso en la báscula. Es normal y temporal.',
          'Prioriza los carbohidratos complejos para sostener la energía y limitar los antojos.',
        ],
        impact: 'Calorías ↑ · Proteínas ↑ · Carbohidratos ↑ · Hidratación ↑',
      },
      training: {
        title: 'Fase lútea',
        subtitle: 'D17–D28 · Energía variable',
        bullets: [
          'La energía puede variar más según el día. Escucha a tu cuerpo.',
          'Las sesiones moderadas a intensas suelen tolerarse bien al inicio de la fase.',
          'Al final de la fase, prioriza la recuperación activa y la movilidad.',
        ],
        impact: 'Energía variable · Recuperación ↑ · Final de fase: intensidad ↓',
      },
    },
    menstrual: {
      nutrition: {
        title: 'Fase menstrual',
        subtitle: 'D1–D5 · Apoyo y recuperación',
        bullets: [
          'Las necesidades de hierro aumentan. Incluye fuentes ricas en hierro como carne roja o lentejas.',
          'Los omega-3 antiinflamatorios pueden ayudar a reducir las molestias.',
          'No recortes calorías durante esta fase. Tu cuerpo necesita recursos.',
        ],
        impact: 'Hierro ↑ · Omega-3 ↑ · Hidratación ↑ · No reducir calorías',
      },
      training: {
        title: 'Fase menstrual',
        subtitle: 'D1–D5 · Fase de recuperación',
        bullets: [
          'Es una fase de recuperación natural. El movimiento suave es beneficioso.',
          'Prioriza yoga, estiramientos y movilidad en lugar de sesiones muy pesadas.',
          'Si te sientes bien, una sesión moderada sigue siendo posible. Escucha a tu cuerpo.',
        ],
        impact: 'Intensidad ↓ · Movilidad ↑ · Recuperación activa recomendada',
      },
    },
  },
}

export function getPhaseContent(
  lang: ClientLang,
  phase: CyclePhase,
  context: CycleContext,
): PhaseContent {
  return PHASE_CONTENT_BY_LANG[lang]?.[phase]?.[context] ?? PHASE_CONTENT[phase][context]
}
