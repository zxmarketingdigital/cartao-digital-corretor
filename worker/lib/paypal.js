const DEFAULT_SANDBOX = 'https://api-m.sandbox.paypal.com';
const DEFAULT_LIVE = 'https://api-m.paypal.com';
const tokenCache = new WeakMap();
const CAPTURE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export class PaypalError extends Error {
  constructor(message, status = 502, details = null) {
    super(message);
    this.name = 'PaypalError';
    this.status = status;
    this.details = details;
  }
}

function paypalBase(env) {
  return env.PAYPAL_ENV === 'live' ? DEFAULT_LIVE : DEFAULT_SANDBOX;
}

function basicAuth(client, secret) {
  const value = `${client}:${secret}`;
  if (typeof btoa === 'function') return btoa(value);
  return Buffer.from(value, 'utf8').toString('base64');
}

async function responseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function paypalFetch(env, path, options = {}) {
  const response = await fetch(`${paypalBase(env)}${path}`, options);
  const body = await responseBody(response);
  if (!response.ok) throw new PaypalError('PayPal recusou o pedido', response.status >= 400 && response.status < 500 ? 400 : 502, body);
  return body;
}

export async function getPaypalAccessToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new PaypalError('PayPal não está configurado', 503);
  const cached = tokenCache.get(env);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  if (cached?.promise) return cached.promise;
  const promise = (async () => {
    const body = await paypalFetch(env, '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: 'grant_type=client_credentials'
    });
    if (!body || typeof body.access_token !== 'string') throw new PaypalError('Resposta OAuth PayPal inválida');
    const expiresIn = Number(body.expires_in);
    const expiresAt = Date.now() + Math.max(0, (Number.isFinite(expiresIn) ? expiresIn : 0) - 60) * 1000;
    tokenCache.set(env, { token: body.access_token, expiresAt });
    return body.access_token;
  })();
  tokenCache.set(env, { promise });
  try { return await promise; } finally {
    const current = tokenCache.get(env);
    if (current?.promise) tokenCache.delete(env);
  }
}

async function authenticatedRequest(env, path, method, body) {
  const token = await getPaypalAccessToken(env);
  return paypalFetch(env, path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

export function productPrice(env) {
  const value = Number(env.PRODUCT_PRICE_EUR || '97.00');
  if (!Number.isFinite(value) || value <= 0) throw new PaypalError('Preço do produto inválido', 500);
  return value;
}

export async function createPaypalOrder(env, orderUuid) {
  const value = productPrice(env).toFixed(2);
  return authenticatedRequest(env, '/v2/checkout/orders', 'POST', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: orderUuid,
      custom_id: orderUuid,
      amount: { currency_code: 'EUR', value }
    }]
  });
}

export async function capturePaypalOrder(env, paypalOrderId) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(String(paypalOrderId))) throw new PaypalError('Identificador PayPal inválido', 400);
  return authenticatedRequest(env, `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, 'POST', {});
}

export async function getCaptureOrderId(env, captureId) {
  const id = String(captureId ?? '');
  if (!CAPTURE_ID.test(id)) throw new PaypalError('Identificador PayPal inválido', 400);
  const body = await authenticatedRequest(env, `/v2/payments/captures/${encodeURIComponent(id)}`, 'GET');
  return body?.supplementary_data?.related_ids?.order_id || null;
}

export async function verifyPaypalWebhook(env, headers, event, rawBody = '') {
  if (!env.PAYPAL_WEBHOOK_ID) return false;
  const get = name => headers.get(name) || headers.get(name.toLowerCase()) || '';
  const fields = {
    auth_algo: get('paypal-auth-algo'),
    cert_url: get('paypal-cert-url'),
    transmission_id: get('paypal-transmission-id'),
    transmission_sig: get('paypal-transmission-sig'),
    transmission_time: get('paypal-transmission-time'),
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: event,
  };
  if (Object.values(fields).some(value => value === '' || value == null)) return false;
  const token = await getPaypalAccessToken(env);
  const result = await paypalFetch(env, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(fields)
  });
  return result?.verification_status === 'SUCCESS';
}

export function paypalOrderId(body) {
  return body?.id || body?.orderID || body?.orderId || body?.paypalOrderId || null;
}
