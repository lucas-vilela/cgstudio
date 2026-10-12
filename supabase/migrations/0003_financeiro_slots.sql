-- CG Studio v1 — financeiro, calendário de slots, aula experimental, gestão de admins.
-- Fonte de verdade: docs/especificacao-v1.md. Base: 0002_members_auth.sql.
--
-- CONVENÇÕES
-- * Regras de negócio ficam em funções SECURITY DEFINER no schema `private` (não exposto
--   na Data API). A API só enxerga wrappers SECURITY INVOKER em `public`, chamados via
--   supabase.rpc(...), com EXECUTE só para `authenticated`.
-- * Erros de regra: `raise exception '<codigo>'` (SQLSTATE P0001). No supabase-js o código
--   vem em `error.message`. Falta de permissão: SQLSTATE 42501.
-- * "Hoje" = data de America/Sao_Paulo (private.hoje()).
-- * dia_semana segue extract(dow): 0 = domingo ... 6 = sábado.
-- * Views da API usam security_invoker = true (respeitam a RLS de quem consulta).

-- ------------------------------------------------------------------ utilidades

create or replace function private.hoje()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date; $$;
revoke all on function private.hoje() from public, anon;
grant execute on function private.hoje() to authenticated;

-- ------------------------------------------------------------------ plans

create table if not exists public.plans (
  id           bigint generated always as identity primary key,
  nome         text not null unique,
  vezes_semana smallint not null check (vezes_semana between 1 and 3),
  valor_padrao numeric(10,2) not null check (valor_padrao >= 0)
);

-- Valores fictícios (pendência de dados: preços reais e nomes dos planos).
insert into public.plans (nome, vezes_semana, valor_padrao) values
  ('1x', 1, 75.00),
  ('2x', 2, 80.00),
  ('3x', 3, 100.00)
on conflict (nome) do nothing;

-- ------------------------------------------------------------------ members (altera)

alter table public.members
  add column if not exists plan_id         bigint references public.plans (id) on delete restrict,
  add column if not exists valor_acordado  numeric(10,2) check (valor_acordado is null or valor_acordado >= 0),
  add column if not exists vencimento      date;

create index if not exists members_plan_id_idx    on public.members (plan_id);
create index if not exists members_vencimento_idx on public.members (vencimento);

-- Migra o texto livre antigo: "1x", "2x", "3x" (ou "2x por semana"...) -> plan_id.
-- Valores antigos sem correspondência (mensal, trimestral...) ficam com plan_id nulo,
-- para o admin escolher o plano depois.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'members' and column_name = 'plano') then
    update public.members m
       set plan_id = p.id
      from public.plans p
     where m.plan_id is null
       and m.plano is not null
       and (lower(btrim(m.plano)) = lower(p.nome)
            or substring(lower(btrim(m.plano)) from '^([123])\s*x')::int = p.vezes_semana);
  end if;
end $$;

-- Aluno edita só nome e telefone. Agora também protegidos: plan_id, valor_acordado, vencimento.
-- (substitui a versão da 0002; precisa vir antes do drop da coluna `plano`.)
-- auth.uid() nulo = SQL editor / service role / pg_cron: liberado.
create or replace function private.protect_member_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    if new.id is distinct from old.id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.email is distinct from old.email
       or new.status is distinct from old.status
       or new.plan_id is distinct from old.plan_id
       or new.valor_acordado is distinct from old.valor_acordado
       or new.vencimento is distinct from old.vencimento
       or new.created_at is distinct from old.created_at then
      raise exception 'Apenas administradores podem alterar esses campos'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

alter table public.members drop column if exists plano;

-- ------------------------------------------------------------------ payments

