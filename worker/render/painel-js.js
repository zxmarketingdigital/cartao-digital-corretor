import { leadsToCsv } from '../lib/csv.js';

const CSV_SOURCE = leadsToCsv.toString();

export const PAINEL_JS = `import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfgElement = document.getElementById('cfg');
const cfg = cfgElement ? JSON.parse(cfgElement.textContent || '{}') : {};
const supabase = cfg.url && cfg.anon ? createClient(cfg.url, cfg.anon) : null;
const root = document.getElementById('painel-app');
const state = { card: null, leads: [], notifications: new Map(), filters: { intent: '', status: '' } };
let loadGeneration = 0;

${CSV_SOURCE}

const make = (tag, textValue, className) => {
  const element = document.createElement(tag);
  if (textValue !== undefined && textValue !== null) element.textContent = String(textValue);
  if (className) element.className = className;
  return element;
};

const clear = (element) => {
  while (element.firstChild) element.removeChild(element.firstChild);
};

const setMessage = (textValue, kind = '') => {
  const message = document.getElementById('painel-message');
  if (!message) return;
  message.textContent = textValue || '';
  message.className = 'painel-message' + (kind ? ' ' + kind : '');
};

const digits = (value) => String(value || '').replace(/\\D/g, '');

const normalizePhoneE164 = (input) => {
  let value = String(input || '').trim().replace(/[\\s().-]/g, '');
  if (value.startsWith('00')) value = '+' + value.slice(2);
  return /^\\+[1-9]\\d{7,14}$/.test(value) ? value : null;
};

const dateOnly = (daysAgo) => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

const queryRows = async (query) => {
  const result = await query;
  if (result.error) throw result.error;
  return result.data || [];
};

const labelIntent = (value) => ({
  arrendamento: 'Arrendamento',
  compra_venda: 'Compra e venda',
  estudo_mercado: 'Estudo de mercado do imóvel',
}[value] || value || '—');

const labelDetail = (value) => ({
  procuro_casa: 'Procura casa',
  tenho_imovel: 'Tem um imóvel para arrendar',
  comprar: 'Quer comprar',
  vender: 'Quer vender',
}[value] || value || '—');

const statusLabel = (value) => ({
  novo: 'Novo',
  contactado: 'Contactado',
  fechado: 'Fechado',
}[value] || value || 'Novo');

const statusOptions = ['novo', 'contactado', 'fechado'];

const makeField = (labelText, name, value, type = 'text') => {
  const label = make('label', undefined, 'painel-field');
  label.append(make('span', labelText));
  const input = make(type === 'textarea' ? 'textarea' : 'input');
  input.name = name;
  if (type !== 'textarea') input.type = type;
  input.value = value == null ? '' : String(value);
  label.append(input);
  return label;
};

const messageFromError = (error) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.';

function renderLogin() {
  clear(root);
  const section = make('section', undefined, 'painel-card painel-login');
  section.append(make('p', 'Aceda ao seu cartão digital.', 'eyebrow'), make('h2', 'Entrar no painel'));
  const form = make('form', undefined, 'painel-form');
  const email = makeField('E-mail', 'email', '', 'email');
  email.querySelector('input').required = true;
  const submit = make('button', 'Enviar link de acesso', 'painel-button');
  submit.type = 'submit';
  form.append(email, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    setMessage('A enviar…');
    try {
      const value = email.querySelector('input').value.trim();
      const result = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: cfg.base + '/c/painel', shouldCreateUser: false },
      });
      if (result.error) throw result.error;
      setMessage('Se o e-mail tiver um cartão, enviámos um link.', 'success');
    } catch (error) {
      setMessage(messageFromError(error), 'error');
    } finally {
      submit.disabled = false;
    }
  });
  section.append(form);
  root.append(section);
}

function metricCard(labelText, value, hint) {
  const card = make('article', undefined, 'metric-card');
  card.append(make('span', labelText, 'metric-label'), make('strong', value, 'metric-value'), make('small', hint, 'muted'));
  return card;
}

function renderMetrics(metrics) {
  const target = document.getElementById('painel-metrics');
  if (!target) return;
  clear(target);
  target.append(
    metricCard('Visitas', metrics.visits7, 'últimos 7 dias'),
    metricCard('Visitas', metrics.visits30, 'últimos 30 dias'),
    metricCard('Leads', metrics.leads7, 'últimos 7 dias'),
    metricCard('Leads', metrics.leads30, 'últimos 30 dias'),
    metricCard('Conversão', metrics.rate, 'visita → lead, 30 dias'),
  );
}

function notificationText(lead) {
  const failed = state.notifications.get(lead.id) || [];
  return failed.map((item) => item.canal === 'whatsapp' ? 'Aviso por WhatsApp falhou' : 'Aviso por e-mail falhou');
}

function makeStatusSelect(lead) {
  const select = make('select');
  select.setAttribute('aria-label', 'Estado de ' + (lead.nome || 'lead'));
  for (const optionValue of statusOptions) {
    const option = make('option', statusLabel(optionValue));
    option.value = optionValue;
    option.selected = (lead.status || 'novo') === optionValue;
    select.append(option);
  }
  select.addEventListener('change', async () => {
    select.disabled = true;
    try {
      const result = await supabase.from('leads').update({ status: select.value }).eq('id', lead.id).eq('card_id', state.card.id).select('id');
      if (result.error) throw result.error;
      if (!result.data || result.data.length !== 1) throw new Error('O estado não foi atualizado.');
      lead.status = select.value;
      setMessage('Estado atualizado.', 'success');
    } catch (error) {
      select.value = lead.status || 'novo';
      setMessage(messageFromError(error), 'error');
    } finally {
      select.disabled = false;
    }
  });
  return select;
}

function renderLead(lead) {
  const item = make('article', undefined, 'lead-card');
  const heading = make('div', undefined, 'lead-heading');
  heading.append(make('strong', lead.nome || 'Sem nome'), make('time', lead.created_at ? new Date(lead.created_at).toLocaleString('pt-PT') : ''));
  item.append(heading);
  const details = make('div', undefined, 'lead-details');
  details.append(
    make('span', labelIntent(lead.intencao)),
    make('span', labelDetail(lead.sub_intencao || lead.detalhe)),
    make('span', lead.email || 'Sem e-mail'),
    make('span', lead.whatsapp_e164 || lead.whatsapp || 'Sem WhatsApp'),
  );
  if (lead.mensagem) details.append(make('p', lead.mensagem, 'lead-message'));
  const actions = make('div', undefined, 'lead-actions');
  const phone = digits(lead.whatsapp_e164 || lead.whatsapp);
  if (phone) {
    const whatsapp = make('a', 'Abrir WhatsApp', 'painel-link');
    whatsapp.href = 'https://wa.me/' + phone;
    whatsapp.target = '_blank';
    whatsapp.rel = 'noopener';
    actions.append(whatsapp);
  }
  actions.append(makeStatusSelect(lead));
  item.append(details, actions);
  for (const warning of notificationText(lead)) item.append(make('p', '⚠ ' + warning, 'warning'));
  return item;
}

function renderLeads() {
  const target = document.getElementById('painel-leads');
  if (!target) return;
  clear(target);
  const visible = state.leads.filter((lead) => {
    const intentOk = !state.filters.intent || lead.intencao === state.filters.intent;
    const statusOk = !state.filters.status || (lead.status || 'novo') === state.filters.status;
    return intentOk && statusOk;
  });
  if (!visible.length) {
    target.append(make('p', 'Ainda não existem leads com estes filtros.', 'muted'));
    return;
  }
  visible.forEach((lead) => target.append(renderLead(lead)));
}

function renderFilters() {
  const target = document.getElementById('painel-filters');
  if (!target) return;
  clear(target);
  const intent = make('select');
  intent.setAttribute('aria-label', 'Filtrar por intenção');
  [['', 'Todas as intenções'], ['arrendamento', 'Arrendamento'], ['compra_venda', 'Compra e venda'], ['estudo_mercado', 'Estudo de mercado']].forEach(([value, labelText]) => {
    const option = make('option', labelText); option.value = value; option.selected = state.filters.intent === value; intent.append(option);
  });
  intent.addEventListener('change', () => { state.filters.intent = intent.value; renderLeads(); });
  const status = make('select');
  status.setAttribute('aria-label', 'Filtrar por estado');
  [['', 'Todos os estados'], ...statusOptions.map((value) => [value, statusLabel(value)])].forEach(([value, labelText]) => {
    const option = make('option', labelText); option.value = value; option.selected = state.filters.status === value; status.append(option);
  });
  status.addEventListener('change', () => { state.filters.status = status.value; renderLeads(); });
  target.append(intent, status);
}

function csvDownload() {
  const blob = new Blob([leadsToCsv(state.leads, state.notifications)], { type: 'text/csv;charset=utf-8' });
  const link = make('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'leads.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function loadQr() {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  script.onload = () => {
    const target = document.getElementById('painel-qr');
    if (!target || !window.QRCode || !state.card) return;
    clear(target);
    new window.QRCode(target, { text: cfg.base + '/c/' + state.card.slug, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
  };
  document.head.append(script);
}

function downloadQr() {
  const image = document.querySelector('#painel-qr img') || document.querySelector('#painel-qr canvas');
  if (!image) { setMessage('O QR ainda está a ser preparado.', 'error'); return; }
  const url = image.tagName === 'CANVAS' ? image.toDataURL('image/png') : image.src;
  const link = make('a'); link.href = url; link.download = (state.card.slug || 'cartao') + '-qr.png'; link.click();
}

function renderEditForm() {
  const target = document.getElementById('painel-edit');
  if (!target || !state.card) return;
  clear(target);
  const form = make('form', undefined, 'painel-form edit-form');
  const fields = [
    ['Nome', 'nome'], ['Cargo', 'cargo'], ['Agência', 'agencia'], ['AMI', 'ami'], ['Fotografia (URL)', 'foto_url'],
    ['Telemóvel', 'telefone_e164'], ['WhatsApp', 'whatsapp_e164'], ['E-mail', 'email'], ['Morada', 'morada'], ['Mapa (URL)', 'maps_url'],
    ['Instagram', 'instagram'], ['Facebook', 'facebook'], ['TikTok', 'tiktok'], ['LinkedIn', 'linkedin'], ['Site', 'site'],
    ['Avaliações (URL)', 'reviews_url'], ['Agenda (URL)', 'agenda_url'], ['E-mail de avisos', 'notify_email'], ['WhatsApp de avisos', 'notify_whatsapp_e164'],
  ];
  for (const [labelText, name] of fields) form.append(makeField(labelText, name, state.card[name]));
  form.append(makeField('Bio', 'bio', state.card.bio, 'textarea'));
  form.append(makeField('Serviços (um por linha)', 'servicos', Array.isArray(state.card.servicos) ? state.card.servicos.join('\\n') : '', 'textarea'));
  form.append(makeField('Destaques (JSON)', 'links', state.card.links ? JSON.stringify(state.card.links) : '[]', 'textarea'));
  const save = make('button', 'Guardar alterações', 'painel-button'); save.type = 'submit'; form.append(save);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); save.disabled = true;
    try {
      const data = {};
      for (const field of fields) data[field[1]] = form.elements[field[1]].value.trim() || null;
      for (const name of ['telefone_e164', 'whatsapp_e164', 'notify_whatsapp_e164']) {
        if (data[name]) { const normalized = normalizePhoneE164(data[name]); if (!normalized) throw new Error('O telefone ' + name + ' não está num formato válido.'); data[name] = normalized; }
      }
      data.bio = form.elements.bio.value.trim();
      data.servicos = form.elements.servicos.value.split('\\n').map((value) => value.trim()).filter(Boolean);
      try { data.links = JSON.parse(form.elements.links.value || '[]'); } catch { throw new Error('Os destaques têm de ser um JSON válido.'); }
      const result = await supabase.from('cards').update(data).eq('id', state.card.id).select('id');
      if (result.error) throw result.error;
      if (!result.data || result.data.length !== 1) throw new Error('O cartão não foi atualizado.');
      state.card = { ...state.card, ...data };
      setMessage('Cartão atualizado.', 'success');
    } catch (error) { setMessage(messageFromError(error), 'error'); }
    finally { save.disabled = false; }
  });
  target.append(form);
}

async function loadPanel(session) {
  const generation = ++loadGeneration;
  const isCurrent = () => generation === loadGeneration;
  if (!session) { renderLogin(); return; }
  clear(root);
  root.append(make('p', 'A carregar o seu painel…', 'muted'));
  try {
    const cards = await queryRows(supabase.from('cards').select('*').limit(1));
    if (!isCurrent()) return;
    state.card = cards[0] || null;
    if (!state.card) { clear(root); root.append(make('section', 'Não encontrámos um cartão nesta conta', 'painel-card')); return; }
    const loadLeads = async () => {
      const all = [];
      const pageSize = 500;
      for (let from = 0; ; from += pageSize) {
        const page = await queryRows(supabase.from('leads').select('*').eq('card_id', state.card.id).order('created_at', { ascending: false }).range(from, from + pageSize - 1));
        all.push(...page);
        if (page.length < pageSize) return all;
      }
    };
    const [visits, leads] = await Promise.all([
      queryRows(supabase.from('visits').select('day,count').eq('card_id', state.card.id).gte('day', dateOnly(29))),
      loadLeads(),
    ]);
    if (!isCurrent()) return;
    state.notifications = new Map();
    state.leads = leads;
    if (leads.length) {
      const notifications = await queryRows(supabase.from('notifications').select('lead_id,canal,status,erro').in('lead_id', leads.map((lead) => lead.id)));
      if (!isCurrent()) return;
      for (const item of notifications) if (item.status === 'falhou') state.notifications.set(item.lead_id, [...(state.notifications.get(item.lead_id) || []), item]);
    }
    const visits7 = visits.filter((row) => row.day >= dateOnly(6)).reduce((sum, row) => sum + Number(row.count || 0), 0);
    const visits30 = visits.reduce((sum, row) => sum + Number(row.count || 0), 0);
    const leads7 = leads.filter((lead) => lead.created_at && lead.created_at >= dateOnly(6)).length;
    const leads30 = leads.filter((lead) => lead.created_at && lead.created_at >= dateOnly(29)).length;
    clear(root);
    const header = make('header', undefined, 'painel-header');
    header.append(make('div', undefined, 'painel-brand'), make('h1', 'O seu painel'), make('span', state.card.nome || 'Cartão digital'));
    const actions = make('div', undefined, 'painel-header-actions');
    const view = make('a', 'Ver o meu cartão', 'painel-link'); view.href = cfg.base + '/c/' + state.card.slug; view.target = '_blank'; view.rel = 'noopener';
    const logout = make('button', 'Sair', 'painel-button secondary'); logout.type = 'button'; logout.addEventListener('click', () => supabase.auth.signOut());
    actions.append(view, logout); header.append(actions); root.append(header);
    const metrics = make('section', undefined, 'metrics-grid'); metrics.id = 'painel-metrics'; root.append(metrics);
    renderMetrics({ visits7, visits30, leads7, leads30, rate: visits30 ? ((leads30 / visits30) * 100).toFixed(1) + '%' : '—' });
    const leadsSection = make('section', undefined, 'painel-section'); leadsSection.append(make('h2', 'Leads'), make('div', undefined, 'painel-filters')); leadsSection.lastChild.id = 'painel-filters';
    const download = make('button', 'Descarregar CSV', 'painel-button secondary'); download.type = 'button'; download.addEventListener('click', csvDownload); leadsSection.append(download, make('div', undefined, 'leads-list')); leadsSection.lastChild.id = 'painel-leads'; root.append(leadsSection);
    const qr = make('section', undefined, 'painel-section'); qr.append(make('h2', 'QR code'), make('p', 'Partilhe este código para abrir o seu cartão.')); const qrBox = make('div'); qrBox.id = 'painel-qr'; qr.append(qrBox); const qrButton = make('button', 'Descarregar QR', 'painel-button secondary'); qrButton.type = 'button'; qrButton.addEventListener('click', downloadQr); qr.append(qrButton); root.append(qr);
    const edit = make('section', undefined, 'painel-section'); edit.append(make('h2', 'Editar cartão'), make('div')); edit.lastChild.id = 'painel-edit'; root.append(edit);
    const message = make('p', '', 'painel-message'); message.id = 'painel-message'; root.append(message);
    renderFilters(); renderLeads(); renderEditForm(); loadQr();
  } catch (error) {
    if (!isCurrent()) return;
    clear(root); root.append(make('p', messageFromError(error), 'painel-message error'));
  }
}

if (root && supabase) {
  supabase.auth.onAuthStateChange((_event, session) => { void loadPanel(session); });
  supabase.auth.getSession().then(({ data }) => loadPanel(data.session)).catch((error) => setMessage(messageFromError(error), 'error'));
}
`;

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const PAINEL_JS_SRC = '/c/assets/painel.js?v=' + fnv1a(PAINEL_JS);
