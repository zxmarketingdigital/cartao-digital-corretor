---
name: criar-cartao-visita
description: >-
  Guia o Claude Code na criação, edição e gestão de cartões de visita digitais
  de corretores. Ative quando o utilizador pedir para criar cartão de visita,
  criar um novo cartão digital, editar cartão, ver cartão, listar cartões,
  suspender cartão ou ativar cartão.
model: claude-sonnet-5
effort: medium
---

# Criar cartão de visita digital

Use o script desta skill para administrar os cartões da tabela `cards` do
projeto. O script é local, não tem dependências npm e comunica diretamente com
o PostgREST do Supabase usando a configuração do repositório.

## Regra de credenciais

Nunca peça ao utilizador para enviar, colar ou escrever chaves no chat. As
credenciais devem existir apenas no arquivo `.env` da raiz do repositório,
normalmente `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e, para montar a URL
apresentada ao utilizador, `PUBLIC_BASE_URL`. Não copie valores de `.env` para a
resposta, para prompts, para exemplos ou para arquivos versionados.

## Passo a passo para o Claude Code

1. Confirme a intenção do utilizador e o subcomando: criar, editar, ver,
   listar, suspender ou ativar.
2. Leia os dados do cartão que o utilizador forneceu. Se faltarem campos
   essenciais para criar, peça somente esses dados funcionais (por exemplo,
   nome e slug); não peça credenciais.
3. Para criar, prepare um JSON local com os campos do cartão. Valide que o slug
   contém apenas letras minúsculas, números e hífens, tem entre 3 e 40
   caracteres e não é reservado. Telefones devem ser internacionais; o script
   normaliza-os para E.164.
4. Execute o script a partir de qualquer diretório do repositório. O script
   localiza a raiz pelo `package.json` e lê o `.env` dessa raiz:

   ```sh
   node .claude/skills/criar-cartao-visita/scripts/cartao.mjs criar --json dados.json
   ```

5. Se o cartão tiver de ficar associado ao comprador, use `--email-dono
   pessoa@exemplo.invalid`. O script cria ou obtém o utilizador no Supabase;
   não revele a resposta de autenticação.
6. Para uma alteração pontual, use `editar` com `--slug` e campos no formato
   `--campo nome=valor` (ou flags diretas, como `--nome "Novo nome"`). O slug
   não é editável; use o slug atual como identificador.
7. Confirme o resultado olhando para a saída JSON do script. Em `criar`, a
   saída inclui a URL pública quando `PUBLIC_BASE_URL` está configurado. Em
   `ver`, confira os dados devolvidos pelo banco antes de comunicar a conclusão.
8. Para pausar ou reativar um cartão, use `suspender --slug slug` ou `ativar
   --slug slug`, e depois confirme com `ver --slug slug`.
9. Se houver erro de configuração, conflito ou resposta do Supabase, explique
   apenas a categoria do erro. Nunca inclua headers, tokens, service role key
   ou conteúdo do `.env` na mensagem.

## Exemplos seguros

```sh
node .claude/skills/criar-cartao-visita/scripts/cartao.mjs listar
node .claude/skills/criar-cartao-visita/scripts/cartao.mjs ver --slug lisboa-imoveis
node .claude/skills/criar-cartao-visita/scripts/cartao.mjs editar --slug lisboa-imoveis --campo bio="Atendimento personalizado em Lisboa."
node .claude/skills/criar-cartao-visita/scripts/cartao.mjs suspender --slug lisboa-imoveis
node .claude/skills/criar-cartao-visita/scripts/cartao.mjs ativar --slug lisboa-imoveis
```

Antes de uma criação real, reveja nome, contactos, links, locale e slug com o
utilizador. Um comando concluído prova que a API aceitou a operação; a URL
deve ser aberta e verificada separadamente quando a entrega pública for
importante.
