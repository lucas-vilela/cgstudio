-- CG Studio: alunos (members), papéis (user_roles), trigger de primeiro login e RLS.

-- Schema privado (não exposto na Data API) para funções privilegiadas.
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------- tabelas

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role    text not null default 'member' check (role in ('admin', 'member'))
);

create table if not exists public.members (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  nome         text,
  email        text,
  telefone     text,
  plano        text,
  status       text not null default 'pendente' check (status in ('ativo', 'inativo', 'pendente')),
  created_at   timestamptz not null default now()
);

create index if not exists members_status_idx on public.members (status);

-- ---------------------------------------------------------------- funções

-- Checa se o usuário logado é admin. SECURITY DEFINER para não cair em
-- recursão de RLS ao ler user_roles; fica no schema privado.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Cria member + papel 'member' no primeiro login (insert em auth.users).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.members (auth_user_id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email
  )
  on conflict (auth_user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Aluno só pode editar nome e telefone; plano/status/email/vínculo são do admin.
-- auth.uid() nulo = SQL editor / service role, liberado.
create or replace function private.protect_member_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.auth_user_id is distinct from old.auth_user_id
       or new.email is distinct from old.email
       or new.plano is distinct from old.plano
       or new.status is distinct from old.status
       or new.created_at is distinct from old.created_at
       or new.id is distinct from old.id then
      raise exception 'Apenas administradores podem alterar esses campos'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists members_protect_columns on public.members;
create trigger members_protect_columns
  before update on public.members
  for each row execute function private.protect_member_columns();

-- ---------------------------------------------------------------- RLS

alter table public.members    enable row level security;
alter table public.user_roles enable row level security;

revoke all on public.members, public.user_roles from anon;
grant select, insert, update, delete on public.members to authenticated;
grant select on public.user_roles to authenticated;

-- members: aluno vê/edita só o próprio; admin vê/edita tudo.
drop policy if exists "members select own or admin" on public.members;
create policy "members select own or admin" on public.members
  for select to authenticated
  using ((select auth.uid()) = auth_user_id or (select private.is_admin()));

drop policy if exists "members update own or admin" on public.members;
create policy "members update own or admin" on public.members
  for update to authenticated
  using ((select auth.uid()) = auth_user_id or (select private.is_admin()))
  with check ((select auth.uid()) = auth_user_id or (select private.is_admin()));

drop policy if exists "members insert admin" on public.members;
create policy "members insert admin" on public.members
  for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists "members delete admin" on public.members;
create policy "members delete admin" on public.members
  for delete to authenticated
  using ((select private.is_admin()));

-- user_roles: cada um lê o próprio papel; admin lê todos. Escrita só via
-- SQL editor / service role (promover admin: update user_roles set role='admin' ...).
drop policy if exists "roles select own or admin" on public.user_roles;
create policy "roles select own or admin" on public.user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id or (select private.is_admin()));
