# Cartão Digital para Corretores — ZX LAB

Cartão de visita digital com **chat de captação**, **mini CRM** e **aviso de lead por e-mail + WhatsApp**, para consultores imobiliários em Portugal.

- 📄 **Especificação completa:** [`SPEC.md`](SPEC.md) — leia primeiro.
- 🎨 **Mockups do visual (direção C · Metal):** [`design/`](design/) — abra os `.html` no navegador.
- 🤖 **Instruções para o Claude Code:** [`CLAUDE.md`](CLAUDE.md) — o Claude lê isto sozinho.

> **Estado:** as 6 fases do `SPEC.md` §13 estão implementadas — cartão, chat + avisos, painel (mini CRM), venda PayPal + formulário de criação, LP e a skill `/criar-cartao-visita`. Para receber as atualizações: `git pull`.

---

## Como usar no seu Claude Code (passo a passo)

Funciona em **Windows, macOS ou Linux** — tudo corre pelo Claude Code.

### 1. Clonar e abrir

```bash
gh repo clone zxmarketingdigital/cartao-digital-corretor
cd cartao-digital-corretor
claude
```

Dentro do Claude, escreva:

```
Leia o SPEC.md e o README.md e guie-me na configuração das contas e conexões, uma de cada vez.
```

O Claude vai conduzir os passos abaixo consigo.

### 2. Contas e conexões necessárias

| # | Serviço | Para quê | Custo |
|---|---|---|---|
| 1 | **Cloudflare** | Alojar o site (Worker) e o seu domínio | Grátis (plano Free chega) |
| 2 | **Supabase** | Banco de dados, login do painel, fotos | Grátis para começar |
| 3 | **Resend** | Enviar e-mails (aviso de lead, boas-vindas) | Grátis até 3.000/mês |
| 4 | **WhatsApp API (Evolution API)** | Enviar o aviso de lead no WhatsApp | Depende do fornecedor |
| 5 | **PayPal Business** | Receber os €97 | Taxa por venda |

#### 2.1 Cloudflare (CLI `wrangler`)
1. Crie conta em cloudflare.com e adicione o seu domínio.
2. No terminal do Claude:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. Confirme: `wrangler whoami` mostra a sua conta.

#### 2.2 Supabase (API — sem MCP)
1. Crie conta em supabase.com → **New project** (região: **EU — Frankfurt ou Paris**, por causa do RGPD).
2. Crie um **Access Token** em supabase.com/dashboard/account/tokens (começa por `sbp_`) e guarde-o no `.env` como `SUPABASE_ACCESS_TOKEN`, junto com `SUPABASE_PROJECT_REF` (o código do projeto, que aparece no URL do painel). Não é preciso MCP nem autorizar nada no navegador: o Claude fala com o Supabase pela **Management API** usando este token.
3. Guarde (vão para o `.env`): **Project URL**, **anon key** e **service_role key** (Settings → API).
4. Em **Authentication → URL Configuration**, coloque o seu domínio em *Site URL* e `https://<seu-dominio>/c/painel` em *Redirect URLs*.
5. Crie as tabelas aplicando as migrations por ordem, via Management API (ou peça ao Claude *"aplique as migrations de `supabase/migrations/` por ordem via Management API"*):
   ```bash
   set -a; . ./.env; set +a
   for f in supabase/migrations/*.sql; do
     echo "→ $f"
     python3 -c 'import json,sys;print(json.dumps({"query":open(sys.argv[1]).read()}))' "$f" \
     | curl -sf -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query" \
         -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
         --data-binary @- > /dev/null || { echo "FALHOU em $f"; break; }
   done
   ```
   Alternativa manual: colar cada ficheiro, por ordem, no **SQL Editor**. Isto cria tabelas, regras de acesso (RLS) e o bucket `fotos`.
6. Opcional: `supabase/seed-zxlab.sql` cria o cartão de exemplo servido em `/cartao-visita` (edite os dados antes).

#### 2.3 Resend (API)
1. Crie conta em resend.com → **Domains** → adicione o seu domínio e crie os registos DNS que ele pede (na Cloudflare).
2. **API Keys** → crie uma chave com permissão *Sending access*.
3. Opcional: em **Authentication → SMTP** do Supabase, use o SMTP da Resend para o e-mail do link mágico sair do seu domínio.

#### 2.4 WhatsApp (Evolution API)
1. Precisa de uma **instância Evolution API** (alojada por si ou por um fornecedor) com um **número dedicado só a avisos** — não use o seu número pessoal nem o número de atendimento.
2. Ligue o número lendo o QR code na instância.
3. Guarde: **URL da API**, **API key** e **nome da instância**.
4. Regra de ouro: cada aviso sai em **1 mensagem só** (o código já faz isso).

#### 2.5 PayPal (REST API, EUR)
1. Conta **PayPal Business** → developer.paypal.com → **Apps & Credentials** → crie uma app (primeiro em **Sandbox**, depois **Live**).
2. Guarde **Client ID** e **Secret**.
3. Em **Webhooks** da app, adicione `https://<seu-dominio>/c/api/paypal/webhook` com o evento `PAYMENT.CAPTURE.COMPLETED` e guarde o **Webhook ID**.
4. Moeda: **EUR**.

#### 2.6 Cloudflare Web Analytics (visitas)
Cloudflare → **Web Analytics** → *Add a site* → copie o **token** do beacon.

### 3. Variáveis de ambiente

```bash
cp .env.example .env      # preencha os valores — o .env NUNCA vai para o git
```

Para produção, os valores **públicos** vão em `[vars]` no `wrangler.toml` (`PUBLIC_BASE_URL`, `EMAIL_FROM`, `PAYPAL_CLIENT_ID`, `PAYPAL_ENV`, `SUPABASE_ANON_KEY`, `CF_BEACON_TOKEN`, `META_PIXEL_ID`) e os **segredos** entram um a um:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Segredos: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.

No `wrangler.toml`, ative as `routes` (estão comentadas) com o seu domínio: `/c/*`, `/cartao-visita*` e `/cartao-digital*`.

### 4. Publicar
Quando o código de cada fase estiver pronto:

```bash
wrangler deploy
```

E confirme no navegador:

| Página | O que deve ver |
|---|---|
| `https://<seu-dominio>/cartao-digital` | LP de venda com o botão PayPal |
| `https://<seu-dominio>/c/<slug>` | Um cartão (crie um de teste com a skill abaixo) |
| `https://<seu-dominio>/c/painel` | Login do painel por link mágico |

Teste a compra em **Sandbox** (conta de comprador de teste do PayPal) antes de passar `PAYPAL_ENV` para `live`.

### 5. Testes automáticos

```bash
npm test
```

Não precisam de contas nem de rede — todas as chamadas externas são simuladas.

### 6. Criar cartões pela linha de comando (skill)

Dentro do Claude Code, neste repositório, peça *"cria um cartão de visita para …"*. A skill `/criar-cartao-visita` (em `.claude/skills/`) usa o `.env` e cria/edita/suspende cartões sem passar pelo pagamento — útil para oferecer, testar ou corrigir dados.

---

## Boas práticas
- **Nunca** coloque chaves/segredos no código ou em mensagens — só no `.env` e em `wrangler secret`.
- Teste pagamentos sempre primeiro em **Sandbox**.
- Antes de apontar o domínio, confirme que ele não serve outra página em produção.

## Suporte
Dúvidas: fale com a equipa ZX LAB no seu grupo de mentoria.
