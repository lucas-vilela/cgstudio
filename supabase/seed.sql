-- Dados de teste do banco LOCAL (supabase start / supabase db reset).
-- Nunca rode isto em produção.
--
-- Planos (1x/2x/3x), treinos e site_config já vêm das migrations.
-- Datas são relativas a current_date para os cenários continuarem válidos.
--
-- Logins (senha de todos: senha-teste-123):
--   admin@cgstudio.test      admin
--   ana@cgstudio.test        aluna ativa, em dia, com ficha completa
--   bruno@cgstudio.test      aluno ativo, inadimplente (vencimento passou)
--   carla@cgstudio.test      aluna pendente (primeiro login, sem plano)
-- Sem login: Diego (cadastrado pelo admin, auth_user_id nulo).

-- ---------------------------------------------------------------- usuários

create or replace function pg_temp.criar_usuario(p_id uuid, p_email text, p_nome text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt('senha-teste-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_nome),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

-- O trigger on_auth_user_created cria members + user_roles('member') para cada um.
select pg_temp.criar_usuario('00000000-0000-0000-0000-00000000a001', 'admin@cgstudio.test', 'Camila Admin');
select pg_temp.criar_usuario('00000000-0000-0000-0000-00000000b001', 'ana@cgstudio.test',   'Ana Souza');
select pg_temp.criar_usuario('00000000-0000-0000-0000-00000000b002', 'bruno@cgstudio.test', 'Bruno Lima');
select pg_temp.criar_usuario('00000000-0000-0000-0000-00000000b003', 'carla@cgstudio.test', 'Carla Mendes');

update public.user_roles set role = 'admin'
 where user_id = '00000000-0000-0000-0000-00000000a001';

-- ---------------------------------------------------------------- alunos

update public.members set
  status = 'ativo', telefone = '11987654321',
  plan_id = (select id from public.plans where nome = '2x'),
  valor_acordado = 80, vencimento = current_date + 20
 where auth_user_id = '00000000-0000-0000-0000-00000000b001';

update public.members set
  status = 'ativo', telefone = '11912345678',
  plan_id = (select id from public.plans where nome = '3x'),
  valor_acordado = 100, vencimento = current_date - 5
 where auth_user_id = '00000000-0000-0000-0000-00000000b002';

-- Carla fica como o trigger criou: pendente, sem plano.

insert into public.members (id, nome, email, telefone, status, plan_id, valor_acordado, vencimento)
values (
  '00000000-0000-0000-0000-00000000c001', 'Diego Rocha', 'diego@cgstudio.test', '11955554444',
  'ativo', (select id from public.plans where nome = '1x'), 75, current_date + 3
);

-- ---------------------------------------------------------------- horários

insert into public.slots (dia_semana, hora_inicio, hora_fim, capacidade)
select d, h::time, (h::time + interval '1 hour')::time, 4
  from generate_series(1, 5) as d,
       unnest(array['07:00', '08:00', '18:00', '19:00']) as h;

insert into public.slots (dia_semana, hora_inicio, hora_fim, capacidade)
values (6, '09:00', '10:00', 4);

-- Ana: seg e qua 07h. Bruno: seg, qua, sex 18h. Diego: ter 19h.
insert into public.slot_members (slot_id, member_id)
select s.id, m.id
  from public.slots s
  join public.members m on true
 where (m.email = 'ana@cgstudio.test'   and s.dia_semana in (1, 3)    and s.hora_inicio = '07:00')
    or (m.email = 'bruno@cgstudio.test' and s.dia_semana in (1, 3, 5) and s.hora_inicio = '18:00')
    or (m.email = 'diego@cgstudio.test' and s.dia_semana = 2          and s.hora_inicio = '19:00');

-- Carla marcou aula experimental para amanhã (qualquer slot do dia, se houver).
insert into public.trial_bookings (member_id, slot_id, data)
select m.id, s.id, current_date + 1
  from public.members m, public.slots s
 where m.email = 'carla@cgstudio.test'
   and s.dia_semana = extract(dow from current_date + 1)
 order by s.hora_inicio
 limit 1;

-- ---------------------------------------------------------------- treinos

insert into public.member_treinos (member_id, treino_id)
select m.id, t.id
  from public.members m
  join public.treinos t on t.nome in ('Funcional', 'Pilates')
 where m.email = 'ana@cgstudio.test'
union all
select m.id, t.id
  from public.members m
  join public.treinos t on t.nome = 'Funcional'
 where m.email in ('bruno@cgstudio.test', 'diego@cgstudio.test');

-- ---------------------------------------------------------------- financeiro

insert into public.payments (member_id, valor, pago_em, forma, registrado_por)
select m.id, p.valor, p.pago_em, p.forma, '00000000-0000-0000-0000-00000000a001'
  from public.members m
  join (values
    ('ana@cgstudio.test',   80.00,  current_date - 10, 'pix'),
    ('ana@cgstudio.test',   80.00,  current_date - 40, 'pix'),
    ('bruno@cgstudio.test', 100.00, current_date - 35, 'dinheiro'),
    ('diego@cgstudio.test', 75.00,  current_date - 27, 'cartao')
  ) as p (email, valor, pago_em, forma) on p.email = m.email;

-- ---------------------------------------------------------------- ficha da Ana

insert into public.member_anamneses (
  member_id, data_nascimento, endereco,
  doenca_cronica, medicacao_continua, restricao_medica, restricao_detalhe,
  praticou_exercicio, modalidades_anteriores, tempo_pratica, objetivos,
  autoriza_imagem, autoriza_imagem_data, consentimento_saude, consentimento_saude_data,
  cuidados_treino
)
select id, '1990-05-12', 'Rua das Flores, 123',
       false, false, true, 'Evitar impacto no joelho esquerdo',
       true, 'Musculação', '2 anos', 'Fortalecer e melhorar a postura',
       true, current_date - 60, true, current_date - 60,
       'Aquecer bem antes de agachamentos'
  from public.members where email = 'ana@cgstudio.test';

insert into public.member_avaliacoes (id, member_id, data, peso_kg, cintura_cm, quadril_cm, braco_cm)
select gen_random_uuid(), id, a.data, a.peso, a.cintura, a.quadril, a.braco
  from public.members
  cross join (values
    (current_date - 60, 68.5, 74.0, 98.0, 28.0),
    (current_date - 5,  66.2, 71.5, 96.5, 28.5)
  ) as a (data, peso, cintura, quadril, braco)
 where email = 'ana@cgstudio.test';

-- ---------------------------------------------------------------- depoimentos

insert into public.depoimentos (member_id, texto, status, aprovado_em)
select id, 'Melhor estúdio que já frequentei, atendimento super atencioso!', 'aprovado', now()
  from public.members where email = 'ana@cgstudio.test';

insert into public.depoimentos (member_id, texto)
select id, 'Treinos muito bons, horários flexíveis.'
  from public.members where email = 'bruno@cgstudio.test';
