-- CG Studio v1 — endurecimento de privilégios e ajuste de políticas (advisors da Fase 1/3).
--
-- 1. O Supabase concede ALL às tabelas novas por padrão (default privileges). Aqui revogamos o
--    que a API nunca deve usar: escrita direta em user_roles (só set_user_role altera papéis,
--    como SECURITY DEFINER) e TRUNCATE/REFERENCES/TRIGGER em todas as tabelas do app.
-- 2. Índice na FK payments.registrado_por.
-- 3. Políticas "admin write" (FOR ALL) sobrepunham a política de leitura no SELECT
--    (multiple_permissive_policies). Separadas em INSERT/UPDATE/DELETE; o comportamento é o mesmo.

-- ------------------------------------------------------------------ 1. privilégios

revoke insert, update, delete on public.user_roles from authenticated;

revoke truncate, references, trigger
  on public.user_roles, public.members, public.plans, public.payments,
     public.slots, public.slot_members, public.trial_bookings
  from authenticated;

-- ------------------------------------------------------------------ 2. índice

create index if not exists payments_registrado_por_idx on public.payments (registrado_por);

-- ------------------------------------------------------------------ 3. políticas

-- plans
drop policy if exists "plans admin write" on public.plans;
create policy "plans admin insert" on public.plans
  for insert to authenticated with check ((select private.is_admin()));
create policy "plans admin update" on public.plans
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "plans admin delete" on public.plans
  for delete to authenticated using ((select private.is_admin()));

-- slots
drop policy if exists "slots admin write" on public.slots;
create policy "slots admin insert" on public.slots
  for insert to authenticated with check ((select private.is_admin()));
create policy "slots admin update" on public.slots
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "slots admin delete" on public.slots
  for delete to authenticated using ((select private.is_admin()));

-- slot_members
drop policy if exists "slot_members admin write" on public.slot_members;
create policy "slot_members admin insert" on public.slot_members
  for insert to authenticated with check ((select private.is_admin()));
create policy "slot_members admin update" on public.slot_members
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "slot_members admin delete" on public.slot_members
  for delete to authenticated using ((select private.is_admin()));

-- trial_bookings
drop policy if exists "trials admin write" on public.trial_bookings;
create policy "trials admin insert" on public.trial_bookings
  for insert to authenticated with check ((select private.is_admin()));
create policy "trials admin update" on public.trial_bookings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "trials admin delete" on public.trial_bookings
  for delete to authenticated using ((select private.is_admin()));
