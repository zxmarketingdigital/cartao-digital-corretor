alter table public.leads add column envio_id uuid;

create unique index leads_envio_id_key
  on public.leads(envio_id);
