# Implementação — Fases 1 e 2 (base + chat/leads/avisos)

Fonte de verdade: `SPEC.md` (ler primeiro). Este documento fecha os detalhes que o SPEC deixa em aberto.
Stack: **Cloudflare Worker em JavaScript ESM puro, sem dependências npm**. Testes com `node:test` (Node 22).

## Decisões desta fase (complementam o SPEC)

| # | Decisão | Porquê |
|---|---|---|
| D1 | Toda a API fica sob `/c/api/...` (`/c/api/lead`). `api` é slug reservado. | Uma só rota de Worker (`<dominio>/c/*`) cobre cartão + API; em `zxlab.com.br` não colide com outros Workers. |
| D2 | `cards.links jsonb not null default '[]'` — lista `[{titulo, descricao, url}]`, render em blocos 2 colunas (como os produtos no mockup). | Cartão da ZX precisa de botões de produto; corretor pode usar para "Imóveis em destaque". |
| D3 | `cards.chat_enabled boolean not null default true`. Quando `false`, o botão flutuante abre o WhatsApp do cartão em vez do chat. | O chat tem intenções imobiliárias; o cartão da ZX não usa chat. |
| D4 | `cards.locale text not null default 'pt-PT' check (locale in ('pt-PT','pt-BR'))`. Rótulos da interface por dicionário (ex.: pt-PT "Guardar/Partilhar/Telemóvel", pt-BR "Salvar/Compartilhar/Celular"). | Corretores = pt-PT; cartão ZX = pt-BR. |
| D5 | `/cartao-visita` renderiza o cartão com slug `env.ZX_CARD_SLUG` (default `zxlab`), vindo do banco (seed separado, não migration). | Um só caminho de render. |
| D6 | `owner_user_id` e `order_id` são **nullable** (cartão ZX e cartões criados pela skill não têm pedido). | Fase 4 preenche para cartões vendidos. |
| D7 | Avisos (e-mail + WhatsApp) correm em `ctx.waitUntil` depois da resposta; resultado de cada canal grava em `notifications`. | Lead nunca espera nem depende do aviso. |
| D8 | Visitas: não contar `HEAD` nem user-agents com `bot|crawl|spider|preview|facebookexternalhit|whatsapp` (case-insensitive). | Não inflar a métrica com pré-visualização de link. |

## Ficheiros a criar

```
package.json                  {"name":"cartao-digital-corretor","private":true,"type":"module","scripts":{"test":"node --test test/"}}
wrangler.toml                 name="zx-cartao", main="worker/index.js", compatibility_date="2026-09-01"
                              [vars] PUBLIC_BASE_URL="", EMAIL_FROM="", EVOLUTION_INSTANCE="avisos-cartao",
                                     CF_BEACON_TOKEN="", ZX_CARD_SLUG="zxlab"
                              SEM `routes` activas: deixar em comentário o exemplo
                              # routes = [{pattern="<dominio>/c/*", zone_name="<dominio>"}, {pattern="<dominio>/cartao-visita*", zone_name="<dominio>"}]
                              Comentário listando os secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY
supabase/migrations/20260929000001_base.sql
supabase/seed-zxlab.sql
worker/index.js               router (export default { fetch(request, env, ctx) })
worker/lib/escape.js          escapeHtml, escapeAttr, safeUrl, vcardEscape
worker/lib/validate.js        RESERVED_SLUGS, isValidSlug, normalizePhoneE164, isValidEmail, validateLead
worker/lib/db.js              cliente Supabase REST (fetch) — getCardBySlug, incrementVisit, insertLead, insertNotification
worker/lib/notify.js          formatLeadMessage, sendLeadEmail (Resend), sendLeadWhatsApp (Evolution), notifyLead
worker/lib/i18n.js            dicionário pt-PT / pt-BR
worker/render/layout.js       <head> comum (fontes, meta, beacon condicional, CSS do template C)
worker/render/card.js         renderCard(card, env, {canonicalPath})
worker/render/chat.js         renderChatPage(card, env) — chat em página cheia
worker/render/chat-widget.js  export const CHAT_WIDGET_JS = `...` (servido em /c/assets/chat.js)
worker/render/vcard.js        renderVcard(card, env)
worker/render/notfound.js     404 no mesmo visual
test/escape.test.js
test/validate.test.js
test/render.test.js
test/router.test.js
test/helpers.js               env falso + stub de fetch
```

