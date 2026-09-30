import { escapeAttr } from '../lib/escape.js';
import { renderLayout } from './layout.js';

export function renderCriar(env = {}, pedido = '') {
  const body = '<main class="page"><section><p class="eyebrow">CARTÃO DIGITAL</p><h1>Criar o seu cartão digital</h1><p class="bio">Preencha os seus dados. Pode alterar tudo mais tarde no painel.</p>'
    + '<form class="cd-form" method="post" action="/c/api/cartao" enctype="multipart/form-data">'
    + '<input type="hidden" name="pedido" value="' + escapeAttr(pedido) + '">'
    + '<label>Nome completo*<input name="nome" id="nome" required maxlength="100" autocomplete="name"></label>'
    + '<label>Slug do cartão*<input name="slug" id="slug" required maxlength="40" pattern="[a-z0-9-]{3,40}"><span id="slug-status" class="muted" aria-live="polite"></span></label>'
    + '<label>Cargo<input name="cargo" maxlength="120"></label><label>Agência<input name="agencia" maxlength="120"></label><label>AMI<input name="ami" maxlength="40"></label>'
    + '<label>Fotografia<input type="file" name="foto" accept="image/jpeg,image/png,image/webp"></label>'
    + '<label>Telemóvel<input name="telefone" inputmode="tel" autocomplete="tel" maxlength="40"></label>'
    + '<label>WhatsApp*<input name="whatsapp" required inputmode="tel" autocomplete="tel" maxlength="40"></label>'
    + '<label>E-mail*<input type="email" name="email" required maxlength="254" autocomplete="email"></label>'
    + '<label>Morada<textarea name="morada" maxlength="300"></textarea></label>'
    + '<label>Instagram<input name="instagram" maxlength="120"></label><label>Facebook<input name="facebook" maxlength="120"></label><label>TikTok<input name="tiktok" maxlength="120"></label><label>LinkedIn<input name="linkedin" maxlength="300"></label>'
    + '<label>Site<input name="site" type="url" maxlength="500"></label><label>Link de avaliações<input name="reviews_url" type="url" maxlength="500"></label><label>Link de agenda<input name="agenda_url" type="url" maxlength="500"></label>'
    + '<fieldset><legend>Serviços</legend><label><input type="checkbox" name="servicos" value="Compra"> Compra</label><label><input type="checkbox" name="servicos" value="Venda"> Venda</label><label><input type="checkbox" name="servicos" value="Arrendamento"> Arrendamento</label><label><input type="checkbox" name="servicos" value="Avaliação de imóvel"> Avaliação de imóvel</label><label><input type="checkbox" name="servicos" value="Investimento"> Investimento</label><label><input type="checkbox" name="servicos" value="Crédito habitação"> Crédito habitação</label></fieldset>'
    + '<label>Apresentação<textarea name="bio" maxlength="400"></textarea></label><button class="cd-submit" type="submit">Criar cartão</button></form></section>'
    + '<script>(function(){const n=document.getElementById("nome"),s=document.getElementById("slug"),m=document.getElementById("slug-status");let manual=false,timer;function check(){clearTimeout(timer);if(!s.value){m.textContent="";return}m.textContent="A verificar…";timer=setTimeout(async()=>{try{const r=await fetch("/c/api/slug?s="+encodeURIComponent(s.value));const j=await r.json();m.textContent=j.motivo==="livre"?"Disponível":j.motivo==="reservado"?"Reservado":j.motivo==="ocupado"?"Já utilizado":"Inválido"}catch{m.textContent="Não foi possível verificar"}},250)}n.addEventListener("input",()=>{if(!manual)s.value=n.value.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40);check()});s.addEventListener("input",()=>{manual=true;check()})})();</script></main>';
  return renderLayout({ title: 'Criar cartão digital', description: 'Crie o seu cartão digital.', canonicalPath: '/cartao-digital/criar', env, body: { html: body } });
}

export function renderCriarPending(env = {}) {
  return renderLayout({ title: 'Pagamento ainda não confirmado', description: 'O pagamento ainda não foi confirmado.', canonicalPath: '/cartao-digital/criar', env, body: { html: '<main class="page"><section><p class="eyebrow">CARTÃO DIGITAL</p><h1>Pagamento ainda não confirmado</h1><p class="bio">Ainda não conseguimos confirmar o seu pagamento. Aguarde alguns instantes e tente novamente.</p><a class="cd-submit" href="/cartao-digital/criar">Recarregar</a></section></main>' } });
}

export function renderCriarDone(env = {}) {
  return renderLayout({ title: 'O seu cartão já foi criado', description: 'O seu cartão digital já está criado.', canonicalPath: '/cartao-digital/criar', env, body: { html: '<main class="page"><section><p class="eyebrow">CARTÃO DIGITAL</p><h1>O seu cartão já foi criado</h1><p class="bio">Pode gerir os seus dados no painel.</p><a class="cd-submit" href="/c/painel">Abrir o painel</a></section></main>' } });
}

export const renderCriarPage = renderCriar;
