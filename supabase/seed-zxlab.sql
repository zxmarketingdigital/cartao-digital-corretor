insert into public.cards (
  slug, nome, cargo, agencia, locale, chat_enabled, bio, email, site,
  whatsapp_e164, instagram, agenda_url, links
)
values (
  'zxlab',
  'Rafael Castro',
  'Fundador',
  'ZX LAB',
  'pt-BR',
  false,
  'Automação com IA e Claude Code para negócios digitais.',
  'contato@zxlab.com.br',
  'https://zxlab.com.br',
  null, -- TODO Rafael
  null, -- TODO Rafael
  null, -- TODO Rafael
  jsonb_build_array(
    jsonb_build_object('titulo', 'ZX Control', 'descricao', 'Sistema operacional para negócios digitais.', 'url', 'https://zxlab.com.br'), -- TODO: URL real da LP
    jsonb_build_object('titulo', 'Formação Cientista da IA', 'descricao', 'Formação prática em inteligência artificial.', 'url', 'https://zxlab.com.br'), -- TODO: URL real da LP
    jsonb_build_object('titulo', 'Agência IA 50K', 'descricao', 'Programa para construir uma agência de IA.', 'url', 'https://zxlab.com.br'), -- TODO: URL real da LP
    jsonb_build_object('titulo', 'IA WhatsApp 15M', 'descricao', 'Agentes de IA para atendimento no WhatsApp.', 'url', 'https://zxlab.com.br'), -- TODO: URL real da LP
    jsonb_build_object('titulo', 'Agência IA Automatizada', 'descricao', 'Automação comercial e operacional com IA.', 'url', 'https://zxlab.com.br'), -- TODO: URL real da LP
    jsonb_build_object('titulo', 'Tráfego Pago Automatizado', 'descricao', 'Aquisição e otimização de campanhas.', 'url', 'https://zxlab.com.br') -- TODO: URL real da LP
  )
)
on conflict (slug) do update set
  nome = excluded.nome,
  cargo = excluded.cargo,
  agencia = excluded.agencia,
  locale = excluded.locale,
  chat_enabled = excluded.chat_enabled,
  bio = excluded.bio,
  email = excluded.email,
  site = excluded.site,
  whatsapp_e164 = excluded.whatsapp_e164,
  instagram = excluded.instagram,
  agenda_url = excluded.agenda_url,
  links = excluded.links;
