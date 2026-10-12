-- CG Studio — cadastro de aluno pelo admin (sem conta Google).
--
-- 1. members.auth_user_id passa a ser opcional: aluno cadastrado pelo admin nasce sem login.
-- 2. Telefone é o identificador: só dígitos e único entre quem tem número. E-mail, quando
--    informado, também é único (sem diferenciar maiúsculas).
-- 3. Primeiro login com Google: se existir aluno sem login com o mesmo e-mail, a conta é ligada a
--    ele (o Google só entrega e-mail verificado) em vez de criar um cadastro novo.
-- 4. excluir_aluno_sem_login: só apaga aluno sem login e sem pagamentos (corrigir cadastro errado).

-- ------------------------------------------------------------------ 1. vínculo opcional

alter table public.members alter column auth_user_id drop not null;

-- ------------------------------------------------------------------ 2. telefone e e-mail únicos

update public.members
   set telefone = nullif(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), '')
 where telefone is distinct from nullif(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), '');

alter table public.members
  add constraint members_telefone_digitos check (telefone is null or telefone ~ '^[0-9]{10,11}$');

create unique index if not exists members_telefone_unique on public.members (telefone)
  where telefone is not null;
create unique index if not exists members_email_unique on public.members (lower(email))
  where email is not null;

-- ------------------------------------------------------------------ 3. ligar conta Google

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_ligado uuid;
begin
  -- Aluno cadastrado pelo admin com o mesmo e-mail: liga a conta e mantém os dados dele.
  update public.members
     set auth_user_id = new.id
   where auth_user_id is null
     and new.email is not null
     and lower(email) = lower(new.email)
  returning id into v_ligado;

  if v_ligado is null then
    insert into public.members (auth_user_id, nome, email)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      new.email
    )
    on conflict (auth_user_id) do nothing;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict (user_id) do nothing;

  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------------------ 4. exclusão segura

-- SECURITY INVOKER: a política "members delete admin" vale; quem não é admin não apaga nada.
create or replace function public.excluir_aluno_sem_login(p_member_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare v_member public.members%rowtype;
begin
  if not (select private.is_admin()) then raise exception 'nao_admin'; end if;

  select * into v_member from public.members where id = p_member_id for update;
  if not found then raise exception 'aluno_nao_encontrado'; end if;
  if v_member.auth_user_id is not null then raise exception 'aluno_com_login'; end if;
  if exists (select 1 from public.payments where member_id = p_member_id) then
    raise exception 'aluno_com_pagamentos';
  end if;

  delete from public.members where id = p_member_id;
end;
$$;

revoke all on function public.excluir_aluno_sem_login(uuid) from public, anon;
grant execute on function public.excluir_aluno_sem_login(uuid) to authenticated;
