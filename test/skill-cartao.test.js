import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_FIELDS,
  createCard,
  createOwnerUser,
  editCard,
  getCard,
  listCards,
  loadEnv,
  normalizePhoneE164,
  parseDotEnv,
  run,
  setCardStatus,
} from '../.claude/skills/criar-cartao-visita/scripts/cartao.mjs';

const ENV = {
  SUPABASE_URL: 'https://supabase.example.invalid',
  SUPABASE_SERVICE_ROLE_KEY: 'local-test-value',
  PUBLIC_BASE_URL: 'https://cartao.example.invalid',
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const route = routes.find((item) => item.match(String(url), init));
    if (!route) throw new Error(`unexpected test network: ${url}`);
    return typeof route.result === 'function' ? route.result(url, init) : route.result;
  };
  return { calls, fetchImpl };
}

function card() {
  return {
    id: 'card-1', slug: 'beatriz-demo', nome: 'Beatriz (exemplo)',
    status: 'ativo', locale: 'pt-PT', chat_enabled: true,
  };
}

test('parseia .env sem imprimir nem transformar comentários em valores', () => {
  const parsed = parseDotEnv([
    'SUPABASE_URL=https://supabase.example.invalid # comentário',
    'export EMAIL_FROM="Cartão <avisos@example.invalid>"',
    "EMPTY=''",
    '# ignorado=sim',
  ].join('\n'));
  assert.deepEqual(parsed, {
    SUPABASE_URL: 'https://supabase.example.invalid',
    EMAIL_FROM: 'Cartão <avisos@example.invalid>',
    EMPTY: '',
  });
  assert.equal(loadEnv({ rootDir: '/path/que-nao-existe', environ: { TEST_VALUE: 'ok' } }).TEST_VALUE, 'ok');
});

test('reexporta o normalizador canónico e mantém slug reservado fora do fluxo', async () => {
  assert.equal(normalizePhoneE164('+351 910 000 000'), '+351910000000');
  assert.equal(normalizePhoneE164('00351910000000'), '+351910000000');
  assert.equal(normalizePhoneE164('910000000'), null);
  await assert.rejects(
    () => createCard({ slug: 'painel', nome: 'Exemplo' }, { env: ENV, fetchImpl: async () => response([]) }),
    /Slug inválido/,
  );
  assert.ok(CARD_FIELDS.includes('links'));
  assert.ok(CARD_FIELDS.includes('chat_enabled'));
  assert.ok(CARD_FIELDS.includes('owner_user_id'));
});

test('criar envia apenas colunas permitidas e normaliza o telefone', async () => {
  const stub = stubFetch([{ match: (url, init) => url.endsWith('/rest/v1/cards') && init.method === 'POST', result: response([card()], 201) }]);
  const result = await createCard({
    slug: 'beatriz-demo', nome: 'Beatriz (exemplo)', whatsapp_e164: '+351 910 000 000',
    links: [], chat_enabled: true, locale: 'pt-PT',
  }, { env: ENV, fetchImpl: stub.fetchImpl });
  const payload = JSON.parse(stub.calls[0].init.body);
  assert.equal(payload.whatsapp_e164, '+351910000000');
  assert.equal(payload.id, undefined);
  assert.equal(result.url, 'https://cartao.example.invalid/c/beatriz-demo');
});

test('email-dono tenta criar e, para utilizador existente, consulta RPC', async () => {
  const stub = stubFetch([
    { match: (url, init) => url.endsWith('/auth/v1/admin/users') && init.method === 'POST', result: response({ message: 'já existe' }, 422) },
    { match: (url, init) => url.endsWith('/rest/v1/rpc/user_id_by_email') && init.method === 'POST', result: response('user-1') },
  ]);
  assert.equal(await createOwnerUser('dono@example.invalid', { env: ENV, fetchImpl: stub.fetchImpl }), 'user-1');
  assert.equal(stub.calls.length, 2);
  assert.equal(JSON.parse(stub.calls[0].init.body).email, 'dono@example.invalid');
  assert.equal(JSON.parse(stub.calls[1].init.body).p_email, 'dono@example.invalid');
  assert.match(stub.calls[0].init.headers.Authorization, /^Bearer /);
});

test('editar, ver e listar usam filtros PostgREST corretos', async () => {
  const stub = stubFetch([
    { match: (url, init) => init.method === 'PATCH', result: response([card()]) },
    { match: (url, init) => init.method === 'GET' && url.includes('slug=eq.beatriz-demo'), result: response([card()]) },
    { match: (url, init) => init.method === 'GET' && url.endsWith('order=created_at.desc'), result: response([card()]) },
  ]);
  const edited = await editCard('beatriz-demo', { bio: 'Atualizado' }, { env: ENV, fetchImpl: stub.fetchImpl });
  assert.equal(edited.card.slug, 'beatriz-demo');
  assert.equal((await getCard('beatriz-demo', { env: ENV, fetchImpl: stub.fetchImpl })).slug, 'beatriz-demo');
  assert.equal((await listCards({ env: ENV, fetchImpl: stub.fetchImpl })).length, 1);
  assert.equal(JSON.parse(stub.calls[0].init.body).bio, 'Atualizado');
});

test('suspender e ativar enviam somente a transição de status', async () => {
  const stub = stubFetch([{ match: (url, init) => init.method === 'PATCH', result: () => response([card()]) }]);
  await setCardStatus('beatriz-demo', 'suspenso', { env: ENV, fetchImpl: stub.fetchImpl });
  await setCardStatus('beatriz-demo', 'ativo', { env: ENV, fetchImpl: stub.fetchImpl });
  assert.deepEqual(JSON.parse(stub.calls[0].init.body), { status: 'suspenso' });
  assert.deepEqual(JSON.parse(stub.calls[1].init.body), { status: 'ativo' });
});

test('status não reporta sucesso quando o slug não existe', async () => {
  const stub = stubFetch([{ match: (url, init) => init.method === 'PATCH', result: response([]) }]);
  await assert.rejects(
    () => setCardStatus('beatriz-demo', 'suspenso', { env: ENV, fetchImpl: stub.fetchImpl }),
    /Cartão não encontrado/,
  );
});

test('run suporta os subcomandos sem fazer fetch no import', async () => {
  const stub = stubFetch([{ match: (url, init) => init.method === 'GET' && url.includes('slug=eq.beatriz-demo'), result: response([card()]) }]);
  const result = await run(['ver', '--slug', 'beatriz-demo'], { env: ENV, fetchImpl: stub.fetchImpl });
  assert.equal(result.card.slug, 'beatriz-demo');
  assert.equal(stub.calls.length, 1);
});
