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

export const TONE_MATRIX: Record<Tone, ToneStyle> = {
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
}