## 1. Migration `20260929000001_base.sql`

Tabelas exatamente como SPEC §5 **mais** D2/D3/D4/D6. Detalhes:
- `create extension if not exists pgcrypto;` ids `uuid default gen_random_uuid()`.
- `created_at timestamptz not null default now()`; `cards.updated_at` com trigger `set_updated_at`.
- `orders.status` default `'criado'`; `orders.amount_cents int`, `currency text not null default 'EUR'`, `paid_at timestamptz`.
- `cards.slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$')`; `status text not null default 'ativo' check in ('ativo','suspenso')`; `nome text not null`; `servicos text[] not null default '{}'`.
- `leads.card_id uuid not null references cards(id) on delete cascade`; `consent_at timestamptz not null`; `utm jsonb not null default '{}'`; índice `(card_id, created_at desc)`.
- `visits (id bigserial pk, card_id uuid not null references cards on delete cascade, day date not null, count int not null default 0, unique(card_id, day))`.
- `notifications.lead_id uuid not null references leads on delete cascade`.
- Função `public.increment_visit(p_card_id uuid) returns void language sql security definer set search_path = public`:
  `insert into visits(card_id, day, count) values (p_card_id, (now() at time zone 'Europe/Lisbon')::date, 1) on conflict (card_id, day) do update set count = visits.count + 1;`
  `revoke all on function public.increment_visit(uuid) from public, anon, authenticated; grant execute ... to service_role;`
- **RLS ligado em todas as 5 tabelas.**
  - `cards`: policy select + update `to authenticated using (owner_user_id = auth.uid())` (update também `with check`).
  - `leads`: select + update `to authenticated using (exists (select 1 from cards c where c.id = leads.card_id and c.owner_user_id = auth.uid()))`.
  - `visits`: select com a mesma condição via cards.
  - `notifications`: select com condição via leads→cards (o painel mostra falhas).
  - `orders`: nenhuma policy (só service role).
- **GRANTs explícitos** (policy sem grant não dá acesso): `revoke all on all tables in schema public from anon;`
  `grant select, update on cards, leads to authenticated; grant select on visits, notifications to authenticated;`
  Colunas que o dono NÃO pode alterar em `cards`: `slug, order_id, owner_user_id, status` → fazer `revoke update on cards from authenticated; grant update (nome, cargo, agencia, ami, bio, foto_url, telefone_e164, whatsapp_e164, email, morada, maps_url, instagram, facebook, tiktok, linkedin, site, reviews_url, agenda_url, servicos, links, notify_email, notify_whatsapp_e164) on cards to authenticated;`
  Em `leads` o dono só altera `status`: `revoke update on leads from authenticated; grant update (status) on leads to authenticated;`
- Comentários SQL curtos a explicar cada bloco de RLS.

## 2. Seed `supabase/seed-zxlab.sql`
Um `insert ... on conflict (slug) do update` do cartão `zxlab`: nome "Rafael Castro", cargo "Fundador", agencia "ZX LAB", locale `pt-BR`, chat_enabled `false`,
bio "Automação com IA e Claude Code para negócios digitais.", email "contato@zxlab.com.br", site "https://zxlab.com.br",
whatsapp_e164 / instagram / agenda_url = `null` (a preencher — comentar `-- TODO Rafael`),
links = 6 produtos `[{titulo, descricao, url}]`: ZX Control, Formação Cientista da IA, Agência IA 50K, IA WhatsApp 15M, Agência IA Automatizada, Tráfego Pago Automatizado — `url` = `"https://zxlab.com.br"` com comentário `-- TODO: URL real da LP`.

## 3. Worker — rotas

