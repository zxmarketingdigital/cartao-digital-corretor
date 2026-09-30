import * as escapeModule from './escape.js';

function escapeHtml(value) {
  const fn = escapeModule.escapeHtml || escapeModule.escapeHTML || escapeModule.escape;
  return typeof fn === 'function' ? fn(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export async function sendWelcome(env, data) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !data?.email || !env.PUBLIC_BASE_URL || !data.slug) return false;
  const base = String(env.PUBLIC_BASE_URL).replace(/\/$/, '');
  const slug = String(data.slug);
  const publicUrl = `${base}/c/${encodeURIComponent(slug)}`;
  const panelUrl = `${base}/c/painel`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(publicUrl)}`;
  const name = escapeHtml(data.nome || data.name || '');
  const publicLink = escapeHtml(publicUrl);
  const panelLink = escapeHtml(panelUrl);
  const qrLink = escapeHtml(qrUrl);
  const html = `<p>Olá ${name},</p><p>O seu cartão digital está no ar.</p><p><a href="${publicLink}">Ver o seu cartão digital</a></p><p><a href="${panelLink}">Abrir o painel</a></p><p><img src="${qrLink}" alt="QR code do seu cartão digital"></p>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [data.email],
      subject: 'O seu cartão digital está no ar',
      html,
      text: `O seu cartão digital está no ar: ${publicUrl}. Abra também o painel: ${panelUrl}.`
    })
  });
  if (!response.ok) throw new Error('Não foi possível enviar o email de boas-vindas');
  return true;
}

export const welcome = sendWelcome;
