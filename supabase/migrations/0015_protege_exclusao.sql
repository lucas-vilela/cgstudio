-- CG Studio — proteção contra exclusão acidental de alunos e do histórico financeiro.
--
-- 1. payments.member_id passa de "on delete cascade" para "on delete restrict": o banco recusa
--    apagar um aluno que tem pagamento, por qualquer caminho (app, Data API, painel do Supabase,
--    excluir o usuário em Authentication). Para remover um aluno com pagamentos, os pagamentos
--    precisam ser apagados antes, de propósito.
-- 2. Excluir aluno passa a ter um único caminho: a RPC excluir_aluno_sem_login. Ela vira
--    SECURITY DEFINER (mantém a checagem de admin) e a política/privilégio de DELETE em members
--    sai do papel authenticated, para nenhum admin apagar aluno direto pela Data API pulando as
--    travas da RPC.

-- ------------------------------------------------------------------ 1. pagamentos protegidos

alter table public.payments
  drop constraint payments_member_id_fkey,
  add constraint payments_member_id_fkey
    foreign key (member_id) references public.members (id) on delete restrict;

-- ------------------------------------------------------------------ 2. exclusão só pela RPC

create or replace function public.excluir_aluno_sem_login(p_member_id uuid)
returns void
language plpgsql
security definer
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

drop policy if exists "members delete admin" on public.members;
revoke delete on public.members from authenticated;
