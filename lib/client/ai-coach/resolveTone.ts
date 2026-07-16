import type { ClientLang } from '@/lib/i18n/clientTranslations'

export type Tone = 'strict' | 'bienveillant' | 'motivant' | 'neutre'

const VALID: Tone[] = ['strict', 'bienveillant', 'motivant', 'neutre']

export function resolveTone(perClient: string | null, global: string | null): Tone {
  if (perClient && VALID.includes(perClient as Tone)) return perClient as Tone
  if (global && VALID.includes(global as Tone)) return global as Tone
  return 'bienveillant'
}

export type ToneStyle = {
  /** Distinct opener per moment — avoids repeating the same line everywhere. */
  openerMorning: (name: string) => string
  openerEvening: (name: string) => string
  openerClosing: (name: string) => string
  closerMorning: string
  closerEvening: string
  firmness: 'soft' | 'plain' | 'firm'
}

// "Kev" + "X, foo" / "Foo" -> "Kev, foo" ; "" -> "Foo" (capitalized standalone)
const lead = (name: string, withName: string, withoutName: string) =>
  name?.trim() ? `${name.trim()}, ${withName}` : withoutName

export const TONE_MATRIX: Record<ClientLang, Record<Tone, ToneStyle>> = {
  fr: {
    strict: {
      openerMorning: (n) => lead(n, 'on démarre la journée.', 'On démarre la journée.'),
      openerEvening: (n) => lead(n, 'bilan de ta journée.', 'Bilan de ta journée.'),
      openerClosing: (n) => lead(n, 'voilà ton récap.', 'Voilà ton récap.'),
      closerMorning: 'Reste concentré, exécution propre.',
      closerEvening: 'Récupère bien, on garde le cap.',
      firmness: 'firm',
    },
    bienveillant: {
      openerMorning: (n) => (n?.trim() ? `Salut ${n.trim()}, j'espère que tu as bien dormi.` : "J'espère que tu as bien dormi."),
      openerEvening: (n) => (n?.trim() ? `Bonsoir ${n.trim()}, on regarde ta journée ensemble.` : 'On regarde ta journée ensemble.'),
      openerClosing: (n) => `Voilà le récap de ta journée${n?.trim() ? `, ${n.trim()}` : ''}.`,
      closerMorning: 'On avance tranquillement, étape par étape.',
      closerEvening: 'Récupère bien ce soir, tu as fait ta part.',
      firmness: 'plain',
    },
    motivant: {
      openerMorning: (n) => (n?.trim() ? `Allez ${n.trim()}, nouvelle journée, on y va !` : 'Nouvelle journée, on y va !'),
      openerEvening: (n) => lead(n, 'on fait le bilan de la journée !', 'On fait le bilan de la journée !'),
      openerClosing: (n) => `Le récap du jour${n?.trim() ? `, ${n.trim()}` : ''} :`,
      closerMorning: 'On garde le rythme, à fond mais propre.',
      closerEvening: 'Bonne récup, demain on repart fort.',
      firmness: 'plain',
    },
    neutre: {
      openerMorning: (n) => `${n?.trim() ? n.trim() + ' — ' : ''}point du matin.`,
      openerEvening: (n) => `${n?.trim() ? n.trim() + ' — ' : ''}point du soir.`,
      openerClosing: (n) => `${n?.trim() ? n.trim() + ' — ' : ''}récap du jour.`,
      closerMorning: 'Bonne journée.',
      closerEvening: 'Bonne soirée, priorité à la récupération.',
      firmness: 'soft',
    },
  },
  en: {
    strict: {
      openerMorning: (n) => lead(n, 'let’s start the day.', 'Let’s start the day.'),
      openerEvening: (n) => lead(n, 'let’s review your day.', 'Let’s review your day.'),
      openerClosing: (n) => lead(n, 'here is your recap.', 'Here is your recap.'),
      closerMorning: 'Stay focused and execute cleanly.',
      closerEvening: 'Recover well, stay on track.',
      firmness: 'firm',
    },
    bienveillant: {
      openerMorning: (n) => (n?.trim() ? `Hi ${n.trim()}, I hope you slept well.` : 'I hope you slept well.'),
      openerEvening: (n) => (n?.trim() ? `Good evening ${n.trim()}, let’s look at your day together.` : 'Let’s look at your day together.'),
      openerClosing: (n) => `Here is your daily recap${n?.trim() ? `, ${n.trim()}` : ''}.`,
      closerMorning: 'We move forward calmly, step by step.',
      closerEvening: 'Recover well tonight, you did your part.',
      firmness: 'plain',
    },
    motivant: {
      openerMorning: (n) => (n?.trim() ? `Come on ${n.trim()}, new day, let’s go!` : 'New day, let’s go!'),
      openerEvening: (n) => lead(n, 'let’s review the day!', 'Let’s review the day!'),
      openerClosing: (n) => `Today’s recap${n?.trim() ? `, ${n.trim()}` : ''}:`,
      closerMorning: 'Keep the rhythm, all in but controlled.',
      closerEvening: 'Recover well, tomorrow we go again.',
      firmness: 'plain',
    },
    neutre: {
      openerMorning: (n) => `${n?.trim() ? `${n.trim()} — ` : ''}morning check-in.`,
      openerEvening: (n) => `${n?.trim() ? `${n.trim()} — ` : ''}evening check-in.`,
      openerClosing: (n) => `${n?.trim() ? `${n.trim()} — ` : ''}daily recap.`,
      closerMorning: 'Have a good day.',
      closerEvening: 'Good evening, recovery comes first.',
      firmness: 'soft',
    },
  },
  es: {
    strict: {
      openerMorning: (n) => lead(n, 'empezamos el día.', 'Empezamos el día.'),
      openerEvening: (n) => lead(n, 'vamos a revisar tu día.', 'Vamos a revisar tu día.'),
      openerClosing: (n) => lead(n, 'aquí va tu resumen.', 'Aquí va tu resumen.'),
      closerMorning: 'Mantente concentrado y ejecuta con precisión.',
      closerEvening: 'Recupérate bien, mantenemos el rumbo.',
      firmness: 'firm',
    },
    bienveillant: {
      openerMorning: (n) => (n?.trim() ? `Hola ${n.trim()}, espero que hayas dormido bien.` : 'Espero que hayas dormido bien.'),
      openerEvening: (n) => (n?.trim() ? `Buenas noches ${n.trim()}, vamos a revisar tu día juntos.` : 'Vamos a revisar tu día juntos.'),
      openerClosing: (n) => `Aquí tienes el resumen de tu día${n?.trim() ? `, ${n.trim()}` : ''}.`,
      closerMorning: 'Avanzamos con calma, paso a paso.',
      closerEvening: 'Recupérate bien esta noche, hiciste tu parte.',
      firmness: 'plain',
    },
    motivant: {
      openerMorning: (n) => (n?.trim() ? `Vamos ${n.trim()}, nuevo día, ¡a por ello!` : 'Nuevo día, ¡a por ello!'),
      openerEvening: (n) => lead(n, '¡vamos a hacer el balance del día!', '¡Vamos a hacer el balance del día!'),
      openerClosing: (n) => `Resumen del día${n?.trim() ? `, ${n.trim()}` : ''}:`,
      closerMorning: 'Mantén el ritmo, con intensidad pero control.',
      closerEvening: 'Buena recuperación, mañana seguimos fuerte.',
      firmness: 'plain',
    },
    neutre: {
      openerMorning: (n) => `${n?.trim() ? `${n.trim()} — ` : ''}punto de la mañana.`,
      openerEvening: (n) => `${n?.trim() ? `${n.trim()} — ` : ''}punto de la noche.`,
      openerClosing: (n) => `${n?.trim() ? `${n.trim()} — ` : ''}resumen del día.`,
      closerMorning: 'Que tengas un buen día.',
      closerEvening: 'Buenas noches, la recuperación es la prioridad.',
      firmness: 'soft',
    },
  },
}
