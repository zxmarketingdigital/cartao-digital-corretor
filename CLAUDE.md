# Cartão Digital para Corretores — instruções para o Claude Code

Este repositório implementa o produto descrito em `SPEC.md`. **Leia o `SPEC.md` inteiro antes de qualquer alteração.** Ele é a fonte de verdade: decisões, rotas, modelo de dados, segurança, visual e critérios de aceite.

## Como trabalhar
- Ao guiar a configuração, siga o `README.md` §2, **um serviço de cada vez**, confirmando cada passo antes do próximo.
- Implementação segue a ordem do `SPEC.md` §13. Uma fase de cada vez; cada fase termina com os critérios de aceite dela verificados.
- Copy voltada ao cliente final em **português de Portugal** (telemóvel, contacto, arrendamento, "consigo").
- Visual: direção C · Metal — ver `design/` e `SPEC.md` §9. Não invente paleta nem fontes.

## Regras que não se negociam
- Segredos **só** em `.env` (local, fora do git) e `wrangler secret`. Nunca no código, commits, logs ou mensagens.
- Pagamento só é confirmado no servidor (captura PayPal + webhook verificado). Nunca pela página de obrigado.
- Nenhum dado pessoal em URL/query string.
- Todo conteúdo vindo do corretor ou do visitante é escapado ao renderizar.
- Telefone em formato internacional (E.164): aceitar qualquer país, sem exigir 9 dígitos portugueses.
- WhatsApp: cada aviso é **uma única mensagem**, por um número dedicado a avisos.
- Testar pagamentos primeiro em Sandbox.

## Estrutura
```
worker/      Cloudflare Worker (rotas, render do cartão, API)
public/      LP, formulário de criação, painel, assets
supabase/    migrations SQL (+ RLS)
design/      mockups de referência (não são servidos em produção)
```
