-- CG Studio — CMS: private.nome_exibicao nasceu executável por PUBLIC (padrão do Postgres).
-- Só o trigger de depoimentos (SECURITY DEFINER, roda como dono) precisa dela.
revoke all on function private.nome_exibicao(text) from public, anon, authenticated;
