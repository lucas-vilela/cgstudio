# CMS da home — design

Data: 2026-10-12. Projeto: CG Studio (Next.js + Supabase, painel do admin já existente).

## Intenção

Hoje, mudar qualquer coisa na home exige mexer no código: preço de plano, lista de treinos, WhatsApp, frases do topo. Os horários já saem do banco (migration 0005). O objetivo é que o admin do studio edite o conteúdo da home por dentro do painel, sem tocar em código, e que alunos possam enviar depoimentos que o admin aprova antes de aparecerem.

Há também um problema de duplicação: os planos da home (1x, 2x, 3x e valores) são digitados à mão em `src/components/landing/plans.tsx`, enquanto a tabela `plans` do banco (mesmos nomes e valores) é o que o financeiro usa para cobrar. Os dois devem virar uma fonte só.

## Objetivos

1. **Planos unificados:** a home lê da tabela `plans`. Mudar o valor padrão do plano muda a home e a cobrança ao mesmo tempo.
2. **Tipos de treino editáveis:** lista de treinos da home (hoje a seção "Modalidades") com nome, descrição curta e ícone, que o admin cria, edita, reordena e esconde.
3. **Depoimentos com aprovação:**
   - o aluno cadastrado envia o próprio depoimento pelo painel dele;
   - o admin aprova, recusa, edita o texto ou esconde;
   - a home mostra só os aprovados, em **grade de cartões** (3 por linha no desktop, no mesmo estilo visual dos cartões de Modalidades e Planos: fundo `surface`, borda, cantos grandes), cada um com o texto, o nome do aluno e um avatar com a inicial.
4. **Textos da home editáveis:** WhatsApp, Instagram, título e subtítulo do topo, textos de apoio das seções e a descrição que aparece no Google.
5. **Tudo no painel do admin**, numa aba nova "Conteúdo" ao lado de Alunos, Financeiro, Calendário e Admins. Só admin edita.
6. Ao salvar, a home reflete a mudança em segundos (mesmo mecanismo dos horários: cache com tag, invalidada pela ação do admin).

## Fora do escopo

- Editor de texto rico (negrito, links, markdown) e upload de imagens/fotos.
- Rascunho, histórico de versões e agendamento de publicação.
- Mudar a estrutura da página: ordem ou existência das seções. Só o conteúdo delas.
- Editar horários (já existe em Calendário).
- Criar ou excluir planos: cada plano amarra limite de vagas por semana (`vezes_semana`) e cobrança. Nesta rodada só se **edita** os três existentes.
- Depoimento enviado por quem não tem conta, ou escrito pelo admin em nome do aluno.
- Mais de um idioma.

## Anti-objetivos (falha mesmo que "funcione")

- Um depoimento não aprovado, recusado, ou editado e ainda não reaprovado aparecer na home, nem por um instante.
- O visitante da home ter qualquer acesso a dados de alunos além de texto do depoimento e nome para exibição: nada de e-mail, telefone, plano, status ou id.
- Um plano editado na home divergir da cobrança (uma só fonte de verdade).
- A home inteira quebrar ou ficar com buracos porque uma consulta do CMS falhou ou a tabela está vazia.
- O aluno conseguir ver ou alterar os treinos ligados a ele, ou os de outro aluno.
- Admin sem o papel conseguir editar conteúdo, ou aluno conseguir aprovar o próprio depoimento.

## Decisões do dono

- Escopo desta rodada: planos, tipos de treino, depoimentos (com envio pelo aluno e aprovação pelo admin) e textos da home (contato, topo, textos de apoio, descrição do Google).
- Planos **unificados** com o banco.
- Depoimentos ligados a **alunos reais cadastrados**: o aluno envia pelo painel dele e o admin aprova.
- Visual dos depoimentos: **grade de cartões**.
- Se o aluno **editar** um depoimento já aprovado, ele sai da home e volta para a fila até ser aprovado de novo.

## Comportamento

