# Ficha do aluno com anamnese — plano de implementação

> **Desvios na implementação (2026-10-13):** a rota é `/dashboard/admin/aluno?id=<id>` (página
> estática; `/alunos/[id]` quebrava o build com `cacheComponents` porque `usePathname()` no menu e no
> app suspende com parâmetro dinâmico, e a query já dá uma cópia só no service worker, que ficou sem
> mudança). O id e a aba são lidos com `useQuery()` (`secoes.ts`), atualizado por `popstate` e pelo
> evento `cg:navegou`. Saída com alterações não salvas: rascunho em memória (`rascunhos.ts`) em vez
> de diálogo de confirmação.

Design: `docs/superpowers/specs/2026-10-13-ficha-aluno-anamnese-design.md` (ler antes; as Open
questions de lá podem mudar a Fase 1).

O projeto não tem test runner. Verificação de cada fase: `npm run lint`, `npm run build`, SQL de
checagem no Supabase (MCP `execute_sql`) e roteiro manual no navegador (skill `webapp-testing` ou
Chrome), incluindo offline pelo DevTools.

## Visão geral da arquitetura

A ficha **não** é uma página de servidor nova com dados próprios. Ela é mais uma "seção" do app de
cliente que já serve Alunos/Financeiro/Calendário (`AdminApp`), lendo do mesmo snapshot do
IndexedDB e gravando pela mesma fila. Isso dá offline de graça e mantém um único caminho de dados.

```
/dashboard/admin/alunos/[id]/page.tsx  ──►  <Guarda/> + <AdminApp/>   (mesma casca de page.tsx)
AdminApp: pathname /dashboard/admin/alunos/<id>  ──►  <FichaAluno visao memberId/>
snapshot  += anamneses[]                            (GET /api/admin/snapshot)
snapshot  += avaliacoes[]
fila      += { tipo: "anamnese_salvar",  payload: { member_id, campos } }
          += { tipo: "avaliacao_salvar", payload: { avaliacao_id, member_id, data, medidas } }
servidor  : operacoes.ts › anamneseSalvar  → upsert parcial em member_anamneses
                         › avaliacaoSalvar → upsert por id em member_avaliacoes
```

## Fase 1 — Banco (`supabase/migrations/0013_anamnese.sql`)

Ler antes: skill `supabase-postgres-best-practices` (`schema-data-types`, `schema-constraints`,
`security-rls-basics`, `security-rls-performance`, `schema-foreign-key-indexes`).

### Tabela `public.member_anamneses` (1 linha por aluno, a versão atual)

| Coluna | Tipo | Notas |
|---|---|---|
| `member_id` | `uuid` PK, FK `members(id) on delete cascade` | PK já indexa a FK |
| `data_nascimento` | `date` | check `>= '1900-01-01'`; "não futura" no trigger (ver abaixo) |
| `endereco` | `text` | `<= 300` |
| `doenca_cronica` | `boolean` (nulo = sem resposta) | |
| `doenca_cronica_quais` | `text` | `<= 1000` |
| `medicacao_continua` | `boolean` | |
| `medicacao_quais` | `text` | `<= 1000` |
| `restricao_medica` | `boolean` | |
| `restricao_detalhe` | `text` | `<= 1000` |
| `praticou_exercicio` | `boolean` | |
| `modalidades_anteriores` | `text` | `<= 500` |
| `tempo_pratica` | `text` | `<= 200` (texto livre, como na folha) |
| `objetivos` | `text` | `<= 2000` |
| `autoriza_imagem` | `boolean` | |
| `autoriza_imagem_data` | `date` | "não futura" no trigger |
| `consentimento_saude` | `boolean` | Open question 6 |
| `consentimento_saude_data` | `date` | "não futura" no trigger |
| `cuidados_treino` | `text` | `<= 2000` |
| `observacoes` | `text` | `<= 2000` |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | trigger |
| `updated_by` | `uuid` FK `auth.users(id) on delete set null` | trigger, `auth.uid()` |

Por que colunas e não `jsonb`: a fila envia só os campos alterados, e um `upsert` do PostgREST com
só essas colunas atualiza exatamente elas (sem merge de JSON no servidor); constraints do banco
validam cada campo; e dá para consultar ("quem toma medicação contínua") se um dia precisar. As
perguntas seguem a ficha em papel do studio (ver design), então mudar pergunta = migration nova.

