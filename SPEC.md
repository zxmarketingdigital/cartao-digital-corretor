# SPEC — Cartão Digital para Corretores (Portugal)

> Versão 1.0 · 29/Set/2026 · Autor: ZX LAB
> Produto: cartão de visita digital com chatbot de captação, mini CRM e aviso de lead por e-mail + WhatsApp, vendido a consultores imobiliários em Portugal por pagamento único.

---

## 1. O que é

Um link (`<dominio>/c/<nome>`) que o corretor partilha no WhatsApp, Instagram, assinatura de e-mail e QR code. Ao abrir:

1. O visitante vê o cartão (foto, nome, agência, AMI, contactos, redes, serviços).
2. Um **chat flutuante guiado** pergunta o que ele procura — **Arrendamento · Compra e venda · Estudo de mercado do imóvel** — e recolhe **nome, e-mail e WhatsApp**.
3. O lead cai no **mini CRM** do corretor e ele recebe **na hora** um e-mail e uma mensagem de WhatsApp com os dados.
4. Cada visita ao cartão é contabilizada (tracking).

O corretor compra numa LP, paga uma vez, preenche um formulário e o cartão **fica no ar imediatamente**.

## 2. Decisões fechadas

| Tema | Decisão |
|---|---|
| Público | Consultores imobiliários em Portugal (copy em **PT-PT**) |
| Modelo | **Pagamento único de €97** |
| Checkout | **PayPal em EUR**, confirmação do pagamento **no servidor** (nunca pela página de obrigado) |
| Chatbot | **Guiado, sem IA** — fluxo fixo, custo zero por conversa |
| Abertura do chat | **Flutuante** (botão no canto) por defeito; também acessível em página própria `/c/<nome>/chat` |
| Aviso de lead | **E-mail** + **WhatsApp** (1 mensagem só) por um **número dedicado** a avisos |
| Mini CRM | **Painel com login por link mágico** no e-mail (sem senha) |
| Entrega | **Automática, na hora** — sem aprovação manual |
| URL do cartão | `<dominio>/c/<nome>` |
| Visual | **Direção C · Metal** — cartão físico preto com borda dourada, grelha de ações, chat flutuante âmbar (ver `design/`) |

## 3. Arquitetura

```
LP  <dominio>/cartao-digital
 └─ CTA → checkout PayPal (EUR €97)
      └─ webhook PayPal (PAYMENT.CAPTURE.COMPLETED) → pedido "pago" no banco
           └─ página /cartao-digital/criar?pedido=<id> (só abre com pedido pago e ainda sem cartão)
                └─ formulário → cria o cartão (status "ativo") → no ar em /c/<nome>
                   + e-mail de boas-vindas com link do cartão e do painel

Cartão  <dominio>/c/<nome>        (Cloudflare Worker, renderização no servidor)
 ├─ tracking: Cloudflare Web Analytics (beacon) + registo de visita próprio (para o painel)
 └─ chat guiado → POST /c/api/lead
      ├─ grava lead (Supabase)
      ├─ e-mail ao corretor (Resend)
      └─ WhatsApp ao corretor (Evolution API — instância dedicada, 1 balão)

Painel  <dominio>/c/painel         (Supabase Auth — magic link)
 └─ leads · visitas · status (novo / contactado / fechado) · exportar CSV
```

**Peças:**

| Peça | Tecnologia | Responsabilidade |
|---|---|---|
| `worker/` | Cloudflare Worker + static assets | Rotas públicas, render do cartão, API de lead, webhook PayPal, criação do cartão |
| `supabase/` | Supabase (Postgres + Auth + Storage) | Dados, login do painel, fotos dos corretores |
| `public/` | HTML/CSS/JS estático | LP, formulário de criação, painel, assets do template |
| E-mail | Resend (API) | Boas-vindas, link mágico (via Supabase SMTP ou Resend), aviso de lead |
| WhatsApp | Evolution API (instância dedicada) | Aviso de lead ao corretor |
| Pagamento | PayPal REST (Orders v2 + Webhooks) | Cobrança €97 EUR |

## 4. Rotas

