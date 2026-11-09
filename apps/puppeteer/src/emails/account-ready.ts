import type { EmailMessage } from '../io/index.ts';
import { BRAND_NAME, renderEmail } from './layout.ts';

/**
 * Email for people whose address was confirmed by hand after the confirmation link failed:
 * the account is active and they can sign in at `loginUrl`.
 */
export function accountReadyEmail(to: { email: string; name: string }, loginUrl: string, appUrl: string): EmailMessage {
  const { html, text } = renderEmail({
    appUrl,
    preheader: 'O seu e-mail foi confirmado. Já pode entrar.',
    heading: 'Seu e-mail foi confirmado',
    paragraphs: [
      `Olá, ${to.name}!`,
      'O link de confirmação que enviamos no seu cadastro não funcionou, e pedimos desculpas por isso. Já corrigimos o problema e confirmamos o seu e-mail por nossa conta: a sua conta está ativa.',
      'Entre com o e-mail e a senha que você cadastrou.'
    ],
    button: { label: `Entrar no ${BRAND_NAME}`, href: loginUrl },
    note: 'Se você não criou uma conta, ignore este e-mail.'
  });
  return { to, subject: `Seu e-mail foi confirmado: já pode entrar no ${BRAND_NAME}`, text, html };
}
