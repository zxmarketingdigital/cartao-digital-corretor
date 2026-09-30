export class DatabaseError extends Error {
  constructor(message, status = 502, details = null) {
    super(message);
    this.name = 'DatabaseError';
    this.status = status;
    this.details = details;
  }
}

function config(env) {
  const root = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!root || !key) throw new DatabaseError('Base de dados não configurada', 503);
  return { root, key };
}

async function request(env, path, options = {}) {
  const { root, key } = config(env);
  const response = await fetch(root + path, {
    method: options.method || 'GET',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Accept: 'application/json',
      ...(options.body === undefined ? {} : {
        'content-type': 'application/json',
        Prefer: options.prefer || 'return=representation',
      }),
      ...(options.headers || {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const raw = await response.text();
  let body = null;
  if (raw) {
    try { body = JSON.parse(raw); } catch { body = raw; }
  }
  if (!response.ok) {
    const status = response.status === 409 || body?.code === '23505' ? 409 : response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new DatabaseError('Operação na base de dados falhou', status, body);
  }
  return body;
}

function first(value) { return Array.isArray(value) ? value[0] || null : value || null; }
function restPath(table, query = '') { return '/rest/v1/' + table + query; }

export async function getOrderById(env, id) {
  return first(await request(env, restPath('orders', '?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1')));
}

export async function getOrderByPaypalOrderId(env, paypalId) {
  return first(await request(env, restPath('orders', '?paypal_order_id=eq.' + encodeURIComponent(paypalId) + '&select=*&limit=1')));
}

export async function insertOrder(env, row) {
  return first(await request(env, restPath('orders'), { method: 'POST', body: row }));
}

export async function patchOrderById(env, id, changes) {
  return first(await request(env, restPath('orders', '?id=eq.' + encodeURIComponent(id)), { method: 'PATCH', body: changes }));
}

export async function patchOrderByPaypalOrderId(env, paypalId, expectedStatus, changes) {
  return first(await request(env, restPath('orders', '?paypal_order_id=eq.' + encodeURIComponent(paypalId) + '&status=eq.' + encodeURIComponent(expectedStatus)), { method: 'PATCH', body: changes }));
}

export async function getCardBySlug(env, slug) {
  return first(await request(env, restPath('cards', '?slug=eq.' + encodeURIComponent(slug) + '&select=*&limit=1')));
}

export async function getCardByOrderId(env, orderId) {
  return first(await request(env, restPath('cards', '?order_id=eq.' + encodeURIComponent(orderId) + '&select=*&limit=1')));
}

export async function insertCard(env, row) {
  return first(await request(env, restPath('cards'), { method: 'POST', body: row }));
}

export async function getUserIdByEmail(env, email) {
  const response = await request(env, '/rest/v1/rpc/user_id_by_email', { method: 'POST', body: { p_email: email } });
  return typeof response === 'string' ? response : response?.id || null;
}

export async function createUser(env, email) {
  const { root, key } = config(env);
  const response = await fetch(root + '/auth/v1/admin/users', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const raw = await response.text();
  let body = null;
  if (raw) { try { body = JSON.parse(raw); } catch { body = null; } }
  if (response.ok) return body?.id || null;
  const duplicate = response.status === 422 || body?.code === 'email_exists' || body?.msg?.toLowerCase?.().includes('already') || body?.message?.toLowerCase?.().includes('already');
  if (duplicate) return getUserIdByEmail(env, email);
  throw new DatabaseError('Utilizador não pôde ser criado', response.status >= 400 && response.status < 500 ? response.status : 502);
}

export async function createOrGetUser(env, email) {
  const created = await createUser(env, email);
  if (created) return created;
  const existing = await getUserIdByEmail(env, email);
  if (!existing) throw new DatabaseError('Utilizador não pôde ser identificado', 502);
  return existing;
}

export async function uploadCardPhoto(env, path, file) {
  const { root, key } = config(env);
  const response = await fetch(root + '/storage/v1/object/' + path, {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'content-type': file.type, 'x-upsert': 'false' },
    body: file.bytes,
  });
  if (!response.ok) throw new DatabaseError('Fotografia não pôde ser guardada', 502);
  return root + '/storage/v1/object/public/' + path;
}

export { request as supabaseRequest };
