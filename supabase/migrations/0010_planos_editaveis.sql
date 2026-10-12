-- CG Studio — planos criados, editados e excluídos pelo admin (aba Conteúdo).
--
-- Aulas por semana passam de 1–3 para 1–7. A exclusão de plano em uso já é barrada pela FK
-- members.plan_id (on delete restrict, migration 0003); a tela lista quem usa o plano antes.

alter table public.plans drop constraint if exists plans_vezes_semana_check;
alter table public.plans
  add constraint plans_vezes_semana_check check (vezes_semana between 1 and 7),
  add constraint plans_nome_tamanho check (char_length(btrim(nome)) between 1 and 30);
