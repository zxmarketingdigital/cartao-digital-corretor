import { escapeAttr, escapeHtml } from '../lib/escape.js';
import { renderLayout } from './layout.js';

export function renderChatPage(card, env) {
  const slug = escapeAttr(card.slug);
  const html = '<main class="chat-page"><header class="chat-header"><strong>'
    + escapeHtml(card.nome) + '</strong><a href="/c/' + slug + '">Ver cartão</a></header>'
    + '<div id="cd-chat" data-slug="' + slug + '" data-nome="' + escapeAttr(card.nome) + '" data-mode="page"></div>'
    + '<script src="/c/assets/chat.js" defer></script></main>';
  return renderLayout({
    title: 'Fale com ' + card.nome,
    description: 'Entre em contacto com ' + card.nome + '.',
    canonicalPath: '/c/' + card.slug + '/chat',
    env,
    body: { html, ogImage: card.foto_url },
  });
}
