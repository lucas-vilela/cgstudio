-- CG Studio — percepções do aluno na avaliação física.
--
-- Campo livre para o que não dá para medir com fita ou balança: o que o aluno sente que melhorou
-- ou piorou (sono, disposição, dor, força no dia a dia). Opcional; a avaliação continua exigindo
-- pelo menos uma medida. RLS, carimbo e grants da tabela já cobrem a coluna nova.

alter table public.member_avaliacoes
  add column if not exists percepcoes text check (length(percepcoes) <= 1000);
