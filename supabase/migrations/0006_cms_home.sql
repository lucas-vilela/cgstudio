-- CG Studio — CMS da home (docs/superpowers/specs/2026-10-12-cms-home-design.md).
--
-- 1. plans: descrição curta e flag de exibição na home; leitura pública (anon) só do que a home usa.
-- 2. treinos: tipos de treino da home (sempre pelo menos um ativo) + member_treinos (só admin).
-- 3. depoimentos: o aluno envia por RPC (sempre entra "pendente"); só admin aprova; anon lê aprovados.
-- 4. site_config: textos e contatos da home (linha única).
--
-- Padrão: RLS em tudo, escrita do admin separada em INSERT/UPDATE/DELETE, grants por coluna para
-- anon e execução de funções só para authenticated.

-- ------------------------------------------------------------------ 1. plans

alter table public.plans
  add column if not exists descricao       text
    check (descricao is null or char_length(btrim(descricao)) between 1 and 120),
  add column if not exists exibir_na_home  boolean not null default true;

grant select (nome, vezes_semana, valor_padrao, descricao) on public.plans to anon;
-- exibir_na_home também precisa de SELECT para a política avaliar a coluna.
grant select (exibir_na_home) on public.plans to anon;

create policy "plans read public" on public.plans
  for select to anon using (exibir_na_home);

-- ------------------------------------------------------------------ 2. treinos

create table if not exists public.treinos (
  id        bigint generated always as identity primary key,
  nome      text not null check (char_length(btrim(nome)) between 1 and 60),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 200),
  icone     text not null default 'dumbbell' check (icone in (
              'dumbbell', 'activity', 'person-standing', 'users', 'heart-pulse', 'flame',
              'timer', 'sparkles', 'leaf', 'zap', 'trophy', 'music', 'bike', 'waves')),
  ordem     integer not null default 0,
  ativo     boolean not null default true
);

create table if not exists public.member_treinos (
  member_id uuid   not null references public.members (id) on delete cascade,
  treino_id bigint not null references public.treinos (id) on delete cascade,
  primary key (member_id, treino_id)
);
create index if not exists member_treinos_treino_idx on public.member_treinos (treino_id);

-- Sempre pelo menos um treino ativo: vale para DELETE e para UPDATE de `ativo`. O lock serializa
-- dois admins removendo os dois últimos ao mesmo tempo (o segundo enxerga o commit do primeiro).
create or replace function private.treinos_minimo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('treinos_minimo'));
  if not exists (select 1 from public.treinos where ativo) then
    raise exception 'treino_minimo';
  end if;
  return null;
end;
$$;
revoke all on function private.treinos_minimo() from public, anon, authenticated;

create trigger treinos_minimo_delete
  after delete on public.treinos
  for each statement execute function private.treinos_minimo();
create trigger treinos_minimo_update
  after update of ativo on public.treinos
  for each statement execute function private.treinos_minimo();

insert into public.treinos (nome, descricao, icone, ordem)
select v.nome, v.descricao, v.icone, v.ordem
  from (values
    ('Funcional', 'Circuitos em turma pequena para força, fôlego e coordenação.', 'dumbbell', 1),
    ('Pilates', 'Controle, postura e respiração, com ajuste individual.', 'activity', 2),
    ('Alongamento e mobilidade', 'Mais amplitude de movimento e menos tensão no dia a dia.', 'person-standing', 3),
    ('Treino em dupla ou trio', 'Atenção próxima do professor, no seu ritmo.', 'users', 4)
  ) as v (nome, descricao, icone, ordem)
 where not exists (select 1 from public.treinos);

alter table public.treinos        enable row level security;
alter table public.member_treinos enable row level security;

revoke all on public.treinos, public.member_treinos from anon, authenticated;
grant select (nome, descricao, icone, ordem, ativo) on public.treinos to anon;
grant select, insert, update, delete on public.treinos, public.member_treinos to authenticated;

create policy "treinos read public" on public.treinos
  for select to anon using (ativo);
