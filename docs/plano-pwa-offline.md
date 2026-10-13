# CG Studio — Plano de execução: PWA offline do admin, backup e toasts

Base: `docs/superpowers/specs/2026-10-12-pwa-offline-design.md`. Estado do código em 2026-10-12 (`a06416f`).

## Arquitetura escolhida

- **Local-first nas telas offline do admin** (Alunos, Financeiro, Calendário). Cada tela vira um componente de cliente que lê um *store* local (IndexedDB), não mais o Supabase direto. Online, o store é atualizado por `GET /api/admin/snapshot`. Offline, usa o último snapshot salvo.
- **Fila de ações** no IndexedDB. Toda escrita offline-capaz (pagamento, cadastrar/editar aluno, pôr/tirar de horário) vira um item `{ id (uuid do aparelho), tipo, payload, criado_em, status }`. A fila é aplicada por cima do snapshot para a tela já mostrar o efeito ("aguardando envio").
- **Envio** por `POST /api/admin/acoes`, um item por vez, na ordem. É uma rota estável, e não Server Action, porque o id de Server Action muda a cada deploy e um app instalado pode estar com JS antigo. O servidor revalida tudo.
- **Idempotência:**
  - pagamento: `payments.client_id` único, e `register_payment` devolve o resultado existente se o id já foi gravado;
  - aluno novo: `members.id` gerado no aparelho;
  - horário: insert com "on conflict do nothing";
  - edição: só os campos alterados.
  - anamnese (`anamnese_salvar`, 0013): upsert por `member_id` só com os campos alterados;
  - medidas (`avaliacao_salvar`, 0013): `member_avaliacoes.id` gerado no aparelho, upsert pelo id.
- **Navegação offline entre Alunos, Financeiro, Calendário e a ficha do aluno** (`/dashboard/admin/aluno?id=`) sem buscar no servidor: essas rotas renderizam o mesmo `AdminApp` de cliente (lista em `src/lib/offline/secoes.ts`). A troca de aba usa `window.history.pushState`, que o Next sincroniza com `usePathname`. Conteúdo e Admins seguem como hoje (online).
- **Service worker** próprio (`public/sw.js`, escopo `/dashboard/admin`):
  - navegação: network-first com fallback ao HTML em cache;
  - `/_next/static`: cache-first;
  - nada de cache de API.
- **Store preso ao usuário:** chave do IndexedDB inclui o `user.id`. Logout pergunta se houver fila e limpa.

## Fases

### Fase 1 — Toasts (independente)
- `npx shadcn add sonner`; `<Toaster />` no layout raiz, tema escuro.
- Trocar os "Salvo." / "Textos salvos." e afins por `toast.success`. Erros de formulário continuam no campo.
- Pronto quando: tsc/lint/build limpos; toasts aparecem nas ações da aba Conteúdo e em Meus dados.

### Fase 2 — Banco (migration 0011)
- `payments.client_id uuid unique` (nulo para pagamentos antigos).
- `register_payment` aceita `p_client_id`; se já existe pagamento com esse id, devolve o vencimento atual sem gravar de novo.
- Pronto quando: aplicada, advisors limpos.

### Fase 3 — API do admin
- `GET /api/admin/snapshot`: com admin autenticado, devolve alunos, planos, treinos, horários com alunos, pagamentos dos últimos 24 meses, inadimplentes, vencimentos próximos, resumo e `gerado_em`.
- `POST /api/admin/acoes`: recebe um item da fila; executa e devolve `{ ok }`, `{ erro: "regra", mensagem }` (vai para pendências) ou `{ erro: "temporario" }` (tenta de novo).
  - Tipos: `pagamento`, `aluno_criar`, `aluno_editar`, `horario_entrar`, `horario_sair`.
- Admin no horário: insert direto em `slot_members` (a RLS de admin já permite). Sem checar vaga nem limite do plano, conforme o dono decidiu.
- Pronto quando: as rotas respondem 401/403 para quem não é admin e são idempotentes ao repetir o mesmo id.

### Fase 4 — Store local + fila + sync (cliente)
- `src/lib/offline/`: IndexedDB (lib `idb`), store com `useSyncExternalStore`, fila, motor de sync.
  - O motor é disparado por: evento `online`, abrir o app, foco da janela e intervalo enquanto houver fila.
- Sobreposição da fila no snapshot (aluno novo, pagamento pendente, horário pendente).
- Toasts de conexão e sincronização. Selo fixo: online/offline, "N aguardando envio" e "dados de <hora>".
- Tela "Pendências com erro": ver motivo, corrigir (reabrir o formulário) ou descartar.

### Fase 5 — Telas do admin sobre o store
- `AdminApp` de cliente com as seções Alunos, Financeiro e Calendário, que reaproveitam os componentes atuais. Busca e filtro de mês passam a ser locais.
- As ações dessas telas passam a enfileirar em vez de chamar a Server Action. Pagamento, cadastrar, editar e pôr/tirar de horário enfileiram. Excluir aluno e o resto pedem conexão.
- No Calendário: "Adicionar aluno" no diálogo do horário (busca por nome ou telefone), com aviso de capacidade e de limite do plano, sem bloquear.

### Fase 6 — PWA
- `app/manifest.ts` (nome, cores, ícones a partir de `public/brand`), `start_url` e escopo `/dashboard/admin`.
- `public/sw.js` com os cabeçalhos de segurança do guia, e registro só nas páginas de admin.
- Convite de instalação só para admins.

### Fase 7 — Backup em planilha
- Botão "Exportar planilha" no admin. Gera `.xlsx` no navegador a partir do store (lib `write-excel-file`), funciona offline.
- Abas: Alunos, Pagamentos, Horários, Planos, mais "Aguardando envio" se houver fila.

### Fase 8 — Revisão e testes
- `/code-review` e correções.
- Testes no navegador:
  - offline (DevTools) cobrindo pagamento, aluno novo com pagamento e horário na mesma sessão, edição e pôr/tirar de horário;
  - volta online, conferindo envio único, sem duplicar;
  - falha por regra (telefone repetido) indo para pendências;
  - planilha;
  - instalação.
- Limpar dados de teste, commit e push (com confirmação do dono).