### Trigger

`private.carimbo_admin()` (genérico, usado nas duas tabelas) `before insert or update`: `new.updated_at := now();
new.updated_by := (select auth.uid());` e, no update, `new.created_at := old.created_at;
new.member_id := old.member_id`; recusa datas no futuro (anamnese: `data_nascimento`, `autoriza_imagem_data`, `consentimento_saude_data`; avaliação: `data` — triggers ou funções separadas por tabela se o genérico ficar confuso) (`private.hoje()`, fuso de São Paulo) com `errcode 23514` — não em `check`, que não deve depender de `current_date`. `set search_path = ''`.

### RLS

```sql
alter table public.member_anamneses enable row level security;
revoke all on public.member_anamneses from anon;
grant select, insert, update, delete on public.member_anamneses to authenticated;
create policy "anamnese admin" on public.member_anamneses
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
```

Nenhuma política para o aluno (v1). Se a Open question 1 virar "sim", acrescentar
`select` do próprio via `members.auth_user_id = auth.uid()`.

### Tabela `public.member_avaliacoes` (medidas datadas)

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | **gerado no aparelho** (idempotente, como `members.id`) |
| `member_id` | `uuid not null` FK `members(id) on delete cascade` | índice `(member_id, data desc)` |
| `data` | `date not null` | "não futura" no trigger |
| `peso_kg` | `numeric(5,1)` | check `between 20 and 300` |
| `cintura_cm`, `quadril_cm`, `coxa_cm`, `peito_cm`, `braco_cm` | `numeric(5,1)` | check `between 10 and 250` |
| `observacao` | `text` | `<= 500` |
| `created_at`, `updated_at`, `updated_by` | como na anamnese | trigger de carimbo |

Check: pelo menos uma medida (`num_nonnulls(peso_kg, cintura_cm, quadril_cm, coxa_cm, peito_cm,
braco_cm) > 0`). RLS igual à da anamnese (só admin). Medidas não entram no alerta.

### Nome de quem atualizou

O snapshot precisa do nome do admin. View `public.member_anamneses_admin` (`security_invoker =
true`) = `member_anamneses a left join members m on m.auth_user_id = a.updated_by` expondo
`a.*, m.nome as updated_by_nome`. Ou resolver no servidor em `queries.ts` com uma segunda consulta
(o builder escolhe; a view é mais simples).

### `members.created_at` no snapshot

A Resumo mostra "Aluno desde", "Autoriza imagem: sim/não", última medida (peso + data) com link para a aba. `member_financeiro` não traz `created_at`: incluir na consulta
`members` que `getAdminMembers` já faz (`select id,valor_acordado,auth_user_id,created_at`) e
adicionar `desde: string` em `AdminMember`. Sem mudança de banco.

### Verificação da Fase 1

- Aplicar com MCP `apply_migration` (nome `0013_anamnese`) depois de conferir `list_tables`.
- `get_advisors` (security e performance) sem alertas novos.
- SQL: como admin, insert parcial + update de 1 coluna mantém as outras; como aluno (`set local
  role authenticated` + `request.jwt.claims` de um aluno), `select` retorna 0 linhas e `insert`
  falha; medida fora da faixa ou avaliação sem medida falha no check; data futura falha no trigger; excluir aluno sem login apaga a anamnese.
- Avaliação: upsert duas vezes com o mesmo `id` → uma linha.
- `generate_typescript_types` se o projeto usar (hoje os tipos são à mão em `types.ts`).

## Fase 2 — Tipos, snapshot e fila

1. **`src/lib/anamnese.ts`** (novo, cliente e servidor): tipo `Anamnese` (todas as colunas +
   `updated_by_nome`), `CamposAnamnese` (= `Partial` sem `member_id`, carimbos e
   `updated_by_nome`), os textos das perguntas da folha (`PERGUNTAS`, usados pelo formulário e pela
   planilha), limites de tamanho, `validarCamposAnamnese(c)` (formato, limites, datas),
   `motivosAlerta(a): string[]` (regra fechada do design) e `idade(dataNascimento, hoje)`. Tipo
   `Avaliacao`, `MEDIDAS` (chave, rótulo, unidade, faixa) e `validarAvaliacao`.
