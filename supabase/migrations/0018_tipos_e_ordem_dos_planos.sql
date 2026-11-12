-- CG Studio — tipos de plano (mensal, trimestral, aula avulsa) e ordem dos planos na home.
--
-- 1. plans.tipo:
--    'mensal'     plano cobrado por mês (o de sempre): pagamento soma 1 mês ao vencimento.
--    'trimestral' plano cobrado a cada 3 meses: valor_padrao é o do trimestre e o pagamento
--                 soma 3 meses ao vencimento.
--    'avulsa'     só vitrine na home: informa que existe aula avulsa e o preço por aula.
--                 Aluno nunca fica com plano avulso.
-- 2. plans.ordem: posição na home e na tela do admin. Começa na ordem de hoje (frequência).
-- 3. Pagamento: o vencimento avança conforme o tipo do plano do aluno.

-- ------------------------------------------------------------------ 1. colunas

alter table public.plans
  add column if not exists tipo  text    not null default 'mensal',
  add column if not exists ordem integer not null default 0;

alter table public.plans drop constraint if exists plans_tipo_check;
alter table public.plans add constraint plans_tipo_check check (tipo in ('mensal', 'trimestral', 'avulsa'));

update public.plans p
   set ordem = o.n
  from (select id, row_number() over (order by vezes_semana, id) as n from public.plans) o
 where o.id = p.id;

-- A home lê tipo e ordena por ordem (ORDER BY também exige SELECT na coluna).
grant select (tipo, ordem) on public.plans to anon;

-- ------------------------------------------------------------------ 2. aluno sem plano avulso

create or replace function private.plano_de_aluno_nao_avulso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.plan_id is not null
     and exists (select 1 from public.plans where id = new.plan_id and tipo = 'avulsa') then
    raise exception 'plano_avulso_em_aluno';
  end if;
  return new;
end;
$$;

drop trigger if exists members_plano_nao_avulso on public.members;
create trigger members_plano_nao_avulso
  before insert or update of plan_id on public.members
  for each row execute function private.plano_de_aluno_nao_avulso();

-- Plano em uso não vira avulso (entre mensal e trimestral a troca é livre).
create or replace function private.plano_em_uso_nao_vira_avulso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'avulsa' and old.tipo <> 'avulsa'
     and exists (select 1 from public.members where plan_id = new.id) then
    raise exception 'plano_em_uso_vira_avulso';
  end if;
  return new;
end;
$$;

drop trigger if exists plans_tipo_em_uso on public.plans;
create trigger plans_tipo_em_uso
  before update of tipo on public.plans
  for each row execute function private.plano_em_uso_nao_vira_avulso();

revoke all on function private.plano_de_aluno_nao_avulso(), private.plano_em_uso_nao_vira_avulso()
  from public, anon;

-- ------------------------------------------------------------------ 3. vencimento por tipo

-- Mesma regra de mês de calendário da 0012, com a quantidade de meses do plano.
create or replace function private.proximo_vencimento(p_base date, p_meses integer)
returns date
language sql
immutable
set search_path = ''
as $$ select (p_base + make_interval(months => p_meses))::date $$;

revoke all on function private.proximo_vencimento(date, integer) from public, anon;

-- Aluno sem plano (valor informado na hora) conta como mensal.
create or replace function private.meses_do_plano(p_tipo text)
returns integer
language sql
immutable
set search_path = ''
as $$ select case when p_tipo = 'trimestral' then 3 else 1 end $$;

revoke all on function private.meses_do_plano(text) from public, anon;

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
  v_atual date;
  v_meses integer;
  v_pago  date := coalesce(p_pago_em, private.hoje());
  v_venc  date;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;
  if not private.is_admin() then raise exception 'nao_admin' using errcode = '42501'; end if;
  if p_forma is null or p_forma not in ('pix', 'dinheiro', 'cartao') then
    raise exception 'forma_invalida';
  end if;

  select coalesce(p_valor, m.valor_acordado, pl.valor_padrao), m.vencimento, private.meses_do_plano(pl.tipo)
    into v_valor, v_atual, v_meses
    from public.members m
    left join public.plans pl on pl.id = m.plan_id
   where m.id = p_member_id
     for update of m;
  if not found then raise exception 'aluno_nao_encontrado'; end if;
  if v_valor is null or v_valor <= 0 then raise exception 'valor_invalido'; end if;

  v_venc := case when v_atual is not null and v_atual >= v_pago
                 then private.proximo_vencimento(v_atual, v_meses)
                 else private.proximo_vencimento(v_pago, v_meses) end;

  insert into public.payments (member_id, valor, pago_em, forma, observacao, registrado_por)
  values (p_member_id, v_valor, v_pago, p_forma, p_observacao, v_uid);

  update public.members set vencimento = v_venc, status = 'ativo' where id = p_member_id;

  return v_venc;
end;
$$;

create or replace function private.registrar_pagamento(
  p_client_id  uuid,
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
  v_atual date;
  v_meses integer;
  v_pago  date := coalesce(p_pago_em, private.hoje());
  v_venc  date;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;
  if not private.is_admin() then raise exception 'nao_admin' using errcode = '42501'; end if;
  if p_client_id is null then raise exception 'client_id_obrigatorio'; end if;
  if p_forma is null or p_forma not in ('pix', 'dinheiro', 'cartao') then
    raise exception 'forma_invalida';
  end if;

  -- Trava o aluno antes de checar o client_id: dois envios simultâneos do mesmo pagamento
  -- ficam em fila aqui e o segundo encontra o primeiro já gravado.
  select coalesce(p_valor, m.valor_acordado, pl.valor_padrao), m.vencimento, private.meses_do_plano(pl.tipo)
    into v_valor, v_atual, v_meses
    from public.members m
    left join public.plans pl on pl.id = m.plan_id
   where m.id = p_member_id
     for update of m;
  if not found then raise exception 'aluno_nao_encontrado'; end if;

  if exists (select 1 from public.payments where client_id = p_client_id) then
    return v_atual;
  end if;

  if v_valor is null or v_valor <= 0 then raise exception 'valor_invalido'; end if;

  v_venc := case when v_atual is not null and v_atual >= v_pago
                 then private.proximo_vencimento(v_atual, v_meses)
                 else private.proximo_vencimento(v_pago, v_meses) end;

  insert into public.payments (member_id, valor, pago_em, forma, observacao, registrado_por, client_id)
  values (p_member_id, v_valor, v_pago, p_forma, p_observacao, v_uid, p_client_id);

  update public.members set vencimento = v_venc, status = 'ativo' where id = p_member_id;

  return v_venc;
end;
$$;
