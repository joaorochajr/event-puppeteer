/** Name shown in the header and the footer of every email. */
export const BRAND_NAME = 'Vem aí';

/** The UEFS organization's color (its `colorScheme`): the top stripe, the button and the links. */
export const BRAND_COLOR = '#2563eb';

/** Mixes two `#rrggbb` colors; `amount` is how much of `other` goes in (0 to 1). */
function mix(color: string, other: string, amount: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const parts = [0, 1, 2].map(i => Math.round(channel(color, i) * (1 - amount) + channel(other, i) * amount));
  return `#${parts.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

/** White or near-black, whichever reads better on `color` (WCAG relative luminance). */
function readableOn(color: string): string {
  const [r, g, b] = [0, 1, 2].map(i => {
    const v = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#0f172a' : '#ffffff';
}

const ACCENT = BRAND_COLOR;
const ON_ACCENT = readableOn(ACCENT);
const LINK_DARK = mix(ACCENT, '#ffffff', 0.45);

/** The call to action of an email: a button, plus its plain link for clients that don't show buttons. */
export interface EmailButton {
  label: string;
  href: string;
}

/** What goes inside the shared email frame. Every string is plain text: the layout escapes it. */
export interface EmailContent {
  /** Public URL of the frontend: the icon in the header is `<appUrl>/icon.png`. */
  appUrl: string;
  /** The line some inbox lists show next to the subject. */
  preheader: string;
  /** The title inside the card. */
  heading: string;
  /** Body paragraphs, one block each. */
  paragraphs: string[];
  button?: EmailButton;
  /** A small line under the button, e.g. what to do if the person didn't ask for the email. */
  note?: string;
}

/** The two bodies of an email message. */
export interface RenderedEmail {
  html: string;
  text: string;
}

/** Escapes text for HTML content and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Renders the shared frame of the app's emails: the icon and name on top, a white card with the
 * title, paragraphs, a button in the organization's color and a small note, and a footer. Built with tables and inline
 * styles because that is what mail clients support; the classes only serve the dark-mode rules.
 * The plain-text body carries the same content.
 */
export function renderEmail({ appUrl, preheader, heading, paragraphs, button, note }: EmailContent): RenderedEmail {
  const logoUrl = `${appUrl.replace(/\/$/, '')}/icon.png`;
  const footer = `Você recebeu este e-mail porque o seu endereço foi usado em uma conta no ${BRAND_NAME}.`;
  const body = paragraphs
    .map(p => `<p class="text" style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155;">${escapeHtml(p)}</p>`)
    .join('\n');
  const href = button ? escapeHtml(button.href) : '';
  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
<tr><td align="center" bgcolor="${ACCENT}" style="border-radius:12px;background:${ACCENT};">
<a href="${href}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;line-height:1.2;color:${ON_ACCENT};text-decoration:none;border-radius:12px;">${escapeHtml(button.label)}</a>
</td></tr>
</table>
<p class="muted" style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;">Se o botão não funcionar, copie este link no navegador:<br><a href="${href}" class="link" style="color:${ACCENT};word-break:break-all;">${href}</a></p>`
    : '';
  const noteHtml = note
    ? `<p class="muted" style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">${escapeHtml(note)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(heading)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .page { background: #0b1220 !important; }
  .card { background: #131c2e !important; border-color: #1e293b !important; }
  .title, .brand { color: #f1f5f9 !important; }
  .text { color: #cbd5e1 !important; }
  .muted { color: #94a3b8 !important; }
  .link { color: ${LINK_DARK} !important; }
}
@media (max-width: 480px) {
  .card-body { padding: 24px 20px !important; }
}
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:0 4px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:12px;"><img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="" style="display:block;border-radius:10px;"></td>
<td class="brand" style="font-size:22px;font-weight:800;color:#0f172a;">${BRAND_NAME}</td>
</tr></table>
</td></tr>
<tr><td class="card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td height="6" style="height:6px;line-height:6px;font-size:0;background:${ACCENT};border-radius:20px 20px 0 0;">&nbsp;</td></tr>
<tr><td class="card-body" style="padding:32px 36px;">
<h1 class="title" style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:800;color:#0f172a;">${escapeHtml(heading)}</h1>
${body}
${buttonHtml}
${noteHtml}
</td></tr>
</table>
</td></tr>
<tr><td class="muted" style="padding:20px 8px 0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">${escapeHtml(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    ...paragraphs,
    ...(button ? [`${button.label}:\n${button.href}`] : []),
    ...(note ? [note] : []),
    `— ${BRAND_NAME}`
  ].join('\n\n');

  return { html, text };
}
