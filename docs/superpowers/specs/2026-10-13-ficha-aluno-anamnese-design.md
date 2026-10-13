# Ficha do aluno com anamnese — design

Data: 2026-10-13. Projeto: CG Studio (Next.js 16 com `cacheComponents`, Supabase, app offline do admin em `/dashboard/admin`).

> Primeira versão escrita sem conversa com o dono (ele pediu que eu inferisse os padrões de
> academia). Depois ele aprovou e mandou a ficha em papel do studio; as perguntas agora seguem a
> folha. Tudo o que não veio dele está marcado como **decisão minha**. Dúvidas em
> [Open questions](#open-questions).

## Intenção

Hoje o aluno só existe como uma linha na tabela de Alunos e um diálogo de edição (nome, telefone,
plano, valor, status, treinos). Não há onde guardar **o que a professora precisa saber sobre o corpo
e a saúde do aluno** antes de montar o treino: objetivo, dores, lesões, cirurgias, doenças,
remédios, liberação médica e os cuidados no treino.

O pedido do dono: **cada aluno ganha uma página de detalhes própria**, onde dá para registrar e
consultar a anamnese dele. Num studio de movimento (pilates, funcional, mobilidade, turmas
pequenas), isso é o que evita a professora pedir um exercício que machuca quem tem hérnia ou
pressão alta. É também a ficha que a academia mostra se algo der errado.

## Quem usa

Só admins (a recepção e a professora, com conta de admin). O aluno **não vê e não preenche** na v1
(decisão minha, ver Open questions).

## Objetivos

1. **Página "Ficha do aluno"** em `/dashboard/admin/aluno?id=<id>` (na implementação: rota fixa com o id na query, ver plano), aberta a partir da lista de alunos
   (e de qualquer lugar do painel que mostre o nome do aluno: vencimentos, inadimplentes, calendário).
2. Na ficha, **um resumo do que já existe**: contato, status, plano e valor, vencimento e situação,
   horários fixos, treinos, últimos pagamentos, com os mesmos atalhos de hoje (editar cadastro,
   registrar pagamento).
3. **Anamnese** do aluno: as perguntas da ficha em papel do studio (lista abaixo), que dá para
   preencher por partes e editar quando quiser.
4. **Medidas** (avaliação física da folha), datadas, para comparar na reavaliação.
5. **Alerta de saúde visível**: se a anamnese tem algo que pede cuidado (doença crônica, medicação,
   restrição médica, cuidados escritos), aparece um selo no topo da ficha e um
   ícone ao lado do nome na lista de alunos e na lista de cada horário do calendário. A professora
   vê na hora, antes da aula, quem precisa de atenção.
6. **Funciona offline**, como o resto do painel: a ficha abre com os dados salvos no aparelho, e
   salvar a anamnese sem internet entra na fila e é enviado depois.
7. **Saber quando foi preenchida**: data da última atualização e quem atualizou.

## Fora do escopo (v1)

- O aluno preencher ou ver a própria anamnese no `/dashboard` dele.
- Gráficos de evolução das medidas; medidas além das 6 da folha (altura, % de gordura, testes).
- Perguntas que não estão na folha (PAR-Q, regiões de dor, sono etc.).
- Histórico de versões da anamnese (só fica a versão atual + quem/quando mudou por último).
- Anotações de evolução datadas por aula ("diário do aluno").
- Anexar arquivo (foto do atestado, exames).
- Assinatura digital. A v1 só registra que o aluno assinou no papel (imagem, consentimento) e quando.
- Imprimir/exportar a ficha em PDF.
- Lista de presença.

Esses itens viram candidatos naturais para as próximas fases (ver final).

## Anti-objetivos (falha mesmo que "funcione")

- **Dado de saúde vazando**: qualquer pessoa que não seja admin conseguir ler a anamnese (pela
  tela, pela API ou pelo banco). É dado pessoal sensível pela LGPD (art. 11).
- **Anamnese que some**: o admin preenche um formulário longo, sai da página ou perde a internet, e
  o que digitou se perde sem aviso.
- **Edição offline apagando a de outro admin**: salvar com dados antigos não pode desfazer campos
  que o outro admin mudou (mesma regra das edições de aluno: envia só o que mudou).
- **Formulário que ninguém preenche**: se for longo e obrigatório demais, a recepção larga. Tudo é
  opcional e dá para salvar pela metade.
- **Alerta que vira ruído**: se todo aluno tiver o selo de alerta, ninguém olha mais. Só acende por
  motivos reais (lista fechada abaixo).
- Quebrar o fluxo offline atual (lista de alunos, pagamento, fila).

## Comportamento

### Navegação

- Na tabela de alunos, o **nome vira link** para a ficha. O botão de lápis (editar) continua lá.
- Em Vencimentos próximos, Inadimplentes, Financeiro (histórico) e no diálogo de alunos de cada
  horário do Calendário, o nome do aluno também leva à ficha.
- A ficha faz parte do mesmo app offline (troca de tela por `pushState`, sem ir ao servidor). O
  botão voltar do navegador/celular volta para a tela anterior.
- No topo da ficha, um link "← Alunos". A aba "Alunos" do menu fica marcada enquanto se está numa
  ficha.
- Aluno cadastrado offline (ainda "aguardando envio") também tem ficha e pode receber anamnese; ela
  entra na fila depois do cadastro.
- Endereço de aluno que não existe (ou foi excluído): mensagem "Aluno não encontrado" com link de
  volta para Alunos.

### Layout da ficha (mobile-first)

Cabeçalho:
- Nome (Lobster Two, como os outros títulos), selo de status, selo "Aguardando envio"/"Com erro"
  quando houver, e **selo de alerta de saúde** quando houver.
- Telefone com link para WhatsApp (`https://wa.me/55<telefone>`) e e-mail com `mailto:`.
- Ações: "Editar cadastro" (abre o mesmo diálogo de hoje) e "Registrar pagamento" (o mesmo
  diálogo de hoje, em vermelho, como é hoje).

Abaixo, **abas**: `Resumo` · `Anamnese` · `Medidas` (decisão minha: abas em vez de uma página longa).

**Aba Resumo** (só leitura, tudo do snapshot que já existe):
- Plano, valor (acordado ou padrão), vencimento e situação.
- Horários fixos (dia e hora), com "N de M do plano".
- Tipos de treino.
- Cuidados no treino (o campo da anamnese, repetido aqui em destaque porque é o que a professora
  mais consulta). Se a anamnese estiver vazia: "Anamnese não preenchida" com botão "Preencher".
- Últimos pagamentos do aluno (data, valor, forma), os 6 mais recentes, com os que aguardam envio
  marcados.
- "Aluno desde" (data do cadastro) e se tem login Google.

**Aba Anamnese**: o formulário, dividido em blocos com título. No celular, cada bloco é um cartão;
o botão "Salvar anamnese" fica fixo no rodapé enquanto há alterações não salvas. Abaixo do título:
"Atualizada em 12/10/2026 por Fulana" ou "Ainda não preenchida".

### Conteúdo da anamnese — segue a ficha em papel do studio

Fonte: "FICHA DE ANAMNESE – FUNCIONAL FEMININO" (PDF enviado pelo dono em 2026-10-13). As perguntas
são as da folha, na mesma ordem, para a recepção poder passar do papel para o sistema sem pensar.
Tudo opcional. Nome e telefone da folha já existem no cadastro do aluno e não se repetem aqui.

**1. Dados pessoais**
- Data de nascimento (data) → mostra a idade.
- Endereço (texto).

**2. Histórico de saúde**
- Possui alguma doença crônica não transmissível (ex.: hipertensão, diabetes, obesidade, problemas
  cardíacos, coluna, tireoide etc.)? (Sim/Não) → Se sim, qual(is)? (texto)
- Está em uso de medicação contínua? (Sim/Não) → Qual(is)? (texto)
- Possui recomendação ou restrição médica para atividades físicas? (Sim/Não) → Detalhar (texto)

**3. Histórico de atividade física**
- Já praticou exercícios físicos anteriormente? (Sim/Não)
- Quais modalidades? (texto) · Há quanto tempo? (texto)

**4. Objetivos** (texto livre, como na folha).

**5. Autorização de imagem**
- "Autorizo o uso de minhas fotos e vídeos realizados durante as aulas e eventos do Studio Clarice
  Geiger para divulgação em redes sociais e materiais promocionais do estúdio." (Sim/Não) e data da
  assinatura. Aparece também no Resumo ("Autoriza imagem: sim/não"), porque a recepção consulta
  isso antes de postar.

**Só do studio (não estão na folha; decisão minha)**
- **Cuidados no treino** (texto livre, o campo mais útil para a professora: "evitar impacto",
  "pressão: medir antes"). Destaque visual (borda vermelha). Também aparece no Resumo.
- **Consentimento para dados de saúde** (Sim/Não + data) — a folha não tem; ver Open question 6.
- **Observações** (texto livre).

Os campos "Se sim, qual(is)?" ficam visíveis só com "Sim" marcado; desmarcar limpa o texto.

### Medidas (avaliação física) — também da folha

A folha tem "Avaliação Física Inicial": peso (kg), cintura, quadril, coxas/pernas, peito/tórax e
braço (cm). Decisão minha: guardar como **avaliações datadas** (a da matrícula é a primeira), para
a reavaliação de daqui a alguns meses caber sem mudar nada.

- Aba **Medidas** na ficha: a última avaliação em destaque, com a diferença para a primeira
  ("Cintura 78 cm · −4 cm desde 10/03/2026"), e a lista de todas abaixo (data + 6 medidas).
- "Nova avaliação": diálogo com data (padrão: hoje) e as 6 medidas, todas opcionais (mínimo uma).
- Corrigir uma avaliação: abre o mesmo diálogo. Funciona offline (fila).
- Excluir avaliação: só online, com confirmação em dois cliques.
- Sem gráficos na v1.

### Alerta de saúde (regra fechada)

O selo de alerta acende quando **qualquer** um destes for verdade:
- doença crônica = Sim;
- medicação contínua = Sim;
- recomendação/restrição médica = Sim;
- "Cuidados no treino" preenchido.

Tocando/passando o mouse no selo, a lista dos motivos com o texto que foi escrito
("Doença: hipertensão · Restrição: não fazer impacto"). Calculado no cliente (também offline).

Selo "Sem anamnese" (cinza, discreto) aparece na ficha de quem não tem anamnese. Na lista de
alunos, não (decisão minha: senão a lista inteira fica cinza no começo).

### Salvar a anamnese

- Igual à edição de aluno: guarda na fila do aparelho e envia; online vai na hora, offline vai
  quando a conexão voltar. Toast "Anamnese salva" / "Anamnese guardada — envio quando a conexão
  voltar" (o `msgGuardado` de hoje).
- Envia **só os campos alterados** desde que o formulário foi aberto. Campos que andam juntos vão
  sempre juntos: cada Sim/Não + seu texto, autorização + data, consentimento + data.
- Enquanto há alterações não salvas: a barra "Salvar / Desfazer" fica presa no rodapé. **Mudança na
  implementação:** em vez de pedir confirmação ao sair, as alterações ficam guardadas em memória
  por aluno (sair da ficha, trocar de aba ou usar o voltar não perde nada; ao sair aparece o aviso
  "a anamnese tem alterações não salvas"). Recarregar ou fechar a aba mostra o aviso padrão do
  navegador (`beforeunload`). Não há rascunho salvo no aparelho.
- Erro de regra na sincronização (ex.: aluno excluído) vai para "Pendências com erro", como hoje.
- Data e autor da última atualização são gravados pelo banco (não pelo aparelho).

### Privacidade e LGPD

- Só admin lê e escreve a anamnese (RLS). O aluno não lê nem a própria na v1.
- A anamnese entra no snapshot do app offline (fica no IndexedDB do aparelho do admin), presa ao
  usuário, e é apagada no logout como o resto (regra já existente).
- A planilha de backup ganha uma aba "Anamnese" (decisão minha; ver Open questions).
- Excluir um aluno sem login apaga a anamnese junto.
- **Apagar anamnese**: botão na aba Anamnese ("Apagar anamnese", com confirmação em dois cliques
  como o "Excluir cadastro" de hoje), para atender pedido do aluno (LGPD art. 18) sem excluir o
  cadastro, já que aluno com login ou com pagamentos não pode ser excluído. **Só online** (decisão
  minha: é irreversível, não deve ficar numa fila). Prazo de retenção automático: não na v1 (ver
  Open question 7).

## Restrições

- Ler antes `node_modules/next/dist/docs/` para rotas dinâmicas com `cacheComponents` (regra do
  `AGENTS.md`).
- A ficha **precisa abrir offline**, inclusive de um aluno cuja ficha nunca foi aberta neste
  aparelho. O service worker hoje guarda uma cópia por endereço e, sem cópia, entrega a casca de
  `/dashboard/admin`; o app tem que decidir a tela pelo endereço real do navegador.
- Nenhuma regra nova no caminho offline que não exista no servidor: o servidor revalida tudo.
- Mesmo visual do painel (`docs/direcao-design.md`): vermelho só em ação/destaque (botão salvar,
  registrar pagamento, cuidados no treino, alerta urgente).
- Migration nova em sequência: `0013`.
- Interface em português, mobile-first (375px sem rolagem horizontal), alvos de toque ≥ 44px.

## Deixado ao construtor

- Componentes exatos (shadcn já tem `tabs`, `dialog`, `select`, `switch`, `textarea`; pode
  adicionar `checkbox`, `radio-group`, `tooltip`/`popover` se quiser).
- Nome dos arquivos e organização dos componentes.
- Como mostrar Sim/Não/sem resposta (sugestão: grupo de botões segmentado).
- Unidades e casas decimais das medidas (sugestão: peso com 1 casa, cm com 1 casa).
- O texto exato dos rótulos e ajudas.
- Se a lista de alunos no celular ganha uma linha clicável inteira ou só o nome.

## Próximas fases (não fazer agora)

1. Aluno preenche a própria anamnese no `/dashboard` (antes da aula experimental), admin revisa.
2. Gráficos de evolução das medidas; altura/IMC.
3. Anotações de evolução por data ("diário").
4. Anexo do atestado (Supabase Storage, bucket privado).
5. Ficha em PDF para imprimir/assinar.

## Open questions

Itens que eu **não** consegui decidir sozinho e que mudam o que é construído. Enquanto não houver
resposta, o plano segue com a opção marcada em **negrito**.

1. **[Respondida 2026-10-13: não]** **O aluno deve ver/preencher a própria anamnese?** Hoje: **não, só admin** (v1). Se sim, muda
   RLS, a tela do aluno e quem pode editar o quê. Também afeta a LGPD (direito de acesso do titular,
   que hoje seria atendido pela recepção sob pedido).
2. **[Respondida: não — sem papel professor]** **Quem é "admin" na prática?** Se a professora (ou professores futuros) for usar a ficha mas
   **não** deveria ver o financeiro, precisaríamos de um papel novo ("professor") com acesso só a
   ficha/anamnese/calendário. Hoje: **não existe papel professor; todo admin vê tudo**.
3. **[Respondida: sim]** **Anamnese na planilha de backup?** Hoje: **sim, aba "Anamnese"**. É dado de saúde num arquivo que
   pode ser repassado. Se preferir, deixo de fora ou só com "Cuidados no treino".
4. ~~As perguntas inferidas servem?~~ **Respondida**: o dono mandou a ficha em papel; as perguntas
   agora seguem a folha.
5. ~~Validade do atestado~~ Saiu junto com as perguntas inferidas (a folha não pede atestado).
8. **A folha é "Funcional Feminino". Existe outra ficha (pilates, mobilidade, masculino) com
   perguntas diferentes?** Hoje: **uma ficha só, para todos os alunos**. Se houver outras, cada
   modalidade teria o próprio formulário (muda o banco).

6. **O termo em papel cobre o consentimento para dados de saúde?** A LGPD (art. 11) pede base legal
   para guardar dado de saúde; a mais simples para um studio é o consentimento escrito e destacado.
   A folha atual só tem autorização de **imagem**, nada sobre dados de saúde. Hoje: **campo
   "consentimento para dados de saúde" (Sim/Não + data) só no sistema**; vale acrescentar uma linha
   na folha (posso redigir). Não sou advogado: vale confirmar com
   quem cuida disso.
7. **[Respondida: não — só manual]** **Apagar anamnese de quem sai do studio?** Hoje: **só manual, pelo botão**. Alternativa: apagar
   sozinha N meses depois de o aluno ficar inativo. Muda o banco (job no `pg_cron`).

Não-blockers (decidi e sigo, só para conferir): abas Resumo/Anamnese/Medidas; tudo opcional; alerta só
pela regra fechada acima; medidas datadas; cuidados no treino e observações a mais que a folha; sem
rascunho local; sem histórico de versões; apagar anamnese e excluir avaliação só online; selo "Sem anamnese" só na ficha.
