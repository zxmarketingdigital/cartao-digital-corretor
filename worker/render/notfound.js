import { renderLayout } from './layout.js';

export function renderNotFound(env, title = 'Cartão não encontrado') {
  return renderLayout({
    title,
    description: 'O cartão digital solicitado não está disponível.',
    canonicalPath: '/404',
    env,
    body: { html: '<main class="page"><section class="physical-card"><div class="physical-card-inner"><span class="brand">CARTÃO DIGITAL</span><div><div class="card-name">Não encontrado</div><div class="card-role">ZX LAB</div></div></div></section><p class="bio">Este cartão não está disponível.</p></main>' },
  });
}
