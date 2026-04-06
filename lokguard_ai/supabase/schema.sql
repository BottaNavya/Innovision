create extension if not exists pgcrypto;

create or replace function public.resolve_login_email(input_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_identifier text := lower(trim(coalesce(input_identifier, '')));
  digits_only_identifier text := regexp_replace(coalesce(input_identifier, ''), '[^0-9]', '', 'g');
  resolved_email text;
begin
  if normalized_identifier = '' then
    return null;
  end if;

  select u.email
    into resolved_email
  from public.users u
  where lower(trim(coalesce(u.email, ''))) = normalized_identifier
     or regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g') = digits_only_identifier
     or trim(coalesce(u.phone, '')) = trim(coalesce(input_identifier, ''))
  order by u.created_at asc
  limit 1;

  return resolved_email;
end;
$$;

grant execute on function public.resolve_login_email(text) to anon, authenticated;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  phone text,
  location text,
  pincode text,
  gender text,
  occupation text,
  preferred_claim_method text default 'UPI',
  verification jsonb default '{}'::jsonb,
  documents jsonb default '{}'::jsonb,
  active_plan jsonb,
  alerts jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists users_email_lower_idx on public.users (lower(email));
create index if not exists users_phone_idx on public.users (phone);

alter table public.users enable row level security;

drop policy if exists "Users can read own row" on public.users;
create policy "Users can read own row"
on public.users
for select
using (auth.uid() = id);

drop policy if exists "Users can insert own row" on public.users;
create policy "Users can insert own row"
on public.users
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row"
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

notify pgrst, 'reload schema';
