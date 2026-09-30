import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVendaRoute } from '../worker/routes/venda.js';

const env = { PAYPAL_CLIENT_ID: 'client', PAYPAL_CLIENT_SECRET: 'secret', PAYPAL_WEBHOOK_ID: 'webhook', SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service', RESEND_API_KEY: 'resend', EMAIL_FROM: 'Cartão <noreply@example.test>', PUBLIC_BASE_URL: 'https://app.test', PRODUCT_PRICE_EUR: '123.45', PAYPAL_ENV: 'sandbox', PAYPAL_API_URL: 'https://paypal.invalid', PAYPAL_API_BASE: 'https://paypal.invalid', PAYPAL_BASE_URL: 'https://paypal.invalid', PAYPAL_MODE: 'live' };
let orders;
let cards;
let paypalCalls;
let patches;
let patchAttempts;
let captureMode;
let resendCalls;

function matchesFilter(item, key, value) {
  if (value.startsWith('eq.')) return String(item[key]) === value.slice(3);
  if (value.startsWith('in.(') && value.endsWith(')')) {
    const list = value.slice(4, -1).split(',').map((entry) => decodeURIComponent(entry));
    return list.includes(String(item[key]));
  }
  return true;
}

async function stubFetch(input, options = {}) {
  const request = input instanceof Request ? input : new Request(input, options);
  const url = new URL(request.url);
  if (url.host === 'api-m.sandbox.paypal.com') {
    paypalCalls.push({ method: request.method, url: request.url, body: request.method === 'GET' ? null : await request.clone().text() });
    if (url.pathname === '/v1/oauth2/token') return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v2/checkout/orders') return new Response(JSON.stringify({ id: 'PAYPAL-ORDER-1', status: 'CREATED' }), { headers: { 'content-type': 'application/json' } });
    if (url.pathname.startsWith('/v2/payments/captures/')) return new Response(JSON.stringify({ supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } } }), { headers: { 'content-type': 'application/json' } });
    if (url.pathname.endsWith('/capture')) {
      const good = captureMode !== 'divergent';
      return new Response(JSON.stringify({ status: 'COMPLETED', payer: { email_address: 'buyer@example.test' }, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-1', amount: { value: good ? '123.45' : '1.00', currency_code: good ? 'EUR' : 'USD' } }] } }] }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname.includes('verify-webhook')) return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { headers: { 'content-type': 'application/json' } });
  }
  if (url.host === 'db.test') {
    if (url.pathname === '/auth/v1/admin/users' && request.method === 'POST') return new Response(JSON.stringify({ id: 'user-1' }), { status: 201, headers: { 'content-type': 'application/json' } });
    const table = url.pathname.split('/').pop();
    if (table === 'orders' && request.method === 'GET') {
      const result = orders.filter(order => {
        for (const [key, value] of url.searchParams) if (key !== 'select' && key !== 'limit' && value.startsWith('eq.') && String(order[key]) !== value.slice(3)) return false;
        return true;
      });
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
    }
    if (table === 'cards' && request.method === 'GET') {
      const result = cards.filter(card => [...url.searchParams].every(([key, value]) => key === 'select' || key === 'limit' || !value.startsWith('eq.') || String(card[key]) === value.slice(3)));
      return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
    }
    if (table === 'orders' || table === 'cards') {
      const body = request.method === 'POST' || request.method === 'PATCH' ? JSON.parse(await request.text()) : null;
      if (request.method === 'POST') {
        const target = table === 'orders' ? orders : cards;
        if (target.some(item => item.id === body.id || (table === 'cards' && item.slug === body.slug))) return new Response('{}', { status: 409 });
        target.push(body);
        return new Response(JSON.stringify([body]), { headers: { 'content-type': 'application/json' } });
      }
      if (request.method === 'PATCH') {
        const target = orders;
        const filters = [...url.searchParams].filter(([key]) => key !== 'select');
        patchAttempts.push({ url: request.url, body });
        const found = target.find(item => filters.every(([key, value]) => matchesFilter(item, key, value)));
        if (!found) return new Response('[]', { headers: { 'content-type': 'application/json' } });
        Object.assign(found, body);
        patches.push({ url: request.url, body });
        return new Response(JSON.stringify([found]), { headers: { 'content-type': 'application/json' } });
      }
    }
    if (table === 'object' && url.pathname.includes('/storage/')) return new Response('{}', { status: 200 });
  }
  if (url.host === 'api.resend.com') { resendCalls += 1; return new Response('{}', { status: 200 }); }
  throw new Error(`host não stubado: ${url.host}`);
}

const originalFetch = globalThis.fetch;
test.beforeEach(() => {
  orders = [];
  cards = [];
  paypalCalls = [];
  patches = [];
  patchAttempts = [];
  captureMode = 'good';
  resendCalls = 0;
  globalThis.fetch = stubFetch;
});
test.after(() => { globalThis.fetch = originalFetch; });

function req(path, options = {}) { return new Request(`https://app.test${path}`, options); }
function order(id = '00000000-0000-4000-8000-000000000001', status = 'criado') { return { id, idempotency_key: 'key', paypal_order_id: 'PAYPAL-ORDER-1', status, amount_cents: 12345, currency: 'EUR' }; }
function completedBody(value = '123.45', currency = 'EUR') { return JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { status: 'COMPLETED', amount: { value, currency_code: currency }, supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } } } }); }
const webhookHeaders = { 'content-type': 'application/json', 'paypal-auth-algo': 'a', 'paypal-cert-url': 'b', 'paypal-transmission-id': 'c', 'paypal-transmission-sig': 'd', 'paypal-transmission-time': 'e' };

 test('preço é sempre o do servidor e a ordem usa orders', async () => {
  const response = await handleVendaRoute(req('/c/api/paypal/order', { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': 'key-1' }, body: JSON.stringify({ price: 1 }) }), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.id, 'PAYPAL-ORDER-1');
  const call = paypalCalls.find(item => item.url.endsWith('/v2/checkout/orders'));
  assert.match(call.body, /123\.45/);
  assert.equal(orders[0].amount_cents, 12345);
  assert.equal(orders[0].status, 'criado');
 });

test('captura divergente não faz PATCH e captura correta faz PATCH condicional', async () => {
  orders.push(order());
  captureMode = 'divergent';
  const bad = await handleVendaRoute(req('/c/api/paypal/capture', { method: 'POST', body: JSON.stringify({ orderID: 'PAYPAL-ORDER-1' }) }), env);
  assert.equal(bad.status, 402);
  assert.equal(patches.length, 0);
  captureMode = 'good';
  const good = await handleVendaRoute(req('/c/api/paypal/capture', { method: 'POST', body: JSON.stringify({ orderID: 'PAYPAL-ORDER-1' }) }), env);
  assert.equal(good.status, 200);
  assert.equal(orders[0].status, 'pago');
  assert.match(patches[0].url, /paypal_order_id=eq\.PAYPAL-ORDER-1/);
  assert.match(patches[0].url, /status=eq\.criado/);
 });

test('webhook inválido é rejeitado e eventos REFUNDED/COMPLETED são idempotentes', async () => {
  orders.push(order());
  const invalid = await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', body: '{}' }), env);
  assert.equal(invalid.status, 400);
  const completed = completedBody();
  assert.equal((await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body: completed }), env)).status, 200);
  assert.equal(orders[0].status, 'pago');
  const refunded = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } } } });
  assert.equal((await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body: refunded }), env)).status, 200);
  assert.equal(orders[0].status, 'reembolsado');
  const count = patches.length;
  await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body: refunded }), env);
  assert.equal(patches.length, count);
 });