create table if not exists public.payments (
  id             bigint generated always as identity primary key,
  member_id      uuid not null references public.members (id) on delete cascade,
  valor          numeric(10,2) not null check (valor > 0),
  pago_em        date not null default current_date,
  forma          text not null check (forma in ('pix', 'dinheiro', 'cartao')),
  observacao     text,
  registrado_por uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists payments_member_pago_idx on public.payments (member_id, pago_em desc);
create index if not exists payments_pago_em_idx     on public.payments (pago_em);

-- ------------------------------------------------------------------ slots

create table if not exists public.slots (
  id          bigint generated always as identity primary key,
  dia_semana  smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim    time not null,
  capacidade  integer not null check (capacidade > 0),
  ativo       boolean not null default true,
  constraint slots_horario_valido check (hora_fim > hora_inicio)
);

-- Alocação fixa semanal. Inativo/atrasado MANTÉM a linha (nada a remove automaticamente).
create table if not exists public.slot_members (
  slot_id    bigint not null references public.slots (id) on delete cascade,
  member_id  uuid   not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (slot_id, member_id)
);
create index if not exists slot_members_member_idx on public.slot_members (member_id);

-- Aula experimental: uma por pessoa (member_id único). Ocupa vaga só no dia `data`.
create table if not exists public.trial_bookings (
  id         bigint generated always as identity primary key,
  member_id  uuid   not null unique references public.members (id) on delete cascade,
  slot_id    bigint not null references public.slots (id) on delete cascade,
  data       date   not null,
  created_at timestamptz not null default now()
);
create index if not exists trial_bookings_slot_data_idx on public.trial_bookings (slot_id, data);

-- ------------------------------------------------------------------ RPCs (private, definer)

-- Entra num slot fixo.
-- Erros: nao_autenticado, aluno_nao_encontrado, aluno_nao_ativo, sem_plano,
--        slot_indisponivel, ja_no_slot, limite_slots, slot_lotado.
create or replace function private.join_slot(p_slot_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_member  public.members%rowtype;
  v_limite  smallint;
  v_slot    public.slots%rowtype;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;

  -- Trava o aluno (evita burlar o limite entrando em 2 slots ao mesmo tempo)
  -- e depois o slot (evita corrida na última vaga). Ordem fixa: aluno -> slot.
  select * into v_member from public.members where auth_user_id = v_uid for update;
  if not found then raise exception 'aluno_nao_encontrado'; end if;
  if v_member.status <> 'ativo' then raise exception 'aluno_nao_ativo'; end if;

  select vezes_semana into v_limite from public.plans where id = v_member.plan_id;
  if v_limite is null then raise exception 'sem_plano'; end if;

  select * into v_slot from public.slots where id = p_slot_id and ativo for update;
  if not found then raise exception 'slot_indisponivel'; end if;

  if exists (select 1 from public.slot_members
             where slot_id = p_slot_id and member_id = v_member.id) then
    raise exception 'ja_no_slot';
  end if;

  if (select count(*) from public.slot_members where member_id = v_member.id) >= v_limite then
    raise exception 'limite_slots';
  end if;

  if (select count(*) from public.slot_members where slot_id = p_slot_id) >= v_slot.capacidade then
    raise exception 'slot_lotado';
  end if;

  insert into public.slot_members (slot_id, member_id) values (p_slot_id, v_member.id);
end;
$$;

-- Sai de um slot (livre, inclusive para inativo). Erros: nao_autenticado, nao_alocado.
create or replace function private.leave_slot(p_slot_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;

  delete from public.slot_members sm
   using public.members m
   where sm.slot_id = p_slot_id
     and sm.member_id = m.id
     and m.auth_user_id = v_uid;
  if not found then raise exception 'nao_alocado'; end if;
end;
$$;

-- Agenda a aula experimental. A data deve cair no dia da semana do slot.
-- Vagas do dia = capacidade - fixos do slot - experimentais já marcadas naquela data.
-- Erros: nao_autenticado, aluno_nao_encontrado, aluno_nao_pendente, experimental_ja_usada,
--        data_invalida (nula ou não futura), slot_indisponivel, dia_incorreto, slot_lotado.
create or replace function private.book_trial(p_slot_id bigint, p_data date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_member public.members%rowtype;
  v_slot   public.slots%rowtype;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;

  select * into v_member from public.members where auth_user_id = v_uid for update;
  if not found then raise exception 'aluno_nao_encontrado'; end if;
  if v_member.status <> 'pendente' then raise exception 'aluno_nao_pendente'; end if;
  if exists (select 1 from public.trial_bookings where member_id = v_member.id) then
    raise exception 'experimental_ja_usada';
  end if;

  if p_data is null or p_data <= private.hoje() then raise exception 'data_invalida'; end if;

  select * into v_slot from public.slots where id = p_slot_id and ativo for update;
  if not found then raise exception 'slot_indisponivel'; end if;
  if extract(dow from p_data)::int <> v_slot.dia_semana then raise exception 'dia_incorreto'; end if;

  if (select count(*) from public.slot_members where slot_id = p_slot_id)
   + (select count(*) from public.trial_bookings where slot_id = p_slot_id and data = p_data)
     >= v_slot.capacidade then
    raise exception 'slot_lotado';
  end if;

  insert into public.trial_bookings (member_id, slot_id, data)
  values (v_member.id, p_slot_id, p_data);
end;
$$;

-- Registra pagamento (só admin): grava payment, vencimento = pago_em + 30 dias e status = ativo
-- (também tira o aluno de pendente/inativo; slots não são tocados).
-- p_valor nulo => usa valor_acordado, senão o valor_padrao do plano.
-- p_pago_em nulo => hoje. Retorna o novo vencimento.
-- Erros: nao_autenticado, nao_admin (42501), aluno_nao_encontrado, forma_invalida, valor_invalido.
create or replace function private.register_payment(
  p_member_id  uuid,
  p_forma      text,
  p_valor      numeric default null,
  p_pago_em    date default null,
  p_observacao text default null
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_valor numeric(10,2);
  v_pago  date := coalesce(p_pago_em, private.hoje());
  v_venc  date;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;
  if not private.is_admin() then raise exception 'nao_admin' using errcode = '42501'; end if;
  if p_forma is null or p_forma not in ('pix', 'dinheiro', 'cartao') then
    raise exception 'forma_invalida';
  end if;

  select coalesce(p_valor, m.valor_acordado, pl.valor_padrao)
    into v_valor
    from public.members m
    left join public.plans pl on pl.id = m.plan_id
   where m.id = p_member_id
     for update of m;
  if not found then raise exception 'aluno_nao_encontrado'; end if;
  if v_valor is null or v_valor <= 0 then raise exception 'valor_invalido'; end if;

  v_venc := v_pago + 30;

  insert into public.payments (member_id, valor, pago_em, forma, observacao, registrado_por)
  values (p_member_id, v_valor, v_pago, p_forma, p_observacao, v_uid);

  update public.members set vencimento = v_venc, status = 'ativo' where id = p_member_id;

  return v_venc;
end;
$$;

-- Troca o papel de um usuário (só admin). Não rebaixa a si mesmo nem o último admin.
-- Erros: nao_autenticado, nao_admin (42501), papel_invalido, usuario_nao_encontrado,
--        nao_pode_rebaixar_a_si_mesmo, ultimo_admin.
create or replace function private.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;
  if not private.is_admin() then raise exception 'nao_admin' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('admin', 'member') then raise exception 'papel_invalido'; end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'usuario_nao_encontrado';
  end if;

  if p_role = 'member' then
    if p_user_id = v_uid then raise exception 'nao_pode_rebaixar_a_si_mesmo'; end if;
    -- serializa rebaixamentos concorrentes antes de contar admins
    perform 1 from public.user_roles where role = 'admin' for update;
    if (select count(*) from public.user_roles where role = 'admin') <= 1
       and exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin') then
      raise exception 'ultimo_admin';
    end if;
  end if;

  insert into public.user_roles (user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;
end;
$$;

-- Vagas de um slot numa data específica (fixos + experimentais do dia). Para a tela de
-- agendar aula grátis. Retorna null se o slot não existe/está inativo.
create or replace function private.slot_vagas_na_data(p_slot_id bigint, p_data date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
           s.capacidade
           - (select count(*) from public.slot_members where slot_id = s.id)
           - (select count(*) from public.trial_bookings where slot_id = s.id and data = p_data),
           0)::int
    from public.slots s
   where s.id = p_slot_id
     and (select auth.uid()) is not null
     and (s.ativo or private.is_admin());
$$;

-- Vagas restantes por slot (alunos veem todos os slots ativos; admin vê todos).
-- Definer porque o aluno só enxerga as próprias alocações pela RLS, mas precisa do total.
create or replace function private.fn_slots_vagas()
returns table (
  slot_id bigint, dia_semana smallint, hora_inicio time, hora_fim time,
  capacidade integer, ativo boolean, ocupados integer, vagas integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.dia_semana, s.hora_inicio, s.hora_fim, s.capacidade, s.ativo,
         count(sm.member_id)::int,
         greatest(s.capacidade - count(sm.member_id), 0)::int
    from public.slots s
    left join public.slot_members sm on sm.slot_id = s.id
   where (select auth.uid()) is not null
     and (s.ativo or private.is_admin())
   group by s.id;
$$;

-- Wrappers públicos (SECURITY INVOKER) -> o que o front chama com supabase.rpc.
create or replace function public.join_slot(p_slot_id bigint)
returns void language sql security invoker set search_path = ''
as $$ select private.join_slot(p_slot_id); $$;

create or replace function public.leave_slot(p_slot_id bigint)
returns void language sql security invoker set search_path = ''
as $$ select private.leave_slot(p_slot_id); $$;

create or replace function public.book_trial(p_slot_id bigint, p_data date)
returns void language sql security invoker set search_path = ''
as $$ select private.book_trial(p_slot_id, p_data); $$;

create or replace function public.register_payment(
  p_member_id uuid, p_forma text, p_valor numeric default null,
  p_pago_em date default null, p_observacao text default null)
returns date language sql security invoker set search_path = ''
as $$ select private.register_payment(p_member_id, p_forma, p_valor, p_pago_em, p_observacao); $$;

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void language sql security invoker set search_path = ''
as $$ select private.set_user_role(p_user_id, p_role); $$;

create or replace function public.slot_vagas_na_data(p_slot_id bigint, p_data date)
returns integer language sql stable security invoker set search_path = ''
as $$ select private.slot_vagas_na_data(p_slot_id, p_data); $$;

-- Permissões de execução: nada para public/anon, só authenticated.
do $$
declare f text;
begin
  foreach f in array array[
    'private.join_slot(bigint)', 'private.leave_slot(bigint)', 'private.book_trial(bigint,date)',
    'private.register_payment(uuid,text,numeric,date,text)', 'private.set_user_role(uuid,text)',
    'private.slot_vagas_na_data(bigint,date)', 'private.fn_slots_vagas()',
    'public.join_slot(bigint)', 'public.leave_slot(bigint)', 'public.book_trial(bigint,date)',
    'public.register_payment(uuid,text,numeric,date,text)', 'public.set_user_role(uuid,text)',
    'public.slot_vagas_na_data(bigint,date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ------------------------------------------------------------------ job diário (pg_cron)

-- Passa para inativo quem está ativo com vencimento vencido. Pendente nunca é tocado;
-- slot_members não é alterado (inativo mantém as vagas; pagar reativa sem perder o lugar).
create or replace function private.expire_overdue_members()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  update public.members
     set status = 'inativo'
   where status = 'ativo'
     and vencimento is not null
     and vencimento < private.hoje();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.expire_overdue_members() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

-- 03:05 UTC = 00:05 em Brasília. Reagendar com o mesmo nome é idempotente.
do $$
begin
  perform cron.unschedule('expire-overdue-members')
    where exists (select 1 from cron.job where jobname = 'expire-overdue-members');
  perform cron.schedule('expire-overdue-members', '5 3 * * *',
                        'select private.expire_overdue_members()');
end $$;

-- ------------------------------------------------------------------ RLS

alter table public.plans          enable row level security;
alter table public.payments       enable row level security;
alter table public.slots          enable row level security;
alter table public.slot_members   enable row level security;
alter table public.trial_bookings enable row level security;

revoke all on public.plans, public.payments, public.slots,
              public.slot_members, public.trial_bookings from anon;
grant select, insert, update, delete on public.plans, public.payments, public.slots,
      public.slot_members, public.trial_bookings to authenticated;

-- plans: todos os logados leem; só admin escreve.
create policy "plans read" on public.plans
  for select to authenticated using (true);
create policy "plans admin write" on public.plans
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- payments: só admin (aluno NÃO lê).
create policy "payments admin all" on public.payments
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- slots: aluno lê os ativos; admin faz tudo.
create policy "slots read" on public.slots
  for select to authenticated using (ativo or (select private.is_admin()));
create policy "slots admin write" on public.slots
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- slot_members: aluno lê só as próprias; escrita do aluno apenas via join_slot/leave_slot.
create policy "slot_members read own or admin" on public.slot_members
  for select to authenticated
  using (member_id = (select id from public.members where auth_user_id = (select auth.uid()))
         or (select private.is_admin()));
create policy "slot_members admin write" on public.slot_members
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- trial_bookings: idem (escrita do aluno só via book_trial).
create policy "trials read own or admin" on public.trial_bookings
  for select to authenticated
  using (member_id = (select id from public.members where auth_user_id = (select auth.uid()))
         or (select private.is_admin()));
create policy "trials admin write" on public.trial_bookings
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- user_roles: continua sem política de escrita (0002) -> só muda via set_user_role.

-- ------------------------------------------------------------------ views de leitura

-- Vagas por slot: ocupados (fixos) / capacidade. Todos os logados.
create or replace view public.slots_vagas with (security_invoker = true) as
  select * from private.fn_slots_vagas();

-- Situação financeira por aluno. Aluno vê só a própria linha; admin vê todas.
-- situacao: em_dia | vence_em_breve (vence em até 5 dias, inclusive hoje) | em_atraso
--           | sem_vencimento (nunca pagou). slots_usados/vezes_semana = "N de M".
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
         end as situacao
    from public.members m
    left join public.plans p on p.id = m.plan_id;

-- Vencimentos nos próximos 5 dias (hoje incluído), do mais perto ao mais longe. Só admin.
-- Exclui pendentes.
create or replace view public.vencimentos_proximos with (security_invoker = true) as
  select m.id as member_id, m.nome, p.nome as plano_nome,
         coalesce(m.valor_acordado, p.valor_padrao) as valor,
         m.vencimento, (m.vencimento - private.hoje()) as dias_restantes
    from public.members m
    left join public.plans p on p.id = m.plan_id
   where (select private.is_admin())
     and m.status <> 'pendente'
     and m.vencimento between private.hoje() and private.hoje() + 5
   order by m.vencimento, m.nome;

-- Inadimplentes: vencimento anterior a hoje (ativos ainda não varridos pelo job + inativos).
-- Só admin. Exclui pendentes. Mais antigo primeiro.
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
   order by m.vencimento, m.nome;

-- Totais por mês (mes = 1º dia do mês, pelo pago_em). Filtre .eq('mes','2026-10-01') para o mês
-- corrente. Só admin (RLS de payments).
create or replace view public.financeiro_mensal with (security_invoker = true) as
  select date_trunc('month', pago_em)::date as mes,
         sum(valor)                                           as total_recebido,
         count(*)::int                                        as qtd_pagamentos,
         coalesce(sum(valor) filter (where forma = 'pix'), 0)      as total_pix,
         coalesce(sum(valor) filter (where forma = 'dinheiro'), 0) as total_dinheiro,
         coalesce(sum(valor) filter (where forma = 'cartao'), 0)   as total_cartao
    from public.payments
   group by 1
   order by 1 desc;

revoke all on public.slots_vagas, public.member_financeiro, public.vencimentos_proximos,
              public.inadimplentes, public.financeiro_mensal from anon;
grant select on public.slots_vagas, public.member_financeiro, public.vencimentos_proximos,
                public.inadimplentes, public.financeiro_mensal to authenticated;
