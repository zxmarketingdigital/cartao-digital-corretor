-- utilizador por e-mail (criação do cartão quando o comprador já tem conta)
create or replace function public.user_id_by_email(p_email text) returns uuid
language sql security definer set search_path = auth, public as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;

-- bucket público de fotos (escrita só service role)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create index if not exists orders_status_idx on public.orders (status);
