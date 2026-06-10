import { Resend } from 'resend'

// ─── Transport ────────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendMail(options: {
  from: string
  to: string
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}) {
  await resend.emails.send({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
    })),
  })
}

// ─── Brand tokens (DS v2.0) ───────────────────────────────────────────────────

const FROM = `STRYVR <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stryvlab.com'

const DS = {
  bg: '#080808',
  card: '#111111',
  accent: '#f2f2f2',
  accentText: '#080808',
  white: '#ffffff',
  textMuted: 'rgba(255,255,255,0.60)',
  textVeryMuted: 'rgba(255,255,255,0.40)',
  surface: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.06)',
  separator: 'rgba(255,255,255,0.07)',
}

// ─── Base template ────────────────────────────────────────────────────────────

function emailTemplate({ body, senderLabel }: { body: string; senderLabel?: string }): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>STRYVR</title>
  <style>
    :root { color-scheme: dark; }
    /* Prevent email clients from auto-inverting our dark design in dark mode */
    @media (prefers-color-scheme: dark) {
      body, table, td, div { background-color: inherit !important; color: inherit !important; }
    }
  </style>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#0a0a0a;margin:0;padding:40px 16px;color-scheme:dark;">
  <div style="max-width:520px;margin:0 auto;">

    <!-- Header -->
    <div style="background:${DS.bg};border-radius:16px 16px 0 0;padding:20px 36px;border-bottom:1px solid ${DS.border};">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;">
            <img src="${SITE_URL}/logo/logo-stryvr-silver.png" alt="STRYVR" width="32" height="32" style="display:inline-block;vertical-align:middle;width:32px;height:32px;object-fit:contain;" />
            ${senderLabel ? `<span style="font-size:11px;color:${DS.textVeryMuted};margin-left:10px;font-weight:500;vertical-align:middle;">${senderLabel}</span>` : ''}
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${DS.textVeryMuted};">STRYVR</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="background:${DS.card};border-radius:0 0 16px 16px;padding:36px;">
      ${body}
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.20);margin:20px 0 0;line-height:1.6;">
      © ${new Date().getFullYear()} STRYVR —
      <a href="${SITE_URL}" style="color:rgba(255,255,255,0.25);text-decoration:none;">stryvlab.com</a>
    </p>

  </div>
</body>
</html>`
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function ctaButton(href: string, label: string): string {
  return `<a href="${href}"
    style="display:inline-block;background:${DS.accent};color:${DS.accentText};text-decoration:none;
           font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;
           margin-bottom:24px;letter-spacing:0.01em;">
    ${label} →
  </a>`
}

// ─── Info table ───────────────────────────────────────────────────────────────

function infoTable(rows: { label: string; value: string; accent?: boolean }[]): string {
  const cells = rows.map(r => `
    <tr>
      <td style="color:${DS.textVeryMuted};padding:5px 0;font-size:13px;width:40%;vertical-align:top;">${r.label}</td>
      <td style="color:${r.accent ? DS.accent : DS.white};font-weight:${r.accent ? '700' : '500'};font-size:13px;vertical-align:top;">${r.value}</td>
    </tr>`).join('')
  return `<div style="background:${DS.surface};border-radius:10px;padding:18px;margin-bottom:24px;">
    <table style="width:100%;border-collapse:collapse;">${cells}</table>
  </div>`
}

// ─── Greeting + body text ─────────────────────────────────────────────────────

function greeting(name: string): string {
  return `<p style="font-size:15px;color:${DS.white};margin:0 0 6px;font-weight:600;">Bonjour ${name},</p>`
}

function bodyText(text: string): string {
  return `<p style="font-size:14px;color:${DS.textMuted};margin:0 0 20px;line-height:1.65;">${text}</p>`
}

function hint(text: string): string {
  return `<p style="font-size:12px;color:${DS.textVeryMuted};margin:0;line-height:1.6;">${text}</p>`
}

function separator(): string {
  return `<div style="height:1px;background:${DS.separator};margin:20px 0;"></div>`
}

function coachSignature(coachName: string | null): string {
  if (!coachName) return ''
  return `<p style="font-size:13px;color:rgba(255,255,255,0.45);margin:20px 0 0;">— Coach ${coachName}</p>`
}

function directLink(url: string): string {
  return `<p style="font-size:11px;color:rgba(255,255,255,0.20);margin:0;">
    Lien direct : <a href="${url}" style="color:${DS.accent};text-decoration:none;">${url}</a>
  </p>`
}