test('webhook COMPLETED com valor divergente não faz PATCH', async () => {
  orders.push(order());
  const response = await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body: completedBody('1.00', 'EUR') }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(patches.length, 0);
  assert.equal(patchAttempts.length, 0);
  assert.equal(orders[0].status, 'criado');
});

test('webhook COMPLETED com moeda USD não faz PATCH', async () => {
  orders.push(order());
  const response = await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body: completedBody('123.45', 'USD') }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(patches.length, 0);
  assert.equal(patchAttempts.length, 0);
  assert.equal(orders[0].status, 'criado');
});

test('webhook REFUNDED usa status=in.(criado,pago)', async () => {
  orders.push(order('00000000-0000-4000-8000-000000000001', 'pago'));
  const body = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-1' } } } });
  const response = await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body }), env);
  assert.equal(response.status, 200);
  assert.equal(orders[0].status, 'reembolsado');
  assert.ok(patches.some((patch) => /status=in\.\(criado,pago\)/.test(patch.url)), 'filtro in.(criado,pago)');
});

test('webhook REFUNDED sem order_id resolve via GET /v2/payments/captures/<id> no host sandbox', async () => {
  orders.push(order('00000000-0000-4000-8000-000000000001', 'pago'));
  const body = JSON.stringify({ event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { links: [{ rel: 'up', href: 'https://captures.example.test/v2/payments/captures/CAPTURE-1' }] } });
  const response = await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body }), env);
  assert.equal(response.status, 200);
  const lookup = paypalCalls.find((call) => call.method === 'GET' && call.url.includes('/v2/payments/captures/CAPTURE-1'));
  assert.ok(lookup, 'deve consultar o capture no PayPal');
  assert.match(lookup.url, /^https:\/\/api-m\.sandbox\.paypal\.com/);
  assert.equal(orders[0].status, 'reembolsado');
  assert.ok(patches.some((patch) => /status=in\.\(criado,pago\)/.test(patch.url)));
});

