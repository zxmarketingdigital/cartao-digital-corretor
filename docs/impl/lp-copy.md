# Copy da LP — `/cartao-digital` (PT-PT)

> Copiar literalmente para `worker/render/lp.js`. Nome comercial numa constante única `PRODUCT_NAME` (fácil de trocar).
> Design: "Terminal Âmbar" ZX LAB — fundo `#08080A`, texto `#ECEAE4`, secundários `#A5A19A`/`#8E97A6`, acento `#F59E0B` + `#D97757`
> (gradiente `135deg, #D97757, #F59E0B`), bordas `#33312C`, superfícies `#101012`/`#131315`/`#1A1A1E`, `border-radius: 3px`,
> JetBrains Mono em badge/eyebrow/preço/CTA, Inter no corpo, CTA em CAIXA ALTA mono com texto `#14100E` sobre o gradiente,
> grelha de fundo 40px `rgba(217,119,87,.045)`. Piso de fonte 11px. `section,[id]{scroll-margin-top:64px}`.
> **CTA único em todos os botões:** `QUERO O MEU CARTÃO DIGITAL` (âncora `#comprar`). Barra sticky inferior no mobile e desktop com preço + mesmo CTA; `body{padding-bottom}` maior que a barra.
> Pixel Meta: só `PageView`. Nada de InitiateCheckout na LP.

`PRODUCT_NAME = "Cartão Digital Imobiliário"` · assinatura "by ZX LAB"

---

## 1. Barra de topo
`PAGAMENTO ÚNICO · €97 · SEM MENSALIDADE · NO AR NO MESMO DIA`

## 2. Hero
- Badge: `PARA CONSULTORES IMOBILIÁRIOS EM PORTUGAL`
- Nome: **Cartão Digital Imobiliário** · by ZX LAB
- H1: **O cartão de visita que CAPTA clientes por si** (palavra em gradiente: `CAPTA`)
- Sub: Um link com a sua foto, contactos e serviços — e um assistente que pergunta ao visitante se procura arrendar, comprar, vender ou avaliar o imóvel. O contacto chega ao seu WhatsApp e e-mail no mesmo minuto.
- 3 bullets:
  - ✅ Cartão digital premium em `seu-dominio/c/o-seu-nome`, pronto para partilhar no WhatsApp, Instagram e QR code
  - ✅ Chat guiado que qualifica o contacto: arrendamento, compra e venda ou estudo de mercado
  - ✅ Aviso imediato no WhatsApp e e-mail + painel com todos os contactos e visitas
- Linha de preço: `€97 · pagamento único` — `Sem mensalidade. Sem contrato.`
- CTA: `QUERO O MEU CARTÃO DIGITAL`
- Micro-trust (mono, pequeno): `Pagamento seguro PayPal · Garantia de 7 dias · Cartão no ar logo após o pagamento`
- Imagem: `img/hero.webp` (sem lazy)

## 3. O que está em jogo
- Eyebrow: `O CONTACTO QUE SE PERDE`
- Título: **Quem pede o seu contacto hoje fecha com outro consultor amanhã**
- Texto: Entrega um cartão de papel numa visita e ele acaba no fundo de uma mala. Envia o número por mensagem e a pessoa guarda "para depois". Um cliente que queria avaliar o apartamento não sabe se deve ligar ou escrever — e acaba por falar com o primeiro que respondeu.
- Texto: Cada contacto que não fica registado é uma comissão que foi para a concorrência.

## 4. Contraste (antes / depois)
| Sem o Cartão Digital | Com o Cartão Digital |
|---|---|
| Cartão de papel que se perde | Um link que fica no telemóvel do cliente |
| "Depois ligo-lhe" — e nunca liga | O cliente deixa nome, e-mail e WhatsApp em 30 segundos |
| Não sabe o que a pessoa procura | Já sabe se é arrendamento, compra, venda ou avaliação |
| Descobre o contacto horas depois | Aviso no WhatsApp no mesmo minuto |
| Contactos espalhados em conversas | Todos num painel, com estado e exportação |

## 5. Para quem é / para quem não é
**É para si se:**
- É consultor(a) imobiliário(a) e vive de contactos novos
- Partilha o seu número no WhatsApp, Instagram ou em visitas
- Quer responder primeiro, antes da concorrência
- Quer ver quantas pessoas abriram o seu cartão

**Não é para si se:**
- Procura um site completo com listagem de imóveis e pesquisa
- Não quer receber contactos pelo WhatsApp

## 6. Como funciona (3 passos)
- `PASSO 1 · PAGAMENTO` — Paga €97 uma única vez pelo PayPal.
- `PASSO 2 · 5 MINUTOS` — Preenche o formulário: foto, contactos, redes, serviços e o nome do seu link.
- `PASSO 3 · NO AR` — O cartão fica no ar na hora. Recebe um e-mail com o link, o QR code e o acesso ao painel.