| Rota | Comportamento |
|---|---|
| `GET /c/assets/chat.js` | `CHAT_WIDGET_JS`, `content-type: text/javascript; charset=utf-8`, `cache-control: public, max-age=3600` |
| `POST /c/api/lead` | ver §5 |
| `GET /c/<slug>` | slug inválido/reservado/inexistente/suspenso → 404 HTML. Senão render + `ctx.waitUntil(incrementVisit)` (respeitando D8) |
| `GET /c/<slug>/chat` | página cheia do chat (se `chat_enabled=false` → 302 para `/c/<slug>`) |
| `GET /c/<slug>/vcard` | `text/vcard; charset=utf-8`, `content-disposition: attachment; filename="<slug>.vcf"` |
| `GET /cartao-visita` | render do cartão `ZX_CARD_SLUG`, canonical `/cartao-visita`, conta visita |
| `/c/painel` | **fora desta fase**: responder 404 por agora (slug reservado) |
| resto | 404 |

Aceitar barra final (`/c/ana-sousa/`). Métodos não suportados → 405. Toda resposta HTML: `content-type: text/html; charset=utf-8`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options: DENY`, `cache-control: no-store`.
Erros inesperados → 500 genérico (sem stack na resposta; `console.error` com a mensagem, **nunca** com dados do lead).

`RESERVED_SLUGS`: `painel, api, admin, assets, cartao-visita, cartao-digital, criar, login, logout, static, www, app, suporte, ajuda, privacidade, termos, zx, zxlab-admin`.

## 4. db.js (Supabase REST, service role)
- Base `${env.SUPABASE_URL}/rest/v1`, headers `apikey` + `Authorization: Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`.
- `getCardBySlug(env, slug)`: `GET /cards?slug=eq.<encodeURIComponent>&status=eq.ativo&select=*&limit=1` → objeto ou `null`.
- `incrementVisit(env, cardId)`: `POST /rpc/increment_visit` `{p_card_id}`.
- `insertLead(env, row)`: `POST /leads` com `Prefer: return=representation` → devolve a linha.
- `insertNotification(env, row)`.
- Resposta não-2xx → `throw new Error('supabase <status>')` (sem corpo com dados pessoais).

## 5. POST /c/api/lead
Corpo JSON (`content-type` tem de conter `application/json`, senão 415; JSON inválido → 400):
`{slug, intencao, sub_intencao?, nome, email, whatsapp, mensagem?, consent, hp?, utm?}`

- `hp` (honeypot) preenchido → responder `200 {ok:true}` **sem gravar nem avisar**.
- Validação (`validateLead`) → 400 `{ok:false, erros:{campo: 'mensagem pt-PT'}}`:
  - `intencao` ∈ `arrendamento|compra_venda|estudo_mercado`.
  - `sub_intencao` opcional: arrendamento ∈ `procuro_casa|tenho_imovel`; compra_venda ∈ `comprar|vender`; estudo_mercado = texto livre (zona/morada) 2–120 chars.
  - `nome` 2–100 chars após trim; `email` regex simples + ≤254; `whatsapp` → `normalizePhoneE164`; `mensagem` opcional ≤500; `consent === true`.
  - `utm`: só chaves `utm_source, utm_medium, utm_campaign, utm_content, utm_term`, valores string cortados a 100 chars; o resto é descartado.
- `normalizePhoneE164(input)`: remove espaços, `-`, `.`, `(`, `)`; `00` inicial → `+`; exige `^\+[1-9]\d{7,14}$`; devolve string E.164 ou `null`. Sem `+` → `null` (o widget pré-preenche `+351`). **Aceita qualquer país** (+55, +351, +44…).
- Card por slug (activo) inexistente ou `chat_enabled=false` → 404 `{ok:false}`.
- Grava lead (`consent_at = now ISO`) → responde `200 {ok:true, nome_corretor, whatsapp_url}` (whatsapp_url = `https://wa.me/<digitos do whatsapp do cartão>` ou `null`).
- `ctx.waitUntil(notifyLead(env, card, lead))`.

