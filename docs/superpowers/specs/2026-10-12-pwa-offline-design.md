# PWA com modo offline do admin, backup em planilha e toasts — design

Data: 2026-10-12. Projeto: CG Studio (Next.js 16 com `cacheComponents`, Supabase, painel do admin em `/dashboard/admin`).

## Intenção

A recepção do studio não pode parar quando a internet cai. O painel do admin deve virar um app instalável que continua abrindo, mostrando os dados e aceitando os registros do dia a dia sem conexão, e que envia tudo sozinho quando a internet volta. O admin também quer exportar os dados para uma planilha do Excel, e o sistema passa a usar toasts (shadcn) para avisos.

## Quem usa

Só admins. Na prática, 1 admin; no máximo 2, em aparelhos diferentes (computador da recepção e/ou celular). Alunos continuam usando o site normal, sem modo offline.

## Objetivos

1. **PWA instalável** (manifest, ícones, service worker), abrindo direto no painel do admin.
2. **Consulta offline** com os últimos dados baixados: Alunos (lista, resumo, vencimentos), Financeiro, Calendário (horários e alunos de cada um).
3. **Registro offline**, enviado automaticamente quando a conexão volta:
   - **registrar pagamento** (prioridade: deve ser o fluxo mais sólido);
   - cadastrar aluno;
   - editar aluno (plano, valor acordado, status, treinos; nome/telefone/e-mail de quem não tem login);
   - colocar e tirar aluno de horário.
4. **Fila de envio visível**: o admin vê quantos registros esperam envio, o que foi enviado e o que falhou (com o motivo).
5. **Backup em planilha `.xlsx`** (abre no Excel), um clique, com uma aba por tipo de dado. Funciona também offline, com os dados locais.
6. **Toasts do shadcn** para avisos do sistema: sem conexão / conexão de volta, sincronizando, "N registros enviados", falhas de sincronização, e confirmações de ações.

## Fora do escopo

- Offline para alunos.
- Offline para: tudo da aba Conteúdo (planos, treinos, depoimentos, textos), criar/editar/ativar horários, promover/rebaixar admin, excluir aluno. Sem conexão essas ações ficam desabilitadas com o aviso "precisa de conexão".
- Restaurar o sistema a partir da planilha (o backup é para consulta e conferência).
- Login offline pela primeira vez: o aparelho precisa ter entrado online ao menos uma vez.
- Notificações push.

## Anti-objetivos (falha mesmo que "funcione")

- **Pagamento duplicado** por reenvio (internet oscilando, duas tentativas, app reaberto). Cada registro offline precisa chegar ao banco no máximo uma vez.
- **Registro perdido em silêncio**: fechou o app, a bateria acabou ou a sincronização falhou e ninguém ficou sabendo.
- O app mostrar dado offline como se fosse atual, sem indicar que está desatualizado e desde quando.
- Burlar as regras do servidor pelo caminho offline (telefone único, permissão de admin, regras do aluno). O servidor continua sendo quem decide; offline é só uma fila. (Vaga e limite do plano não se aplicam ao admin, por decisão do dono.)
- Dados pessoais dos alunos ficarem no aparelho depois do logout.

## Decisões do dono

- Ao colocar aluno em horário, o admin pode tudo: acima da capacidade, acima do limite do plano e com aluno pendente/inativo.

- Offline só para admins.
- Ações offline: registrar pagamento (prioridade), cadastrar aluno, editar aluno, colocar/tirar de horário. O resto fica fora.
- Backup = planilha compatível com Excel.
- Toasts do shadcn.
- 2 admins no máximo, normalmente 1.

## Comportamento

### Sincronização
- Cada ação offline entra numa fila local, na ordem em que foi feita, e é reenviada nessa ordem quando a conexão volta (e também ao abrir o app online).
- O servidor valida tudo de novo no envio. Se uma ação falhar por regra (ex.: horário lotou, telefone já usado por outro cadastro, aluno não ativo), ela vai para **"Pendências com erro"** com o motivo em português; o admin corrige e reenvia, ou descarta. Ações seguintes que dependem dela (ex.: pagamento de um aluno cujo cadastro falhou) ficam paradas junto e são explicadas.
- Conflito de edição entre 2 admins: cada edição offline guarda **só os campos que o admin mudou** e envia só eles. Assim uma edição feita com dados antigos não desfaz mudanças de outros campos (ex.: status trocado pelo job diário ou pelo outro admin). No mesmo campo, vale a última a chegar ao servidor (raro com 1–2 admins).
- Depois de sincronizar, os dados locais são atualizados a partir do servidor.

