import { isValidEmail, isValidSlug, normalizePhoneE164, RESERVED_SLUGS } from '../lib/validate.js';
import { capturePaypalOrder, createPaypalOrder, paypalOrderId, productPrice, verifyPaypalWebhook } from '../lib/paypal.js';
import * as db from '../lib/db-venda.js';
import { sendWelcome } from '../lib/welcome.js';
import { renderCriar, renderCriarDone, renderCriarPending } from '../render/criar.js';

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_SYNTAX = /^[a-z0-9-]{3,40}$/;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function fail(message, status, field) {
  const error = new Error(message);
  error.status = status;
  error.field = field;
  throw error;
}

function errorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) return json({ ok: false, error: 'Erro interno' }, status);
  if (error?.field) return json({ ok: false, erros: { [error.field]: error.message } }, status);
  return json({ ok: false, error: error?.message || 'Pedido inválido' }, status);
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = Math.random() * 16 | 0;
    return (char === 'x' ? r : r & 3 | 8).toString(16);
  });
}

function stringValue(value, max = Infinity) {
  const result = String(value ?? '').trim();
  if (result.length > max) fail('Campo demasiado longo.', 400);
  return result;
}

async function readBody(request) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) fail('Pedido demasiado grande.', 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) fail('Pedido demasiado grande.', 413);
  const contentType = request.headers.get('content-type') || '';
  const raw = new TextDecoder().decode(bytes);
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
    const data = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') {
        if (key === 'servicos') data.servicos = [...(data.servicos || []), value];
        else data[key] = value;
        continue;
      }
      if (!value.size) continue;
      const type = String(value.type || '').toLowerCase();
      if (value.size > MAX_PHOTO_BYTES || !PHOTO_TYPES.has(type)) fail('Fotografia inválida.', 400, 'foto');
      data.foto = { bytes: new Uint8Array(await value.arrayBuffer()), type };
    }
    return { data, raw };
  }
  if (!raw.trim()) return { data: {}, raw };
  try { return { data: JSON.parse(raw), raw }; } catch { fail('JSON inválido.', 400); }
}

function validPublicSlug(value) {
  return SLUG_SYNTAX.test(value) && isValidSlug(value);
}

function optionalUrl(value, max = 500) {
  const result = stringValue(value, max);
  if (!result) return null;
  try {
    const parsed = new URL(result);
    return ['http:', 'https:'].includes(parsed.protocol) ? result : null;
  } catch { return null; }
}

function cardFields(data) {
  const nome = stringValue(data.nome, 100);
  const email = stringValue(data.email, 254).toLowerCase();
  const slug = stringValue(data.slug, 40).toLowerCase();
  const whatsapp = normalizePhoneE164(stringValue(data.whatsapp, 40));
  const telefoneInput = stringValue(data.telefone, 40);
  const telefone = telefoneInput ? normalizePhoneE164(telefoneInput) : null;
  if (nome.length < 2) fail('Indique o seu nome.', 400, 'nome');
  if (!isValidEmail(email)) fail('Indique um e-mail válido.', 400, 'email');
  if (!validPublicSlug(slug)) fail(RESERVED_SLUGS.has(slug) ? 'Slug reservado.' : 'Slug inválido.', 400, 'slug');
  if (!whatsapp) fail('Indique um WhatsApp internacional válido.', 400, 'whatsapp');
  if (telefoneInput && !telefone) fail('Indique um telefone internacional válido.', 400, 'telefone');
  const servicos = (Array.isArray(data.servicos) ? data.servicos : data.servicos ? [data.servicos] : [])
    .map((item) => stringValue(item, 80)).filter(Boolean).slice(0, 20);
  return {
    slug, nome, cargo: stringValue(data.cargo, 120) || null, agencia: stringValue(data.agencia, 120) || null,
    ami: stringValue(data.ami, 40) || null, bio: stringValue(data.bio, 400) || null,
    foto_url: null, telefone_e164: telefone, whatsapp_e164: whatsapp, email,
    morada: stringValue(data.morada, 300) || null, maps_url: optionalUrl(data.maps_url),
    instagram: stringValue(data.instagram, 120) || null, facebook: stringValue(data.facebook, 120) || null,
    tiktok: stringValue(data.tiktok, 120) || null, linkedin: stringValue(data.linkedin, 300) || null,
    site: optionalUrl(data.site), reviews_url: optionalUrl(data.reviews_url), agenda_url: optionalUrl(data.agenda_url),
    servicos, links: [], notify_email: email, notify_whatsapp_e164: whatsapp,
    chat_enabled: true, locale: 'pt-PT', status: 'ativo',
  };
}

async function createOrder(request, env) {
  const amount = productPrice(env);
  const orderId = uuid();
  await db.insertOrder(env, { id: orderId, status: 'criado', amount_cents: Math.round(amount * 100), currency: 'EUR' });
  const paypal = await createPaypalOrder(env, orderId);
  if (!paypal?.id) fail('Resposta PayPal inválida.', 502);
  await db.patchOrderById(env, orderId, { paypal_order_id: paypal.id });
  return json({ id: paypal.id });
}

