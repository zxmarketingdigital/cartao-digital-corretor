import { PAINEL_JS } from '../render/painel-js.js';
import { renderPainel } from '../render/painel.js';

export async function handlePainelRoute(request, env, ctx, path) {
  void ctx;
  if (request.method !== 'GET') return null;
  if (path === '/c/painel') {
    return new Response(renderPainel(env), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
  if (path === '/c/assets/painel.js') {
    return new Response(PAINEL_JS, {
      status: 200,
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    });
  }
  return null;
}