// ─── Exports — Types ──────────────────────────────────────────────────────────

export interface SendBilanEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  templateName: string
  bilanUrl: string
  expiresAt: Date
}

export interface SendAccessLinkEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  accessUrl: string
  expiresAt: Date
}

export interface SendBilanCompletedEmailParams {
  to: string
  coachFirstName: string
  clientFullName: string
  templateName: string
  dashboardUrl: string
}

export interface SendPaymentReceiptEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  amount: number
  description: string | null
  paymentDate: string
  reference: string | null
  method: string
}

export interface SendPaymentReminderEmailParams {
  to: string
  clientFirstName: string
  coachName: string
  formulaName: string
  amount: number
  dueDate: string
  paymentMethod?: string
  fromName?: string
}

export interface SendInvoiceEmailParams {
  to: string
  clientFirstName: string
  coachName: string
  invoiceNumber: string
  amount: number
  pdfBuffer: Buffer
  fromName?: string
}

export interface SendInvitationEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  setupPasswordUrl: string
}

// ─── Method labels ────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  manual: 'Manuel',
  bank_transfer: 'Virement bancaire',
  card: 'Carte bancaire',
  cash: 'Espèces',
  stripe: 'Stripe',
  other: 'Autre',
}

// ─── 1. Bilan envoyé au client ────────────────────────────────────────────────

export async function sendBilanEmail(params: SendBilanEmailParams) {
  const { to, clientFirstName, coachName, templateName, bilanUrl, expiresAt } = params

  const expiryFormatted = expiresAt.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const intro = coachName
    ? `Votre coach <strong style="color:${DS.white};">${coachName}</strong> vous a envoyé un bilan à remplir : <strong style="color:${DS.white};">${templateName}</strong>.`
    : `Votre coach vous a envoyé un bilan à remplir : <strong style="color:${DS.white};">${templateName}</strong>.`

  const subject = coachName
    ? `${coachName} vous a envoyé un bilan — ${templateName}`
    : `Votre bilan "${templateName}" est prêt`

  await sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${ctaButton(bilanUrl, 'Remplir mon bilan')}
        ${hint(`Ce lien expire le ${expiryFormatted}. Si vous ne souhaitez pas remplir ce bilan, ignorez ce message.`)}
        ${separator()}
        ${directLink(bilanUrl)}
        ${coachSignature(coachName)}
      `,
    }),
  })
}

// ─── 2. Lien d'accès client (magic link) ─────────────────────────────────────

export async function sendAccessLinkEmail(params: SendAccessLinkEmailParams) {
  const { to, clientFirstName, coachName, accessUrl, expiresAt } = params

  const expiryFormatted = expiresAt.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const intro = coachName
    ? `Votre coach <strong style="color:${DS.white};">${coachName}</strong> vous invite à accéder à votre espace personnel STRYVR.`
    : `Votre coach vous invite à accéder à votre espace personnel STRYVR.`

  const subject = coachName
    ? `${coachName} vous invite sur STRYVR`
    : 'Votre accès à STRYVR est prêt'

  await sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${bodyText('Cliquez sur le bouton ci-dessous pour vous connecter en un clic — aucun mot de passe requis.')}
        ${ctaButton(accessUrl, 'Accéder à mon espace')}
        ${hint(`Ce lien expire le ${expiryFormatted}. Ne partagez pas cet email.`)}
        ${separator()}
        ${directLink(accessUrl)}
        ${coachSignature(coachName)}
      `,
    }),
  })
}

// ─── 3. Bilan complété → notification coach ───────────────────────────────────

export async function sendBilanCompletedEmail(params: SendBilanCompletedEmailParams) {
  const { to, coachFirstName, clientFullName, templateName, dashboardUrl } = params

  await sendMail({
    from: FROM,
    to,
    subject: `${clientFullName} a complété son bilan`,
    html: emailTemplate({
      body: `
        ${greeting(coachFirstName)}
        ${bodyText(`<strong style="color:${DS.white};">${clientFullName}</strong> vient de compléter le bilan <strong style="color:${DS.white};">${templateName}</strong>.`)}
        ${ctaButton(dashboardUrl, 'Voir le bilan')}
        ${hint('Connectez-vous à votre espace coach pour consulter les réponses et les métriques.')}
      `,
    }),
  })
}