## 7. Na prática (3 blocos com imagem)
1. **O cartão** — Foto, agência, AMI, WhatsApp, e-mail, Instagram, agenda, "Guardar contacto" e "Partilhar" num só toque. Visual premium preto e dourado que se destaca de qualquer cartão de papel. _(sem imagem — só texto + ícones SVG inline)_
2. **O aviso** — Quando alguém preenche o chat, recebe no WhatsApp: interesse, nome, telemóvel e e-mail. Tudo numa mensagem. E o mesmo no e-mail. _(img/lead.webp)_
3. **O painel** — Entra com um link mágico no e-mail, sem senha. Vê as visitas dos últimos 7 e 30 dias, a lista de contactos, marca cada um como novo, contactado ou fechado e exporta tudo em CSV. _(img/painel.webp)_

## 8. Veja um cartão real
- Título: **Abra um cartão a funcionar**
- Texto: Este é o cartão da própria ZX LAB, feito com o mesmo sistema.
- Link (secundário, não é CTA de compra): `Ver cartão de exemplo →` → `/cartao-visita` (abre em nova aba)

## 9. O que recebe (bloco da oferta — item a item)
- ✅ Cartão digital premium com o seu link próprio
- ✅ Foto, cargo, agência e número AMI
- ✅ Botões de WhatsApp, e-mail, Instagram, agenda, guardar contacto e partilhar
- ✅ Lista dos seus serviços (compra, venda, arrendamento, avaliação…)
- ✅ Chat guiado de captação: arrendamento, compra e venda, estudo de mercado
- ✅ Aviso de novo contacto no WhatsApp
- ✅ Aviso de novo contacto por e-mail
- ✅ Painel com login por link mágico (sem senha)
- ✅ Contagem de visitas ao cartão (7 e 30 dias)
- ✅ Estado de cada contacto: novo, contactado, fechado
- ✅ Exportação de contactos em CSV
- ✅ QR code do cartão para imprimir
- ✅ Edição dos seus dados sempre que quiser
- Preço: `€97` · `pagamento único — sem mensalidade`
- Ancoragem: `Um único arrendamento fechado paga o cartão várias vezes.`
- Botão PayPal (`<div id="paypal-buttons">`) — se `PAYPAL_CLIENT_ID` vazio, mostrar o texto `Pagamentos ainda não configurados.` no lugar.
- Sob o botão: `Pagamento processado pelo PayPal (cartão ou conta PayPal). Após a confirmação é levado ao formulário do seu cartão.`

## 10. Garantia
- Título: **Garantia de 7 dias**
- Texto: Crie o seu cartão, partilhe-o e use o painel. Se nos primeiros 7 dias achar que não é para si, peça o reembolso e devolvemos os €97.

## 11. FAQ
- **Tenho de pagar mensalidade?** Não. Paga €97 uma vez e o cartão fica seu.
- **Preciso de saber de tecnologia?** Não. Preenche um formulário e o cartão fica no ar. Para editar, entra no painel.
- **Quanto tempo demora a ficar no ar?** Logo após o pagamento. O formulário leva uns 5 minutos.
- **O cliente tem de instalar alguma coisa?** Não. O cartão abre no navegador de qualquer telemóvel ou computador.
- **Aceita números de fora de Portugal?** Sim. O chat aceita telemóveis de qualquer país.
- **Onde recebo os contactos?** No seu WhatsApp, no seu e-mail e no painel, ao mesmo tempo.
- **Posso mudar os meus dados depois?** Sim, no painel. Só o endereço do link (`/c/o-seu-nome`) fica fixo.
- **E os dados dos meus clientes (RGPD)?** O chat pede consentimento explícito antes de enviar. Os dados ficam no seu painel e não são partilhados com terceiros.

## 12. Fechamento
- Título: **Daqui a 30 dias pode continuar a entregar cartões de papel — ou ter cada contacto no seu painel**
- Texto: O próximo cliente que pedir o seu contacto pode ser o próximo fecho. Responda primeiro.
- CTA: `QUERO O MEU CARTÃO DIGITAL`

## 13. Rodapé
`© ZX LAB · Cartão Digital Imobiliário · Pagamentos processados pelo PayPal`

## Barra sticky inferior
`€97 · pagamento único` + botão `QUERO O MEU CARTÃO DIGITAL` (âncora `#comprar`)

## Meta
- `<title>`: `Cartão Digital Imobiliário — o cartão que capta clientes`
- description: `Cartão de visita digital para consultores imobiliários em Portugal, com chat que capta contactos e aviso imediato no WhatsApp. Pagamento único de €97.`
- og:image: `/cartao-digital/img/hero.webp`
