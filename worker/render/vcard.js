import { safeUrl, vcardEscape } from '../lib/escape.js';

export function renderVcard(card, env) {
  const base = String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const phone = card.telefone_e164 || card.whatsapp_e164;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:' + vcardEscape(card.nome),
    'N:' + vcardEscape(card.nome) + ';;;;',
    card.cargo ? 'TITLE:' + vcardEscape(card.cargo) : null,
    card.agencia ? 'ORG:' + vcardEscape(card.agencia) : null,
    phone ? 'TEL;TYPE=CELL:' + vcardEscape(phone) : null,
    card.email ? 'EMAIL:' + vcardEscape(card.email) : null,
    safeUrl(base + '/c/' + card.slug) ? 'URL:' + vcardEscape(base + '/c/' + card.slug) : null,
    card.morada ? 'ADR:;;' + vcardEscape(card.morada) + ';;;;' : null,
    card.ami ? 'NOTE:AMI ' + vcardEscape(card.ami) : null,
    'END:VCARD',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}
