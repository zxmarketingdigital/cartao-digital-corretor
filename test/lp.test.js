import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLp } from '../worker/render/lp.js';

const base = { PUBLIC_BASE_URL: 'https://exemplo.pt' };

test('LP mostra preço €97, CTA único e nenhuma menção a juros', () => {
  const out = renderLp(base);
  assert.match(out, /€97/);
  assert.doesNotMatch(out, /juros/i);
  assert.doesNotMatch(out, /seu mac|no mac\b/i);
  const ctas = out.match(/QUERO O MEU CARTÃO DIGITAL/g) || [];
  assert.ok(ctas.length >= 3, 'CTA repetido em hero, fecho e barra fixa');
  assert.match(out, /lang='pt-PT'|lang="pt-PT"/);
});

test('beacon só aparece com token', () => {
  assert.doesNotMatch(renderLp(base), /cloudflareinsights/);
  assert.match(renderLp({ ...base, CF_BEACON_TOKEN: 'tok123' }), /cloudflareinsights[^>]*tok123/);
});

test('pixel só aparece com id e dispara apenas PageView', () => {
  assert.doesNotMatch(renderLp(base), /fbevents/);
  const out = renderLp({ ...base, META_PIXEL_ID: '123456' });
  assert.match(out, /fbevents/);
  assert.match(out, /'PageView'/);
  assert.doesNotMatch(out, /InitiateCheckout|AddToCart|Purchase/);
});

test('botão PayPal só com client id; sem ele mostra aviso', () => {
  const sem = renderLp(base);
  assert.doesNotMatch(sem, /paypal\.com\/sdk/);
  assert.match(sem, /Pagamentos ainda não configurados\./);
  const com = renderLp({ ...base, PAYPAL_CLIENT_ID: 'abc<x>' });
  assert.match(com, /paypal\.com\/sdk\/js\?client-id=abc%3Cx%3E&amp;currency=EUR|client-id=abc%3Cx%3E/);
  assert.doesNotMatch(com, /client-id=abc<x>/);
  assert.match(com, /\/c\/api\/paypal\/order/);
  assert.match(com, /\/c\/api\/paypal\/capture/);
});