| Rota | Método | O que faz |
|---|---|---|
| `/cartao-digital` | GET | LP de venda |
| `/cartao-digital/criar?pedido=<id>` | GET | Formulário de criação (valida pedido pago e sem cartão) |
| `/c/api/cartao` | POST | Cria o cartão a partir do formulário (valida pedido, slug, dados) |
| `/c/api/paypal/order` | POST | Cria ordem PayPal €97 EUR |
| `/c/api/paypal/capture` | POST | Captura a ordem aprovada |
| `/c/api/paypal/webhook` | POST | Verifica assinatura do webhook e marca pedido como pago (idempotente) |
| `/c/<nome>` | GET | Cartão (render servidor) + registo de visita |
| `/c/<nome>/chat` | GET | Chat em página cheia |
| `/c/<nome>/vcard` | GET | Ficheiro `.vcf` "Guardar contacto" |
| `/c/api/lead` | POST | Recebe lead do chat |
| `/c/api/slug?s=<nome>` | GET | Verifica se o endereço do cartão está livre |
| `/c/painel` | GET | Painel do corretor (exige sessão Supabase) |
| `/cartao-visita` | GET | Cartão da própria empresa (mesmo template, registo especial) |

## 5. Modelo de dados (Supabase)

```sql
orders   (id uuid pk, paypal_order_id text unique, status text check in ('criado','pago','reembolsado'),
          buyer_email text, amount_cents int, currency text default 'EUR', created_at, paid_at)

cards    (id uuid pk, slug text unique check (slug ~ '^[a-z0-9-]{3,40}$'), order_id uuid unique → orders,
          owner_user_id uuid → auth.users, status text check in ('ativo','suspenso'),
          nome, cargo, agencia, ami, bio, foto_url, telefone_e164, whatsapp_e164, email,
          morada, maps_url, instagram, facebook, tiktok, linkedin, site, reviews_url, agenda_url,
          servicos text[], notify_email text, notify_whatsapp_e164 text,
          created_at, updated_at)

leads    (id uuid pk, card_id uuid → cards, intencao text check in ('arrendamento','compra_venda','estudo_mercado'),
          sub_intencao text, nome text, email text, whatsapp_e164 text, mensagem text,
          status text default 'novo' check in ('novo','contactado','fechado'),
          utm jsonb, consent_at timestamptz not null, created_at)

visits   (id bigserial pk, card_id uuid → cards, day date, count int, unique(card_id, day))   -- contagem diária agregada, sem IP guardado

notifications (id uuid pk, lead_id uuid → leads, canal text check in ('email','whatsapp'),
               status text check in ('enviado','falhou'), erro text, created_at)
```

**RLS:** `cards`, `leads`, `visits` só legíveis/atualizáveis pelo dono (`owner_user_id = auth.uid()`); escrita pública **só** via Worker com service role. `orders` e `notifications` sem acesso pelo cliente.

## 6. Fluxos

### 6.1 Compra → cartão no ar
1. LP → botão "Quero o meu cartão" → checkout PayPal (€97 EUR).
2. Captura aprovada → Worker grava `orders.status='pago'`. O webhook confirma de forma **idempotente** (mesmo evento 2× não duplica).
3. Redireciona para `/cartao-digital/criar?pedido=<id>`. O `id` é UUID não adivinhável; **nenhum dado pessoal na URL**.
4. Formulário (PT-PT): nome, cargo, agência, AMI, foto (upload), telemóvel, WhatsApp, e-mail, morada, redes, serviços, bio, slug desejado (sugerido a partir do nome, verificação de disponibilidade em tempo real).
5. `POST /c/api/cartao` → valida pedido pago e sem cartão → cria utilizador Supabase (e-mail) → cria `cards` → devolve URL.
6. E-mail de boas-vindas: link do cartão, link do painel, QR code.

### 6.2 Lead pelo chat
1. Botão flutuante "Fale comigo" → passo 1: intenção (3 opções).
2. Passo 2 (opcional por intenção): *Arrendamento* → "Procuro casa" / "Tenho um imóvel"; *Compra e venda* → "Quero comprar" / "Quero vender"; *Estudo de mercado* → morada/zona do imóvel (texto livre curto).
3. Passo 3: nome, e-mail, WhatsApp (formato internacional E.164, **aceita qualquer país**, prefixo +351 sugerido) + checkbox de consentimento RGPD.
4. `POST /c/api/lead` → grava → dispara e-mail e WhatsApp → mostra confirmação "A <nome> vai contactá-lo em breve" + botão para abrir o WhatsApp do corretor.
5. Falha de notificação **não** perde o lead: grava em `notifications` com `status='falhou'` e aparece no painel.

