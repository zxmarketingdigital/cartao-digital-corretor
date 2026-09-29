import { escapeHtml } from './escape.js';
import { insertNotification } from './db.js';

const INTENCAO_LABELS = {
  arrendamento: 'Arrendamento',
  compra_venda: 'Compra e venda',
  estudo_mercado: 'Estudo de mercado do imóvel',
};
const SUB_LABELS = {
  procuro_casa: 'Procura casa',
  tenho_imovel: 'Tem um imóvel para arrendar',
  comprar: 'Quer comprar',
  vender: 'Quer vender',
};

export function formatLeadMessage(card, lead, env) {
  const intent = INTENCAO_LABELS[lead.intencao] || lead.intencao;
  const detail = lead.intencao === 'estudo_mercado'
    ? ' — Zona: ' + (lead.sub_intencao || '')
    : (SUB_LABELS[lead.sub_intencao] ? ' — ' + SUB_LABELS[lead.sub_intencao] : '');
  const lines = [
    'Novo contacto pelo seu cartão digital',
    'Interesse: ' + intent + detail,
    'Nome: ' + lead.nome,
    'WhatsApp: ' + lead.whatsapp_e164,
    'E-mail: ' + lead.email,
  ];
  if (lead.mensagem) lines.push('Mensagem: ' + lead.mensagem);
  lines.push('Ver no painel: ' + String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '') + '/c/painel');
  return lines.join('\n');
}

function channelFailure(message) {
  return { status: 'falhou', erro: message };
}

export async function sendLeadEmail(card, lead, env) {
  const destination = card.notify_email || card.email;
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !destination) return channelFailure('não configurado');
  const message = formatLeadMessage(card, lead, env);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [destination],
      subject: 'Novo contacto: ' + lead.nome,
      text: message,
      html: '<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap">'
        + escapeHtml(message) + '</pre>',
      reply_to: lead.email,
    }),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return { status: 'enviado', erro: null };
}

export async function sendLeadWhatsApp(card, lead, env) {
  const destination = card.notify_whatsapp_e164 || card.whatsapp_e164;
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY || !env.EVOLUTION_INSTANCE || !destination) {
    return channelFailure('não configurado');
  }
  const endpoint = String(env.EVOLUTION_API_URL).replace(/\/$/, '')
    + '/message/sendText/' + encodeURIComponent(env.EVOLUTION_INSTANCE);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: env.EVOLUTION_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      number: destination.replace(/\D/g, ''),
      text: formatLeadMessage(card, lead, env),
    }),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return { status: 'enviado', erro: null };
}

export async function notifyLead(env, card, lead) {
  const results = await Promise.allSettled([
    sendLeadEmail(card, lead, env),
    sendLeadWhatsApp(card, lead, env),
  ]);
  for (const [index, result] of results.entries()) {
    const canal = index === 0 ? 'email' : 'whatsapp';
    const status = result.status === 'fulfilled' ? result.value : channelFailure(
      result.reason instanceof Error ? result.reason.message.slice(0, 120) : 'falha desconhecida',
    );
    try {
      await insertNotification(env, {
        lead_id: lead.id,
        canal,
        status: status.status,
        erro: status.erro || null,
      });
    } catch (error) {
      console.error('notification persist failed', error instanceof Error ? error.message : 'unknown');
    }
  }
}
