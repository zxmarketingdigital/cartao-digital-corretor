# Implementação — Fases 3 a 6 (painel · venda · LP · skill)

Fonte de verdade: `SPEC.md` + `docs/impl/fase-1-2.md` (decisões D1–D8 continuam valendo).
Stack igual: **Worker JS ESM puro, zero dependências npm no Worker**; testes `node:test` (`npm test`).
Todo efeito externo (Supabase, PayPal, Resend, Evolution) é `fetch` e é **stubado nos testes** — nenhum teste fala com rede.

## Decisões novas

| # | Decisão | Porquê |
|---|---|---|
| D9 | Rotas de API continuam sob `/c/api/*` (D1). Mapeamento do SPEC §4: `/api/cartao` → `/c/api/cartao`; `/api/paypal/*` → `/c/api/paypal/*`; `/api/lead` → `/c/api/lead`. Novas: `GET /c/api/slug?s=<slug>` (disponibilidade). | Uma rota de Worker `<dominio>/c/*` + `<dominio>/cartao-digital*`. |
| D10 | **Painel = página servida pelo Worker em `/c/painel`, que usa `@supabase/supabase-js@2` pelo CDN** (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`) com a **anon key** (pública por desenho) e fala com o Supabase direto; a segurança é a RLS já existente (dono só vê o seu). O Worker só injeta `SUPABASE_URL` + `SUPABASE_ANON_KEY` na página. | Sem backend de sessão; RLS já validada na Fase 1. |
| D11 | Login do painel: `signInWithOtp({ email, options: { emailRedirectTo: PUBLIC_BASE_URL + '/c/painel', shouldCreateUser: false } })`. Mensagem genérica "Se o e-mail tiver um cartão, enviámos um link" (não revela se existe conta). | Sem enumeração de contas; só quem comprou tem utilizador. |
| D12 | Pagamento: **PayPal Orders v2, intent CAPTURE, €`PRODUCT_PRICE_EUR` (default `97.00`) EUR**. O preço vem SEMPRE do servidor, nunca do cliente. `PAYPAL_ENV=sandbox|live` escolhe `https://api-m.sandbox.paypal.com` ou `https://api-m.paypal.com`. | Confirmação no servidor (SPEC §8). |
| D13 | Pedido fica `pago` quando **a captura devolve `COMPLETED` com valor e moeda iguais aos esperados**, OU quando chega webhook `PAYMENT.CAPTURE.COMPLETED` **com assinatura verificada** (`POST /v1/notifications/verify-webhook-signature` → `verification_status === 'SUCCESS'`). Update idempotente: `PATCH /orders?paypal_order_id=eq.X&status=eq.criado`. Webhook `PAYMENT.CAPTURE.REFUNDED` verificado → `status='reembolsado'` (não mexe no cartão). | Idempotência + fonte dupla. |
| D14 | Criação do cartão: `POST /c/api/cartao` (multipart/form-data, foto opcional ≤ 2 MB, jpeg/png/webp). Ordem: valida pedido `pago` e sem cartão → valida campos → cria/obtém utilizador Supabase (`POST /auth/v1/admin/users {email, email_confirm:true}`; se já existir, obtém id via RPC `user_id_by_email(p_email)` security definer só para `service_role`) → upload da foto para o bucket público `fotos` em `<card_id>/<uuid>.<ext>` → insert em `cards` (`order_id` unique garante uma vez por pedido; conflito ⇒ 409) → e-mail de boas-vindas em `ctx.waitUntil`. | SPEC §6.1. |
| D15 | QR code do cartão: gerado **no browser** no painel (lib `qrcodejs` via cdnjs) com botão "Descarregar QR". O e-mail de boas-vindas leva link do cartão, link do painel e a imagem `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=<URL pública do cartão, url-encoded>` (URL pública, sem dado pessoal). | Sem dependência npm no Worker. |
| D16 | LP em `/cartao-digital` renderizada pelo Worker (`worker/render/lp.js`), copy em `docs/impl/lp-copy.md` (PT-PT, escrita à parte). Botão PayPal via JS SDK (`https://www.paypal.com/sdk/js?client-id=<PAYPAL_CLIENT_ID>&currency=EUR&intent=capture`) chamando `/c/api/paypal/order` e `/c/api/paypal/capture`; sucesso ⇒ `location = '/cartao-digital/criar?pedido=' + pedido`. Beacon CF (D já existente em layout) + Meta Pixel se `META_PIXEL_ID` não vazio. Imagens em `public/cartao-digital/img/` servidas pelo binding `[assets]` do wrangler. | SPEC §6.1 e §7. |
| D17 | Skill `.claude/skills/criar-cartao-visita/` no repo: `SKILL.md` + `scripts/cartao.mjs` (Node ≥ 20, zero deps, lê `.env`) com subcomandos `criar`, `editar`, `listar`, `suspender`, `ativar`, `ver`. Usa service role via PostgREST. Nunca imprime chaves. | SPEC §13.6. |
| D18 | Não há rate limit no código (decisão pendente do dono; proposta: regra WAF Cloudflare). Não implementar. | Safeguard não decidido. |

## Migration nova — `supabase/migrations/20260930000003_venda_painel.sql`

```sql
-- utilizador por e-mail (criação do cartão quando o comprador já tem conta)
create or replace function public.user_id_by_email(p_email text) returns uuid
language sql security definer set search_path = auth, public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- bucket público de fotos (escrita só service role)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create index if not exists orders_status_idx on public.orders (status);
```

## Fase 3 — Painel (`worker/routes/painel.js` + `worker/render/painel.js`)

- `GET /c/painel` → HTML completo (usa `renderLayout`), `cache-control: no-store`, CSP não necessária. Injeta config via `<script type="application/json" id="cfg">{"url":..., "anon":..., "base":...}</script>` (escapar `<` como `<`). Se `SUPABASE_URL` ou `SUPABASE_ANON_KEY` vazios → página "Painel não configurado".
- JS do painel (servido em `/c/assets/painel.js`, com `?v=<fnv1a>` como o chat) — ESM:
  - Sem sessão: formulário de e-mail → `signInWithOtp` (D11) → mensagem genérica.
  - Com sessão: carrega `cards` do utilizador (`select * ... limit 1`). Sem cartão → mensagem "Não encontrámos um cartão nesta conta".
  - **Métricas**: visitas 7d e 30d (soma de `visits.count` com `day >= hoje-6` / `hoje-29`), leads 7d e 30d, taxa visita→lead 30d (`—` se 0 visitas).
  - **Leads**: `leads` do cartão ordenados `created_at desc`, filtros intenção e status, `<select>` de status que faz `update({status})`; botão "Abrir WhatsApp" (`https://wa.me/<dígitos>`); aviso ⚠ quando existe `notifications` `falhou` para o lead ("Aviso por WhatsApp falhou" / "por e-mail").
  - **CSV**: gerado no browser (`Blob`), colunas `data,nome,email,whatsapp,intencao,detalhe,status,mensagem`, separador `;`, BOM UTF-8, valores entre aspas com `"` duplicado; **neutralizar injeção de fórmula** (prefixar `'` quando começa por `= + - @`).
  - **QR** (D15) e link "Ver o meu cartão".
  - **Editar cartão**: formulário com os campos do grant de update (sem slug, sem status). Telefones normalizados E.164 no cliente (mesma regra de `normalizePhoneE164`); guarda com `update(...)`.
  - Todo texto vindo do banco entra no DOM via `textContent`/`value` — **nunca `innerHTML` com dado**.
  - Botão "Sair" → `signOut()`.
- Visual: mesmo tema C (layout CSS existente + CSS próprio do painel, desktop e mobile, tabela vira cartões < 640px).

## Fase 4 — Venda (`worker/routes/venda.js`, `worker/lib/paypal.js`, `worker/lib/db-venda.js`, `worker/render/criar.js`, `worker/lib/welcome.js`)

- `POST /c/api/paypal/order` → cria ordem (D12) com `purchase_units[0].amount {currency_code:'EUR', value}` e `custom_id` = id do `orders` criado antes (`insert orders {status:'criado', amount_cents, currency:'EUR'}` → depois `PATCH paypal_order_id`). Resposta `{ id: <paypal order id> }`.
- `POST /c/api/paypal/capture` `{orderID}` → `POST /v2/checkout/orders/{id}/capture` → confere `status==='COMPLETED'`, `amount.value === PRICE` e `currency_code==='EUR'` → marca pago (D13) com `buyer_email = payer.email_address` → responde `{ pedido: <orders.id> }`. Qualquer divergência ⇒ 402 `{ok:false}` e nada marcado.
- `POST /c/api/paypal/webhook` → lê corpo cru, verifica assinatura (D13) com headers `paypal-auth-algo`, `paypal-cert-url`, `paypal-transmission-id`, `paypal-transmission-sig`, `paypal-transmission-time` e `PAYPAL_WEBHOOK_ID`. Não verificada ⇒ 400. `order_id` vem de `resource.supplementary_data.related_ids.order_id`. Sempre 200 para evento verificado desconhecido.
- Token OAuth PayPal: `POST /v1/oauth2/token` com Basic `client_id:secret`, cache em memória do isolate até `expires_in - 60`.
- `GET /cartao-digital/criar?pedido=<uuid>` → pedido inexistente/não pago ⇒ página "Pagamento ainda não confirmado" com botão recarregar; pedido com cartão ⇒ "O seu cartão já foi criado" + link para `/c/painel`; senão formulário (PT-PT) com: nome*, cargo, agência, AMI, foto, telemóvel, WhatsApp*, e-mail* (pré-preenchido com `buyer_email`), morada, Instagram, Facebook, TikTok, LinkedIn, site, link de avaliações, link de agenda, serviços (chips: Compra, Venda, Arrendamento, Avaliação de imóvel, Investimento, Crédito habitação), bio (≤ 400), slug* (sugerido do nome: minúsculas, sem acentos, espaços→`-`), verificação ao vivo via `/c/api/slug`.
- `GET /c/api/slug?s=` → `{disponivel: bool, motivo?}` (inválido / reservado / ocupado).
- `POST /c/api/cartao` (D14) → `201 {url: '/c/<slug>'}`; erros de validação `400 {erros}`; slug ocupado `409 {erros:{slug}}`; pedido já com cartão `409`; pedido não pago `402`. Limite corpo 3 MB.
- E-mail de boas-vindas (Resend, `EMAIL_FROM`) PT-PT: assunto "O seu cartão digital está no ar", link do cartão, link do painel, QR (D15), instrução de como entrar no painel (link mágico). Falha não desfaz o cartão; só `console.error`.
- `notify_email` = e-mail do formulário; `notify_whatsapp_e164` = WhatsApp do formulário.

## Fase 5 — LP (`worker/render/lp.js` + `public/cartao-digital/img/*`)

- Estrutura e textos: `docs/impl/lp-copy.md` (copiar literalmente).
- Preço só aparece aqui (€97, pagamento único). Sem juros/parcelas.
- Imagens: `public/cartao-digital/img/hero.webp`, `lead.webp`, `painel.webp` (o `<img>` tem `width/height`, `loading="lazy"` exceto a hero).
- `wrangler.toml`: `[assets] directory = "./public"`; rotas comentadas passam a incluir `<dominio>/cartao-digital*`; vars novas `PAYPAL_ENV="sandbox"`, `PRODUCT_PRICE_EUR="97.00"`, `PAYPAL_CLIENT_ID=""`, `META_PIXEL_ID=""`, `SUPABASE_ANON_KEY=""` (anon key é pública). Secrets comentados: + `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.

## Fase 6 — Skill (D17)

`node .claude/skills/criar-cartao-visita/scripts/cartao.mjs <cmd> [--json arquivo.json] [--slug x] [--campo valor ...]`
- `criar --json dados.json` (campos = colunas de `cards`; valida slug/reservado/E.164; `owner_user_id` opcional via `--email-dono` que cria/obtém utilizador) → imprime URL.
- `editar --slug x --campo valor` · `ver --slug x` · `listar` · `suspender --slug x` · `ativar --slug x`.
- `SKILL.md` com `model: claude-sonnet-5`, `effort: medium`, gatilhos PT ("criar cartão de visita", "novo cartão digital", "editar cartão"), passo a passo e aviso de nunca colar chaves no chat.

## Testes obrigatórios (novos)

- painel: página injeta config escapada; sem config ⇒ página "não configurado"; `painel.js` servido com `?v=`.
- paypal: criar ordem usa preço do servidor; captura com valor/moeda divergente ⇒ 402 e nenhum PATCH; captura OK ⇒ PATCH com `status=eq.criado`; webhook sem assinatura válida ⇒ 400 sem PATCH; webhook verificado repetido ⇒ 2 PATCH idempotentes (filtro `status=eq.criado`), nenhum erro.
- criar: pedido não pago ⇒ 402; pedido com cartão ⇒ 409; slug reservado ⇒ 400; conflito unique no insert ⇒ 409; sucesso ⇒ 201 e 1 chamada Resend; `/cartao-digital/criar` sem pedido UUID ⇒ 404.
- slug: inválido/reservado/ocupado/livre.
- LP: renderiza preço €97, sem `juros`, beacon só com token, pixel só com id, botão PayPal só com client id.
- CSV (função pura exportada de um módulo testável, ex.: `worker/lib/csv.js` embutido também no painel): BOM, `;`, aspas, fórmula neutralizada.