## 6. notify.js
- `formatLeadMessage(card, lead, env)` — **UMA mensagem**, formato SPEC §6.3:
  ```
  Novo contacto pelo seu cartão digital
  Interesse: <rótulo intenção>[ — <rótulo sub-intenção> | — Zona: <texto>]
  Nome: <nome>
  WhatsApp: <whatsapp>
  E-mail: <email>
  [Mensagem: <mensagem>]
  Ver no painel: <PUBLIC_BASE_URL>/c/painel
  ```
  Rótulos: arrendamento="Arrendamento", compra_venda="Compra e venda", estudo_mercado="Estudo de mercado do imóvel"; procuro_casa="Procura casa", tenho_imovel="Tem um imóvel para arrendar", comprar="Quer comprar", vender="Quer vender".
- `sendLeadEmail`: destino `card.notify_email || card.email`; `POST https://api.resend.com/emails` `{from: env.EMAIL_FROM, to:[dest], subject:"Novo contacto: <nome>", text: mensagem, html: mensagem escapada em <pre style=...>}` com `reply_to: lead.email`.
- `sendLeadWhatsApp`: destino `card.notify_whatsapp_e164 || card.whatsapp_e164`; `POST ${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}` headers `apikey`, body `{number: <só dígitos>, text}`.
- Canal sem config (env em falta ou destino vazio) → `{status:'falhou', erro:'não configurado'}` sem chamar fetch.
- `notifyLead`: `Promise.allSettled` dos 2 canais; para cada um grava `notifications {lead_id, canal, status:'enviado'|'falhou', erro}` (erro = `HTTP <status>` ou mensagem curta, **sem** dados pessoais). Falha ao gravar notification → `console.error` e segue.

## 7. Render (template C — reproduzir `design/cartao.html` e `design/chat.html`)
- Layout mobile-first centrado, `max-width: 430px`, fundo `radial-gradient(ellipse at 50% 0%, #1F1A12 0%, #0A0A0A 60%)`; tokens do SPEC §9 como CSS custom properties num único `<style>` (classes, não estilos inline repetidos).
- Fontes Google (Inter 400–900, JetBrains Mono 500/700) com `preconnect`.
- Beacon: se `env.CF_BEACON_TOKEN` não-vazio → `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"<escapeAttr(token)>"}'></script>`; vazio → nada.
- Meta: `<title>nome — cargo</title>`, description (bio cortada), `og:title`, `og:description`, `og:image` = foto_url se `safeUrl`, `link rel=canonical` = `PUBLIC_BASE_URL + canonicalPath`.
- Conteúdo, por ordem: cartão físico 346×216 com borda gradiente (marca mono = agencia em maiúsculas; nome; cargo; AMI se houver; foto circular se `foto_url`); tagline/bio; grelha 3 colunas de ações — WhatsApp (`https://wa.me/<dígitos>`), E-mail (`mailto:`), Instagram (se houver; aceitar `@user` ou URL), Agendar (`agenda_url`), Guardar (`/c/<slug>/vcard`), Partilhar (botão JS `navigator.share` com fallback copiar link) — **tiles sem dado são omitidos**; serviços (chips); links (blocos 2 colunas com título + descrição, abrem em nova aba `rel="noopener"`); morada + botão mapa (`maps_url`); redes (facebook, tiktok, linkedin, site, reviews_url); rodapé: "Responsável pelo tratamento dos dados: <nome>[ · <agencia>][ · AMI <ami>]" + frase curta de privacidade (dados do chat usados só para responder ao contacto) + "Cartão Digital".
- **Todo o conteúdo do corretor passa por `escapeHtml`/`escapeAttr`; todo URL por `safeUrl`** (só `http:`, `https:`, `mailto:`, `tel:`; o resto → omitido).
- Botão flutuante âmbar ("Fale comigo" pt-PT / "Fale conosco" pt-BR): `chat_enabled` → abre widget; senão → link WhatsApp (se houver).
- Widget: `<script src="/c/assets/chat.js" defer></script>` + `<div id="cd-chat" data-slug="<escapeAttr(slug)>" data-nome="<escapeAttr(nome)>" data-mode="floating|page">`. Dados passados só por `data-*` (nunca interpolados dentro de JS).
- `CHAT_WIDGET_JS` (vanilla, sem libs): 3 passos com barra de progresso "X / 3"; passo 1 intenção (3 botões); passo 2 sub-intenção (2 botões) ou input de zona para estudo de mercado; passo 3 nome, e-mail, WhatsApp (input `type=tel` pré-preenchido `+351 `, `inputmode=tel`), textarea opcional, checkbox consentimento com texto "Aceito que <nome> me contacte sobre este pedido.", honeypot `hp` escondido (`position:absolute;left:-9999px`, `tabindex=-1`, `autocomplete=off`); envio `fetch('/c/api/lead', POST JSON)` lendo UTMs de `location.search` (só as 5 chaves); erros de validação mostrados por campo; sucesso: "Obrigado! <nome> vai contactá-lo em breve." + botão WhatsApp se `whatsapp_url`. Texto inserido no DOM **só via `textContent`**, nunca `innerHTML` com dados. Botões com `min-height:44px`, foco visível, `aria-live="polite"` na área de mensagens, fecha com Esc no modo flutuante.
- `renderChatPage`: mesmo widget em `data-mode="page"` ocupando o ecrã, com cabeçalho do corretor e link "Ver cartão".
- `renderVcard`: vCard 3.0 CRLF — `FN`, `N`, `TITLE`, `ORG`, `TEL;TYPE=CELL` (telefone ou whatsapp), `EMAIL`, `URL` (cartão), `ADR` (morada), `NOTE` (AMI), valores com `vcardEscape` (`\\`, `,`, `;`, quebras de linha → `\n`).

