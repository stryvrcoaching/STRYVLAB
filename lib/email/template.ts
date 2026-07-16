const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://stryvlab.com'

type RenderStryvEmailOptions = {
  body: string
  senderLabel?: string
  productLabel?: string
  preheader?: string
}

export function renderStryvEmail({
  body,
  senderLabel,
  productLabel,
  preheader,
}: RenderStryvEmailOptions): string {
  const product = productLabel
    ? `<p style="margin:4px 0 0;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.42);">${productLabel}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>STRYV lab</title>
  <style>
    :root { color-scheme: dark; }
    @media (prefers-color-scheme: dark) {
      body, table, td, div { background-color: inherit !important; color: inherit !important; }
    }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background:#0d0d0d;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color-scheme:dark;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>` : ''}
  <div style="max-width:560px;margin:0 auto;">
    <main style="overflow:hidden;background:#141414;border:1px solid rgba(255,255,255,0.09);border-radius:20px;">
      <header style="padding:22px 28px;border-bottom:1px solid rgba(255,255,255,0.09);">
        <table role="presentation" style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;">
              ${senderLabel ? `<span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.42);">${senderLabel}</span>` : ''}
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <table role="presentation" align="right" style="border-collapse:collapse;">
                <tr>
                  <td style="text-align:right;vertical-align:middle;">
                    <p style="margin:0;font-size:14px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">STRYV <span style="font-weight:400;color:rgba(255,255,255,0.52);">lab</span></p>
                    ${product}
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <img src="${SITE_URL}/images/logo-stryvr-silver.png" alt="STRYV lab" width="32" height="32" style="display:block;width:32px;height:32px;object-fit:contain;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </header>
      <section style="padding:32px 28px;">${body}</section>
    </main>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;line-height:1.6;color:rgba(255,255,255,0.34);">© ${new Date().getFullYear()} STRYV lab · <a href="${SITE_URL}" style="color:rgba(255,255,255,0.52);text-decoration:none;">stryvlab.com</a></p>
  </div>
</body>
</html>`
}
