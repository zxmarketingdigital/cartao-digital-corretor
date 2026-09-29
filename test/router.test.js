import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { card, makeCtx, makeEnv, stubFetch } from './helpers.js';

function apiStub({ currentCard = card(), lead = null, evolutionStatus = 200 } = {}) {
  return stubFetch(async (url, init) => {
    if (url.includes('/cards?')) return { body: currentCard ? [currentCard] : [] };
    if (url.includes('/rpc/increment_visit')) return { body: {} };
    if (url.endsWith('/leads')) {
      const payload = JSON.parse(init.body);
      return { body: [lead || { id: 'lead-1', ...payload }] };
    }
    if (url.endsWith('/notifications')) return { body: {} };
    if (url.includes('api.resend.com')) return { body: { id: 'email-1' } };
    if (url.includes('/message/sendText/')) return { status: evolutionStatus, body: {} };
    throw new Error('unexpected ' + url + ' ' + init.method);
  });
}

test('rotas de cartão, visita, reserva, cartão ZX e vcard', async () => {
  const env = makeEnv();
  const fetcher = apiStub();
  try {
    const ctx = makeCtx();
    const response = await worker.fetch(new Request('https://cartao.example/c/ana-sousa'), env, ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.promises);
    assert.equal(fetcher.calls.some((call) => call.url.includes('/rpc/increment_visit')), true);

    const before = fetcher.calls.length;
    const noVisit = await worker.fetch(new Request('https://cartao.example/c/ana-sousa', { headers: { 'user-agent': 'WhatsApp/2.0' } }), env, makeCtx());
    assert.equal(noVisit.status, 200);
    assert.equal(fetcher.calls.slice(before).some((call) => call.url.includes('/rpc/increment_visit')), false);

    const reserved = await worker.fetch(new Request('https://cartao.example/c/painel'), env, makeCtx());
    assert.equal(reserved.status, 404);
    assert.equal(fetcher.calls.slice(before).some((call) => call.url.includes('slug=eq.painel')), false);

    const zx = await worker.fetch(new Request('https://cartao.example/cartao-visita'), env, makeCtx());
    assert.equal(zx.status, 200);
    assert.equal(fetcher.calls.some((call) => call.url.includes('slug=eq.zxlab')), true);

    const vcard = await worker.fetch(new Request('https://cartao.example/c/ana-sousa/vcard'), env, makeCtx());
    assert.equal(vcard.status, 200);
    assert.match(vcard.headers.get('content-type'), /text\/vcard/);
  } finally {
    fetcher.restore();
  }
});

test('slug inexistente responde 404', async () => {
  const fetcher = apiStub({ currentCard: null });
  try {
    const response = await worker.fetch(new Request('https://cartao.example/c/ana-sousa'), makeEnv(), makeCtx());
    assert.equal(response.status, 404);
  } finally {
    fetcher.restore();
  }
});

test('lead válido notifica por dois canais após responder', async () => {
  const fetcher = apiStub();
  const ctx = makeCtx();
  try {
    const response = await worker.fetch(new Request('https://cartao.example/c/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'ana-sousa', intencao: 'arrendamento', sub_intencao: 'procuro_casa', nome: 'João Silva', email: 'joao@example.com', whatsapp: '+351 912 345 678', consent: true }),
    }), makeEnv(), ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    await Promise.all(ctx.promises);
    assert.equal(fetcher.calls.filter((x) => x.url.includes('api.resend.com')).length, 1);
    assert.equal(fetcher.calls.filter((x) => x.url.includes('/message/sendText/')).length, 1);
    const notificationCalls = fetcher.calls.filter((x) => x.url.endsWith('/notifications'));
    assert.equal(notificationCalls.length, 2);
    assert.match(JSON.parse(fetcher.calls.find((x) => x.url.includes('api.resend.com')).init.body).text, /Novo contacto.*João Silva/s);
  } finally {
    fetcher.restore();
  }
});

test('falha do WhatsApp não falha o lead', async () => {
  const fetcher = apiStub({ evolutionStatus: 500 });
  const ctx = makeCtx();
  try {
    const response = await worker.fetch(new Request('https://cartao.example/c/api/lead', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'ana-sousa', intencao: 'compra_venda', sub_intencao: 'comprar', nome: 'João Silva', email: 'joao@example.com', whatsapp: '+351912345678', consent: true }),
    }), makeEnv(), ctx);
    assert.equal(response.status, 200);
    await Promise.all(ctx.promises);
    const failed = fetcher.calls.filter((x) => x.url.endsWith('/notifications')).map((x) => JSON.parse(x.init.body));
    assert.equal(failed.some((x) => x.canal === 'whatsapp' && x.status === 'falhou'), true);
  } finally {
    fetcher.restore();
  }
});

test('honeypot, consentimento, content type e chat desligado', async () => {
  const fetcher = apiStub();
  try {
    const base = { slug: 'ana-sousa', intencao: 'arrendamento', sub_intencao: 'procuro_casa', nome: 'João', email: 'joao@example.com', whatsapp: '+351912345678', consent: true };
    const honeypot = await worker.fetch(new Request('https://cartao.example/c/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...base, hp: 'filled' }) }), makeEnv(), makeCtx());
    assert.equal(honeypot.status, 200);
    assert.equal(fetcher.calls.length, 0);
    const invalid = await worker.fetch(new Request('https://cartao.example/c/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...base, consent: false }) }), makeEnv(), makeCtx());
    assert.equal(invalid.status, 400);
    const wrongType = await worker.fetch(new Request('https://cartao.example/c/api/lead', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }), makeEnv(), makeCtx());
    assert.equal(wrongType.status, 415);
    const closedFetcher = apiStub({ currentCard: card({ chat_enabled: false }) });
    try {
      const closed = await worker.fetch(new Request('https://cartao.example/c/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base) }), makeEnv(), makeCtx());
      assert.equal(closed.status, 404);
    } finally {
      closedFetcher.restore();
    }
  } finally {
    fetcher.restore();
  }
});

test('recusa corpo JSON acima do limite antes de consultar o Supabase', async () => {
  const fetcher = apiStub();
  try {
    const response = await worker.fetch(new Request('https://cartao.example/c/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ padding: 'x'.repeat(70 * 1024) }),
    }), makeEnv(), makeCtx());
    assert.equal(response.status, 413);
    assert.equal(fetcher.calls.length, 0);
  } finally {
    fetcher.restore();
  }
});
