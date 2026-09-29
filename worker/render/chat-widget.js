export const CHAT_WIDGET_JS = `(() => {
  const root = document.getElementById('cd-chat');
  if (!root) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BALLOON_PATH = 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z';
  const CROSS_PATH = 'M18 6 6 18M6 6l12 12';

  const mode = root.dataset.mode || 'floating';
  const slug = root.dataset.slug || '';
  const nome = root.dataset.nome || 'o corretor';
  const openLabel = root.dataset.label || 'Fale comigo';
  const closeLabel = root.dataset.closeLabel || 'Fechar';
  const state = { step: 1, intent: '', sub: '', envioId: '' };

  const make = (tag, textValue, cls) => {
    const el = document.createElement(tag);
    if (textValue !== undefined) el.textContent = textValue;
    if (cls) el.className = cls;
    return el;
  };

  const clear = (el) => {
    while (el.firstChild) el.removeChild(el.firstChild);
  };

  const svgIcon = (pathData, cls) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
    return svg;
  };

  // Gera um envio_id uma vez por preenchimento; é reutilizado em reenvios.
  const newEnvioId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const panel = make('div', undefined, mode === 'page' ? 'cd-panel cd-page' : 'cd-panel cd-floating');
  panel.id = 'cd-chat-panel';

  const head = make('div', undefined, 'cd-head');
  const avatar = make('div', nome.slice(0, 2).toUpperCase(), 'cd-avatar');
  const headMain = make('div', undefined, 'cd-head-main');
  headMain.append(make('strong', nome), make('span', 'Normalmente responde em minutos', 'muted'));
  const counter = make('span', '1 / 3', 'eyebrow');
  const closeButton = make('button', undefined, 'cd-close');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', closeLabel);
  closeButton.append(svgIcon(CROSS_PATH));
  head.append(avatar, headMain, counter);

  const progress = make('div', undefined, 'cd-progress');
  const bar = make('span');
  progress.append(bar);

  const body = make('div', undefined, 'cd-body');
  const msg = make('div', undefined, 'cd-message');
  msg.setAttribute('aria-live', 'polite');

  panel.append(head, progress, body);
  root.append(panel);

  let toggle = null;

  const setOpen = (open) => {
    root.classList.toggle('cd-hidden', !open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? closeLabel : openLabel);
    }
  };

  if (mode !== 'page') {
    head.append(closeButton);

    toggle = make('button', undefined, 'cd-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', panel.id);
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', openLabel);
    const balloon = svgIcon(BALLOON_PATH, 'cd-toggle-balloon');
    const cross = svgIcon(CROSS_PATH, 'cd-toggle-cross');
    const toggleLabel = make('span', openLabel, 'cd-toggle-label');
    toggle.append(balloon, toggleLabel, cross);
    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    closeButton.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
    (root.parentElement || document.body).append(toggle);
    setOpen(false);
  }

  const show = (value) => {
    clear(msg);
    msg.textContent = value || '';
  };

  const option = (textValue, onClick) => {
    const button = make('button', textValue, 'cd-option');
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  };

  const render = () => {
    clear(body);
    const title = state.step === 1
      ? 'Como podemos ajudar?'
      : state.step === 2
        ? 'Diga-nos um pouco mais'
        : 'Como podemos contactá-lo?';
    body.append(make('h2', title));
    counter.textContent = state.step + ' / 3';
    bar.style.width = (state.step * 33.333) + '%';
    if (state.step === 1) intentStep();
    else if (state.step === 2) subStep();
    else formStep();
    body.append(msg);
  };

  const intentStep = () => {
    const box = make('div', undefined, 'cd-options');
    [
      ['arrendamento', 'Arrendamento'],
      ['compra_venda', 'Compra e venda'],
      ['estudo_mercado', 'Estudo de mercado do imóvel'],
    ].forEach((entry) => {
      box.append(option(entry[1], () => {
        state.intent = entry[0];
        state.step = 2;
        render();
      }));
    });
    body.append(box);
  };

  const subStep = () => {
    const box = make('div', undefined, 'cd-options');
    if (state.intent === 'estudo_mercado') {
      const label = make('label', undefined, 'cd-form');
      const input = make('input');
      label.append(make('span', 'Zona ou morada do imóvel'), input);
      box.append(label, option('Continuar', () => {
        state.sub = input.value.trim();
        if (state.sub.length < 2) {
          show('Indique uma zona ou morada.');
          return;
        }
        state.step = 3;
        render();
      }));
    } else {
      const items = state.intent === 'arrendamento'
        ? [['procuro_casa', 'Procuro casa'], ['tenho_imovel', 'Tenho um imóvel']]
        : [['comprar', 'Quero comprar'], ['vender', 'Quero vender']];
      items.forEach((entry) => {
        box.append(option(entry[1], () => {
          state.sub = entry[0];
          state.step = 3;
          render();
        }));
      });
    }
    body.append(box);
  };

  const formStep = () => {
    if (!state.envioId) state.envioId = newEnvioId();
    const form = make('form', undefined, 'cd-form');
    [
      ['nome', 'Nome', 'text'],
      ['email', 'E-mail', 'email'],
      ['whatsapp', 'WhatsApp', 'tel'],
    ].forEach((entry) => {
      const name = entry[0];
      const label = make('label');
      label.dataset.field = name;
      const input = make('input');
      input.name = name;
      input.type = entry[2];
      input.required = true;
      if (name === 'whatsapp') {
        input.value = '+351 ';
        input.inputMode = 'tel';
      }
      const error = make('span', undefined, 'cd-error');
      error.dataset.error = name;
      label.append(make('span', entry[1]), input, error);
      form.append(label);
    });

    const messageLabel = make('label');
    const textarea = make('textarea');
    textarea.name = 'mensagem';
    textarea.maxLength = 500;
    const messageError = make('span', undefined, 'cd-error');
    messageError.dataset.error = 'mensagem';
    messageLabel.append(make('span', 'Mensagem (opcional)'), textarea, messageError);
    form.append(messageLabel);

    const consentLabel = make('label', undefined, 'cd-consent');
    const checkbox = make('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'consent';
    const consentError = make('span', undefined, 'cd-error');
    consentError.dataset.error = 'consent';
    consentLabel.append(checkbox, make('span', 'Aceito que ' + nome + ' me contacte sobre este pedido.'), consentError);
    form.append(consentLabel);

    const honeypot = make('input');
    honeypot.name = 'hp';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.style.position = 'absolute';
    honeypot.style.left = '-9999px';
    form.append(honeypot);

    const submit = make('button', 'Enviar pedido', 'cd-submit');
    submit.type = 'submit';
    form.append(submit);
    form.addEventListener('submit', (event) => send(event, form, submit));
    body.append(form);
  };

  const send = async (event, form, submit) => {
    event.preventDefault();
    show('');
    const data = Object.fromEntries(new FormData(form).entries());
    data.consent = form.elements.consent.checked;
    data.slug = slug;
    data.intencao = state.intent;
    data.sub_intencao = state.sub;
    data.envio_id = state.envioId;
    data.utm = {};
    new URLSearchParams(location.search).forEach((value, key) => {
      if (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].includes(key)) {
        data.utm[key] = value;
      }
    });
    submit.disabled = true;
    try {
      const response = await fetch('/c/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        Object.entries(result.erros || {}).forEach((entry) => {
          const target = form.querySelector('[data-error=' + entry[0] + ']');
          if (target) target.textContent = entry[1];
        });
        show('Corrija os campos indicados.');
        submit.disabled = false;
        return;
      }
      clear(body);
      body.append(
        make('h2', 'Pedido enviado'),
        make('div', 'Obrigado! ' + result.nome_corretor + ' vai contactá-lo em breve.', 'cd-message'),
      );
      if (result.whatsapp_url) {
        const link = make('a', 'Abrir WhatsApp');
        link.href = result.whatsapp_url;
        link.target = '_blank';
        link.rel = 'noopener';
        body.append(link);
      }
    } catch (error) {
      show('Não foi possível enviar agora. Tente novamente.');
      submit.disabled = false;
    }
  };

  render();
})();`;

// Versão do asset derivada do conteúdo: muda o ?v= a cada alteração do widget,
// para o cache de 1h do /c/assets/chat.js não servir código antigo.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const CHAT_WIDGET_SRC = '/c/assets/chat.js?v=' + fnv1a(CHAT_WIDGET_JS);
