-- CG Studio v1 — horários ativos visíveis na home (visitante sem login).
--
-- O papel anon passa a ler só dia/hora dos slots ativos. Capacidade e demais colunas
-- continuam restritas (grant por coluna) e as vagas seguem só para quem está logado.

grant select (dia_semana, hora_inicio, hora_fim, ativo) on public.slots to anon;

create policy "slots read public" on public.slots
  for select to anon using (ativo);