create policy "treinos read" on public.treinos
  for select to authenticated using (ativo or (select private.is_admin()));
create policy "treinos admin insert" on public.treinos
  for insert to authenticated with check ((select private.is_admin()));
create policy "treinos admin update" on public.treinos
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "treinos admin delete" on public.treinos
  for delete to authenticated using ((select private.is_admin()));

-- member_treinos: só admin (o aluno não lê nem escreve).
create policy "member_treinos admin select" on public.member_treinos
  for select to authenticated using ((select private.is_admin()));
create policy "member_treinos admin insert" on public.member_treinos
  for insert to authenticated with check ((select private.is_admin()));
create policy "member_treinos admin update" on public.member_treinos
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "member_treinos admin delete" on public.member_treinos
  for delete to authenticated using ((select private.is_admin()));

-- ------------------------------------------------------------------ 3. depoimentos

-- "Marina Souza Lima" -> "Marina L."; nome de uma palavra fica como está.
create or replace function private.nome_exibicao(p_nome text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(p_nome), '') is null then null
    when array_length(regexp_split_to_array(btrim(p_nome), '\s+'), 1) = 1 then btrim(p_nome)
    else (regexp_split_to_array(btrim(p_nome), '\s+'))[1]
         || ' ' ||
         upper(left((regexp_split_to_array(btrim(p_nome), '\s+'))
                    [array_length(regexp_split_to_array(btrim(p_nome), '\s+'), 1)], 1))
         || '.'
  end;
$$;

create table if not exists public.depoimentos (
  id                  bigint generated always as identity primary key,
  member_id           uuid not null unique references public.members (id) on delete cascade,
  texto               text not null check (char_length(btrim(texto)) between 10 and 500),
  status              text not null default 'pendente'
                        check (status in ('pendente', 'aprovado', 'recusado', 'oculto')),
  ajustado_pelo_admin boolean not null default false,
  -- Nome público, congelado enquanto o depoimento está aprovado (ver trigger).
  nome_exibicao       text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  aprovado_em         timestamptz
);
create index if not exists depoimentos_status_idx on public.depoimentos (status);

-- O nome público é tirado do cadastro ao criar e ao aprovar, e não muda sozinho enquanto aprovado:
-- o aluno não consegue trocar o nome exibido na home sem passar pela aprovação.
create or replace function private.depoimentos_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
  v_renomear boolean := false;
begin
  if tg_op = 'INSERT' then
    v_renomear := true;
  else
    new.updated_at := now();
    if new.status = 'aprovado' and old.status <> 'aprovado' then
      v_renomear := true;
      new.aprovado_em := now();
    elsif new.status <> 'aprovado' then
      new.aprovado_em := null;
    end if;
  end if;

  if v_renomear then
    select private.nome_exibicao(m.nome) into v_nome from public.members m where m.id = new.member_id;
    if v_nome is null then raise exception 'aluno_sem_nome'; end if;
    new.nome_exibicao := v_nome;
  end if;
  return new;
end;
$$;
revoke all on function private.depoimentos_before_write() from public, anon, authenticated;

create trigger depoimentos_before_write
  before insert or update on public.depoimentos
  for each row execute function private.depoimentos_before_write();