### Planos
- Admin edita, por plano: valor padrão, descrição curta (opcional, mostrada no cartão) e se aparece na home. O nome e `vezes_semana` seguem sendo os do banco.
- O texto "1 aula por semana" da home sai de `vezes_semana`.
- Alunos com **valor acordado** próprio não são afetados por mudança no valor padrão. Pagamentos já registrados não mudam. A tela de edição deve avisar isso.
- A ordem na home é por `vezes_semana`.

### Tipos de treino
- Campos: nome, descrição curta, ícone (escolhido de uma lista fixa de ícones lucide, sem digitar nome livre), ordem, ativo.
- O admin cria, edita, reordena, desativa (esconde sem apagar) e exclui.
- **Sempre pelo menos um tipo de treino ativo.** Não se pode excluir nem desativar o último ativo. A regra vale no banco (trigger ou equivalente), não só na tela.
- **Ligação com alunos (muitos para muitos):** um aluno pode ter mais de um tipo de treino, e um tipo de treino pode ter vários alunos. O admin escolhe os treinos de cada aluno na tela de edição do aluno (Alunos). **A ligação é só do admin:** quem associa é o admin; o aluno **não vê** quais treinos estão ligados a ele (nem no painel, nem pela API: o banco não deixa o aluno ler essa tabela). A ligação **não** muda horários, vagas, cobrança nem a home; é um registro interno. Ao excluir um treino que tem alunos ligados, a tela avisa quantos são e a ligação some junto; os alunos não são afetados além disso.

### Depoimentos
- **Aluno:** em Meu painel, bloco "Deixe seu depoimento" com campo de texto e botão de enviar. Estados que ele vê: nenhum enviado, em análise, publicado, recusado. Pode editar o texto; editar volta o estado para "em análise" e tira da home.
- **Regras de envio:** só aluno com cadastro de status `ativo`; um depoimento por aluno; limite de tamanho do texto; validação também no servidor.
- **Admin:** fila de pendentes com nome do aluno, texto, Aprovar e Recusar; lista dos aprovados com Esconder/Mostrar. O admin pode ajustar o texto antes de aprovar, e o aluno vê que o texto foi ajustado.
- **Home:** só aprovados, na grade de cartões. Com nenhum aprovado, a seção inteira não aparece (e o link dela, se houver, também não).
- **Nome exibido:** derivado do cadastro do aluno: primeiro nome + inicial do último sobrenome (ex.: "Marina S."). Aluno sem nome cadastrado não gera cartão.
- Se o aluno for excluído, o depoimento é excluído junto.
- **Aluno que fica `inativo`:** o depoimento já publicado **continua na home**. Nada sai sozinho e a home não depende do status do aluno. Na aba Conteúdo, o depoimento desse aluno ganha um **destaque visual** (selo "Aluno inativo", em lugar visível na fila e na lista de aprovados) para o admin decidir se revisa ou esconde. Quando o aluno volta a `ativo`, o selo some. Alunos `inativo` e `pendente` **não podem enviar nem editar** depoimento; o bloco no painel deles aparece desabilitado, com uma frase explicando.
- **Vínculo com o cadastro:** a tabela `members` tem `auth_user_id` (único, ligado a `auth.users`), `nome` (um campo só, texto completo) e `status` (`ativo`, `inativo`, `pendente`). O depoimento referencia `members.id` com exclusão em cascata. O nome de exibição é derivado de `members.nome`. Quem logado é "o aluno" se acha por `auth_user_id`, como já faz `getOwnMember`.
- **Edição pelo admin:** o texto do admin **substitui** o texto do aluno (um campo só), e o depoimento guarda um marcador "ajustado pelo admin". O aluno abre o campo de edição já com a versão do admin e vê um aviso de que foi ajustado.

### Textos da home
- Chaves editáveis: WhatsApp (número), Instagram (usuário), título e destaque do topo ("Corpo em ação," + "mente em equilíbrio."), subtítulo do topo, frases de apoio das seções (Modalidades, Planos, Horários, Contato) e a descrição do site para o Google.
- Todos os campos nascem preenchidos com os textos que existem hoje no código. Campo vazio no banco ou consulta falha usa o texto padrão do código, nunca deixa o espaço em branco.

## Restrições

