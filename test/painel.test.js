import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePainelRoute } from '../worker/routes/painel.js';
import { PAINEL_JS, PAINEL_JS_SRC } from '../worker/render/painel-js.js';
import { renderPainel } from '../worker/render/painel.js';
import { leadsToCsv } from '../worker/lib/csv.js';
import { makeEnv } from './helpers.js';

test('renderiza configuração segura e usa PT-PT', () => {
  const html = renderPainel(makeEnv({
    SUPABASE_ANON_KEY: '</script><script>alert(1)</script>',
    PUBLIC_BASE_URL: 'https://cartao.example/',
  }));
  assert.match(html, /id="cfg"/);
  assert.doesNotMatch(html, /<\/script><script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script\\u003e/);
  assert.match(html, /lang="pt-PT"/);
  assert.match(html, /Painel do cartão digital/);
});

test('sem configuração mostra estado fechado', () => {
  const html = renderPainel(makeEnv({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '' }));
  assert.match(html, /Painel não configurado/);
  assert.doesNotMatch(html, /id="cfg"/);
});

test('rota serve HTML e asset versionado, sem capturar outras rotas', async () => {
  const env = makeEnv({ SUPABASE_ANON_KEY: 'anon' });
  const htmlResponse = await handlePainelRoute(new Request('https://cartao.example/c/painel'), env, {}, '/c/painel');
  assert.equal(htmlResponse.status, 200);
  assert.equal(htmlResponse.headers.get('cache-control'), 'no-store');
  const assetResponse = await handlePainelRoute(new Request('https://cartao.example/c/assets/painel.js'), env, {}, '/c/assets/painel.js');
  assert.equal(await assetResponse.text(), PAINEL_JS);
  assert.match(PAINEL_JS_SRC, /\?v=[0-9a-f]{8}$/);
  assert.equal(await handlePainelRoute(new Request('https://cartao.example/c/outra'), env, {}, '/c/outra'), null);
  assert.equal(await handlePainelRoute(new Request('https://cartao.example/c/painel', { method: 'POST' }), env, {}, '/c/painel'), null);
});

test('asset é ESM e não injeta dados do banco com HTML', () => {
  assert.match(PAINEL_JS, /import \{ createClient \}/);
  assert.match(PAINEL_JS, /shouldCreateUser: false/);
  assert.match(PAINEL_JS, /textContent/);
  assert.match(PAINEL_JS, /createElement/);
  assert.doesNotMatch(PAINEL_JS, /\binnerHTML\b/);
  assert.match(PAINEL_JS, /function leadsToCsv\(leads, notificationsByLead\)/);
});

test('CSV embutido no asset mantém a mesma saída do módulo Worker', () => {
  const start = PAINEL_JS.indexOf('function leadsToCsv');
  const end = PAINEL_JS.indexOf('\n\nconst make', start);
  const browserLeadsToCsv = Function(PAINEL_JS.slice(start, end) + '; return leadsToCsv;')();
  const leads = [{ nome: '=teste', mensagem: 'a;"b', created_at: '2026-09-30T00:00:00.000Z' }];
  assert.equal(browserLeadsToCsv(leads), leadsToCsv(leads));
});
