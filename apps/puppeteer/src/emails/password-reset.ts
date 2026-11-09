import type { EmailMessage } from '../io/index.ts';
import { renderEmail } from './layout.ts';

/**
 * Email with the link to choose a new password. The link opens the frontend's
 * reset page and expires after `validMinutes`.
 */
export function passwordResetEmail(to: { email: string; name: string }, link: string, validMinutes: number, appUrl: string): EmailMessage {
  const { html, text } = renderEmail({
    appUrl,
    preheader: `Use o link para escolher uma nova senha. Ele vale por ${validMinutes} minutos.`,
    heading: 'Redefinir sua senha',
    paragraphs: [
      `Olá, ${to.name}!`,
      `Recebemos um pedido para redefinir a senha da sua conta. Para escolher uma nova senha, use o botão abaixo (válido por ${validMinutes} minutos).`
    ],
    button: { label: 'Escolher nova senha', href: link },
    note: 'Se você não pediu, ignore este e-mail: a sua senha continua a mesma.'
  });
  return { to, subject: 'Redefinir sua senha', text, html };
}
