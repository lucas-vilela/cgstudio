-- CG Studio — PWA offline do admin: pagamento idempotente (docs/plano-pwa-offline.md, fase 2).
--
-- Cada pagamento registrado offline leva um id gerado no aparelho (client_id). Se o mesmo id
-- chegar de novo (internet oscilando, reenvio da fila), nada é gravado de novo: a função só
-- devolve o vencimento atual. Função nova (registrar_pagamento) em vez de mudar a assinatura
-- de register_payment, que continua igual para quem já usa.

alter table public.payments add column if not exists client_id uuid;
create unique index if not exists payments_client_id_unique on public.payments (client_id)
  where client_id is not null;

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
                 then v_atual + 30
                 else v_pago + 30 end;

  insert into public.payments (member_id, valor, pago_em, forma, observacao, registrado_por, client_id)
  values (p_member_id, v_valor, v_pago, p_forma, p_observacao, v_uid, p_client_id);

  update public.members set vencimento = v_venc, status = 'ativo' where id = p_member_id;

  return v_venc;
end;
$$;

create or replace function public.registrar_pagamento(
  p_client_id uuid, p_member_id uuid, p_forma text, p_valor numeric default null,
  p_pago_em date default null, p_observacao text default null)
returns date language sql security invoker set search_path = ''
as $$ select private.registrar_pagamento(p_client_id, p_member_id, p_forma, p_valor, p_pago_em, p_observacao); $$;

revoke all on function private.registrar_pagamento(uuid, uuid, text, numeric, date, text),
                       public.registrar_pagamento(uuid, uuid, text, numeric, date, text)
  from public, anon;
grant execute on function private.registrar_pagamento(uuid, uuid, text, numeric, date, text),
                          public.registrar_pagamento(uuid, uuid, text, numeric, date, text)
  to authenticated;
