function restUrl(env, path) {
  return String(env.SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1' + path;
}

function headers(env, extra = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    Authorization: 'Bearer ' + (env.SUPABASE_SERVICE_ROLE_KEY || ''),
    'content-type': 'application/json',
    ...extra,
  };
}

async function checked(response) {
  if (!response.ok) throw new Error('supabase ' + response.status);
  return response;
}

export async function getCardBySlug(env, slug) {
  const query = '/cards?slug=eq.' + encodeURIComponent(slug)
    + '&status=eq.ativo&select=*&limit=1';
  const response = await checked(await fetch(restUrl(env, query), {
    method: 'GET',
    headers: headers(env),
  }));
  const rows = await response.json();
  return Array.isArray(rows) ? (rows[0] || null) : null;
}

export async function incrementVisit(env, cardId) {
  await checked(await fetch(restUrl(env, '/rpc/increment_visit'), {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify({ p_card_id: cardId }),
  }));
}

export async function insertLead(env, row) {
  const response = await checked(await fetch(restUrl(env, '/leads'), {
    method: 'POST',
    headers: headers(env, { Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  }));
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function insertNotification(env, row) {
  const response = await checked(await fetch(restUrl(env, '/notifications'), {
    method: 'POST',
    headers: headers(env),
    body: JSON.stringify(row),
  }));
  try {
    return await response.json();
  } catch {
    return null;
  }
}