### Pagamento offline
- A data do pagamento é a do registro no aparelho (não a do envio). O vencimento é calculado pelo servidor no envio, com a mesma regra de hoje.
- Enquanto não sincroniza, a tela mostra o pagamento como "aguardando envio" e não promete o novo vencimento.

### Aluno cadastrado offline
- Aparece nas listas como "aguardando envio" e pode receber pagamento e horário na mesma sessão offline; essas ações seguem a fila depois do cadastro.

### Colocar aluno em horário pelo admin (novo, online e offline)
- Hoje só o próprio aluno logado entra em horário; o admin só tira. Passa a existir, no Calendário (diálogo "Alunos" de cada horário), um "Adicionar aluno" com busca por nome ou telefone.
- **O admin pode tudo:** passar da capacidade, passar do limite de horários do plano e colocar aluno `pendente` ou `inativo`. A tela avisa (sem bloquear) quando o horário fica acima da capacidade ou o aluno acima do limite do plano.
- No banco, uma RPC de admin própria (não `join_slot`, que é do aluno), restrita a `is_admin()`. O aluno continua com as regras de hoje.

### Indicadores
- Selo fixo no painel: online/offline, "N aguardando envio", e "dados de <data/hora>" quando offline.

### Backup em planilha
- Abas: Alunos (nome, telefone, e-mail, plano, valor, status, vencimento, treinos, com/sem login), Pagamentos (data, aluno, valor, forma, observação), Horários (dia, início, fim, capacidade, alunos), Planos.
- Nome do arquivo com a data (ex.: `cgstudio-backup-2026-10-12.xlsx`).
- Se houver registros ainda não enviados, a planilha avisa (ex.: uma aba "Aguardando envio" ou uma linha de aviso).

### Toasts
- Componente de toasts do shadcn (Sonner) no layout.
- Usar para: mudança de conexão, início/fim de sincronização, falhas de sincronização (com ação "ver pendências") e confirmações de ações que hoje mostram "Salvo." em texto.
- Erros de validação de formulário continuam junto do campo (não viram toast).

## Restrições

- Ler antes `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` e `offline-support.md` (regra do `AGENTS.md`). O `experimental.useOffline` do Next só segura requisições que caem no meio; **não resolve abrir o app sem internet**, então as telas do admin precisam conseguir renderizar a partir de dados locais.
- As telas do admin hoje são Server Components que buscam no Supabase com cookie. Para funcionar offline, elas precisam de um caminho que leia de um armazenamento local no aparelho (IndexedDB ou equivalente).
- O servidor (RLS, RPCs `register_payment`, `join_slot`/admin, triggers) continua a fonte da verdade. Nada de afrouxar regras para o offline.
- Idempotência no banco: cada registro offline leva um id gerado no aparelho; o banco recusa o mesmo id duas vezes (ex.: coluna única em `payments`, e id do aluno gerado no cliente, já que `members.id` é uuid).
- Sessão do Supabase: o token expira; ao voltar online, renovar a sessão antes de enviar a fila. Se a sessão não puder ser renovada, a fila fica guardada e o app pede login; nada se perde.
- Logout limpa os dados locais e a fila só depois de avisar se houver itens não enviados.
- Dados locais e fila ficam **presos ao usuário** que os criou. Se a sessão expirar e outra pessoa entrar no mesmo aparelho, ela não vê nem envia nada disso; a fila só é enviada quando o mesmo admin entrar de novo (o app avisa que há registros de outro usuário guardados). Se quem entrar não for admin, o app não mostra nenhum dado de admin.
- Interface em português, mobile-first, mesmo visual do painel.
- Migrations novas em sequência (próxima: `0011`).

## Decisões minhas (para o dono conferir)

- Conflito de edição: última a chegar vence.
- Ação que falha na sincronização vai para "Pendências com erro"; nada é descartado sem o admin decidir.
- Data do pagamento = momento do registro no aparelho.
- Abas da planilha conforme acima.
- O app instalável é do painel do admin: `start_url` e escopo do service worker em `/dashboard/admin`, e o convite de instalação só aparece para admins. Páginas públicas e do aluno não entram no cache offline.
- Edição offline envia só os campos alterados.
- Fila e dados locais presos ao usuário que os criou.
- Logout com itens não enviados: avisa e pede confirmação antes de apagar.

## Deixado ao construtor

- Biblioteca de service worker / estratégia de cache, e de armazenamento local.
- Biblioteca para gerar o `.xlsx` no navegador.
- Como reorganizar as telas do admin para ler dados locais (ex.: dados carregados num store do cliente, sincronizados com o servidor).
- Formato da fila e política de novas tentativas.
- Ícones do PWA a partir da marca em `public/brand/`.
- Plano de testes (incluindo offline no navegador, reenvio duplicado e sessão expirada).
