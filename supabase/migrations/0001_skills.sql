-- Catálogo de skills mapeadas de https://skills-nocode-startup.lovable.app/

create table if not exists public.skills (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  category    text not null,
  description text not null,
  use_case    text,
  url         text,
  kind        text not null default 'skill' check (kind in ('skill', 'repository', 'area')),
  created_at  timestamptz not null default now()
);

create index if not exists skills_category_idx on public.skills (category);

alter table public.skills enable row level security;

-- Catálogo público: qualquer um pode ler, só o service role escreve.
drop policy if exists "skills are public" on public.skills;
create policy "skills are public" on public.skills
  for select using (true);

insert into public.skills (slug, name, category, description, use_case, url, kind) values
  -- Repositórios base
  ('anthropic',         'Anthropic',         'Repositórios', 'Padrões oficiais e exemplos confiáveis.',              'Referência oficial de skills',          'https://github.com/anthropics/skills', 'repository'),
  ('skills-directory',  'Skills Directory',  'Repositórios', 'Exploração e descoberta de novas skills.',              'Descobrir skills novas',                'https://skills.sh',                    'repository'),
  ('skillsmp',          'SkillsMP',          'Repositórios', 'Marketplace para comparar skills.',                     'Comparar alternativas',                 'https://skillsmp.com',                 'repository'),
  ('lobehub',           'LobeHub',           'Repositórios', 'Exploração visual de skills.',                          'Navegar skills visualmente',            'https://lobehub.com/skills',           'repository'),

  -- Gerais
  ('skill-creator',     'skill-creator',     'Gerais', 'Cria skills personalizadas.',                                 'Skills de produto ou de agente',        'https://skills.sh/search?q=skill-creator', 'skill'),
  ('find-skills',       'find-skills',       'Gerais', 'Descobre skills relevantes.',                                 'Montar uma stack inicial',              'https://skills.sh/search?q=find-skills',   'skill'),
  ('superpowers',       'superpowers',       'Gerais', 'Raciocínio técnico aprofundado.',                             'Decisões de arquitetura',               'https://skills.sh/search?q=superpowers',   'skill'),
  ('get-shit-done',     'get-shit-done',     'Gerais', 'Foco em produtividade e execução.',                           'Sprints e entregas rápidas',            'https://skills.sh/search?q=get-shit-done', 'skill'),
  ('review-ultrareview','review + ultrareview','Gerais','Revisão crítica de outputs da IA.',                          'Revisar outputs longos',                'https://skills.sh/search?q=review',        'skill'),

  -- Automação
  ('firecrawl',         'firecrawl',         'Automação', 'Web scraping, inclusive de sites com JavaScript.',         'Leads e pesquisa de mercado',           'https://skills.sh/search?q=firecrawl',     'skill'),
  ('playwright',        'playwright',        'Automação', 'Automação de navegador.',                                  'Testes E2E',                            'https://skills.sh/search?q=playwright',    'skill'),
  ('claude-routines',   'claude-routines',   'Automação', 'Tarefas agendadas e autônomas.',                           'Monitoramento e relatórios diários',    'https://skills.sh/search?q=routines',      'skill'),

  -- Web Design
  ('frontend-design',   'frontend-design',   'Web Design', 'Criação rápida de interfaces modernas e responsivas.',    'Landing pages e dashboards',            'https://skills.sh/search?q=frontend-design', 'skill'),
  ('shadcn',            'shadcn',            'Web Design', 'Componentes reutilizáveis.',                              'Design system próprio',                 'https://skills.sh/search?q=shadcn',          'skill'),
  ('web-design-guidelines','web-design-guidelines','Web Design','Boas práticas de UX.',                               'Melhorar onboarding e fluxos',          'https://skills.sh/search?q=web-design-guidelines', 'skill'),

  -- Imagem
  ('ai-image-generation','ai-image-generation','Imagem', 'Imagens prontas para conteúdo.',                            'Thumbnails e posts',                    'https://skills.sh/search?q=ai-image-generation', 'skill'),
  ('nano-banana-2',     'nano-banana-2',     'Imagem', 'Geração visual avançada.',                                    'Ads e branding',                        'https://skills.sh/search?q=nano-banana',   'skill'),

  -- Vídeo
  ('ai-video-generation','ai-video-generation','Vídeo', 'Vídeos prontos para publicação.',                            'Conteúdo curto e anúncios',             'https://skills.sh/search?q=ai-video-generation', 'skill'),

  -- Desenvolvimento
  ('brainstorming',     'brainstorming',     'Desenvolvimento', 'Geração estruturada de ideias.',                     'Ideias de produtos de IA',              'https://skills.sh/search?q=brainstorming', 'skill'),
  ('mcp-builder',       'mcp-builder',       'Desenvolvimento', 'Criação de agentes e MCPs.',                         'Agentes de suporte ou vendas',          'https://skills.sh/search?q=mcp-builder',   'skill'),
  ('webapp-testing',    'webapp-testing',    'Desenvolvimento', 'Testes de aplicações com relatório de bugs.',        'QA de MVP',                             'https://skills.sh/search?q=webapp-testing','skill'),
  ('supabase',          'supabase',          'Desenvolvimento', 'Backend e banco de dados.',                          'SaaS com autenticação',                 'https://skills.sh/search?q=supabase',      'skill'),
  ('stripe',            'stripe',            'Desenvolvimento', 'Implementação de pagamentos.',                       'Monetização de SaaS',                   'https://skills.sh/search?q=stripe',        'skill'),
  ('gstack',            'gstack',            'Desenvolvimento', 'Boas práticas do time da YC.',                       'Setup de startup técnica',              'https://skills.sh/search?q=gstack',        'skill'),

  -- Ferramentas
  ('pdf',               'pdf',               'Ferramentas', 'Geração e edição de PDFs.',                              'Ebooks e propostas',                    'https://github.com/anthropics/skills',     'skill'),
  ('pptx',              'pptx',              'Ferramentas', 'Criação de apresentações.',                              'Pitches e aulas',                       'https://github.com/anthropics/skills',     'skill'),
  ('docx',              'docx',              'Ferramentas', 'Criação de documentos.',                                 'Contratos e materiais',                 'https://github.com/anthropics/skills',     'skill'),

  -- Escrita
  ('copywriting',       'Copywriting',       'Escrita', 'Textos persuasivos.',                                        'Landing pages e anúncios',              'https://skills.sh/search?q=copywriting',   'skill'),
  ('content-strategy',  'Content Strategy',  'Escrita', 'Planejamento de conteúdo.',                                  'Conteúdo e funil',                      'https://skills.sh/search?q=content-strategy', 'skill'),

  -- Skills para áreas
  ('product-manager',   'Product Manager',   'Áreas', 'Marketplace de skills para PMs.',                              'Gestão de produto',                     'https://www.productcompass.pm',            'area'),
  ('marketing',         'Marketing',         'Áreas', 'Skills de marketing.',                                         'Times de marketing',                    'https://marketing-skills.com',             'area')
on conflict (slug) do nothing;