2. **`src/lib/offline/tipos.ts`**: `AdminSnapshot.anamneses: Anamnese[]` e
   `AdminSnapshot.avaliacoes: Avaliacao[]`; novas variantes de `AcaoFila`:
   `{ tipo: "anamnese_salvar"; payload: { member_id; campos: CamposAnamnese } }` e
   `{ tipo: "avaliacao_salvar"; payload: { avaliacao_id; member_id; data; peso_kg…braco_cm;
   observacao } }`. Criar e corrigir avaliação são a mesma ação (upsert pelo `avaliacao_id`);
   corrigir uma avaliação que ainda está na fila substitui o item (`corrigir()`), não enfileira outro.
3. **`queries.ts`**: `getAnamneses()` e `getAvaliacoes()` com `todasAsPaginas` (mesmo padrão).
4. **`/api/admin/snapshot`**: incluir `anamneses` e `avaliacoes` no `Promise.all`.
5. **`/api/admin/acoes`**: adicionar `"anamnese_salvar"` e `"avaliacao_salvar"` em `TIPOS`.
6. **`operacoes.ts`**: `anamneseSalvar(sb, p)`: valida UUID e `validarCamposAnamnese`; se não sobrar
   campo, `OK`; senão `sb.from("member_anamneses").upsert({ member_id, ...campos },
   { onConflict: "member_id" })`. Upsert com as mesmas colunas é idempotente (reenvio = mesmo
   resultado). FK violada (`23503`, aluno excluído) → `regra("Aluno não encontrado.")` (ver
   `friendlyError` em `errors.ts`; acrescentar o caso). `avaliacaoSalvar(sb, p)`: valida e faz
   `upsert({ id: avaliacao_id, ... }, { onConflict: "id" })`. Ligar os dois no `switch` de
   `executarAcao`.
7. **`visao.ts`**: `Visao.anamneses: Map<string, Anamnese & Marca>` e
   `Visao.avaliacoes: Map<string, (Avaliacao & Marca)[]>` (por aluno, data desc); partir de
   `snapshot.anamneses ?? []` / `snapshot.avaliacoes ?? []` (snapshot antigo no aparelho não tem os
   campos) e aplicar os itens da fila por cima (merge dos `campos`; avaliação substitui pelo id).
