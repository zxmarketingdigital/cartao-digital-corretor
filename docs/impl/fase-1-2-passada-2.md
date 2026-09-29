# Passada 2 — correções (Fases 1-2)

1. **Idempotência do lead** (review MÉDIO):
   - Nova migration `supabase/migrations/20260929000002_lead_envio_id.sql`: `alter table leads add column envio_id uuid; create unique index leads_envio_id_key on leads(envio_id) where envio_id is not null;`
   - O widget gera `crypto.randomUUID()` UMA vez por formulário preenchido (guardado no estado; reenviar o mesmo formulário reutiliza o mesmo id) e envia `envio_id`.
   - `validateLead`: `envio_id` obrigatório e tem de ser UUID (regex v4 genérico `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`, case-insensitive).
   - `insertLead`: `POST /leads?on_conflict=envio_id` com `Prefer: resolution=ignore-duplicates,return=representation`. Resposta `[]` = duplicado → responder `200 {ok:true,...}` igual ao sucesso **sem** agendar avisos.
   - Testes: mesmo `envio_id` 2× → 1 aviso só; `envio_id` ausente/inválido → 400.
2. **Chat flutuante (bug visto no browser)**: no modo `floating`, o painel tem de abrir por cima do cartão (classe `cd-floating` aplicada ao contentor, posição fixa acima do botão), como em `design/chat.html`.
   - O botão flutuante fechado é uma pílula âmbar com ícone de balão + texto `Fale comigo` (pt-PT) / `Fale conosco` (pt-BR) — `i18n`; aberto vira círculo com ícone X (`aria-expanded` true/false, `aria-controls`). Um só botão (remover o `cd-close` absoluto duplicado); no cabeçalho do painel um botão X pequeno também fecha.
   - Reescrever `worker/render/chat-widget.js` como **um template literal legível** (código formatado, não um array de linhas minificadas). Manter: só `textContent` para dados, honeypot, UTMs, erros por campo, Esc fecha.
3. **Ícones nos tiles de ação** do cartão (WhatsApp, E-mail, Instagram, Agendar, Guardar, Partilhar): SVG inline 22px `stroke=currentColor` âmbar acima do rótulo, como em `design/cartao.html`.
4. **Não** implementar rate limit (fica para decisão do Rafael).

Terminar com `node --test test/*.test.js` verde e `node --check` em todos os .js.