- Next.js com `cacheComponents` ativo e `partialPrefetching`. Antes de escrever código, ler `node_modules/next/dist/docs/` (regra do `AGENTS.md`: esta versão tem diferenças do que se conhece). Padrão já usado: `src/lib/slots.ts` com `use cache`, `cacheLife`, `cacheTag`, e `updateTag` nas ações do admin.
- Supabase: seguir o padrão das migrations 0003–0005: RLS em toda tabela, `private.is_admin()`, políticas de escrita separadas em INSERT/UPDATE/DELETE, `revoke` do que a API não usa, índices nas FKs, `get_advisors` limpo no fim. Leitura pública (papel `anon`) por **grant por coluna** + política, como em `slots`.
- Regras de aprovação precisam valer no **banco**, não só no front: o aluno não pode gravar `status` nem aprovar; a volta para "em análise" ao editar tem de ser garantida por trigger ou equivalente.
- O status do aluno é lido só na aba do admin (para o selo). Não entra na leitura pública nem no cache da home.
- Dados públicos de depoimento passam por uma view ou função que entregue só texto e nome de exibição.
- **Cache e aprovação:** a leitura pública de depoimentos é cacheada como os outros conteúdos, com uma tag. Toda ação que muda o que é público chama `updateTag`: aprovar, recusar, esconder e editar pelo admin, **e também a edição do aluno** quando o depoimento estava aprovado (é o que tira o cartão da home na hora). Enviar um depoimento novo não precisa invalidar.
- Interface em português, mobile-first (alvos de toque `min-h-11`), mesma linguagem visual do painel e ícones lucide.
- Migrations numeradas em sequência (próxima: `0006`), aplicadas pelo MCP do Supabase (já liberado).

## Decisões minhas (para o dono conferir)

- Ícone de treino escolhido de lista fixa, não texto livre.
- Só **editar** planos existentes (sem criar/excluir), pelo vínculo com cobrança e limite de vagas.
- Avatar do depoimento é um círculo vermelho com a inicial. Foto do Google fica de fora (exige guardar dado extra e consentimento).
- Um depoimento por aluno; só aluno `ativo` pode enviar.
- Nome de exibição = primeiro nome + inicial do último sobrenome.
- Os treinos ligados a cada aluno aparecem como etiquetas na lista de Alunos do admin, e a busca/filtro por treino fica como melhoria futura (não entra agora).
- Aba "Conteúdo" mostra o número de depoimentos pendentes.
- Um depoimento **pendente** de aluno que ficou inativo também recebe o selo "Aluno inativo", para o admin ver na fila.
- Aluno `inativo` que já tem depoimento vê o estado dele (publicado, em análise, recusado) mas não consegue editar.
- Recusado: o aluno vê o estado e pode reescrever; não há motivo de recusa.
- A home não quebra se o CMS falhar: usa os textos padrão do código. Exceção (decidida na revisão de código): se a consulta de **planos** falhar, a seção Planos some, em vez de mostrar preços padrão que podem estar desatualizados.
- Os textos padrão ficam no código como constantes (fallback) **e** são copiados para o banco no seed. Duas cópias, de propósito: o banco manda, o código só cobre falha ou campo vazio.
- A descrição do site para o Google (`metadata`) pode demorar mais que "segundos" para refletir a mudança, se a leitura em `generateMetadata` com `cacheComponents` exigir isso. O construtor confere na documentação do Next e escolhe a opção mais simples que funcione.
- Edição pelo admin substitui o texto do aluno (sem guardar o original).
- O texto dos treinos, planos e frases atuais da home vira o conteúdo inicial do banco (seed).

## Deixado ao construtor

- Formato exato das tabelas (colunas, nomes, uma tabela de config com colunas tipadas ou chave/valor), e se `plans` ganha colunas novas ou há tabela à parte para a parte pública.
- Limite de caracteres do depoimento.
- Como organizar a aba Conteúdo (abas internas, rotas separadas) e os componentes de reordenação.
- Granularidade das tags de cache (uma por tipo de conteúdo é o esperado).
- Lista de ícones disponíveis.
- Plano de testes de RLS e da aprovação por SQL, nos moldes da Fase 1 do `plano-v1.md`.