8. **`descricao.ts`**: descrição dos itens para Pendências ("Anamnese de Fulana", "Medidas de
   Fulana em 13/10").
9. **`store.ts`**: nada muda — `membroDe` já encontra `payload.member_id`, então anamnese de aluno
   cujo cadastro falhou fica bloqueada junto, como pagamento e horário.

Atenção a deploy: app instalado com JS antigo não manda as ações novas, e JS novo com snapshot
antigo no IndexedDB precisa do `?? []`. Não há passo a mais.

### Verificação da Fase 2

`npm run lint && npm run build`. No navegador, `fetch('/api/admin/snapshot')` traz `anamneses`.
POST manual em `/api/admin/acoes` com o mesmo `id` duas vezes → uma linha, mesmos valores (as duas
ações).

## Fase 3 — Rota e navegação

Ler antes: `node_modules/next/dist/docs/01-app/` sobre rotas dinâmicas com `cacheComponents`
(`params` é Promise; ver se a página precisa de `generateStaticParams` ou Suspense quando **não**
lê `params`) e `02-guides/progressive-web-apps.md`.

1. **`src/app/dashboard/admin/alunos/[id]/page.tsx`**: igual a `admin/page.tsx` (Suspense com
   `<Guarda/>` + `<AdminApp/>`). Não lê `params`: o app pega o id do endereço. Extrair a `Guarda`
   para um arquivo compartilhado em vez de copiar.
2. **`src/lib/offline/secoes.ts`**: trocar o `Set` por `ehSecaoOffline(path)` que aceita os três
   caminhos de hoje **e** `/^\/dashboard\/admin\/alunos\/[^/]+$/`; e `fichaId(path)`. Atualizar
   `admin-nav.tsx` (`navegar`) para usar a função.
3. **`admin-app.tsx`**: novo ramo `fichaId(pathname)` → `<FichaAluno visao memberId />`.
   **Ponto a testar primeiro**: offline, abrindo direto uma ficha nunca visitada, o service worker
   entrega a casca de `/dashboard/admin`. No Next 16.4 instalado, o estado inicial do roteador usa
   `location.href` como `canonicalUrl` (`create-initial-router-state.js`), então `usePathname()`
   deve devolver o endereço real. O risco que sobra: o roteador associar o caminho da ficha à árvore
   RSC de `/dashboard/admin` (`discoverKnownRoute`) e navegações/prefetch seguintes se confundirem.
   Testar: abrir ficha offline por carga completa → navegar para Financeiro e voltar → reconectar e
   navegar de novo.
4. **`admin-nav.tsx`**: aba "Alunos" ativa também em `/dashboard/admin/alunos/*`.
5. **`src/components/dashboard/admin/link-aluno.tsx`** (novo): `<LinkAluno id nome/>` que navega
   com `pushState` dentro do app (mesma regra do `navegar`) e cai em `<a href>` normal com
   modificadores (abrir em nova aba). Usar em: `members-table.tsx` (nome), `vencimentos-proximos`,
   `inadimplentes-table`, `pagamentos-table`, `slots-board` (lista do horário),
   `financeiro-secao`. Aluno da fila (pendente) também linka.
6. **`public/sw.js`**: já cobre `/dashboard/admin/*`, mas a chave do cache é por endereço: cada
   ficha aberta por carga completa guardaria uma cópia do HTML, sem limite. Normalizar
   `/dashboard/admin/alunos/*` para uma chave só (`/dashboard/admin/alunos/_ficha`) e subir `VERSAO`
   para `v2`.

### Verificação da Fase 3

Online: clicar no nome → ficha, voltar do navegador → lista com a busca. Offline (DevTools): mesma
coisa; e recarregar a página numa ficha nunca aberta → ficha aparece.

## Fase 4 — Ficha (UI)

Ler antes: skills `frontend-design`, `shadcn` (o projeto usa `@base-ui/react`, ver
`rules/base-vs-radix.md`) e `docs/direcao-design.md`. Adicionar via CLI do shadcn o que faltar
(provável: `checkbox`, `radio-group` ou `toggle-group`, `popover`).

Arquivos em `src/components/dashboard/admin/ficha/`:

- **`ficha-aluno.tsx`**: acha o aluno em `visao.members`; não achou → "Aluno não encontrado" +
  link. Cabeçalho (nome, `Tag` de status, marca de fila, `SeloAlerta`, telefone com `wa.me`,
  e-mail), botões "Editar cadastro" (reusa `MemberForm` num `Dialog`, já exportado de
  `members-table.tsx`) e "Registrar pagamento" (`RegisterPaymentButton`). `Tabs` Resumo/Anamnese/Medidas;
  aba guardada no `?aba=anamnese` (com `replaceState`) para o voltar funcionar.
- **`resumo.tsx`**: plano/valor/vencimento (reusar `VencimentoCell` → extrair de
  `members-table.tsx`), horários do aluno (filtrar `visao.slots` por `alunos[].member_id`), treinos
  (`snapshot.treinos`), cuidados no treino em destaque, últimos 6 de `visao.pagamentos` do aluno,
  "Aluno desde", "Autoriza imagem: sim/não", última medida (peso + data) com link para a aba.
- **`selo-alerta.tsx`**: usa `motivosAlerta`; ícone + "Atenção à saúde"; `Popover` com os motivos.
  Versão só-ícone (com `aria-label` listando motivos) para a tabela e o calendário.
- **`anamnese-form.tsx`**: estado local inicializado da anamnese atual (`visao.anamneses`);
  `alterados()` compara campo a campo com o inicial (arrays por conteúdo); salvar →
  `validarCamposAnamnese` → `enfileirar({ tipo: "anamnese_salvar", ... })` → toast `msgGuardado`;
  depois do salvar, o novo "inicial" é o que foi salvo. Blocos como `fieldset` com `legend`.
  Blocos na ordem da folha. Campos condicionais: cada "Se sim, qual(is)?"/"Detalhar" só com Sim;
  datas de autorização/consentimento só com Sim (limpar o dependente ao desmarcar). **Pares sempre
  juntos em `campos`** (Sim/Não + texto, autorização + data, consentimento + data). Sim/Não/— como
  grupo segmentado com alvo ≥ 44px. Botão "Salvar anamnese" fixo no rodapé no celular quando
  `alterados()` não está vazio.
- **Apagar anamnese** (só online): Server Action `apagarAnamnese(memberId)` em `actions.ts`
  (mesmo padrão de `deleteMemberSemLogin`: `requireAdmin` + `delete` com RLS), botão desabilitado
  offline com "precisa de conexão", confirmação em dois cliques, depois `atualizar()`. Se houver item
  `anamnese_salvar` do mesmo aluno na fila, avisar e descartar esses itens antes de apagar (senão a
  fila recria a linha). Sim/Não/— como grupo segmentado
  com alvo ≥ 44px. Botão "Salvar anamnese" fixo no rodapé no celular quando `alterados()` não está
  vazio.
- **`medidas.tsx`**: última avaliação em destaque com a diferença para a primeira (por medida,
  só quando as duas têm valor), lista de todas (tabela no desktop, cartões no celular), botão "Nova
  avaliação" → diálogo (data padrão hoje em São Paulo, 6 campos com `inputMode="decimal"` aceitando
  vírgula, observação) → `enfileirar({ tipo: "avaliacao_salvar", payload: { avaliacao_id:
  novoId(), ... } })`. Tocar numa avaliação abre o mesmo diálogo para corrigir (mesmo id). Excluir
  avaliação: só online (Server Action `excluirAvaliacao`, confirmação em dois cliques).
