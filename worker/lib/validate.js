export const RESERVED_SLUGS = new Set([
  'painel', 'api', 'admin', 'assets', 'cartao-visita', 'cartao-digital',
  'criar', 'login', 'logout', 'static', 'www', 'app', 'suporte', 'ajuda',
  'privacidade', 'termos', 'zx', 'zxlab-admin',
]);

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const INTENCOES = new Set(['arrendamento', 'compra_venda', 'estudo_mercado']);
const SUBS = {
  arrendamento: new Set(['procuro_casa', 'tenho_imovel']),
  compra_venda: new Set(['comprar', 'vender']),
};

export function isValidSlug(value) {
  return typeof value === 'string'
    && /^[a-z0-9-]{3,40}$/.test(value)
    && !RESERVED_SLUGS.has(value);
}

export function normalizePhoneE164(input) {
  if (typeof input !== 'string') return null;
  let value = input.replace(/[\s().-]/g, '');
  if (value.startsWith('00')) value = '+' + value.slice(2);
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

export function isValidEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function sanitizeUtm(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(UTM_KEYS
    .filter((key) => typeof input[key] === 'string')
    .map((key) => [key, input[key].slice(0, 100)]));
}

export function validateLead(input = {}) {
  const erros = {};
  const value = input && typeof input === 'object' ? input : {};
  const slug = typeof value.slug === 'string' ? value.slug.trim() : '';
  const intencao = typeof value.intencao === 'string' ? value.intencao : '';
  const sub = typeof value.sub_intencao === 'string' ? value.sub_intencao.trim() : '';
  const nome = typeof value.nome === 'string' ? value.nome.trim() : '';
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const whatsapp = normalizePhoneE164(value.whatsapp);
  const mensagem = typeof value.mensagem === 'string' ? value.mensagem.trim() : '';

  if (!isValidSlug(slug)) erros.slug = 'Slug inválido.';
  if (!INTENCOES.has(intencao)) erros.intencao = 'Escolha uma intenção válida.';
  if (intencao !== 'estudo_mercado' && sub && !SUBS[intencao]?.has(sub)) {
    erros.sub_intencao = 'Escolha uma opção válida.';
  }
  if (intencao === 'estudo_mercado' && (sub.length < 2 || sub.length > 120)) {
    erros.sub_intencao = 'Indique uma zona ou morada entre 2 e 120 caracteres.';
  }
  if (nome.length < 2 || nome.length > 100) erros.nome = 'Indique o seu nome.';
  if (!isValidEmail(email)) erros.email = 'Indique um e-mail válido.';
  if (!whatsapp) erros.whatsapp = 'Indique um WhatsApp internacional válido.';
  if (mensagem.length > 500) erros.mensagem = 'A mensagem deve ter no máximo 500 caracteres.';
  if (value.consent !== true) erros.consent = 'O consentimento é obrigatório.';

  const normalized = {
    slug,
    intencao,
    sub_intencao: sub || null,
    nome,
    email,
    whatsapp_e164: whatsapp,
    mensagem: mensagem || null,
    consent: true,
    utm: sanitizeUtm(value.utm),
  };
  return Object.keys(erros).length
    ? { ok: false, erros }
    : { ok: true, value: normalized, utm: normalized.utm };
}
