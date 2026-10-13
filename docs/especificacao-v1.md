# CG Studio — Especificação da v1

Objetivo da fase: controlar cadastro e mensalidades da academia, com calendário de slots semanais.
Operação: dois admins com acesso total. Pagamento 100% manual (sem gateway).

## Escopo

1. Cadastro de alunos (já existe: migration `0002`).
2. Financeiro manual: pagamentos, vencimento, relatório.
3. Calendário de slots semanais com capacidade máxima.
4. Aula experimental para alunos pendentes.
5. Gestão de admins.

Fora da v1: gateway de pagamento, presença, avisos, captação pela landing.

## Planos

Por frequência semanal, cobrança mensal. Valores fictícios por enquanto:

| Plano | Vezes/semana | Valor padrão |
|---|---|---|
| 1x | 1 | R$ 75 |
| 2x | 2 | R$ 80 |
| 3x | 3 | R$ 100 |

O admin pode definir um valor acordado por aluno (`valor_acordado`), que sobrepõe o padrão.
A lista mensal/trimestral/semestral/anual em `src/app/dashboard/members.ts` (`PLANS`) deve ser substituída por essa.

## Modelo de dados (migration `0003`)

| Tabela | Conteúdo |
|---|---|
| `plans` | `id`, `nome`, `vezes_semana` (1–3), `valor_padrao` |
| `members` (altera) | `plan_id`, `valor_acordado` (opcional), `vencimento` (date) |
| `payments` | `member_id`, `valor`, `pago_em`, `forma` (pix, dinheiro, cartao), `observacao`, `registrado_por` |
| `slots` | `dia_semana`, `hora_inicio`, `hora_fim`, `capacidade`, `ativo` |
| `slot_members` | alocação fixa: `slot_id`, `member_id` (único por par) |
| `trial_bookings` | `member_id` (único: uma por pessoa), `slot_id`, `data` |

A coluna `plano` (texto livre) de `members` é substituída por `plan_id`.

## Regras (impostas no banco, não só na tela)

- **Pagamento:** o admin registra em `payments`. O vencimento **soma 1 mês de calendário ao vencimento atual** quando o aluno paga adiantado (dia inexistente cai no último dia do mês: 31/01 → 28/02); se o vencimento está nulo ou já passou, conta 1 mês a partir do `pago_em`. O aluno volta a `ativo` na hora.
- **Status automático:** job diário (`pg_cron`) passa para `inativo` quem está com `vencimento` vencido. O atraso nunca altera slots: o aluno inativo **mantém as vagas** e reativa ao pagar sem perder o lugar. Pendente nunca é alterado pelo job.
- **Entrar num slot (aluno):** função com bloqueio da linha do slot (sem corrida na última vaga). Exige `status = ativo`, vaga disponível e nº de slots do aluno menor que `vezes_semana` do plano. Entrada automática, sem aprovação. Sair é livre e libera a vaga na hora.
- **Aluno inativo:** não entra em slots novos (a regra exige `ativo`), mas continua nos atuais.
- **Experimental:** só `pendente`, uma por pessoa, em data futura, num slot. Ocupa vaga apenas naquele dia (soma com os alunos fixos para a capacidade). O aluno pode cancelar a própria experimental enquanto a data for futura (RPC `cancel_trial`); experimental já realizada não se repete.
- **Situação financeira** exibida (em dia / vence em breve / em atraso) é calculada a partir de `vencimento`.

## Permissões (RLS)

- Admin: tudo.
- Aluno: lê `slots`, as próprias alocações e a própria experimental; vê só `vencimento` e a situação dele. Não lê `payments`.
- Papéis: `user_roles` só muda por função de banco que confere se quem chama é admin. Travas: não rebaixar o último admin nem a si mesmo.
- O primeiro admin é promovido pelo SQL editor.

## Telas

**Aluno (`/dashboard`)**
- Calendário semanal com vagas restantes por slot, botões entrar/sair, contador "N de M slots usados".
- Vencimento e selo de situação (em dia / em atraso).
- Pendente: botão "agendar aula grátis" (escolhe slot e data).

**Admin**
- Alunos (`/dashboard/admin`): inclui plano, valor e botão "registrar pagamento".
- Calendário (`/dashboard/admin/calendario`): criar/editar slots e capacidade; ver e remover alunos de cada slot.
- Financeiro (`/dashboard/admin/financeiro`): entradas do mês, inadimplentes, histórico por aluno.
- Admins (`/dashboard/admin/admins`): lista, promover aluno a admin, rebaixar.
- **Ficha do aluno** (`/dashboard/admin/aluno?id=<id>`, migration `0013`): resumo, anamnese (perguntas da ficha em papel do studio) e medidas datadas, com alerta de saúde nas listas. Só admin lê e escreve. Design: `docs/superpowers/specs/2026-10-13-ficha-aluno-anamnese-design.md`.
- **Componente "Vencimentos próximos"** no painel: quem vence nos próximos 5 dias, do mais perto ao mais longe (nome, plano, data, dias restantes, atalho "registrar pagamento").

## Divisão entre os terminais

- `skills-vault-bb`: migration `0003`, funções (entrar/sair do slot, registrar pagamento, trocar papel), job `pg_cron`, RLS.
- `skills-vault-a3`: telas de admin (alunos, financeiro, admins, vencimentos próximos).
- `skills-vault-a6` e `skills-vault-0b`: calendário do aluno e calendário do admin.

## Pendências de dados

Preços reais, horários e capacidades dos slots, e a conferência dos nomes dos planos.
