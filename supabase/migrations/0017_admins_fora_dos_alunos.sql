-- CG Studio — admin não é aluno.
--
-- Todo usuário ganha uma linha em members no 1º login (handle_new_user), inclusive quem é admin
-- (papel em user_roles). Essa linha não deve aparecer nem contar como aluno: lista de Alunos,
-- resumo (ativos, em atraso), vencimentos próximos e inadimplentes.
--
-- 1. member_financeiro ganha a coluna eh_admin (no fim: create or replace view só acrescenta
--    colunas). O app do admin filtra eh_admin = false; o painel do aluno segue lendo a própria
--    linha como antes.
-- 2. vencimentos_proximos e inadimplentes deixam os admins de fora.

create or replace view public.member_financeiro with (security_invoker = true) as
  select m.id as member_id, m.nome, m.email, m.telefone, m.status,
         m.plan_id, p.nome as plano_nome, p.vezes_semana,
         (select count(*)::int from public.slot_members sm where sm.member_id = m.id) as slots_usados,
         coalesce(m.valor_acordado, p.valor_padrao) as valor,
         m.vencimento,
         (m.vencimento - private.hoje()) as dias_para_vencer,
         case
           when m.vencimento is null then 'sem_vencimento'
           when m.vencimento < private.hoje() then 'em_atraso'
           when m.vencimento - private.hoje() <= 5 then 'vence_em_breve'
           else 'em_dia'
         end as situacao,
         exists (
           select 1 from public.user_roles r where r.user_id = m.auth_user_id and r.role = 'admin'
         ) as eh_admin
    from public.members m
    left join public.plans p on p.id = m.plan_id;

create or replace view public.vencimentos_proximos with (security_invoker = true) as
  select m.id as member_id, m.nome, p.nome as plano_nome,
         coalesce(m.valor_acordado, p.valor_padrao) as valor,
         m.vencimento, (m.vencimento - private.hoje()) as dias_restantes
    from public.members m
    left join public.plans p on p.id = m.plan_id
   where (select private.is_admin())
     and m.status <> 'pendente'
     and m.vencimento between private.hoje() and private.hoje() + 5
     and not exists (
       select 1 from public.user_roles r where r.user_id = m.auth_user_id and r.role = 'admin'
     )
   order by m.vencimento, m.nome;

create or replace view public.inadimplentes with (security_invoker = true) as
  select m.id as member_id, m.nome, m.email, m.telefone, m.status,
         p.nome as plano_nome,
         coalesce(m.valor_acordado, p.valor_padrao) as valor_devido,
         m.vencimento, (private.hoje() - m.vencimento) as dias_atraso
    from public.members m
    left join public.plans p on p.id = m.plan_id
   where (select private.is_admin())
     and m.status <> 'pendente'
     and m.vencimento < private.hoje()
     and not exists (
       select 1 from public.user_roles r where r.user_id = m.auth_user_id and r.role = 'admin'
     )
   order by m.vencimento, m.nome;
