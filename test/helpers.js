export function makeEnv(overrides = {}) {
  return {
    PUBLIC_BASE_URL: 'https://cartao.example',
    EMAIL_FROM: 'Cartão <noreply@example.com>',
    EVOLUTION_INSTANCE: 'avisos-cartao',
    EVOLUTION_API_URL: 'https://evolution.example',
    EVOLUTION_API_KEY: 'evolution-test-key',
    RESEND_API_KEY: 'resend-test-key',
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
    ZX_CARD_SLUG: 'zxlab',
    CF_BEACON_TOKEN: '',
    ...overrides,
  };
}

export function makeCtx() {
  const ctx = { promises: [], waitUntil(promise) { this.promises.push(Promise.resolve(promise)); } };
  return ctx;
}

export function stubFetch(handlers = {}) {
  const calls = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const call = { url, init };
    calls.push(call);
    let handler;
    if (typeof handlers === 'function') handler = handlers;
    else if (Array.isArray(handlers)) handler = handlers.find((item) => item.match(url, init))?.handler;
    else handler = Object.entries(handlers).find(([key]) => url.includes(key))?.[1];
    if (!handler) throw new Error('unexpected test network: ' + url);
    const result = typeof handler === 'function' ? await handler(url, init, call) : handler;
    if (result instanceof Response) return result;
    const status = result?.status || 200;
    const body = result?.body === undefined ? result : result.body;
    return new Response(body === undefined ? '' : JSON.stringify(body), {
      status,
      headers: result?.headers || { 'content-type': 'application/json' },
    });
  };
  return {
    calls,
    restore() { globalThis.fetch = previous; },
  };
}

export function card(overrides = {}) {
  return {
    id: 'card-1',
    slug: 'ana-sousa',
    status: 'ativo',
    nome: 'Ana Sousa',
    cargo: 'Consultora imobiliária',
    agencia: 'Agência Exemplo',
    ami: '12345',
    bio: 'Ajudo famílias a encontrar o próximo imóvel.',
    foto_url: null,
    telefone_e164: '+351912345678',
    whatsapp_e164: '+351912345678',
    email: 'ana@example.com',
    morada: 'Lisboa',
    maps_url: 'https://maps.example',
    instagram: '@ana.sousa',
    facebook: null,
    tiktok: null,
    linkedin: null,
    site: null,
    reviews_url: null,
    agenda_url: 'https://agenda.example',
    servicos: ['Compra e venda'],
    links: [],
    notify_email: null,
    notify_whatsapp_e164: null,
    chat_enabled: true,
    locale: 'pt-PT',
    ...overrides,
  };
}
