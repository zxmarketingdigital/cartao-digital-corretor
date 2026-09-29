import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCard } from '../worker/render/card.js';
import { card, makeEnv } from './helpers.js';

test('renderiza conteúdo escapado e omite URL perigosa', () => {
  const html = renderCard(card({
    nome: '<img src=x onerror=alert(1)>',
    instagram: 'javascript:alert(1)',
    links: [{ titulo: 'Seguro', descricao: 'Descrição', url: 'javascript:alert(1)' }],
    chat_enabled: false,
  }), makeEnv(), { canonicalPath: '/c/ana-sousa' });
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('javascript:'), false);
  assert.equal(html.includes('Instagram'), false);
});

test('beacon e dicionário de locale', () => {
  const ptbr = renderCard(card({ locale: 'pt-BR', chat_enabled: false }), makeEnv({ CF_BEACON_TOKEN: 'token-1' }));
  const ptpt = renderCard(card({ locale: 'pt-PT', chat_enabled: false }), makeEnv());
  assert.match(ptbr, /static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(ptbr, /Salvar/);
  assert.match(ptpt, /Guardar/);
  assert.equal(ptpt.includes('beacon.min.js'), false);
});

test('tiles usam ícone SVG âmbar acima do label', () => {
  const html = renderCard(card({ chat_enabled: false }), makeEnv());
  const icons = html.match(/class="tile-icon"/g) || [];
  assert.equal(icons.length, 6);
  assert.match(html, /class="tile-icon"[^>]*stroke="currentColor"/);
  assert.match(html, /width="22" height="22"/);
  assert.match(html, /class="tile-label"/);
});

test('script do chat carrega versão derivada do conteúdo (cache-busting)', () => {
  const html = renderCard(card({ chat_enabled: true }), makeEnv());
  assert.match(html, /src="\/c\/assets\/chat\.js\?v=[0-9a-f]{8}"/);
  assert.doesNotMatch(renderCard(card({ chat_enabled: false }), makeEnv()), /assets\/chat\.js/);
});
