import { Resend } from 'resend'
import type { CoachPlan } from '@/lib/billing/plans'
import { renderStryvEmail } from '@/lib/email/template'

export type CoachTrialOnboardingEmailKey = 'setup' | 'workflow' | 'progress' | 'trial_ending'

export type CoachTrialProgress = {
  clientCount: number
  programCount: number
  nutritionProtocolCount: number
}

type CoachTrialOnboardingEmailParams = CoachTrialProgress & {
  to: string
  coachName?: string | null
  plan: CoachPlan
  sequenceKey: CoachTrialOnboardingEmailKey
  trialEndsAt: Date
}

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stryvlab.com'
const FROM = `STRYV lab <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`

const PLAN_PRICES: Record<CoachPlan, string> = {
  solo: '29 € / mois',
  pro: '79 € / mois',
  studio: '129 € / mois',
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character] ?? character)
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(value)
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function emailContent(key: CoachTrialOnboardingEmailKey, progress: CoachTrialProgress, trialEndsAt: Date, plan: CoachPlan) {
  const clients = plural(progress.clientCount, 'client')
  const programs = plural(progress.programCount, 'programme')
  const protocols = plural(progress.nutritionProtocolCount, 'protocole')

  switch (key) {
    case 'setup': {
      const hasClient = progress.clientCount > 0
      return hasClient
        ? {
            subject: 'Votre premier suivi prend forme',
            eyebrow: 'Premier repère',
            title: 'Vous avez lancé le mouvement.',
            copy: `Votre premier client est déjà dans STRYV lab. La prochaine étape est simple : transformez son contexte en un suivi clair, puis ajustez au fil des retours.`,
            tip: 'Commencez par un bilan ou un objectif précis. Un suivi utile se construit avec un premier signal fiable, pas avec une configuration parfaite.',
            ctaLabel: 'Ouvrir mes athlètes',
            ctaPath: '/coach/athletes',
          }
        : {
            subject: 'Le meilleur point de départ pour votre essai',
            eyebrow: 'Premier repère',
            title: 'Commencez par un seul suivi.',
            copy: 'Ne cherchez pas à tout configurer dès aujourd’hui. Ajoutez un premier client et utilisez STRYV lab sur un cas réel : c’est le moyen le plus rapide de voir si l’outil soutient vraiment votre façon de coacher.',
            tip: 'Choisissez un accompagnement actif. Vous pourrez ensuite construire le profil, le bilan, la prescription et les retours dans le même contexte.',
            ctaLabel: 'Ajouter mon premier client',
            ctaPath: '/coach/athletes',
          }
    }
    case 'workflow':
      return {
        subject: 'Avant la prescription : retrouvez le contexte',
        eyebrow: 'Méthode de travail',
        title: 'La décision vient avant la prescription.',
        copy: 'Un bon programme ne commence pas par une liste d’exercices. Il commence par le contexte du client : objectif, contraintes, historique, retours et niveau d’engagement. STRYV lab sert à garder ce raisonnement au même endroit.',
        tip: progress.clientCount > 0
          ? `Vous avez actuellement ${clients}. Prenez un de ces profils et posez une première intention de suivi avant de créer ou d’ajuster sa prescription.`
          : 'Quand vous ajouterez votre premier client, commencez par son objectif et ses contraintes avant de construire le programme.',
        ctaLabel: progress.clientCount > 0 ? 'Voir mes athlètes' : 'Préparer mon espace coach',
        ctaPath: progress.clientCount > 0 ? '/coach/athletes' : '/coach/settings',
      }
    case 'progress': {
      const elements = [
        progress.clientCount > 0 ? clients : null,
        progress.programCount > 0 ? programs : null,
        progress.nutritionProtocolCount > 0 ? protocols : null,
      ].filter(Boolean)
      const snapshot = elements.length > 0 ? elements.join(' · ') : 'votre espace est encore à poser'
      return {
        subject: 'Votre espace coach, en un coup d’œil',
        eyebrow: 'Point d’étape',
        title: elements.length > 0 ? 'Ce que vous avez déjà posé.' : 'Votre prochain repère est simple.',
        copy: elements.length > 0
          ? `Depuis le début de votre essai : ${snapshot}. Ce ne sont pas des métriques marketing ; ce sont les éléments concrets de votre environnement de coaching.`
          : 'Votre essai est toujours ouvert. La meilleure prochaine action est de créer un suivi réel plutôt que de parcourir les fonctionnalités une par une.',
        tip: elements.length > 0
          ? 'Pour la suite, cherchez une boucle complète : un profil, une intention de suivi, une prescription, puis un retour client qui vous aide à ajuster.'
          : 'Un seul client suffit pour tester le cycle complet : contexte → décision → accompagnement → ajustement.',
        ctaLabel: elements.length > 0 ? 'Continuer dans STRYV lab' : 'Créer un premier suivi',
        ctaPath: elements.length > 0 ? '/coach' : '/coach/athletes',
      }
    }
    case 'trial_ending':
      return {
        subject: 'Votre essai STRYV lab se termine demain',
        eyebrow: 'Votre accès',
        title: 'Demain, votre essai arrive à son terme.',
        copy: `Votre accès ${plan === 'pro' ? 'Pro' : plan === 'studio' ? 'Studio' : 'Solo'} reste pleinement disponible jusqu’au ${formatDate(trialEndsAt)}. Ensuite, votre abonnement se poursuivra à ${PLAN_PRICES[plan]}.`,
        tip: 'Prenez une minute pour vérifier votre formule et vos informations de facturation. Vous gardez le contrôle : la gestion ou la résiliation se fait depuis vos réglages.',
        ctaLabel: 'Gérer mon abonnement',
        ctaPath: '/coach/settings',
      }
  }
}

export async function sendCoachTrialOnboardingEmail({
  to,
  coachName,
  plan,
  sequenceKey,
  trialEndsAt,
  ...progress
}: CoachTrialOnboardingEmailParams) {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')

  const content = emailContent(sequenceKey, progress, trialEndsAt, plan)
  const safeName = coachName?.trim() ? ` ${escapeHtml(coachName.trim())}` : ''
  const safeTitle = escapeHtml(content.title)
  const safeCopy = escapeHtml(content.copy)
  const safeTip = escapeHtml(content.tip)
  const safeCta = escapeHtml(content.ctaLabel)
  const url = `${SITE_URL}${content.ctaPath}`

  await resend.emails.send({
    from: FROM,
    to,
    subject: content.subject,
    html: renderStryvEmail({
      productLabel: 'Espace coach',
      preheader: safeCopy,
      body: `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.78);">Bonjour${safeName},</p>
      <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#69d0ac;">${escapeHtml(content.eyebrow)}</p>
      <h1 style="max-width:440px;margin:0 0 18px;font-size:30px;line-height:1.14;letter-spacing:-.03em;color:#fff;">${safeTitle}</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:rgba(255,255,255,.72);">${safeCopy}</p>
      <div style="margin:0 0 28px;border-left:2px solid #c6b48b;padding:3px 0 3px 14px;"><p style="margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.68);"><strong style="color:#fff;">Le bon repère :</strong> ${safeTip}</p></div>
      <a href="${url}" style="display:inline-block;border-radius:10px;background:#1f8a65;padding:13px 18px;color:#fff;text-decoration:none;font-size:14px;font-weight:800;">${safeCta} <span aria-hidden="true">→</span></a>
    `,
    }),
  })
}