// ─── 4. Reçu de paiement (création immédiate) ─────────────────────────────────

export async function sendPaymentReceiptEmail(params: SendPaymentReceiptEmailParams) {
  const { to, clientFirstName, coachName, amount, description, paymentDate, reference, method } = params

  const dateFormatted = new Date(paymentDate).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const intro = coachName
    ? `Votre coach <strong style="color:${DS.white};">${coachName}</strong> a enregistré un paiement de <strong style="color:${DS.white};">${amount.toFixed(2)} €</strong> en date du ${dateFormatted}.`
    : `Un paiement de <strong style="color:${DS.white};">${amount.toFixed(2)} €</strong> a été enregistré en date du ${dateFormatted}.`

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Montant', value: `${amount.toFixed(2)} €`, accent: true },
    { label: 'Date', value: dateFormatted },
    { label: 'Méthode', value: METHOD_LABELS[method] ?? method },
  ]
  if (description) rows.push({ label: 'Description', value: description })
  if (reference) rows.push({ label: 'Référence', value: reference })

  await sendMail({
    from: FROM,
    to,
    subject: `Reçu de paiement — ${amount.toFixed(2)} €`,
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${infoTable(rows)}
        ${hint('Conservez cet email comme reçu de paiement. Pour toute question, contactez votre coach directement.')}
        ${coachSignature(coachName)}
      `,
    }),
  })
}

// ─── 5. Rappel paiement (manuel ou cron) ─────────────────────────────────────

export async function sendPaymentReminderEmail(params: SendPaymentReminderEmailParams) {
  const { to, clientFirstName, coachName, formulaName, amount, dueDate, paymentMethod, fromName } = params

  const dueDateFormatted = new Date(dueDate).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const rows: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Formule', value: formulaName },
    { label: 'Montant dû', value: `${amount.toFixed(2)} €`, accent: true },
    { label: 'Échéance', value: dueDateFormatted },
  ]
  if (paymentMethod) rows.push({ label: 'Méthode habituelle', value: METHOD_LABELS[paymentMethod] ?? paymentMethod })

  await sendMail({
    from: fromName ? `${fromName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>` : FROM,
    to,
    subject: `Rappel paiement — ${formulaName} — ${amount.toFixed(2)} €`,
    html: emailTemplate({
      senderLabel: coachName,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(`Votre coach <strong style="color:${DS.white};">${coachName}</strong> vous rappelle qu'un paiement est attendu pour votre formule <strong style="color:${DS.white};">${formulaName}</strong>.`)}
        ${infoTable(rows)}
        ${hint('Pour toute question, répondez directement à cet email ou contactez votre coach.')}
        ${coachSignature(coachName)}
      `,
    }),
  })
}

// ─── 6. Facture PDF par email ─────────────────────────────────────────────────

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const { to, clientFirstName, coachName, invoiceNumber, amount, pdfBuffer, fromName } = params

  await sendMail({
    from: fromName ? `${fromName} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>` : FROM,
    to,
    subject: `Reçu de paiement — ${amount.toFixed(2)} € — ${invoiceNumber}`,
    html: emailTemplate({
      senderLabel: coachName,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(`Veuillez trouver ci-joint votre reçu de paiement <strong style="color:${DS.white};">${invoiceNumber}</strong> d'un montant de <strong style="color:${DS.white};">${amount.toFixed(2)} €</strong>.`)}
        ${hint('Pour toute question, contactez votre coach directement.')}
        ${coachSignature(coachName)}
      `,
    }),
    attachments: [{
      filename: `recu-${invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  })
}

// ─── 7. Invitation client (premier accès — définir son mot de passe) ─────────

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { to, clientFirstName, coachName, setupPasswordUrl } = params

  const intro = coachName
    ? `Votre coach <strong style="color:${DS.white};">${coachName}</strong> vous a créé un espace personnel sur STRYVR. Définissez votre mot de passe pour accéder à vos bilans et votre programme.`
    : `Votre coach vous a créé un espace personnel sur STRYVR. Définissez votre mot de passe pour y accéder.`

  const subject = coachName
    ? `${coachName} vous invite sur STRYVR — Créez votre accès`
    : 'Créez votre accès STRYVR'

  await sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${ctaButton(setupPasswordUrl, 'Créer mon mot de passe')}
        ${hint('Ce lien est valable 1 heure. Si vous n\'avez pas demandé cet accès, ignorez ce message.')}
        ${separator()}
        ${directLink(setupPasswordUrl)}
        ${coachSignature(coachName)}
      `,
    }),
  })
}

// ─── 8. Réactivation client (accès restauré) ─────────────────────────────────

export interface SendReactivationEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  loginUrl: string
}

export async function sendReactivationEmail(params: SendReactivationEmailParams) {
  const { to, clientFirstName, coachName, loginUrl } = params

  const intro = coachName
    ? `Votre coach <strong style="color:${DS.white};">${coachName}</strong> a restauré votre accès à STRYVR. Vous pouvez vous reconnecter avec votre email et votre mot de passe habituel.`
    : `Votre accès à STRYVR a été restauré. Vous pouvez vous reconnecter avec votre email et votre mot de passe habituel.`

  const subject = coachName
    ? `${coachName} a restauré votre accès STRYVR`
    : 'Votre accès STRYVR est restauré'

  await sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${ctaButton(loginUrl, 'Se connecter')}
        ${hint('Si vous avez oublié votre mot de passe, utilisez la page de connexion pour le réinitialiser.')}
        ${coachSignature(coachName)}
      `,
    }),
  })
}

