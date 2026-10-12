# CG Studio — Plano de execução da v1

Base: `docs/especificacao-v1.md`. Este plano cobre o que falta para fechar a v1, a partir do estado do código em 2026-10-12.

## Estado atual

| Área | Situação |
|---|---|
| Landing, login Google, dashboard base | Pronto e commitado |
| Migration `0003` (financeiro, slots, admins, `cancel_trial`) | Escrita e commitada. **Não aplicada**: o projeto Supabase conectado não tem nenhuma migration registrada (`list_migrations` vazio) |
| Telas de admin (alunos, financeiro, calendário, admins) | Escritas, **sem commit** |
| Calendário do aluno e aula experimental | Escritos, **sem commit** |
| `tsc --noEmit` | Passa |
| `npm run lint` | Erros só em `.claude/skills/brainstorming/scripts/` (arquivos de skill, não do app) |
| Pendências de dados | Preços reais, horários e capacidades dos slots, nomes dos planos |

## Fase 0 — Confirmar o banco (bloqueia tudo)

1. Confirmar com o dono qual é o projeto Supabase da v1 e se o MCP aponta para ele. Se for o mesmo, `0002` e `0003` precisam ser aplicadas, em ordem.
2. Aplicar `0002`, depois `0003`. Conferir que `pg_cron` está habilitado.
3. Promover o primeiro admin pelo SQL editor.
4. Rodar `get_advisors` (security e performance). Corrigir tabelas sem RLS e funções `security definer` sem `search_path` fixo.

Pronto quando: `list_tables` mostra `plans`, `payments`, `slots`, `slot_members`, `trial_bookings` e o advisor de segurança está limpo.

## Fase 1 — Verificar as regras no banco

Testar por SQL (com `set role`/claims de aluno e de admin), antes de confiar na tela:

- Pagamento adiantado soma 30 dias ao vencimento atual; vencimento nulo ou vencido conta de `pago_em`; aluno volta a `ativo`.
- Job diário inativa vencidos, não mexe em `pendente` e não remove vagas.
- Entrar em slot: bloqueia na última vaga com duas chamadas concorrentes, exige `ativo` e respeita `vezes_semana`.
- Experimental: só `pendente`, uma por pessoa, data futura, soma com fixos na capacidade, `cancel_trial` só para data futura.
- RLS: aluno não lê `payments` nem dados de outro aluno; não rebaixa o último admin nem a si mesmo.

## Fase 2 — Integrar e validar as telas

1. Rodar o app e percorrer os fluxos reais com um admin e um aluno de teste (skills `webapp-testing`, `run`).
2. Aluno: ver calendário, entrar/sair de slot, contador "N de M", vencimento e selo; pendente agenda e cancela experimental.
3. Admin: cadastrar aluno com plano e valor acordado, registrar pagamento, "Vencimentos próximos" (5 dias), financeiro do mês e inadimplentes, criar/editar slots, gerir admins.
4. Conferir que `PLANS` em `members.ts` foi substituído pelos planos 1x/2x/3x vindos da tabela `plans`.
5. Revisar UI com `web-design-guidelines` e contra `docs/direcao-design.md`; checar mobile (admin e aluno usam no celular).
6. Corrigir erros de lint do projeto: excluir `.claude/` e `.agents/` do ESLint (`eslint.config.mjs`).

## Fase 3 — Fechar e publicar

1. `npm run build` limpo.
2. Commits em partes: banco/actions, telas de admin, calendário do aluno, componentes `ui/`.
3. Dados reais: preços, horários, capacidades dos slots, nomes dos planos (decisão do dono).
4. Deploy e variáveis de ambiente de produção; URL de callback do Google OAuth no Supabase.
5. Smoke test em produção com os dois admins.

## Divisão entre terminais

| Terminal | Responsável por | Skills |
|---|---|---|
| `skills-vault-bb` | Fases 0 e 1 (aplicar migrations, testes de regra, RLS) | `supabase`, `supabase-postgres-best-practices` |
| `skills-vault-a3` | Fase 2: telas de admin | `shadcn`, `frontend-design`, `vercel-react-best-practices` |
| `skills-vault-a6` / `skills-vault-0b` | Fase 2: calendário do aluno / calendário do admin | idem |
| `cgstudio-bc` | QA ponta a ponta e revisão de UI | `webapp-testing`, `web-design-guidelines`, `systematic-debugging` |
| Todos | Antes de dar uma tarefa como pronta | `verification-before-completion` |

Fase 2 só começa depois da Fase 0.

## Fora da v1

Gateway de pagamento, presença, avisos, captação pela landing.

## Decisões em aberto (do dono)

1. Qual projeto Supabase é o da v1 (a Fase 0 depende disso).
2. Preços, horários e capacidades reais.
3. Quem são os dois admins (e-mails Google).
