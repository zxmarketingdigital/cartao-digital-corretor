create extension if not exists pgcrypto;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  paypal_order_id text unique,
  status text not null default 'criado' check (status in ('criado', 'pago', 'reembolsado')),
  buyer_email text,
  amount_cents int,
  currency text not null default 'EUR',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  order_id uuid unique references public.orders(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'suspenso')),
  nome text not null,
  cargo text,
  agencia text,
  ami text,
  bio text,
  foto_url text,
  telefone_e164 text,
  whatsapp_e164 text,
  email text,
  morada text,
  maps_url text,
  instagram text,
  facebook text,
  tiktok text,
  linkedin text,
  site text,
  reviews_url text,
  agenda_url text,
  servicos text[] not null default '{}',
  links jsonb not null default '[]'::jsonb,
  notify_email text,
  notify_whatsapp_e164 text,
  chat_enabled boolean not null default true,
  locale text not null default 'pt-PT' check (locale in ('pt-PT', 'pt-BR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  intencao text not null check (intencao in ('arrendamento', 'compra_venda', 'estudo_mercado')),
  sub_intencao text,
  nome text not null,
  email text not null,
  whatsapp_e164 text not null,
  mensagem text,
  status text not null default 'novo' check (status in ('novo', 'contactado', 'fechado')),
  utm jsonb not null default '{}'::jsonb,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.visits (
  id bigserial primary key,
  card_id uuid not null references public.cards(id) on delete cascade,
  day date not null,
  count int not null default 0,
  unique (card_id, day)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  canal text not null check (canal in ('email', 'whatsapp')),
  status text not null check (status in ('enviado', 'falhou')),
  erro text,
  created_at timestamptz not null default now()
);

create index leads_card_created_idx on public.leads (card_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cards_set_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

create or replace function public.increment_visit(p_card_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visits(card_id, day, count)
  values (p_card_id, (now() at time zone 'Europe/Lisbon')::date, 1)
  on conflict (card_id, day)
  do update set count = public.visits.count + 1;
$$;

revoke all on function public.increment_visit(uuid) from public, anon, authenticated;
grant execute on function public.increment_visit(uuid) to service_role;

-- RLS is enabled on every table; public writes happen only through the Worker service role.
alter table public.orders enable row level security;
alter table public.cards enable row level security;
alter table public.leads enable row level security;
alter table public.visits enable row level security;
alter table public.notifications enable row level security;

-- Owners can read and edit only their own cards.
create policy cards_owner_select on public.cards
for select to authenticated
using (owner_user_id = auth.uid());
create policy cards_owner_update on public.cards
for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

-- Leads are visible and status-editable only through the owning card.
create policy leads_owner_select on public.leads
for select to authenticated
using (exists (
  select 1 from public.cards c
  where c.id = leads.card_id and c.owner_user_id = auth.uid()
));
create policy leads_owner_update on public.leads
for update to authenticated
using (exists (
  select 1 from public.cards c
  where c.id = leads.card_id and c.owner_user_id = auth.uid()
))
with check (exists (
  select 1 from public.cards c
  where c.id = leads.card_id and c.owner_user_id = auth.uid()
));

-- Visit aggregates follow the same ownership boundary as the card.
create policy visits_owner_select on public.visits
for select to authenticated
using (exists (
  select 1 from public.cards c
  where c.id = visits.card_id and c.owner_user_id = auth.uid()
));

-- Notification failures are visible only to the owner of the related lead.
create policy notifications_owner_select on public.notifications
for select to authenticated
using (exists (
  select 1
  from public.leads l
  join public.cards c on c.id = l.card_id
  where l.id = notifications.lead_id and c.owner_user_id = auth.uid()
));

revoke all on all tables in schema public from anon;
grant select, update on public.cards, public.leads to authenticated;
grant select on public.visits, public.notifications to authenticated;

revoke update on public.cards from authenticated;
grant update (
  nome, cargo, agencia, ami, bio, foto_url, telefone_e164, whatsapp_e164,
  email, morada, maps_url, instagram, facebook, tiktok, linkedin, site,
  reviews_url, agenda_url, servicos, links, notify_email, notify_whatsapp_e164
) on public.cards to authenticated;

revoke update on public.leads from authenticated;
grant update (status) on public.leads to authenticated;