test('webhook COMPLETED depois de reembolsado não altera e mantém status=eq.criado', async () => {
  orders.push(order('00000000-0000-4000-8000-000000000001', 'reembolsado'));
  const response = await handleVendaRoute(req('/c/api/paypal/webhook', { method: 'POST', headers: webhookHeaders, body: completedBody() }), env);
  assert.equal(response.status, 200);
  assert.equal(orders[0].status, 'reembolsado');
  assert.equal(patches.length, 0);
  assert.ok(patchAttempts.some((attempt) => /status=eq\.criado/.test(attempt.url)), 'filtro eq.criado mantido');
});

test('slug distingue inválido, reservado, ocupado e livre', async () => {
  cards.push({ slug: 'ana-costa' });
  for (const [slug, available, reason] of [['ab', false, 'invalido'], ['admin', false, 'reservado'], ['ana-costa', false, 'ocupado'], ['novo-card', true, 'livre']]) {
    const response = await handleVendaRoute(req(`/c/api/slug?s=${slug}`), env);
    const body = await response.json();
    assert.equal(body.disponivel, available);
    assert.equal(body.motivo, reason);
  }
 });

test('criação não paga, duplicada, reservada, conflito e sucesso', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const form = (name, pedido = id) => { const data = new FormData(); data.set('pedido', pedido); data.set('nome', 'Ana Costa'); data.set('email', 'ana@example.test'); data.set('telefone', '+351912345678'); data.set('whatsapp', '+351912345678'); data.set('slug', name); data.set('bio', 'Olá'); return data; };
  orders.push(order(id, 'criado'));
  assert.equal((await handleVendaRoute(req('/c/api/cartao', { method: 'POST', body: form('ana') }), env)).status, 402);
  orders[0].status = 'pago';
  const waits = [];
  const created = await handleVendaRoute(req('/c/api/cartao', { method: 'POST', body: form('ana') }), env, { waitUntil(promise) { waits.push(promise); } });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { url: '/c/ana' });
  await Promise.all(waits);
  assert.equal(resendCalls, 1);
  assert.equal((await handleVendaRoute(req('/c/api/cartao', { method: 'POST', body: form('outro') }), env)).status, 409);
  orders.push(order('00000000-0000-4000-8000-000000000002', 'pago'));
  assert.equal((await handleVendaRoute(req('/c/api/cartao', { method: 'POST', body: form('admin', '00000000-0000-4000-8000-000000000002') }), env)).status, 400);
  assert.equal((await handleVendaRoute(req('/c/api/cartao', { method: 'POST', body: form('ana') }), env)).status, 409);
 });

test('renderiza formulário PT-PT com hidden pedido e método errado é 405', async () => {
  orders.push(order('00000000-0000-4000-8000-000000000001', 'pago'));
  const page = await handleVendaRoute(req('/cartao-digital/criar?pedido=00000000-0000-4000-8000-000000000001'), env);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /name="pedido"/);
  assert.match(html, /name="bio"/);
  assert.match(html, /\/c\/api\/slug\?s=/);
 assert.equal((await handleVendaRoute(req('/c/api/slug?s=x', { method: 'POST' }), env)).status, 405);
 });

test('criar sem pedido UUID responde 404 e pedido reembolsado não libera formulário', async () => {
  const missing = await handleVendaRoute(req('/cartao-digital/criar'), env);
  assert.equal(missing.status, 404);
  orders.push(order('00000000-0000-4000-8000-000000000001', 'reembolsado'));
  const refunded = await handleVendaRoute(req('/cartao-digital/criar?pedido=00000000-0000-4000-8000-000000000001'), env);
  assert.equal(refunded.status, 200);
  assert.match(await refunded.text(), /Pagamento ainda não confirmado/);
});

test('host não previsto lança no stub', async () => {
  await assert.rejects(() => stubFetch('https://host-desconhecido.test/x'), /host não stubado/);
 });

test('formulário pré-preenche o e-mail do comprador escapado', async () => {
  const { renderCriar } = await import('../worker/render/criar.js');
  const out = renderCriar({}, '11111111-1111-4111-8111-111111111111', 'a"b@x.pt');
  assert.match(out, /name="email"[^>]*value="a&quot;b@x\.pt"/);
});