async function captureOrder(request, env) {
  const { data } = await readBody(request);
  const paypalId = paypalOrderId(data);
  if (!paypalId) return json({ ok: false }, 400);
  const order = await db.getOrderByPaypalOrderId(env, String(paypalId));
  if (!order) return json({ ok: false }, 404);
  if (order.status === 'pago') return json({ pedido: order.id });
  if (order.status !== 'criado') return json({ ok: false }, 402);
  const captureResult = await capturePaypalOrder(env, String(paypalId));
  const capture = captureResult?.purchase_units?.[0]?.payments?.captures?.[0];
  const expected = productPrice(env).toFixed(2);
  if (captureResult?.status !== 'COMPLETED' || capture?.amount?.value !== expected || capture?.amount?.currency_code !== 'EUR') {
    return json({ ok: false }, 402);
  }
  const updated = await db.patchOrderByPaypalOrderId(env, String(paypalId), 'criado', {
    status: 'pago', buyer_email: captureResult?.payer?.email_address || null, paid_at: new Date().toISOString(),
  });
  if (!updated) {
    const current = await db.getOrderByPaypalOrderId(env, String(paypalId));
    if (current?.status === 'pago') return json({ pedido: current.id });
    return json({ ok: false }, 409);
  }
  return json({ pedido: updated.id || order.id });
}

async function webhook(request, env) {
  const { data, raw } = await readBody(request);
  if (!await verifyPaypalWebhook(env, request.headers, data, raw)) return json({ ok: false }, 400);
  const orderId = data?.resource?.supplementary_data?.related_ids?.order_id;
  const type = String(data?.event_type || '').toUpperCase();
  if (orderId && type === 'PAYMENT.CAPTURE.COMPLETED') {
    await db.patchOrderByPaypalOrderId(env, orderId, 'criado', { status: 'pago', paid_at: new Date().toISOString() });
  } else if (orderId && type === 'PAYMENT.CAPTURE.REFUNDED') {
    await db.patchOrderByPaypalOrderId(env, orderId, 'pago', { status: 'reembolsado' });
  }
  return json({ ok: true });
}

async function slugAvailability(request, env, url) {
  const value = String((url || new URL(request.url)).searchParams.get('s') || '').trim().toLowerCase();
  if (!SLUG_SYNTAX.test(value)) return json({ disponivel: false, motivo: 'invalido' });
  if (RESERVED_SLUGS.has(value)) return json({ disponivel: false, motivo: 'reservado' });
  if (await db.getCardBySlug(env, value)) return json({ disponivel: false, motivo: 'ocupado' });
  return json({ disponivel: true, motivo: 'livre' });
}

async function createCard(request, env, ctx, url) {
  const { data } = await readBody(request);
  const orderId = stringValue(data.pedido || (url || new URL(request.url)).searchParams.get('pedido'), 36);
  if (!UUID.test(orderId)) return json({ ok: false, erros: { pedido: 'Pedido inválido.' } }, 400);
  const order = await db.getOrderById(env, orderId);
  if (!order || order.status !== 'pago') return json({ ok: false }, 402);
  if (await db.getCardByOrderId(env, orderId)) return json({ ok: false }, 409);
  const fields = cardFields(data);
  if (await db.getCardBySlug(env, fields.slug)) return json({ ok: false, erros: { slug: 'Este slug já está ocupado.' } }, 409);
  const ownerUserId = await db.createOrGetUser(env, fields.email);
  const cardId = uuid();
  if (data.foto) {
    const extension = data.foto.type === 'image/jpeg' ? 'jpg' : data.foto.type.slice('image/'.length);
    fields.foto_url = await db.uploadCardPhoto(env, `fotos/${cardId}/${uuid()}.${extension}`, data.foto);
  }
  let card;
  try {
    card = await db.insertCard(env, { id: cardId, order_id: orderId, owner_user_id: ownerUserId, ...fields });
  } catch (error) {
    if (error.status === 409) return json({ ok: false, erros: { slug: 'Este slug já está ocupado.' } }, 409);
    throw error;
  }
  if (ctx?.waitUntil) ctx.waitUntil(sendWelcome(env, { nome: fields.nome, email: fields.email, slug: fields.slug }).catch((error) => console.error('welcome email failed', error instanceof Error ? error.message : 'unknown')));
  return json({ url: '/c/' + fields.slug }, 201);
}

export async function handleVendaRoute(request, env, ctx, path, url) {
  const pathname = path || new URL(request.url).pathname;
  const methods = {
    '/cartao-digital/criar': 'GET', '/c/api/paypal/order': 'POST', '/c/api/paypal/capture': 'POST',
    '/c/api/paypal/webhook': 'POST', '/c/api/slug': 'GET', '/c/api/cartao': 'POST',
  };
  if (!(pathname in methods)) return null;
  if (request.method !== methods[pathname]) return json({ ok: false, error: 'Método não permitido' }, 405);
  try {
    if (pathname === '/cartao-digital/criar') {
      const pedido = (url || new URL(request.url)).searchParams.get('pedido') || '';
      if (!UUID.test(pedido)) return new Response(renderCriarPending(env), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      const order = await db.getOrderById(env, pedido);
      if (!order || order.status !== 'pago') return new Response(renderCriarPending(env), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      if (await db.getCardByOrderId(env, pedido)) return new Response(renderCriarDone(env), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      return new Response(renderCriar(env, pedido), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    if (pathname === '/c/api/paypal/order') return await createOrder(request, env);
    if (pathname === '/c/api/paypal/capture') return await captureOrder(request, env);
    if (pathname === '/c/api/paypal/webhook') return await webhook(request, env);
    if (pathname === '/c/api/slug') return await slugAvailability(request, env, url);
    return await createCard(request, env, ctx, url);
  } catch (error) { return errorResponse(error); }
}
