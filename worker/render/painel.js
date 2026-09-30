import { renderLayout } from './layout.js';
import { PAINEL_JS_SRC } from './painel-js.js';

const PANEL_CSS = '<style>'
  + '.painel-page{width:min(100%,980px);max-width:980px;padding:36px 24px 80px}.painel-header{display:flex;align-items:center;gap:16px;flex-wrap:wrap}.painel-header h1{margin:0;color:#fff;font-size:clamp(28px,5vw,42px)}.painel-brand{font-family:var(--mono);color:var(--amber-bright);font-size:12px;letter-spacing:.14em}.painel-header>span{color:var(--muted);flex:1}.painel-header-actions{display:flex;align-items:center;gap:10px}.painel-section,.painel-card{padding:22px;background:var(--surface);border:1px solid var(--line);border-radius:18px}.painel-section h2,.painel-card h1{margin:0;color:#fff}.metrics-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.metric-card{padding:18px;background:linear-gradient(160deg,rgba(217,119,6,.18),var(--surface));border:1px solid rgba(217,119,6,.38);border-radius:14px;display:grid;gap:6px}.metric-label{color:var(--muted);font-size:12px}.metric-value{font-size:27px;color:#fff}.metric-card small{font-size:11px}.painel-form{display:grid;gap:14px}.painel-field{display:grid;gap:6px;color:var(--muted);font-size:12px}.painel-field input,.painel-field textarea,.painel-filters select,.lead-actions select{width:100%;padding:11px 12px;border:1px solid #333;border-radius:10px;background:#0d0d0d;color:#fff}.painel-field textarea{min-height:90px;resize:vertical}.painel-button{min-height:44px;padding:10px 16px;border:0;border-radius:999px;background:linear-gradient(135deg,#d97706,#f59e0b);color:#141414;font-weight:800}.painel-button.secondary{border:1px solid var(--amber);background:transparent;color:var(--amber-bright)}.painel-button:disabled{opacity:.6;cursor:wait}.painel-login{max-width:520px;margin:12vh auto}.painel-page>*,.painel-section{width:100%}.painel-filters{display:grid;grid-template-columns:repeat(2,minmax(0,220px));gap:10px;margin:16px 0}.leads-list{display:grid;gap:10px}.lead-card{padding:16px;border:1px solid var(--line);border-radius:14px;background:#101010;display:grid;gap:12px}.lead-heading,.lead-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.lead-heading strong{color:#fff}.lead-heading time{color:var(--muted);font-size:12px}.lead-details{display:flex;gap:8px;flex-wrap:wrap;color:#d1d5db;font-size:13px}.lead-details span{padding:5px 8px;border:1px solid var(--line);border-radius:999px}.lead-message{white-space:pre-wrap;color:var(--muted);margin:0}.lead-actions select{width:auto;min-width:150px}.warning{margin:0;color:#fcd34d;font-size:13px}.painel-link{color:var(--amber-bright);font-weight:700}.painel-message{min-height:22px;color:var(--muted)}.painel-message.success{color:#86efac}.painel-message.error,.error{color:#fca5a5}.muted{color:var(--muted)}#painel-qr{min-height:220px;margin:16px 0;display:flex;align-items:center;justify-content:flex-start}#painel-qr img,#painel-qr canvas{background:#fff;padding:10px;border-radius:10px}.edit-form{grid-template-columns:repeat(2,minmax(0,1fr))}.edit-form .painel-field:nth-last-of-type(-n+3),.edit-form .painel-button{grid-column:1/-1}'
  + '@media(max-width:640px){.painel-page{padding:24px 16px 60px}.metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.metrics-grid .metric-card:last-child{grid-column:1/-1}.edit-form{grid-template-columns:1fr}.edit-form .painel-field,.edit-form .painel-button{grid-column:auto}.painel-header-actions{width:100%;justify-content:space-between}.painel-filters{grid-template-columns:1fr}.lead-actions select{width:100%}}'
  + '</style>';

function configJson(env) {
  const config = {
    url: String(env.SUPABASE_URL || '').replace(/\/$/, ''),
    anon: String(env.SUPABASE_ANON_KEY || ''),
    base: String(env.PUBLIC_BASE_URL || '').replace(/\/$/, ''),
  };
  return JSON.stringify(config).replace(/[<>&\u2028\u2029]/g, (character) => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  }[character]));
}

export function renderPainel(env) {
  const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
  const html = configured
    ? PANEL_CSS + '<main class="page painel-page"><div id="painel-app"><p class="muted">A carregar o painel…</p></div></main>'
      + '<script type="application/json" id="cfg">' + configJson(env) + '</script>'
      + '<script type="module" src="' + PAINEL_JS_SRC + '"></script>'
    : PANEL_CSS + '<main class="page painel-page"><section class="painel-card"><p class="eyebrow">CARTÃO DIGITAL</p><h1>Painel não configurado</h1><p class="muted">O painel ainda não está disponível.</p></section></main>';
  return renderLayout({
    title: configured ? 'Painel do cartão digital' : 'Painel não configurado',
    description: configured ? 'Gira os seus leads e o seu cartão digital.' : 'Painel não configurado.',
    canonicalPath: '/c/painel',
    env,
    body: { html },
  });
}
