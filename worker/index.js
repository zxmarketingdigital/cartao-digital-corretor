import { getCardBySlug, incrementVisit, insertLead } from './lib/db.js';
import { validateLead, isValidSlug, RESERVED_SLUGS } from './lib/validate.js';
import { notifyLead } from './lib/notify.js';
import { CHAT_WIDGET_JS } from './render/chat-widget.js';
import { renderCard } from './render/card.js';
import { renderChatPage } from './render/chat.js';
import { renderVcard } from './render/vcard.js';
import { renderNotFound } from './render/notfound.js';
import { renderLp } from './render/lp.js';
import { handlePainelRoute } from './routes/painel.js';
import { handleVendaRoute } from './routes/venda.js';

const htmlHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'cache-control': 'no-store',
};
const MAX_LEAD_BODY_BYTES = 64 * 1024;

function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...htmlHeaders, ...extra } });
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });
}

function notFound(env) {
  return html(renderNotFound(env), 404);
}

function shouldCountVisit(request) {
  if (request.method === 'HEAD') return false;
  const agent = request.headers.get('user-agent') || '';
  return !/(bot|crawl|spider|preview|facebookexternalhit|whatsapp)/i.test(agent);
}

function countVisit(card, request, env, ctx) {
  if (!shouldCountVisit(request)) return;
  ctx.waitUntil(incrementVisit(env, card.id).catch((error) => {
    console.error('visit increment failed', error instanceof Error ? error.message : 'unknown');
  }));
}

async function readLimitedJson(request) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_LEAD_BODY_BYTES) {
    return { tooLarge: true };
  }
  if (!request.body) return { value: await request.json() };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_LEAD_BODY_BYTES) {
        await reader.cancel();
        return { tooLarge: true };
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { value: JSON.parse(new TextDecoder().decode(bytes)) };
}

async function serveCard(card, request, env, ctx, canonicalPath) {
  countVisit(card, request, env, ctx);
  return html(renderCard(card, env, { canonicalPath }));
}

async function handleLead(request, env, ctx) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) return json({ ok: false }, 415);
  let body;
  try {
    const parsed = await readLimitedJson(request);
    if (parsed.tooLarge) return json({ ok: false, erro: 'Corpo demasiado grande.' }, 413);
    body = parsed.value;
  } catch {
    return json({ ok: false, erros: { body: 'JSON inválido.' } }, 400);
  }
  if (body && body.hp && String(body.hp).trim()) return json({ ok: true });
  const validation = validateLead(body);
  if (!validation.ok) return json({ ok: false, erros: validation.erros }, 400);
  const leadData = validation.value;
  let card;
  try {
    card = await getCardBySlug(env, leadData.slug);
  } catch (error) {
    console.error('card lookup failed', error instanceof Error ? error.message : 'unknown');
    return json({ ok: false }, 500);
  }
  if (!card || card.chat_enabled === false) return json({ ok: false }, 404);
  let lead;
  try {
    lead = await insertLead(env, {
      envio_id: leadData.envio_id,
      card_id: card.id,
      intencao: leadData.intencao,
      sub_intencao: leadData.sub_intencao,
      nome: leadData.nome,
      email: leadData.email,
      whatsapp_e164: leadData.whatsapp_e164,
      mensagem: leadData.mensagem,
      consent_at: new Date().toISOString(),
      utm: leadData.utm,
    });
  } catch (error) {
    console.error('lead insert failed', error instanceof Error ? error.message : 'unknown');
    return json({ ok: false }, 500);
  }
  const recipient = String(card.whatsapp_e164 || '').replace(/\D/g, '');
  const whatsappUrl = recipient ? 'https://wa.me/' + recipient : null;
  if (!lead) {
    // envio_id já existia: duplicado, responde sucesso sem avisos/notificações.
    return json({ ok: true, duplicado: true, nome_corretor: card.nome, whatsapp_url: whatsappUrl });
  }
  ctx.waitUntil(notifyLead(env, card, lead).catch((error) => {
    console.error('lead notification failed', error instanceof Error ? error.message : 'unknown');
  }));
  return json({ ok: true, nome_corretor: card.nome, whatsapp_url: whatsappUrl });
}

async function handlePublicCard(request, env, ctx, slug, suffix = '') {
  if (!isValidSlug(slug) || RESERVED_SLUGS.has(slug)) return notFound(env);
  const card = await getCardBySlug(env, slug);
  if (!card) return notFound(env);
  if (suffix === 'chat') {
    if (card.chat_enabled === false) return new Response(null, { status: 302, headers: { location: '/c/' + slug } });
    return html(renderChatPage(card, env));
  }
  if (suffix === 'vcard') {
    return new Response(renderVcard(card, env), {
      status: 200,
      headers: {
        'content-type': 'text/vcard; charset=utf-8',
        'content-disposition': 'attachment; filename="' + slug + '.vcf"',
      },
    });
  }
  if (suffix) return notFound(env);
  return serveCard(card, request, env, ctx, '/c/' + slug);
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/c/assets/chat.js') {
    if (request.method !== 'GET') return new Response(null, { status: 405 });
    return new Response(CHAT_WIDGET_JS, {
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }
  if (path === '/c/api/lead') {
    if (request.method !== 'POST') return json({ ok: false }, 405);
    return handleLead(request, env, ctx);
  }
  if (path === '/cartao-digital') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return html('', 405);
    return html(renderLp(env));
  }
  const venda = await handleVendaRoute(request, env, ctx, path, url);
  if (venda) return venda;
  const painel = await handlePainelRoute(request, env, ctx, path);
  if (painel) return painel;
  if (path === '/cartao-visita') {
    if (request.method !== 'GET') return html('', 405);
    const slug = env.ZX_CARD_SLUG || 'zxlab';
    if (!isValidSlug(slug)) return notFound(env);
    const card = await getCardBySlug(env, slug);
    return card ? serveCard(card, request, env, ctx, '/cartao-visita') : notFound(env);
  }
  if (!path.startsWith('/c/')) return notFound(env);
  if (request.method !== 'GET') return html('', 405);
  const parts = path.slice(3).split('/').filter(Boolean);
  if (parts.length === 1) return handlePublicCard(request, env, ctx, parts[0]);
  if (parts.length === 2) return handlePublicCard(request, env, ctx, parts[0], parts[1]);
  return notFound(env);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      console.error('worker request failed', error instanceof Error ? error.message : 'unknown');
      return html('<!doctype html><html lang="pt-PT"><body><h1>Erro interno</h1></body></html>', 500);
    }
  },
};
