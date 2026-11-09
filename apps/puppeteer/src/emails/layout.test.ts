import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail, BRAND_NAME } from './layout.ts';
import { verificationEmail } from './verification.ts';
import { passwordResetEmail } from './password-reset.ts';
import { accountReadyEmail } from './account-ready.ts';

const appUrl = 'https://app.test/';
const content = { appUrl, preheader: 'Resumo', heading: 'Título', paragraphs: ['Um', 'Dois'] };

test('Email layout', async (t) => {
  await t.test('escapes every piece of text it is given', () => {
    const { html } = renderEmail({
      appUrl,
      preheader: '<b>pre</b>',
      heading: '<i>h</i>',
      paragraphs: ['<script>x</script>'],
      button: { label: '"><b>go</b>', href: 'https://a.test/?a=1&b="2"' },
      note: '<u>n</u>'
    });
    assert.doesNotMatch(html, /<script>|<b>|<i>h|<u>n/);
    assert.match(html, /href="https:\/\/a\.test\/\?a=1&amp;b=&quot;2&quot;"/);
  });

  await t.test('shows the brand, the icon, the preheader and the button with its plain link', () => {
    const { html, text } = renderEmail({ ...content, button: { label: 'Abrir', href: 'https://a.test/x' }, note: 'Nota' });
    assert.match(html, new RegExp(BRAND_NAME));
    assert.match(html, /<img src="https:\/\/app\.test\/icon\.png"/);
    assert.match(html, /display:none[^>]*>Resumo</);
    assert.match(html, />Abrir<\/a>/);
    assert.equal(html.split('https://a.test/x').length - 1, 3, 'the href, the link text and its href');
    assert.equal(text, 'Um\n\nDois\n\nAbrir:\nhttps://a.test/x\n\nNota\n\n— Vem aí');
  });

  await t.test('has no button section without a button', () => {
    const { html, text } = renderEmail(content);
    assert.doesNotMatch(html, /Se o botão não funcionar/);
    assert.equal(text, 'Um\n\nDois\n\n— Vem aí');
  });

  await t.test('uses the organization color for the stripe and the button, with a readable label', () => {
    const { html } = renderEmail({ ...content, button: { label: 'Abrir', href: 'https://a.test/x' } });
    assert.match(html, /background:#2563eb/);
    assert.match(html, /color:#ffffff;text-decoration:none/);
  });

  await t.test('the three messages carry the name and the link in both bodies', () => {
    const to = { email: 'a@test.com', name: 'José <Silva>' };
    const messages = [
      verificationEmail(to, 'https://app.test/verify?token=a%2Bb', appUrl),
      passwordResetEmail(to, 'https://app.test/reset?token=a%2Bb', 60, appUrl),
      accountReadyEmail(to, 'https://app.test/entrar', appUrl)
    ];
    for (const message of messages) {
      assert.match(message.text, /Olá, José <Silva>!/);
      assert.match(message.html, /José &lt;Silva&gt;/);
      assert.match(message.text, /https:\/\/app\.test\//);
      assert.match(message.html, /href="https:\/\/app\.test\//);
    }
    assert.match(messages[1]!.text, /60 minutos/);
  });
});
