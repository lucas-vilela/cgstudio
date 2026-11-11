-- CG Studio — excluir horário (slot).
--
-- Só exclui horário vazio: sem aluno fixo (slot_members) e sem aula experimental (trial_bookings).
-- Horário com gente é para desativar. A aula experimental conta mesmo se já passou: apagá-la
-- (cascata) liberaria a pessoa para marcar outra aula grátis (uma por pessoa, ver book_trial).
--
-- Exclusão passa a ter um único caminho, esta RPC: sai a política/privilégio de DELETE em slots
-- do papel authenticated.

create or replace function public.excluir_horario(p_slot_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then raise exception 'nao_admin'; end if;

  -- FOR UPDATE: segura quem tenta entrar no horário (FK em slot_members/trial_bookings) até o fim.
  perform 1 from public.slots where id = p_slot_id for update;
  if not found then raise exception 'horario_nao_encontrado'; end if;

  if exists (select 1 from public.slot_members where slot_id = p_slot_id) then
    raise exception 'horario_com_alunos';
  end if;
  if exists (select 1 from public.trial_bookings where slot_id = p_slot_id) then
    raise exception 'horario_com_aula_experimental';
  end if;

  delete from public.slots where id = p_slot_id;
end;
$$;

revoke all on function public.excluir_horario(bigint) from public, anon;
grant execute on function public.excluir_horario(bigint) to authenticated;

drop policy if exists "slots admin delete" on public.slots;
revoke delete on public.slots from authenticated;
