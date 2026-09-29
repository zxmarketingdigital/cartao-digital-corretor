# Cartão Digital para Corretores — ZX LAB

Cartão de visita digital com **chat de captação**, **mini CRM** e **aviso de lead por e-mail + WhatsApp**, para consultores imobiliários em Portugal.

- 📄 **Especificação completa:** [`SPEC.md`](SPEC.md) — leia primeiro.
- 🎨 **Mockups do visual (direção C · Metal):** [`design/`](design/) — abra os `.html` no navegador.
- 🤖 **Instruções para o Claude Code:** [`CLAUDE.md`](CLAUDE.md) — o Claude lê isto sozinho.

> O código está a ser construído neste mesmo repositório por fases (ver `SPEC.md` §13). Para receber as atualizações: `git pull`.

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

#### 2.2 Supabase (MCP oficial)
1. Crie conta em supabase.com → **New project** (região: **EU — Frankfurt ou Paris**, por causa do RGPD).
2. Ligue o MCP do Supabase ao seu Claude:
   ```bash
   claude mcp add --transport http supabase https://mcp.supabase.com/mcp
   ```
   Depois, dentro do Claude, rode `/mcp` e autorize o Supabase no navegador.
3. Guarde (vão para o `.env`): **Project URL**, **anon key** e **service_role key** (Settings → API).
4. Em **Authentication → URL Configuration**, coloque o seu domínio em *Site URL* e `https://<seu-dominio>/c/painel` em *Redirect URLs*.

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
3. Em **Webhooks** da app, adicione `https://<seu-dominio>/api/paypal/webhook` com o evento `PAYMENT.CAPTURE.COMPLETED` e guarde o **Webhook ID**.
4. Moeda: **EUR**.

#### 2.6 Cloudflare Web Analytics (visitas)
Cloudflare → **Web Analytics** → *Add a site* → copie o **token** do beacon.

### 3. Variáveis de ambiente

```bash
cp .env.example .env      # preencha os valores — o .env NUNCA vai para o git
```

Para produção, o Claude envia cada valor como segredo do Worker:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

### 4. Publicar
Quando o código de cada fase estiver pronto:

```bash
wrangler deploy
```

E confirme no navegador `https://<seu-dominio>/c/<um-slug-de-teste>`.

---

## Boas práticas
- **Nunca** coloque chaves/segredos no código ou em mensagens — só no `.env` e em `wrangler secret`.
- Teste pagamentos sempre primeiro em **Sandbox**.
- Antes de apontar o domínio, confirme que ele não serve outra página em produção.

## Suporte
Dúvidas: fale com a equipa ZX LAB no seu grupo de mentoria.