## 8. Testes (`node --test test/`) — obrigatórios, sem rede
`test/helpers.js`: `makeEnv(overrides)` e `stubFetch(handlers)` que substitui `globalThis.fetch`, regista chamadas e **lança erro em qualquer host não previsto** (nenhum teste pode tocar rede real). `makeCtx()` que acumula `waitUntil` promises para os testes fazerem `await Promise.all(ctx.promises)`.

Casos mínimos:
1. escape: `<script>`, aspas, `&` em escapeHtml/escapeAttr; safeUrl recusa `javascript:`, `data:`, ` JaVaScRiPt:`.
2. validate: slug válido/ inválido/ reservado; telefone `+55 11 99999-9999`, `+351 912 345 678`, `+44 7700 900123`, `0035191234567` aceites; `''`, `912345678`, `+0123`, `+351abc` recusados; lead sem consentimento recusado; intenção inválida recusada; utm filtra chaves.
3. render: cartão com `nome = '<img src=x onerror=alert(1)>'` e `instagram = 'javascript:alert(1)'` → HTML não contém `<img src=x` nem `javascript:`; tile de Instagram omitido quando vazio; beacon presente só com token; `locale pt-BR` mostra "Salvar", pt-PT mostra "Guardar".
4. router: `GET /c/ana-sousa` 200 e chama `rpc/increment_visit`; com UA `WhatsApp/2.0` não chama; slug reservado `/c/painel` 404 sem chamar Supabase; slug inexistente 404; `/cartao-visita` usa `ZX_CARD_SLUG`; `/c/ana-sousa/vcard` content-type vcard.
5. lead: válido → 200, insere lead, e (após waitUntil) 1 chamada Resend + 1 chamada Evolution com **uma** mensagem contendo "Novo contacto" e o nome, e 2 notifications `enviado`; Evolution a devolver 500 → resposta continua 200, lead gravado, notification whatsapp `falhou`; honeypot → 200 e **zero** chamadas ao Supabase; sem consentimento → 400; content-type errado → 415; card com `chat_enabled=false` → 404.

Todos os testes têm de passar com `node --test test/`. `node --check` em todos os `.js`.

## Não fazer nesta fase
Painel, PayPal, formulário de criação, LP, upload de foto, rate limit, deploy, `routes` activas no wrangler.toml, qualquer dependência npm.