### 6.3 Mensagem de aviso ao corretor (1 balão)
```
Novo contacto pelo seu cartão digital
Interesse: Estudo de mercado do imóvel — Zona: Sintra
Nome: João Silva
WhatsApp: +351 912 345 678
E-mail: joao@email.pt
Ver no painel: <dominio>/c/painel
```

### 6.4 Painel
- Login: e-mail → link mágico (Supabase Auth).
- Lista de leads (mais recentes primeiro), filtro por intenção e status, alterar status, botão "Abrir WhatsApp" por lead, exportar CSV.
- Cartões de métricas: visitas (7d / 30d), leads (7d / 30d), taxa visita→lead.
- Editar dados do cartão (mesmos campos do formulário, exceto slug).

## 7. Tracking
- **Cloudflare Web Analytics**: beacon no `<head>` do cartão e da LP, token por configuração (vazio ⇒ tag omitida, nada quebra).
- **Contagem própria** em `visits` (agregada por dia, sem IP) para o painel mostrar visitas por cartão.
- LP: Meta Pixel opcional por configuração.

## 8. Segurança e RGPD
- Pagamento confirmado **no servidor** (captura + webhook com verificação de assinatura PayPal).
- `pedido` = UUID; o formulário só cria cartão uma vez por pedido.
- `slug` validado por regex, lista de reservados (`painel`, `api`, `admin`, `cartao-visita`, …) e unicidade.
- `/c/api/lead`: validação de campos, honeypot anti-bot, consentimento obrigatório, escape de todo o conteúdo renderizado (sem XSS em nome/bio).
- Nunca dados pessoais em query string. Segredos só em variáveis do Worker (`wrangler secret`), nunca no repositório.
- Política de privacidade e identificação do responsável (corretor) no rodapé do cartão.

## 9. Visual — Direção C · Metal
- Fundo `#0A0A0A` com brilho radial âmbar no topo; cartão "físico" 346×216 com borda em gradiente dourado (`#FCD34D → #92400E → #F59E0B → #78350F`).
- Acento único âmbar `#D97706` / `#F59E0B`; texto `#E2E8F0`; superfícies `#141414` / borda `#2A2A2A`.
- Tipografia: **Inter** (texto) + **JetBrains Mono** (rótulos, marca).
- Grelha 3×2 de ações (WhatsApp, E-mail, Instagram, Agendar, Guardar, Partilhar) → serviços → rodapé.
- Chat: botão flutuante âmbar "Fale comigo" → janela com barra de progresso (passo X/3).
- Mockups de referência: `design/cartao.html`, `design/chat.html`.

## 10. Configuração (variáveis)
Ver `.env.example`. Todas entram como `wrangler secret` / `vars` — nunca no código.

## 11. Critérios de aceite
- [ ] Compra €97 em EUR no PayPal sandbox cria pedido `pago`; webhook repetido não duplica.
- [ ] Formulário cria cartão uma única vez por pedido; slug reservado/ocupado é recusado.
- [ ] `/c/<nome>` abre em < 1 s, mostra dados escapados, conta visita.
- [ ] Chat completa os 3 passos; lead gravado; e-mail e WhatsApp chegam ao corretor em < 1 min.
- [ ] Com WhatsApp em baixo, o lead continua gravado e aparece com aviso no painel.
- [ ] Painel: login por link mágico, só vê os próprios leads, altera status, exporta CSV.
- [ ] Telefone +55, +351, +44 aceites; vazio/inválido recusado.
- [ ] Nenhum segredo no repositório; nenhum dado pessoal em URL.

## 12. Fora do âmbito (v1)
IA conversacional · mensalidade/renovação · domínio próprio por corretor · múltiplos cartões por conta · edição de slug · app nativa.

## 13. Ordem de implementação
1. **Base**: Supabase (migrations + RLS) · Worker com rotas `/c/<nome>` e template C · cartão da própria empresa em `/cartao-visita`.
2. **Chat + leads + avisos**: `/c/api/lead`, e-mail, WhatsApp, registo de falhas.
3. **Painel**: login mágico, lista, status, CSV, métricas.
4. **Venda**: PayPal EUR (ordem, captura, webhook) · formulário de criação · e-mail de boas-vindas.
5. **LP** + imagens ilustrativas + beacon de analytics.
6. **Skill** `/criar-cartao-visita` para criar/editar cartões pela linha de comando.
