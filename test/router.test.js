import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { card, makeCtx, makeEnv, stubFetch } from './helpers.js';

const ENVIO_ID = '11111111-1111-4111-8111-111111111111';

function apiStub({ currentCard = card(), lead = null, leadsResponse, evolutionStatus = 200 } = {}) {
  return stubFetch(async (url, init) => {
    if (url.includes('/cards?')) return { body: currentCard ? [currentCard] : [] };
    if (url.includes('/rpc/increment_visit')) return { body: {} };
    if (url.includes('/leads')) {
      if (leadsResponse !== undefined) return { body: leadsResponse };
      const payload = JSON.parse(init.body);
      return { body: [lead || { id: 'lead-1', ...payload }] };
    }
    if (url.endsWith('/notifications')) return { body: {} };
    if (url.includes('api.resend.com')) return { body: { id: 'email-1' } };
    if (url.includes('/message/sendText/')) return { status: evolutionStatus, body: {} };
    throw new Error('unexpected ' + url + ' ' + init.method);
  });
}

function leadBody(overrides = {}) {
  return {
    slug: 'ana-sousa',
    envio_id: ENVIO_ID,
    intencao: 'arrendamento',
    sub_intencao: 'procuro_casa',
    nome: 'João Silva',
    email: 'joao@example.com',
    whatsapp: '+351 912 345 678',
    consent: true,
    ...overrides,
  };
}

function postLead(body) {
  return new Request('https://cartao.example/c/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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

    const reserved = await worker.fetch(new Request('https://cartao.example/c/admin'), env, makeCtx());
    assert.equal(reserved.status, 404);
    assert.equal(fetcher.calls.slice(before).some((call) => call.url.includes('slug=eq.admin')), false);

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

test('lead válido usa on_conflict por envio_id e notifica por dois canais', async () => {
  const fetcher = apiStub();
  const ctx = makeCtx();
  try {
    const response = await worker.fetch(postLead(leadBody()), makeEnv(), ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    await Promise.all(ctx.promises);

    const insertCall = fetcher.calls.find((x) => x.url.includes('/leads?on_conflict=envio_id'));
    assert.ok(insertCall, 'insert deve usar on_conflict=envio_id');
    assert.equal(JSON.parse(insertCall.init.body).envio_id, ENVIO_ID);
    assert.match(insertCall.init.headers.Prefer, /resolution=ignore-duplicates/);
    assert.match(insertCall.init.headers.Prefer, /return=representation/);

    assert.equal(fetcher.calls.filter((x) => x.url.includes('api.resend.com')).length, 1);
    assert.equal(fetcher.calls.filter((x) => x.url.includes('/message/sendText/')).length, 1);
    assert.equal(fetcher.calls.filter((x) => x.url.endsWith('/notifications')).length, 2);
    assert.match(JSON.parse(fetcher.calls.find((x) => x.url.includes('api.resend.com')).init.body).text, /Novo contacto.*João Silva/s);
  } finally {
    fetcher.restore();
  }
});

test('envio_id duplicado responde sucesso sem segunda notificação', async () => {
  const fetcher = apiStub({ leadsResponse: [] });
  const ctx = makeCtx();
  try {
    const response = await worker.fetch(postLead(leadBody()), makeEnv(), ctx);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    await Promise.all(ctx.promises);
    assert.equal(fetcher.calls.filter((x) => x.url.includes('api.resend.com')).length, 0);
    assert.equal(fetcher.calls.filter((x) => x.url.includes('/message/sendText/')).length, 0);
    assert.equal(fetcher.calls.filter((x) => x.url.endsWith('/notifications')).length, 0);
  } finally {
    fetcher.restore();
  }
});

test('envio_id ausente ou inválido responde 400 sem gravar', async () => {
  const fetcher = apiStub();
  try {
    const missing = await worker.fetch(postLead(leadBody({ envio_id: undefined })), makeEnv(), makeCtx());
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).erros.envio_id, 'Identificador de envio inválido.');

    const invalid = await worker.fetch(postLead(leadBody({ envio_id: 'nao-e-uuid' })), makeEnv(), makeCtx());
    assert.equal(invalid.status, 400);

    assert.equal(fetcher.calls.some((x) => x.url.includes('/leads')), false);
  } finally {
    fetcher.restore();
  }
});

test('falha do WhatsApp não falha o lead', async () => {
  const fetcher = apiStub({ evolutionStatus: 500 });
  const ctx = makeCtx();
  try {
    const response = await worker.fetch(postLead(leadBody({ intencao: 'compra_venda', sub_intencao: 'comprar', whatsapp: '+351912345678' })), makeEnv(), ctx);
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
    const base = leadBody();
    const honeypot = await worker.fetch(postLead({ ...base, hp: 'filled' }), makeEnv(), makeCtx());
    assert.equal(honeypot.status, 200);
    assert.equal(fetcher.calls.length, 0);

    const invalid = await worker.fetch(postLead({ ...base, consent: false }), makeEnv(), makeCtx());
    assert.equal(invalid.status, 400);

    const wrongType = await worker.fetch(new Request('https://cartao.example/c/api/lead', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }), makeEnv(), makeCtx());
    assert.equal(wrongType.status, 415);

    const closedFetcher = apiStub({ currentCard: card({ chat_enabled: false }) });
    try {
      const closed = await worker.fetch(postLead(base), makeEnv(), makeCtx());
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
