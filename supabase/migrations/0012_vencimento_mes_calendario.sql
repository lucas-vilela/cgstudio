-- CG Studio — vencimento por mês de calendário em vez de 30 dias fixos.
--
-- Pagamento passa a somar 1 mês: 10/01 → 10/02, 10/02 → 10/03. Quando o dia não existe no mês
-- seguinte, cai no último dia (31/01 → 28/02, ou 29/02 em ano bissexto). Regra de base continua:
-- vencimento atual >= pago_em soma ao atual; nulo ou vencido conta de pago_em.

create or replace function private.proximo_vencimento(p_base date)
returns date
language sql
immutable
set search_path = ''
as $$ select (p_base + interval '1 month')::date $$;

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
  v_pago  date := coalesce(p_pago_em, private.hoje());
  v_venc  date;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;
  if not private.is_admin() then raise exception 'nao_admin' using errcode = '42501'; end if;
  if p_forma is null or p_forma not in ('pix', 'dinheiro', 'cartao') then
    raise exception 'forma_invalida';
  end if;

  select coalesce(p_valor, m.valor_acordado, pl.valor_padrao), m.vencimento
    into v_valor, v_atual
    from public.members m
    left join public.plans pl on pl.id = m.plan_id
   where m.id = p_member_id
     for update of m;
  if not found then raise exception 'aluno_nao_encontrado'; end if;
  if v_valor is null or v_valor <= 0 then raise exception 'valor_invalido'; end if;

  v_venc := case when v_atual is not null and v_atual >= v_pago
                 then private.proximo_vencimento(v_atual)
                 else private.proximo_vencimento(v_pago) end;

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
  select coalesce(p_valor, m.valor_acordado, pl.valor_padrao), m.vencimento
    into v_valor, v_atual
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
                 then private.proximo_vencimento(v_atual)
                 else private.proximo_vencimento(v_pago) end;

  insert into public.payments (member_id, valor, pago_em, forma, observacao, registrado_por, client_id)
  values (p_member_id, v_valor, v_pago, p_forma, p_observacao, v_uid, p_client_id);

  update public.members set vencimento = v_venc, status = 'ativo' where id = p_member_id;

  return v_venc;
end;
$$;

revoke all on function private.proximo_vencimento(date) from public, anon;
