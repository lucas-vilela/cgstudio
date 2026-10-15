# Skills Vault

Catálogo de skills para IA (curadoria da [NoCode StartUp](https://skills-nocode-startup.lovable.app/)), com busca e filtro por categoria.

**Stack:** Next.js 16 (App Router, Cache Components) · Supabase (Postgres + RLS) · shadcn/ui · Tailwind v4

## Setup

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o conteúdo de [`supabase/migrations/0001_skills.sql`](supabase/migrations/0001_skills.sql). Ele cria a tabela `skills`, habilita RLS com leitura pública e insere as 31 entradas.
3. Copie as credenciais (Project Settings → API):

   ```bash
   cp .env.example .env.local
   # preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

4. Rode:

   ```bash
   npm install
   npm run dev
   ```

## Estrutura

| Arquivo | Papel |
| --- | --- |
| `supabase/migrations/0001_skills.sql` | Schema, política RLS e seed |
| `src/lib/supabase.ts` | Client anônimo + tipo `Skill` |
| `src/lib/skills.ts` | `getSkills()` com `use cache` (perfil `hours`) |
| `src/components/skills-explorer.tsx` | Busca + abas de categoria (client) |
| `src/app/page.tsx` | Página principal (server) |

## Categorias mapeadas

Repositórios (4) · Gerais (5) · Automação (3) · Web Design (3) · Imagem (2) · Vídeo (1) · Desenvolvimento (6) · Ferramentas (3) · Escrita (2) · Áreas (2)

## Banco de testes (Supabase local)

Requer Docker (OrbStack) e a CLI do Supabase (`brew install supabase/tap/supabase`).

```bash
npm run db:start   # sobe o Supabase local (aplica migrations + supabase/seed.sql)
npm run db:reset   # recria o banco do zero com o seed
npm run test:e2e   # Playwright na porta 3100, sempre contra o banco local
npm run db:stop
```

Studio local: http://127.0.0.1:54323. Logins do seed (senha `senha-teste-123`):
`admin@cgstudio.test`, `ana@cgstudio.test` (em dia), `bruno@cgstudio.test` (inadimplente),
`carla@cgstudio.test` (pendente). Nos testes, use `test.use({ storageState: storageStatePath("admin") })`.

### Suíte de regressão (e2e/)

Projetos do Playwright (`npx playwright test --project=<nome>`):

| Projeto | Arquivos | O quê |
| --- | --- | --- |
| `desktop`, `mobile` | `*.spec.ts` | Fluxos de tela em 1280px e 375px, em paralelo |
| `api` | `*.api.spec.ts` | Rotas `/api/admin/*`, idempotência da fila, RLS e regras das RPCs |
| `serial` | `*.serial.spec.ts` | Conteúdo global da home (textos, planos, treinos), um teste por vez |

Cada teste confere três camadas: **UI**, **rede** (Server Actions, `GET /api/admin/snapshot`,
`POST /api/admin/acoes`, ver `e2e/support/rede.ts`) e **dados** (consulta direta ao banco local).

- O seed é só lido. Teste que grava cria os próprios dados com `fabrica` (`e2e/support/fabrica.ts`):
  nomes/e-mails com prefixo `E2E`/`e2e-`, horários entre 00:00 e 05:59. Tudo é apagado no fim
  do teste e, por garantia, no início da suíte.
- Logout revoga todas as sessões do usuário: teste de sair usa usuário criado na hora, nunca o do seed.