- **Alterações não salvas**: `beforeunload` enquanto sujo; trocar de aba da ficha e sair pelo
  `LinkAluno`/`AdminNav`/voltar pede confirmação. Para o `AdminNav` e o voltar, um pequeno registro
  global "há alterações não salvas" em `src/lib/offline/sujo.ts` consultado pelo `navegar`; o
  `popstate` não é cancelável — ao voltar com o form sujo, `pushState` de volta para a ficha e
  perguntar (diálogo próprio, não `confirm()`).
- **`members-table.tsx`** e **`slots-board.tsx`**: ícone de alerta ao lado do nome.

### Verificação da Fase 4

Roteiro manual em 375px e desktop: passar a folha em PDF do studio para o sistema (todas as
perguntas têm lugar); preencher parcialmente e salvar; reabrir e ver os dados; mudar 1
campo e confirmar no Supabase que só ele mudou (`updated_at` novo); dois navegadores (2 admins)
editando campos diferentes offline → ambos ficam; sair com form sujo → aviso; alerta acende por
cada motivo da regra e some quando limpa; avaliação nova offline → reconectar → chega uma vez;
corrigir avaliação; diferença para a primeira certa; aluno cadastrado offline → anamnese → reconectar → cadastro
e anamnese chegam nessa ordem; aluno sem login excluído com anamnese na fila → vai para Pendências
com "Aluno não encontrado". `web-design-guidelines` na ficha.

Listas de múltipla escolha: upsert do array inteiro ("última vence", decisão registrada no design).

## Fase 5 — Backup e acabamento

1. **`backup.ts`**: aba "Anamnese" (Nome + as perguntas da folha com `PERGUNTAS` como cabeçalho,
   Cuidados no treino, Atualizada em) e aba "Medidas" (Nome, Data, 6 medidas) — Open question 3.
2. **Logout**: nada novo (o snapshot inteiro já é apagado).
3. Atualizar `docs/especificacao-v1.md` (telas do admin) e `docs/plano-pwa-offline.md` (nova ação
   offline e nova seção).

### Verificação final

Skill `verification-before-completion`: `npm run lint`, `npm run build`, advisors do Supabase,
roteiro manual completo online e offline. Commits por fase.

## Ordem e tamanho

| Fase | Depende de | Tamanho |
|---|---|---|
| 1 Banco | Open questions 1, 4 | pequeno |
| 2 Tipos/snapshot/fila | 1 | médio |
| 3 Rota/navegação | 2 | pequeno (o risco do SW é o ponto de atenção) |
| 4 UI da ficha | 2, 3 | grande (o formulário) |
| 5 Backup/docs | 4, Open question 3 | pequeno |

As Fases 2 e 3 podem andar em paralelo depois da 1.
