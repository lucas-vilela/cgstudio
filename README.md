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