-- Único caminho de escrita do aluno: sempre cria/volta para "pendente" (aprovação é só do admin).
-- Texto igual ao já enviado (pendente/aprovado/oculto) não muda nada: salvar sem editar não derruba
-- um depoimento aprovado.
create or replace function private.enviar_depoimento(p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_member public.members%rowtype;
  v_texto  text := btrim(coalesce(p_texto, ''));
  v_atual  public.depoimentos%rowtype;
begin
  if v_uid is null then raise exception 'nao_autenticado'; end if;

  select * into v_member from public.members where auth_user_id = v_uid for update;
  if not found then raise exception 'aluno_nao_encontrado'; end if;
  if v_member.status <> 'ativo' then raise exception 'aluno_nao_ativo'; end if;
  if nullif(btrim(coalesce(v_member.nome, '')), '') is null then raise exception 'aluno_sem_nome'; end if;
  if char_length(v_texto) < 10 or char_length(v_texto) > 500 then raise exception 'texto_invalido'; end if;

  select * into v_atual from public.depoimentos where member_id = v_member.id for update;
  if found and v_atual.texto = v_texto and v_atual.status <> 'recusado' then
    return;
  end if;

  insert into public.depoimentos (member_id, texto)
  values (v_member.id, v_texto)
  on conflict (member_id) do update
    set texto = excluded.texto,
        status = 'pendente',
        ajustado_pelo_admin = false,
        nome_exibicao = excluded.nome_exibicao;
end;
$$;

create or replace function public.enviar_depoimento(p_texto text)
returns void language sql security invoker set search_path = ''
as $$ select private.enviar_depoimento(p_texto); $$;

revoke all on function private.enviar_depoimento(text), public.enviar_depoimento(text)
  from public, anon;
grant execute on function private.enviar_depoimento(text), public.enviar_depoimento(text)
  to authenticated;

alter table public.depoimentos enable row level security;

revoke all on public.depoimentos from anon, authenticated;
grant select (id, texto, nome_exibicao, status) on public.depoimentos to anon;
-- Sem INSERT para authenticated: criar só pela RPC.
grant select, update, delete on public.depoimentos to authenticated;

create policy "depoimentos read public" on public.depoimentos
  for select to anon using (status = 'aprovado');
create policy "depoimentos read own or admin" on public.depoimentos
  for select to authenticated
  using (member_id = (select id from public.members where auth_user_id = (select auth.uid()))
         or (select private.is_admin()));
create policy "depoimentos admin update" on public.depoimentos
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "depoimentos admin delete" on public.depoimentos
  for delete to authenticated using ((select private.is_admin()));

-- ------------------------------------------------------------------ 4. site_config

create table if not exists public.site_config (
  id               smallint primary key default 1 check (id = 1),
  whatsapp         text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  instagram        text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  hero_titulo      text check (char_length(hero_titulo) <= 80),
  hero_destaque    text check (char_length(hero_destaque) <= 80),
  hero_subtitulo   text check (char_length(hero_subtitulo) <= 200),
  nota_modalidades text check (char_length(nota_modalidades) <= 200),
  nota_planos      text check (char_length(nota_planos) <= 200),
  nota_horarios    text check (char_length(nota_horarios) <= 200),
  nota_contato     text check (char_length(nota_contato) <= 200),
  meta_descricao   text check (char_length(meta_descricao) <= 300)
);

insert into public.site_config (
  id, whatsapp, instagram, hero_titulo, hero_destaque, hero_subtitulo,
  nota_modalidades, nota_planos, nota_horarios, nota_contato, meta_descricao)
values (
  1, '5553984573198', 'studioclaricegeiger',
  'Corpo em ação,', 'mente em equilíbrio.',
  'Turmas pequenas, atenção ao seu movimento e horários que cabem na sua semana.',
  'Aulas conduzidas de perto, com poucas pessoas por horário.',
  'Cobrança mensal, pela frequência semanal. Pagamento combinado direto com o studio.',
  'Turmas fixas, com poucas pessoas por horário. Entre com sua conta Google para ver as vagas e escolher os seus horários.',
  'Fale com a gente para tirar dúvidas ou marcar sua aula experimental.',
  'CG Studio: studio de movimento com turmas pequenas e atenção ao seu movimento. Conheça modalidades, planos e horários.')
on conflict (id) do nothing;

alter table public.site_config enable row level security;

revoke all on public.site_config from anon, authenticated;
grant select on public.site_config to anon, authenticated;
grant insert, update on public.site_config to authenticated;

create policy "site_config read public" on public.site_config
  for select to anon, authenticated using (true);
create policy "site_config admin insert" on public.site_config
  for insert to authenticated with check ((select private.is_admin()));
create policy "site_config admin update" on public.site_config
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
