import { escapeHtml, escapeAttr } from '../lib/escape.js';

const PRODUCT_NAME = "Cartão Digital Imobiliário";

export function renderLp(env) {
  env = env || {};

  let rawPrice = env.PRODUCT_PRICE_EUR;
  let numericPrice = typeof rawPrice === 'string' && rawPrice.trim() === '' ? NaN : Number(rawPrice);
  if (!Number.isFinite(numericPrice) || numericPrice < 0) numericPrice = 97;
  let formattedPrice = numericPrice.toFixed(2).replace('.', ',');
  if (formattedPrice.endsWith(',00')) formattedPrice = formattedPrice.slice(0, -3);
  let price = escapeHtml('€' + formattedPrice);
  let productName = escapeHtml(PRODUCT_NAME);

  let beacon = '';
  if (env.CF_BEACON_TOKEN) {
    beacon = `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\":\"${escapeAttr(env.CF_BEACON_TOKEN)}\"}'></script>`;
  }

  let pixelMarkup = '';
  if (env.META_PIXEL_ID) {
    let pixelId = escapeAttr(String(env.META_PIXEL_ID));
    pixelMarkup = `<meta id='meta-pixel' data-id='${pixelId}'><script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',document.getElementById('meta-pixel').getAttribute('data-id'));fbq('track','PageView');</script><noscript><img height='1' width='1' style='display:none' src='https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1' alt=''></noscript>`;
  }

  let paypalMarkup = '';
  if (env.PAYPAL_CLIENT_ID) {
    let clientId = String(env.PAYPAL_CLIENT_ID);
    let sdkUrl = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(clientId) + '&currency=EUR&intent=capture';
    paypalMarkup = `<script src='${escapeAttr(sdkUrl)}'></script><script>(function(){function paypalMessage(text){var node=document.getElementById('paypal-msg');if(node)node.textContent=text}function readJson(response){return response.json().catch(function(){return {}})}paypal.Buttons({createOrder:function(){return fetch('/c/api/paypal/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})}).then(function(response){return readJson(response).then(function(data){if(!response.ok||!data.id)throw new Error('order');return data.id})}).catch(function(){paypalMessage('Não foi possível iniciar o pagamento. Tente novamente.');throw new Error('order')})},onApprove:function(data){return fetch('/c/api/paypal/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderID: data.orderID})}).then(function(response){return readJson(response).then(function(json){if(!response.ok||!json.pedido)throw new Error('capture');location.href='/cartao-digital/criar?pedido='+encodeURIComponent(json.pedido)})}).catch(function(){paypalMessage('Não foi possível confirmar o pagamento. Tente novamente.');throw new Error('capture')})},onError:function(){paypalMessage('O pagamento não foi concluído. Tente novamente.')}}).render('#paypal-buttons').catch(function(){paypalMessage('O pagamento não foi concluído. Tente novamente.')})})();</script>`;
  }

  let body = `
    <div class='shell'>
      <header class='topbar'>
        <span>PAGAMENTO ÚNICO · ${price} · SEM MENSALIDADE · NO AR NO MESMO DIA</span>
      </header>

      <main>
        <section class='hero section-grid' aria-labelledby='hero-title'>
          <div class='hero-copy'>
            <p class='eyebrow'>PARA CONSULTORES IMOBILIÁRIOS EM PORTUGAL</p>
            <p class='brand'>${productName} <span>by ZX LAB</span></p>
            <h1 id='hero-title'>O cartão de visita que <span class='gradient-text'>CAPTA</span> clientes por si</h1>
            <p class='hero-sub'>Um link com a sua foto, contactos e serviços — e um assistente que pergunta ao visitante se procura arrendar, comprar, vender ou avaliar o imóvel. O contacto chega ao seu WhatsApp e e-mail no mesmo minuto.</p>
            <ul class='check-list'>
              <li>✅ Cartão digital premium em <code>seu-dominio/c/o-seu-nome</code>, pronto para partilhar no WhatsApp, Instagram e QR code</li>
              <li>✅ Chat guiado que qualifica o contacto: arrendamento, compra e venda ou estudo de mercado</li>
              <li>✅ Aviso imediato no WhatsApp e e-mail + painel com todos os contactos e visitas</li>
            </ul>
            <div class='price-line'><strong>${price} · pagamento único</strong><span>Sem mensalidade. Sem contrato.</span></div>
            <a class='cta' href='#comprar'>QUERO O MEU CARTÃO DIGITAL</a>
            <p class='micro-trust'>Pagamento seguro PayPal · Garantia de 7 dias · Cartão no ar logo após o pagamento</p>
          </div>
          <div class='hero-visual'>
            <div class='terminal-frame'><span class='terminal-dot'></span><span class='terminal-dot'></span><span class='terminal-dot'></span><span class='terminal-label'>LIVE / DIGITAL CARD</span></div>
            <img src='/cartao-digital/img/hero.webp' width='1792' height='1024' alt='Cartão Digital Imobiliário num telemóvel'>
          </div>
        </section>

        <section class='section split-section' aria-labelledby='stakes-title'>
          <div>
            <p class='eyebrow'>O CONTACTO QUE SE PERDE</p>
            <h2 id='stakes-title'>Quem pede o seu contacto hoje fecha com outro consultor amanhã</h2>
          </div>
          <div class='section-copy'>
            <p>Entrega um cartão de papel numa visita e ele acaba no fundo de uma mala. Envia o número por mensagem e a pessoa guarda "para depois". Um cliente que queria avaliar o apartamento não sabe se deve ligar ou escrever — e acaba por falar com o primeiro que respondeu.</p>
            <p>Cada contacto que não fica registado é uma comissão que foi para a concorrência.</p>
          </div>
        </section>

        <section class='section' aria-labelledby='contrast-title'>
          <p class='eyebrow'>ANTES / DEPOIS</p>
          <h2 id='contrast-title'>O contraste</h2>
          <div class='table-wrap'>
            <table class='contrast-table'>
              <thead><tr><th>Sem o Cartão Digital</th><th>Com o Cartão Digital</th></tr></thead>
              <tbody>
                <tr><td>Cartão de papel que se perde</td><td>Um link que fica no telemóvel do cliente</td></tr>
                <tr><td>"Depois ligo-lhe" — e nunca liga</td><td>O cliente deixa nome, e-mail e WhatsApp em 30 segundos</td></tr>
                <tr><td>Não sabe o que a pessoa procura</td><td>Já sabe se é arrendamento, compra, venda ou avaliação</td></tr>
                <tr><td>Descobre o contacto horas depois</td><td>Aviso no WhatsApp no mesmo minuto</td></tr>
                <tr><td>Contactos espalhados em conversas</td><td>Todos num painel, com estado e exportação</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class='section split-section' aria-labelledby='audience-title'>
          <div>
            <p class='eyebrow'>PARA QUEM É</p>
            <h2 id='audience-title'>É para si se:</h2>
            <ul class='plain-list'>
              <li>É consultor(a) imobiliário(a) e vive de contactos novos</li>
              <li>Partilha o seu número no WhatsApp, Instagram ou em visitas</li>
              <li>Quer responder primeiro, antes da concorrência</li>
              <li>Quer ver quantas pessoas abriram o seu cartão</li>
            </ul>
          </div>
          <div class='not-for'>
            <p class='eyebrow'>PARA QUEM NÃO É</p>
            <h2>Não é para si se:</h2>
            <ul class='plain-list'>
              <li>Procura um site completo com listagem de imóveis e pesquisa</li>
              <li>Não quer receber contactos pelo WhatsApp</li>
            </ul>
          </div>
        </section>

        <section class='section' aria-labelledby='steps-title'>
          <p class='eyebrow'>COMO FUNCIONA</p>
          <h2 id='steps-title'>Em 3 passos, está no ar</h2>
          <div class='steps-grid'>
            <article class='step-card'><span class='step-number'>01</span><h3>PASSO 1 · PAGAMENTO</h3><p>Paga ${price} uma única vez pelo PayPal.</p></article>
            <article class='step-card'><span class='step-number'>02</span><h3>PASSO 2 · 5 MINUTOS</h3><p>Preenche o formulário: foto, contactos, redes, serviços e o nome do seu link.</p></article>
            <article class='step-card'><span class='step-number'>03</span><h3>PASSO 3 · NO AR</h3><p>O cartão fica no ar na hora. Recebe um e-mail com o link, o QR code e o acesso ao painel.</p></article>
          </div>
        </section>

        <section class='section' aria-labelledby='practice-title'>
          <p class='eyebrow'>NA PRÁTICA</p>
          <h2 id='practice-title'>Tudo o que precisa, num só lugar</h2>
          <div class='practice-grid'>
            <article class='practice-card practice-card-text'>
              <div class='icon-row' aria-hidden='true'><svg viewBox='0 0 24 24'><rect x='5' y='2' width='14' height='20' rx='2'></rect><circle cx='12' cy='18' r='1'></circle></svg><svg viewBox='0 0 24 24'><path d='M4 6h16v12H4z'></path><path d='M8 10h8M8 14h5'></path></svg></div>
              <p class='card-label'>01 / O CARTÃO</p>
              <h3>O cartão</h3>
              <p>Foto, agência, AMI, WhatsApp, e-mail, Instagram, agenda, "Guardar contacto" e "Partilhar" num só toque. Visual premium preto e dourado que se destaca de qualquer cartão de papel.</p>
            </article>
            <article class='practice-card'>
              <img src='/cartao-digital/img/lead.webp' width='1792' height='1024' loading='lazy' alt='Aviso de novo contacto no WhatsApp'>
              <div class='practice-content'><p class='card-label'>02 / O AVISO</p><h3>O aviso</h3><p>Quando alguém preenche o chat, recebe no WhatsApp: interesse, nome, telemóvel e e-mail. Tudo numa mensagem. E o mesmo no e-mail.</p></div>
            </article>
            <article class='practice-card'>
              <img src='/cartao-digital/img/painel.webp' width='1792' height='1024' loading='lazy' alt='Painel com contactos e visitas'>
              <div class='practice-content'><p class='card-label'>03 / O PAINEL</p><h3>O painel</h3><p>Entra com um link mágico no e-mail, sem senha. Vê as visitas dos últimos 7 e 30 dias, a lista de contactos, marca cada um como novo, contactado ou fechado e exporta tudo em CSV.</p></div>
            </article>
          </div>
        </section>

        <section class='section example-section' aria-labelledby='example-title'>
          <div>
            <p class='eyebrow'>VEJA UM CARTÃO REAL</p>
            <h2 id='example-title'>Abra um cartão a funcionar</h2>
            <p>Este é o cartão da própria ZX LAB, feito com o mesmo sistema.</p>
          </div>
          <a class='secondary-link' href='/cartao-visita' target='_blank' rel='noopener'>Ver cartão de exemplo →</a>
        </section>

        <section class='section offer-section' id='comprar' aria-labelledby='offer-title'>
          <div class='offer-heading'>
            <p class='eyebrow'>O QUE RECEBE</p>
            <h2 id='offer-title'>Tudo para transformar contactos em oportunidades</h2>
          </div>
          <ul class='offer-list'>
            <li>✅ Cartão digital premium com o seu link próprio</li>
            <li>✅ Foto, cargo, agência e número AMI</li>
            <li>✅ Botões de WhatsApp, e-mail, Instagram, agenda, guardar contacto e partilhar</li>
            <li>✅ Lista dos seus serviços (compra, venda, arrendamento, avaliação…)</li>
            <li>✅ Chat guiado de captação: arrendamento, compra e venda, estudo de mercado</li>
            <li>✅ Aviso de novo contacto no WhatsApp</li>
            <li>✅ Aviso de novo contacto por e-mail</li>
            <li>✅ Painel com login por link mágico (sem senha)</li>
            <li>✅ Contagem de visitas ao cartão (7 e 30 dias)</li>
            <li>✅ Estado de cada contacto: novo, contactado, fechado</li>
            <li>✅ Exportação de contactos em CSV</li>
            <li>✅ QR code do cartão para imprimir</li>
            <li>✅ Edição dos seus dados sempre que quiser</li>
          </ul>
          <div class='buy-box'>
            <p class='buy-price'>${price} <span>· pagamento único — sem mensalidade</span></p>
            <p class='anchoring'>Um único arrendamento fechado paga o cartão várias vezes.</p>
            <div id='paypal-buttons'>${env.PAYPAL_CLIENT_ID ? '' : 'Pagamentos ainda não configurados.'}</div>
            ${env.PAYPAL_CLIENT_ID ? "<p id='paypal-msg' class='paypal-msg' aria-live='polite'></p>" : ''}
            <p class='payment-note'>Pagamento processado pelo PayPal (cartão ou conta PayPal). Após a confirmação é levado ao formulário do seu cartão.</p>
          </div>
        </section>

        <section class='section guarantee-section' aria-labelledby='guarantee-title'>
          <p class='eyebrow'>SEM RISCO</p>
          <h2 id='guarantee-title'>Garantia de 7 dias</h2>
          <p>Crie o seu cartão, partilhe-o e use o painel. Se nos primeiros 7 dias achar que não é para si, peça o reembolso e devolvemos os ${price}.</p>
        </section>

        <section class='section faq-section' aria-labelledby='faq-title'>
          <p class='eyebrow'>FAQ</p>
          <h2 id='faq-title'>Perguntas frequentes</h2>
          <div class='faq-list'>
            <details><summary>Tenho de pagar mensalidade?</summary><p>Não. Paga ${price} uma vez e o cartão fica seu.</p></details>
            <details><summary>Preciso de saber de tecnologia?</summary><p>Não. Preenche um formulário e o cartão fica no ar. Para editar, entra no painel.</p></details>
            <details><summary>Quanto tempo demora a ficar no ar?</summary><p>Logo após o pagamento. O formulário leva uns 5 minutos.</p></details>
            <details><summary>O cliente tem de instalar alguma coisa?</summary><p>Não. O cartão abre no navegador de qualquer telemóvel ou computador.</p></details>
            <details><summary>Aceita números de fora de Portugal?</summary><p>Sim. O chat aceita telemóveis de qualquer país.</p></details>
            <details><summary>Onde recebo os contactos?</summary><p>No seu WhatsApp, no seu e-mail e no painel, ao mesmo tempo.</p></details>
            <details><summary>Posso mudar os meus dados depois?</summary><p>Sim, no painel. Só o endereço do link (<code>/c/o-seu-nome</code>) fica fixo.</p></details>
            <details><summary>E os dados dos meus clientes (RGPD)?</summary><p>O chat pede consentimento explícito antes de enviar. Os dados ficam no seu painel e não são partilhados com terceiros.</p></details>
          </div>
        </section>

        <section class='section closing-section' aria-labelledby='closing-title'>
          <p class='eyebrow'>A DECISÃO É SUA</p>
          <h2 id='closing-title'>Daqui a 30 dias pode continuar a entregar cartões de papel — ou ter cada contacto no seu painel</h2>
          <p>O próximo cliente que pedir o seu contacto pode ser o próximo fecho. Responda primeiro.</p>
          <a class='cta' href='#comprar'>QUERO O MEU CARTÃO DIGITAL</a>
        </section>
      </main>

      <footer class='footer'>© ZX LAB · ${productName} · Pagamentos processados pelo PayPal</footer>
    </div>
    <div class='sticky-bar'><span>${price} · pagamento único</span><a class='cta' href='#comprar'>QUERO O MEU CARTÃO DIGITAL</a></div>
  `;

  let css = `
    :root{--bg:#08080A;--text:#ECEAE4;--muted:#A5A19A;--muted-blue:#8E97A6;--accent:#F59E0B;--coral:#D97757;--line:#33312C;--surface:#101012;--surface-2:#131315;--surface-3:#1A1A1E;--mono:'JetBrains Mono',monospace;--radius:3px}
    *{box-sizing:border-box}
    html{background:var(--bg);scroll-behavior:smooth}
    body{margin:0;min-width:320px;overflow-x:hidden;background:var(--bg);background-image:linear-gradient(rgba(217,119,87,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(217,119,87,.045) 1px,transparent 1px),radial-gradient(ellipse at 50% -10%,rgba(245,158,11,.16),transparent 52%);background-size:40px 40px,40px 40px,100% 100%;color:var(--text);font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.55;padding-bottom:112px}
    section,[id]{scroll-margin-top:64px}
    a{color:inherit;text-decoration:none}
    button,input,textarea{font:inherit}
    .shell{width:min(100%,1180px);margin:0 auto;padding:0 20px}
    .topbar{min-height:38px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--muted);font:500 10px/1.3 var(--mono);letter-spacing:.08em;text-align:center;padding:10px 0}
    .section{padding:76px 0;border-top:1px solid rgba(51,49,44,.7)}
    .section-grid{display:grid;gap:38px}
    .hero{padding:72px 0 84px;border-top:0}
    .hero-copy{min-width:0}
    .eyebrow,.card-label{margin:0 0 15px;color:var(--coral);font:700 11px/1.3 var(--mono);letter-spacing:.14em;text-transform:uppercase}
    .brand{margin:0 0 23px;color:var(--text);font:700 13px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase}.brand span{color:var(--muted);font-weight:500;text-transform:none;letter-spacing:0}
    h1,h2,h3,p{margin-top:0}h1,h2,h3{font-weight:800;line-height:1.08;letter-spacing:-.035em}h1{max-width:760px;margin-bottom:22px;font-size:clamp(38px,10vw,76px)}h2{margin-bottom:23px;font-size:clamp(31px,6vw,56px)}h3{margin-bottom:12px;font-size:21px}p{color:var(--muted)}
    .gradient-text{background:linear-gradient(135deg,#D97757,#F59E0B);-webkit-background-clip:text;background-clip:text;color:transparent}
    .hero-sub{max-width:680px;font-size:18px;line-height:1.6;color:var(--text)}
    .check-list,.plain-list,.offer-list{list-style:none;padding:0;margin:28px 0;display:grid;gap:13px}.check-list li,.plain-list li,.offer-list li{color:var(--text);line-height:1.5}.check-list li{font-size:15px}.check-list code,code{color:var(--accent);font:500 .9em var(--mono);overflow-wrap:anywhere}
    .price-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:12px 18px;margin:28px 0 21px}.price-line strong,.buy-price{color:var(--text);font:700 22px/1.2 var(--mono)}.price-line span{color:var(--muted);font-size:14px}
    .cta{display:inline-flex;align-items:center;justify-content:center;min-height:52px;border:0;border-radius:var(--radius);padding:14px 20px;background:linear-gradient(135deg,#D97757,#F59E0B);color:#14100E;font:800 12px/1.2 var(--mono);letter-spacing:.035em;text-align:center;transition:filter .2s,transform .2s}.cta:hover,.cta:focus-visible{color:#14100E;filter:brightness(1.12);transform:translateY(-1px)}
    .micro-trust{margin:16px 0 0;color:var(--muted-blue);font:500 11px/1.5 var(--mono)}
    .hero-visual{position:relative;min-width:0;align-self:center;border:1px solid var(--line);background:var(--surface);padding:12px}.hero-visual img{display:block;width:100%;height:auto;aspect-ratio:1792/1024;object-fit:cover;filter:saturate(.85)}.terminal-frame{display:flex;align-items:center;gap:6px;padding:0 0 10px;color:var(--muted-blue);font:500 9px var(--mono);letter-spacing:.08em}.terminal-dot{width:7px;height:7px;border-radius:50%;background:var(--coral)}.terminal-dot:nth-child(2){background:var(--accent)}.terminal-dot:nth-child(3){background:#7C8A75}.terminal-label{margin-left:auto}
    .split-section{display:grid;gap:32px}.section-copy p{max-width:580px;font-size:17px}.section-copy p:last-child{color:var(--text);font-weight:600}
    .table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);background:var(--surface)}.contrast-table{width:100%;border-collapse:collapse;table-layout:fixed}.contrast-table th,.contrast-table td{width:50%;padding:15px 13px;border-bottom:1px solid var(--line);border-right:1px solid var(--line);text-align:left;vertical-align:top;overflow-wrap:anywhere}.contrast-table tr:last-child td{border-bottom:0}.contrast-table th:last-child,.contrast-table td:last-child{border-right:0}.contrast-table th{color:var(--accent);font:700 11px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase}.contrast-table td{color:var(--muted);font-size:14px}.contrast-table td:last-child{color:var(--text)}
    .plain-list li{position:relative;padding-left:22px;color:var(--text)}.plain-list li:before{content:'→';position:absolute;left:0;color:var(--coral);font-family:var(--mono)}.not-for{border-left:2px solid var(--line);padding-left:22px}
    .steps-grid,.practice-grid{display:grid;gap:14px}.step-card{padding:22px;border:1px solid var(--line);background:var(--surface);min-width:0}.step-number{display:block;margin-bottom:26px;color:var(--coral);font:700 24px var(--mono)}.step-card h3{font:700 12px/1.4 var(--mono);letter-spacing:.05em;color:var(--accent)}.step-card p{margin:0;color:var(--muted)}
    .practice-card{border:1px solid var(--line);background:var(--surface);min-width:0;overflow:hidden}.practice-card img{display:block;width:100%;height:auto;aspect-ratio:1792/1024;object-fit:cover}.practice-card-text{padding:23px}.practice-content{padding:22px 23px}.practice-card h3{color:var(--text)}.practice-card p:last-child{margin-bottom:0}.icon-row{display:flex;gap:10px;margin-bottom:28px;color:var(--accent)}.icon-row svg{width:28px;height:28px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
    .example-section{display:flex;flex-direction:column;gap:20px;align-items:flex-start;background:linear-gradient(90deg,rgba(217,119,87,.07),transparent)}.example-section p{margin-bottom:0}.secondary-link{display:inline-block;color:var(--accent);font:700 12px var(--mono);border-bottom:1px solid var(--accent);padding-bottom:4px}.secondary-link:hover{color:var(--text)}
    .offer-section{display:grid;gap:35px}.offer-list{margin:0;grid-template-columns:1fr;gap:14px}.offer-list li{font-size:15px}.buy-box{padding:25px 20px;border:1px solid var(--coral);background:var(--surface-2);box-shadow:0 0 35px rgba(217,119,87,.08)}.buy-price{margin-bottom:13px}.buy-price span{display:block;margin-top:5px;color:var(--muted);font:500 12px/1.4 var(--mono)}.anchoring{color:var(--text);font-size:14px}.paypal-msg{min-height:22px;margin:12px 0;color:var(--accent);font-size:13px}.payment-note{margin:15px 0 0;color:var(--muted-blue);font-size:12px}.buy-box #paypal-buttons{min-height:46px}
    .guarantee-section{border:1px solid var(--line);border-left:2px solid var(--accent);padding:31px 24px;margin:0 0 76px}.guarantee-section p{max-width:680px;margin-bottom:0;font-size:17px}.faq-list{border-top:1px solid var(--line)}details{border-bottom:1px solid var(--line)}summary{cursor:pointer;padding:20px 30px 20px 0;position:relative;color:var(--text);font-weight:700}summary:after{content:'+';position:absolute;right:4px;color:var(--accent);font:700 20px var(--mono)}details[open] summary:after{content:'−'}details p{margin:0;padding:0 0 20px;max-width:750px}
    .closing-section{text-align:center;padding-bottom:80px}.closing-section h2{max-width:850px;margin-left:auto;margin-right:auto}.closing-section>p:not(.eyebrow){max-width:580px;margin:0 auto 27px;font-size:18px}.footer{border-top:1px solid var(--line);padding:25px 0;color:var(--muted);font:500 11px/1.6 var(--mono);text-align:center}
    .sticky-bar{position:fixed;z-index:20;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;gap:18px;min-height:76px;padding:12px 20px;background:rgba(16,16,18,.96);border-top:1px solid var(--line);box-shadow:0 -10px 30px rgba(0,0,0,.3);backdrop-filter:blur(12px);color:var(--text);font:700 13px var(--mono)}.sticky-bar .cta{min-height:44px;padding:11px 15px;font-size:10px}
    @media (min-width:700px){.shell{padding:0 34px}.section{padding:104px 0}.hero{grid-template-columns:minmax(0,1.1fr) minmax(320px,.9fr);align-items:center;padding:104px 0 120px}.split-section{grid-template-columns:minmax(0,.85fr) minmax(0,1fr);gap:70px}.steps-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.practice-grid{grid-template-columns:1fr 1fr}.practice-card-text{grid-row:span 2}.offer-section{grid-template-columns:minmax(0,.7fr) minmax(0,1fr) minmax(280px,.75fr);align-items:start}.offer-heading{position:sticky;top:90px}.offer-list{grid-template-columns:1fr 1fr;column-gap:22px}.buy-box{position:sticky;top:90px}.example-section{flex-direction:row;align-items:center;justify-content:space-between}.guarantee-section{margin-bottom:104px;padding:42px 45px}.sticky-bar{justify-content:flex-end;padding-right:max(34px,calc((100vw - 1112px)/2));padding-left:max(34px,calc((100vw - 1112px)/2))}.sticky-bar>span{margin-right:auto}}
    @media (max-width:420px){.shell{padding-left:16px;padding-right:16px}.topbar{font-size:9px}.hero{padding-top:55px}.hero-sub{font-size:16px}.cta{width:100%;font-size:11px}.price-line{gap:7px 12px}.buy-box{padding:21px 15px}.sticky-bar{gap:9px;padding:10px 12px}.sticky-bar>span{flex:0 1 auto;min-width:0;font-size:11px;white-space:nowrap}.sticky-bar .cta{width:auto;min-width:0;flex:1 1 auto;padding-left:10px;padding-right:10px;font-size:9px;line-height:1.1;white-space:normal}}
  `;

  return '<!doctype html><html lang=\'pt-PT\'><head><meta charset=\'utf-8\'><meta name=\'viewport\' content=\'width=device-width,initial-scale=1\'><title>Cartão Digital Imobiliário — o cartão que capta clientes</title><meta name=\'description\' content=\'Cartão de visita digital para consultores imobiliários em Portugal, com chat que capta contactos e aviso imediato no WhatsApp. Pagamento único de €97.\'><meta property=\'og:title\' content=\'Cartão Digital Imobiliário — o cartão que capta clientes\'><meta property=\'og:description\' content=\'Cartão de visita digital para consultores imobiliários em Portugal, com chat que capta contactos e aviso imediato no WhatsApp. Pagamento único de €97.\'><meta property=\'og:image\' content=\'/cartao-digital/img/hero.webp\'><meta name=\'theme-color\' content=\'#08080A\'><link rel=\'preconnect\' href=\'https://fonts.googleapis.com\'><link rel=\'preconnect\' href=\'https://fonts.gstatic.com\' crossorigin><link rel=\'stylesheet\' href=\'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap\'><style>' + css + '</style>' + beacon + pixelMarkup + '</head><body>' + body + paypalMarkup + '</body></html>';
}
