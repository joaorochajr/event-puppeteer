import type { EmailMessage } from '../io/index.ts';
import { renderEmail } from './layout.ts';

/** Email with the link that confirms the address and activates the account. */
export function verificationEmail(to: { email: string; name: string }, link: string, appUrl: string): EmailMessage {
  const { html, text } = renderEmail({
    appUrl,
    preheader: 'Falta só um passo para ativar a sua conta.',
    heading: 'Confirme seu e-mail',
    paragraphs: [`Olá, ${to.name}!`, 'Confirme o seu e-mail para ativar a sua conta.'],
    button: { label: 'Confirmar e-mail', href: link },
    note: 'Se você não criou uma conta, ignore este e-mail.'
  });
  return { to, subject: 'Confirme seu email', text, html };
}
