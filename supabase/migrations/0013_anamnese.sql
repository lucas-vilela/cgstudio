-- CG Studio — ficha do aluno: anamnese e medidas (avaliação física).
--
-- As perguntas seguem a ficha em papel do studio ("Ficha de anamnese – Funcional feminino").
-- Ver docs/superpowers/specs/2026-10-13-ficha-aluno-anamnese-design.md.
--
-- 1. member_anamneses: uma linha por aluno (a versão atual). Tudo opcional.
-- 2. member_avaliacoes: medidas datadas; id gerado no aparelho (idempotente pela fila offline).
-- 3. Carimbo (updated_at/updated_by) e datas no futuro recusadas por trigger.
-- 4. View com o nome de quem atualizou.
-- 5. RLS: só admin (dado de saúde, LGPD art. 11). O aluno não lê nem a própria.

-- ------------------------------------------------------------------ 1. anamnese

create table if not exists public.member_anamneses (
  member_id                uuid primary key references public.members (id) on delete cascade,
  -- Dados pessoais (nome e telefone ficam em members)
  data_nascimento          date check (data_nascimento >= date '1900-01-01'),
  endereco                 text check (length(endereco) <= 300),
  -- Histórico de saúde
  doenca_cronica           boolean,
  doenca_cronica_quais     text check (length(doenca_cronica_quais) <= 1000),
  medicacao_continua       boolean,
  medicacao_quais          text check (length(medicacao_quais) <= 1000),
  restricao_medica         boolean,
  restricao_detalhe        text check (length(restricao_detalhe) <= 1000),
  -- Histórico de atividade física
  praticou_exercicio       boolean,
  modalidades_anteriores   text check (length(modalidades_anteriores) <= 500),
  tempo_pratica            text check (length(tempo_pratica) <= 200),
  -- Objetivos
  objetivos                text check (length(objetivos) <= 2000),
  -- Autorização de imagem (assinada no papel)
  autoriza_imagem          boolean,
  autoriza_imagem_data     date,
  -- Consentimento para dados de saúde (não está na folha; registrado só aqui)
  consentimento_saude      boolean,
  consentimento_saude_data date,
  -- Só do studio
  cuidados_treino          text check (length(cuidados_treino) <= 2000),
  observacoes              text check (length(observacoes) <= 2000),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users (id) on delete set null
);

-- ------------------------------------------------------------------ 2. medidas

create table if not exists public.member_avaliacoes (
  id          uuid primary key,
  member_id   uuid not null references public.members (id) on delete cascade,
  data        date not null,
  peso_kg     numeric(5,1) check (peso_kg between 20 and 300),
  cintura_cm  numeric(5,1) check (cintura_cm between 10 and 250),
  quadril_cm  numeric(5,1) check (quadril_cm between 10 and 250),
  coxa_cm     numeric(5,1) check (coxa_cm between 10 and 250),
  peito_cm    numeric(5,1) check (peito_cm between 10 and 250),
  braco_cm    numeric(5,1) check (braco_cm between 10 and 250),
  observacao  text check (length(observacao) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null,
  constraint member_avaliacoes_alguma_medida
    check (num_nonnulls(peso_kg, cintura_cm, quadril_cm, coxa_cm, peito_cm, braco_cm) > 0)
);

create index if not exists member_avaliacoes_member_data_idx
  on public.member_avaliacoes (member_id, data desc);
create index if not exists member_anamneses_updated_by_idx on public.member_anamneses (updated_by);
create index if not exists member_avaliacoes_updated_by_idx on public.member_avaliacoes (updated_by);

-- ------------------------------------------------------------------ 3. carimbo e datas

-- Datas "não futuras" ficam no trigger (e não em check, que não deve depender do dia de hoje).
create or replace function private.anamnese_carimbo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data_nascimento > private.hoje()
     or new.autoriza_imagem_data > private.hoje()
     or new.consentimento_saude_data > private.hoje() then
    raise exception 'data_no_futuro' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.member_id  := old.member_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create or replace function private.avaliacao_carimbo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data > private.hoje() then
    raise exception 'data_no_futuro' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    new.id         := old.id;
    new.member_id  := old.member_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

revoke all on function private.anamnese_carimbo(), private.avaliacao_carimbo() from public, anon, authenticated;

drop trigger if exists member_anamneses_carimbo on public.member_anamneses;
create trigger member_anamneses_carimbo
  before insert or update on public.member_anamneses
  for each row execute function private.anamnese_carimbo();

drop trigger if exists member_avaliacoes_carimbo on public.member_avaliacoes;
create trigger member_avaliacoes_carimbo
  before insert or update on public.member_avaliacoes
  for each row execute function private.avaliacao_carimbo();

-- ------------------------------------------------------------------ 4. nome de quem atualizou

create or replace view public.member_anamneses_admin with (security_invoker = true) as
  select a.*, m.nome as updated_by_nome
    from public.member_anamneses a
    left join public.members m on m.auth_user_id = a.updated_by;

-- ------------------------------------------------------------------ 5. RLS

alter table public.member_anamneses  enable row level security;
alter table public.member_avaliacoes enable row level security;

revoke all on public.member_anamneses, public.member_avaliacoes, public.member_anamneses_admin from anon;
grant select, insert, update, delete on public.member_anamneses, public.member_avaliacoes to authenticated;
grant select on public.member_anamneses_admin to authenticated;

drop policy if exists "anamneses admin" on public.member_anamneses;
create policy "anamneses admin" on public.member_anamneses
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "avaliacoes admin" on public.member_avaliacoes;
create policy "avaliacoes admin" on public.member_avaliacoes
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
