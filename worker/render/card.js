import { escapeAttr, escapeHtml, safeUrl } from '../lib/escape.js';
import { labels } from '../lib/i18n.js';
import { CHAT_WIDGET_SRC } from './chat-widget.js';
import { renderLayout } from './layout.js';

const text = (value) => escapeHtml(value || '');
const digits = (value) => String(value || '').replace(/\D/g, '');

const ICONS = {
  whatsapp: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  email: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  schedule: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  save: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
};

function tileIcon(inner) {
  return '<svg class="tile-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
}

function tile(label, href, icon, extra = '') {
  return '<a class="action-tile" href="' + escapeAttr(href) + '"' + extra + '>'
    + tileIcon(icon) + '<span class="tile-label">' + text(label) + '</span></a>';
}

function tileButton(label, attrs, icon) {
  return '<button class="action-tile" type="button"' + attrs + '>'
    + tileIcon(icon) + '<span class="tile-label">' + text(label) + '</span></button>';
}

function instagramUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  return raw.startsWith('@')
    ? safeUrl('https://instagram.com/' + raw.slice(1).replace(/[^a-zA-Z0-9._-]/g, ''))
    : safeUrl(raw);
}

function renderWidget(card, slug, locale) {
  if (!card.chat_enabled) return '';
  return '<script src="' + CHAT_WIDGET_SRC + '" defer></script>'
    + '<div id="cd-chat" data-slug="' + escapeAttr(slug)
    + '" data-nome="' + escapeAttr(card.nome)
    + '" data-mode="floating"'
    + ' data-label="' + escapeAttr(locale.chat || 'Fale comigo') + '"'
    + '></div>';
}

export function renderCard(card, env, { canonicalPath = '/c/' + card.slug } = {}) {
  const locale = labels(card.locale);
  const slug = card.slug;
  const photo = safeUrl(card.foto_url);
  const whatsapp = digits(card.whatsapp_e164 || card.telefone_e164);
  const instagram = instagramUrl(card.instagram);
  const email = card.email ? safeUrl('mailto:' + encodeURIComponent(card.email)) : null;
  const agenda = safeUrl(card.agenda_url);
  const map = safeUrl(card.maps_url);
  const shareUrl = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '') + canonicalPath;
  const actionTiles = [
    whatsapp ? tile('WhatsApp', 'https://wa.me/' + whatsapp, ICONS.whatsapp) : '',
    email ? tile(locale.email, email, ICONS.email) : '',
    instagram ? tile('Instagram', instagram, ICONS.instagram, ' target="_blank" rel="noopener"') : '',
    agenda ? tile(locale.schedule, agenda, ICONS.schedule, ' target="_blank" rel="noopener"') : '',
    tile(locale.save, '/c/' + slug + '/vcard', ICONS.save),
    tileButton(locale.share, ' data-share-url="' + escapeAttr(shareUrl) + '"', ICONS.share),
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
    + '</main>' + (card.chat_enabled ? renderWidget(card, slug, locale) : (whatsapp ? '<a class="floating-cta" href="https://wa.me/' + escapeAttr(whatsapp) + '">' + text(locale.chat) + '</a>' : '')) + script;
  return renderLayout({
    title: String(card.nome || '') + (card.cargo ? ' — ' + card.cargo : ''),
    description: String(card.bio || '').slice(0, 160),
    canonicalPath,
    env,
    body: { html, ogImage: photo },
  });
}
