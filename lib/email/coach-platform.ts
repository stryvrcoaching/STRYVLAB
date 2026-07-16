import { Resend } from 'resend'
import { renderStryvEmail } from '@/lib/email/template'

type CoachPlatformTrialEmailParams = {
  to: string
  coachName?: string | null
  planLabel: string
  monthlyPrice: string
  trialEndsAt: Date
}

const resend = new Resend(process.env.RESEND_API_KEY)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stryvlab.com'
const FROM = `STRYV lab <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[character]
  })
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value)
}

/** Confirmation sent once Stripe Checkout has successfully created a trial. */
export async function sendCoachPlatformTrialEmail({
  to,
  coachName,
  planLabel,
  monthlyPrice,
  trialEndsAt,
}: CoachPlatformTrialEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const safeName = coachName?.trim() ? ` ${escapeHtml(coachName.trim())}` : ''
  const safePlan = escapeHtml(planLabel)
  const safePrice = escapeHtml(monthlyPrice)
  const firstChargeDate = formatDate(trialEndsAt)

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Bienvenue dans STRYV lab — votre espace coach est prêt',
    html: renderStryvEmail({
      productLabel: 'Espace coach',
      preheader: 'Votre espace de pilotage est prêt. Posez les bases de votre suivi client dans STRYV lab.',
      body: `
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.78);">Bonjour${safeName},</p>
        <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;color:#69d0ac;">L&apos;essentiel, au bon moment</p>
        <h1 style="max-width:430px;margin:0 0 18px;font-size:30px;line-height:1.14;letter-spacing:-.03em;color:#ffffff;">Votre espace de pilotage est prêt.</h1>
        <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:rgba(255,255,255,.72);">Vous accédez dès maintenant au plan <strong style="color:#ffffff;">${safePlan}</strong>. STRYV lab réunit le contexte de vos clients, vos décisions et leur expérience de suivi au même endroit.</p>

        <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 28px;">
          <tr>
            <td style="width:33.33%;padding:0 10px 0 0;vertical-align:top;"><div style="min-height:106px;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:15px 12px;background:rgba(255,255,255,.025);"><span style="display:block;margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:.12em;color:#c6b48b;">01</span><strong style="display:block;font-size:13px;line-height:1.35;color:#ffffff;">Centraliser</strong><span style="display:block;margin-top:5px;font-size:11px;line-height:1.45;color:rgba(255,255,255,.48);">Le contexte de chaque suivi.</span></div></td>
            <td style="width:33.33%;padding:0 5px;vertical-align:top;"><div style="min-height:106px;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:15px 12px;background:rgba(255,255,255,.025);"><span style="display:block;margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:.12em;color:#c6b48b;">02</span><strong style="display:block;font-size:13px;line-height:1.35;color:#ffffff;">Décider</strong><span style="display:block;margin-top:5px;font-size:11px;line-height:1.45;color:rgba(255,255,255,.48);">Avec les bons signaux.</span></div></td>
            <td style="width:33.33%;padding:0 0 0 10px;vertical-align:top;"><div style="min-height:106px;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:15px 12px;background:rgba(255,255,255,.025);"><span style="display:block;margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:.12em;color:#c6b48b;">03</span><strong style="display:block;font-size:13px;line-height:1.35;color:#ffffff;">Accompagner</strong><span style="display:block;margin-top:5px;font-size:11px;line-height:1.45;color:rgba(255,255,255,.48);">Sans ajouter de friction.</span></div></td>
          </tr>
        </table>

        <div style="margin:0 0 28px;border-left:2px solid #1f8a65;padding:2px 0 2px 14px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(255,255,255,.68);"><strong style="color:#ffffff;">Votre prochain repère :</strong> prenez quelques minutes pour personnaliser votre espace, puis créez le premier suivi client lorsque vous êtes prêt.</p>
        </div>

        <a href="${SITE_URL}/coach/settings" style="display:inline-block;margin:0 0 30px;border-radius:10px;background:#1f8a65;padding:13px 18px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;">Ouvrir mon espace coach <span aria-hidden="true">→</span></a>

        <p style="margin:0 0 10px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.42);">Votre accès</p>
        <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid rgba(255,255,255,.1);border-radius:12px;overflow:hidden;">
          <tr><td style="padding:15px 16px;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;color:rgba(255,255,255,.54);">Essai jusqu’au</td><td style="padding:15px 16px;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;font-weight:700;text-align:right;color:#ffffff;">${firstChargeDate}</td></tr>
          <tr><td style="padding:15px 16px;font-size:13px;color:rgba(255,255,255,.54);">Puis</td><td style="padding:15px 16px;font-size:13px;font-weight:700;text-align:right;color:#69d0ac;">${safePrice}</td></tr>
        </table>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:rgba(255,255,255,.48);">Aucun montant n’est prélevé aujourd’hui. Votre moyen de paiement est traité de façon sécurisée par Stripe. Vous pouvez gérer ou résilier votre abonnement à tout moment depuis vos réglages.</p>
      `,
    }),
  })
}
