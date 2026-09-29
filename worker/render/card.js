import { escapeAttr, escapeHtml, safeUrl } from '../lib/escape.js';
import { labels } from '../lib/i18n.js';
import { CHAT_WIDGET_JS } from './chat-widget.js';
import { renderLayout } from './layout.js';

const text = (value) => escapeHtml(value || '');
const digits = (value) => String(value || '').replace(/\D/g, '');

function instagramUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  return raw.startsWith('@')
    ? safeUrl('https://instagram.com/' + raw.slice(1).replace(/[^a-zA-Z0-9._-]/g, ''))
    : safeUrl(raw);
}

function linkTile(label, url, extra = '') {
  const safe = safeUrl(url);
  return safe ? '<a class="action-tile" href="' + escapeAttr(safe) + '"' + extra + '>' + text(label) + '</a>' : '';
}

function renderWidget(card, slug) {
  if (!card.chat_enabled) return '';
  return '<script src="/c/assets/chat.js" defer></script>'
    + '<div id="cd-chat" data-slug="' + escapeAttr(slug) + '" data-nome="' + escapeAttr(card.nome) + '" data-mode="floating"></div>';
}

export function renderCard(card, env, { canonicalPath = '/c/' + card.slug } = {}) {
  const locale = labels(card.locale);
  const slug = card.slug;
  const photo = safeUrl(card.foto_url);
  const whatsapp = digits(card.whatsapp_e164 || card.telefone_e164);
  const instagram = instagramUrl(card.instagram);
  const email = card.email ? safeUrl('mailto:' + encodeURIComponent(card.email)) : null;
  const map = safeUrl(card.maps_url);
  const shareUrl = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '') + canonicalPath;
  const actionTiles = [
    whatsapp ? '<a class="action-tile" href="https://wa.me/' + escapeAttr(whatsapp) + '">' + text(locale.phone === 'Celular' ? 'WhatsApp' : 'WhatsApp') + '</a>' : '',
    email ? '<a class="action-tile" href="' + escapeAttr(email) + '">' + text(locale.email) + '</a>' : '',
    instagram ? '<a class="action-tile" href="' + escapeAttr(instagram) + '" target="_blank" rel="noopener">' + text('Instagram') + '</a>' : '',
    linkTile(locale.schedule, card.agenda_url, ' target="_blank" rel="noopener"'),
    '<a class="action-tile" href="/c/' + escapeAttr(slug) + '/vcard">' + text(locale.save) + '</a>',
    '<button class="action-tile" type="button" data-share-url="' + escapeAttr(shareUrl) + '">' + text(locale.share) + '</button>',
  ].join('');
  const services = Array.isArray(card.servicos) && card.servicos.length
    ? '<section class="services" aria-label="Serviços">' + card.servicos.map((item) => '<span class="chip">' + text(item) + '</span>').join('') + '</section>'
    : '';
  const links = Array.isArray(card.links) ? card.links.map((item) => {
    const url = safeUrl(item?.url);
    if (!url) return '';
    return '<a class="link-card" href="' + escapeAttr(url) + '" target="_blank" rel="noopener">'
      + '<strong>' + text(item.titulo) + '</strong><span>' + text(item.descricao) + '</span></a>';
  }).join('') : '';
  const linksSection = links ? '<section><div class="eyebrow">DESTAQUES</div><div class="links-grid">' + links + '</div></section>' : '';
  const socials = [
    ['Facebook', card.facebook], ['TikTok', card.tiktok], ['LinkedIn', card.linkedin],
    ['Site', card.site], ['Avaliações', card.reviews_url],
  ].map(([label, value]) => {
    const url = safeUrl(value);
    return url ? '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + text(label) + '</a>' : '';
  }).join('');
  const socialSection = socials ? '<section class="social-row">' + socials + '</section>' : '';
  const physical = '<section class="physical-card"><div class="physical-card-inner">'
    + '<div class="physical-card-brand-row"><span class="brand">'
    + text(String(card.agencia || '').toUpperCase() || 'CARTÃO DIGITAL') + '</span>'
    + (photo ? '<img class="physical-card-photo" src="' + escapeAttr(photo) + '" alt="">' : '')
    + '</div><div><div class="card-name">' + text(card.nome) + '</div>'
    + '<div class="card-role">' + text(card.cargo) + (card.ami ? ' · AMI ' + text(card.ami) : '') + '</div></div>'
    + '</div></section>';
  const address = card.morada ? '<section class="contact-block"><span>' + text(card.morada) + '</span>'
    + (map ? '<a href="' + escapeAttr(map) + '" target="_blank" rel="noopener">Ver no mapa</a>' : '') + '</section>' : '';
  const owner = 'Responsável pelo tratamento dos dados: ' + text(card.nome)
    + (card.agencia ? ' · ' + text(card.agencia) : '') + (card.ami ? ' · AMI ' + text(card.ami) : '');
  const script = '<script>document.addEventListener("click",function(event){var button=event.target.closest("[data-share-url]");if(!button)return;var url=button.dataset.shareUrl;if(navigator.share){navigator.share({title:document.title,url:url}).catch(function(){});}else if(navigator.clipboard){navigator.clipboard.writeText(url);button.textContent="Link copiado";}});</script>';
  const html = '<main class="page">' + physical
    + (card.bio ? '<section class="bio">' + text(card.bio) + '</section>' : '')
    + '<section class="action-grid">' + actionTiles + '</section>'
    + services + linksSection + address + socialSection
    + '<footer class="footer"><div>' + owner + '</div><div>' + text(locale.privacy) + '</div><div>Cartão Digital</div></footer>'
    + '</main>' + (card.chat_enabled ? renderWidget(card, slug) : (whatsapp ? '<a class="floating-cta" href="https://wa.me/' + escapeAttr(whatsapp) + '">' + text(locale.chat) + '</a>' : '')) + script;
  return renderLayout({
    title: String(card.nome || '') + (card.cargo ? ' — ' + card.cargo : ''),
    description: String(card.bio || '').slice(0, 160),
    canonicalPath,
    env,
    body: { html, ogImage: photo },
  });
}
