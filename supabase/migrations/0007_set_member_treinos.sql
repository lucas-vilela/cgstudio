-- CG Studio — troca atômica dos tipos de treino de um aluno (CMS da home).
-- SECURITY INVOKER: a RLS de member_treinos (só admin) vale; quem não é admin não altera nada.

create or replace function public.set_member_treinos(p_member_id uuid, p_treino_ids bigint[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.member_treinos
   where member_id = p_member_id
     and treino_id <> all (coalesce(p_treino_ids, '{}'::bigint[]));

  insert into public.member_treinos (member_id, treino_id)
  select p_member_id, t.id
    from public.treinos t
   where t.id = any (coalesce(p_treino_ids, '{}'::bigint[]))
  on conflict do nothing;
end;
$$;

revoke all on function public.set_member_treinos(uuid, bigint[]) from public, anon;
grant execute on function public.set_member_treinos(uuid, bigint[]) to authenticated;