// ─── 9. Bienvenue après création du mot de passe ──────────────────────────────

export interface SendWelcomeEmailParams {
  to: string
  clientFirstName: string
  coachName: string | null
  loginUrl: string
}

export async function sendWelcomeEmail(params: SendWelcomeEmailParams) {
  const { to, clientFirstName, coachName, loginUrl } = params

  const intro = coachName
    ? `Votre mot de passe a bien été créé. Bienvenue sur STRYVR — votre espace personnel configuré par <strong style="color:${DS.white};">${coachName}</strong> est maintenant accessible.`
    : `Votre mot de passe a bien été créé. Bienvenue sur STRYVR — votre espace personnel est maintenant accessible.`

  await sendMail({
    from: FROM,
    to,
    subject: 'Bienvenue sur STRYVR — ton accès est actif',
    html: emailTemplate({
      senderLabel: coachName ?? undefined,
      body: `
        ${greeting(clientFirstName)}
        ${bodyText(intro)}
        ${ctaButton(loginUrl, 'Accéder à mon espace')}
        ${hint('Conserve ce lien pour te reconnecter à tout moment.')}
        ${separator()}
        ${directLink(loginUrl)}
        ${coachSignature(coachName)}
      `,
    }),
  })
}

// ─── 10. Alerte coach — message client requiert intervention ──────────────────

export interface SendCoachAlertEmailParams {
  to: string
  coachFirstName: string
  clientFirstName: string
  category: 'safety' | 'out_of_scope' | 'pattern_inquiry' | 'engagement' | 'weight_off_track'
  messageExcerpt: string  // déjà tronqué à 200 chars par l'appelant
  inboxUrl: string
}

const CATEGORY_LABELS: Record<SendCoachAlertEmailParams['category'], string> = {
  safety: 'Sécurité — message urgent',
  out_of_scope: 'Hors périmètre — à traiter',
  pattern_inquiry: 'Question de comportement',
  engagement: 'Client inactif',
  weight_off_track: 'Poids hors objectif',
}

export async function sendCoachAlertEmail(params: SendCoachAlertEmailParams) {
  const { to, coachFirstName, clientFirstName, category, messageExcerpt, inboxUrl } = params

  const isSafety = category === 'safety'
  const subjectPrefix = isSafety ? '🚨 [Urgent] ' : '⚡ Action requise — '
  const subject = `${subjectPrefix}${clientFirstName} vous a envoyé un message`

  const categoryLabel = CATEGORY_LABELS[category]

  await sendMail({
    from: FROM,
    to,
    subject,
    html: emailTemplate({
      body: `
        ${greeting(coachFirstName)}
        ${bodyText(`<strong style="color:${DS.white};">${clientFirstName}</strong> vous a envoyé un message qui demande votre attention.`)}
        ${infoTable([
          { label: 'Catégorie', value: categoryLabel, accent: isSafety },
          { label: 'Extrait', value: `"${messageExcerpt}"` },
        ])}
        ${ctaButton(inboxUrl, 'Voir dans l\'espace coach')}
        ${hint('Ce message a été automatiquement signalé par le système STRYVR. Répondez depuis votre espace coach.')}
      `,
    }),
  })
}

