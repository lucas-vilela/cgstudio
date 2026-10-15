import { Suspense } from "react";
import {
  Banknote, CalendarDays, ClipboardList, CloudOff, LayoutTemplate, ShieldCheck, Users, Wallet,
} from "lucide-react";
import { Guia, type Secao } from "@/components/ajuda/guia";
import { PageLoading } from "@/components/dashboard/admin/page-loading";
import { requireAdmin } from "../guard";

// Guia do admin: como funciona cada aba do painel e as regras que o sistema aplica sozinho.

const SECOES: Secao[] = [
  {
    id: "visao-geral",
    titulo: "Visão geral",
    icone: CloudOff,
    resumo: "Abas do painel, uso sem internet e a barra de status.",
    topicos: [
      {
        titulo: "As abas",
        itens: [
          <><b>Alunos:</b> cadastro, busca, vencimentos e a ficha de cada aluno.</>,
          <><b>Financeiro:</b> entradas do mês, inadimplentes e histórico de pagamentos.</>,
          <><b>Calendário:</b> horários da semana, capacidade e alunos de cada turma.</>,
          <><b>Conteúdo:</b> planos, treinos, depoimentos e textos da página inicial.</>,
          <><b>Admins:</b> quem tem acesso ao painel.</>,
        ],
      },
      {
        titulo: "Funciona sem internet",
        texto: (
          <>
            Alunos, Financeiro e Calendário ficam salvos no aparelho. Sem conexão, dá para cadastrar aluno, registrar
            pagamento, mexer nas turmas, preencher anamnese e medidas: tudo fica guardado e é enviado sozinho quando a
            internet voltar. Conteúdo e Admins precisam de conexão.
          </>
        ),
        dica: "No celular ou no computador, use “Instalar app” (no topo do painel, quando o navegador oferece) para abrir o painel como um aplicativo.",
      },
      {
        titulo: "Barra de status",
        itens: [
          <><b>Online / Offline:</b> se o aparelho está conectado agora.</>,
          <><b>Dados de …:</b> quando os dados do aparelho foram atualizados pela última vez.</>,
          <><b>Registros aguardando envio:</b> o que foi feito offline e ainda não chegou ao servidor.</>,
          <><b>Atualizar:</b> envia o que está pendente e baixa os dados mais novos.</>,
          <><b>Exportar planilha:</b> baixa um backup em Excel com alunos, pagamentos, horários, planos, anamneses e medidas (inclusive o que ainda aguarda envio).</>,
        ],
      },
      {
        titulo: "Pendências com erro",
        texto: "Quando o servidor recusa um registro feito offline (por exemplo, telefone repetido), ele aparece no topo em “Pendências com erro”. Nada é descartado sem você decidir.",
        itens: [
          <><b>Corrigir:</b> abre o formulário para ajustar e enviar de novo.</>,
          <><b>Tentar de novo:</b> reenvia sem mudar nada (útil se foi falha de conexão).</>,
          <><b>Descartar:</b> apaga o registro. Pede confirmação e não tem volta.</>,
        ],
      },
    ],
  },
  {
    id: "alunos",
    titulo: "Alunos",
    icone: Users,
    resumo: "Cadastro, busca e acompanhamento dos alunos.",
    topicos: [
      {
        titulo: "Resumo e vencimentos próximos",
        texto: "Os cartões do topo mostram alunos ativos, quanto entrou no mês e quantos estão em atraso. Logo abaixo, “Vencimentos próximos” lista quem vence nos próximos 5 dias, com o botão “Registrar” para lançar o pagamento ali mesmo.",
      },
      {
        titulo: "Cadastrar um aluno",
        passos: [
          "Em “Todos os alunos”, toque em “Novo aluno”.",
          "Preencha nome e telefone. O e-mail é opcional.",
          "Escolha o plano. Se combinou um preço diferente, preencha “Valor acordado”; vazio usa o valor padrão do plano.",
          "Marque os tipos de treino (só a recepção vê) e toque em “Cadastrar”.",
        ],
        dica: "Informe o e-mail do Google do aluno: quando ele entrar no site com essa conta, o login é ligado a este cadastro, sem duplicar.",
      },
      {
        titulo: "Regras do cadastro",
        itens: [
          "O telefone identifica o aluno e não pode repetir entre cadastros. O e-mail também não.",
          "Aluno novo começa como “Pendente” e fica “Ativo” no primeiro pagamento.",
          "“Excluir cadastro” só existe para aluno sem login e sem pagamentos (para corrigir cadastro errado).",
        ],
      },
      {
        titulo: "Selos na lista",
        itens: [
          <><b>Sem login:</b> o aluno ainda não entrou no site com o Google.</>,
          <><b>Aguardando envio:</b> feito offline, ainda não chegou ao servidor.</>,
          <><b>Erro no envio:</b> o servidor recusou. Veja em “Pendências com erro”.</>,
          <><b>Coração vermelho:</b> a anamnese pede atenção. Passe o mouse ou abra a ficha para ver o motivo.</>,
        ],
      },
    ],
  },
  {
    id: "ficha",
    titulo: "Ficha do aluno",
    icone: ClipboardList,
    resumo: "Tudo sobre um aluno em um lugar: toque no nome dele em qualquer lista.",
    topicos: [
      {
        titulo: "Resumo",
        texto: "Cuidados no treino (vindos da anamnese), plano e valor, horários fixos, últimas medidas e últimos pagamentos. O telefone abre conversa no WhatsApp.",
      },
      {
        titulo: "Anamnese",
        texto: "Questionário de saúde do aluno. Respostas que pedem cuidado geram o alerta “Atenção à saúde” no topo da ficha e o coração ao lado do nome nas listas e no calendário.",
        dica: "Se sair da ficha sem salvar, o que você digitou continua lá ao voltar. Só se perde ao recarregar ou fechar a página, e o navegador avisa antes.",
      },
      {
        titulo: "Medidas",
        passos: [
          "Na aba Medidas, toque em “Nova avaliação”.",
          "Preencha a data e as medidas que tiver (peso, cintura, quadril, coxas, peito, braço).",
          "Em “Percepções do aluno”, anote o que ele sente que melhorou ou piorou e não dá para medir: sono, disposição, dores, força no dia a dia.",
          "Salve. A última avaliação aparece em destaque e as anteriores ficam em “Todas as avaliações”, com “Corrigir” em cada uma.",
        ],
      },
      {
        titulo: "Acompanhamento",
        itens: [
          <><b>Peso:</b> gráfico de linha com o valor atual e quanto mudou desde a primeira avaliação.</>,
          <><b>Variação das medidas:</b> barras que mostram, de uma vez, quais circunferências diminuíram e quais aumentaram.</>,
          <><b>Circunferências:</b> um gráfico pequeno por medida, cada um na própria escala.</>,
          <><b>Percepções do aluno:</b> tudo o que foi anotado nas avaliações, da mais recente para a mais antiga.</>,
        ],
        texto: "Os gráficos aparecem a partir da segunda avaliação. As datas ficam na distância real entre elas, e passar o mouse ou tocar mostra o valor de cada data.",
        dica: "Abaixo dos gráficos, “Ver todas as medidas em tabela” mostra os números exatos.",
      },
    ],
  },
  {
    id: "pagamentos",
    titulo: "Pagamentos e vencimento",
    icone: Banknote,
    resumo: "Como registrar e como o sistema calcula o vencimento.",
    topicos: [
      {
        titulo: "Registrar um pagamento",
        passos: [
          "Toque em “Registrar” na lista de alunos, nos vencimentos próximos ou na ficha.",
          "Confira o valor (já vem o valor acordado ou o padrão do plano).",
          "Escolha a forma (Pix, dinheiro ou cartão) e a data em que o aluno pagou.",
          "Confirme. O aluno passa para “Ativo” e o vencimento avança.",
        ],
        dica: "Se já existe um pagamento do aluno aguardando envio, o formulário avisa para evitar lançar duas vezes.",
      },
      {
        titulo: "Como o vencimento é calculado",
        itens: [
          "Cada pagamento soma 1 mês de calendário: 10/01 vira 10/02.",
          "Se o aluno paga antes de vencer, o mês é somado ao vencimento atual (ele não perde dias).",
          "Se já venceu (ou não tinha vencimento), o mês conta a partir da data do pagamento.",
          "Quando o dia não existe no mês seguinte, cai no último dia: 31/01 vira 28/02.",
        ],
      },
      {
        titulo: "O que acontece quando vence",
        texto: "Todo dia, logo após a meia-noite, quem está ativo com vencimento passado vira “Inativo” automaticamente. O aluno inativo mantém os horários dele, mas não entra em novos. Ao pagar, volta a ativo sem perder o lugar.",
      },
    ],
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    icone: Wallet,
    resumo: "Entradas do mês, inadimplentes e histórico.",
    topicos: [
      {
        titulo: "Entradas do mês",
        texto: "Use ‹ e › para trocar o mês. Os cartões somam o recebido no total e por forma de pagamento. Pagamentos feitos offline já entram na conta, e a tela diz quantos ainda aguardam envio.",
      },
      {
        titulo: "Inadimplentes",
        texto: "Alunos com vencimento passado. Quem tem pagamento aguardando envio aparece marcado, para você não cobrar duas vezes.",
      },
      {
        titulo: "Histórico de um aluno",
        texto: "Em “Pagamentos do mês”, toque no nome de um aluno para ver todos os pagamentos dele. “← Ver pagamentos do mês” volta para a lista do mês.",
      },
    ],
  },
  {
    id: "calendario",
    titulo: "Calendário",
    icone: CalendarDays,
    resumo: "Horários da semana e quem está em cada turma.",
    topicos: [
      {
        titulo: "Criar e editar horários",
        passos: [
          "Toque em “Novo horário”.",
          "Escolha o dia da semana (inclusive sábado e domingo), início, fim e capacidade.",
          "Salve. O horário aparece para os alunos na agenda deles.",
        ],
        texto: "“Desativar” tira o horário da agenda dos alunos sem apagar nada. Ativar e desativar precisam de conexão.",
      },
      {
        titulo: "Alunos da turma",
        passos: [
          "No cartão do horário, toque em “Alunos”.",
          "Busque pelo nome ou telefone e toque em “Adicionar”. Para tirar alguém, use “Remover”.",
        ],
        dica: "O admin pode tudo: dá para passar da capacidade, do limite do plano ou incluir aluno não ativo. O sistema só avisa, não bloqueia.",
      },
    ],
  },
  {
    id: "conteudo",
    titulo: "Conteúdo da página inicial",
    icone: LayoutTemplate,
    resumo: "O que aparece no site. As mudanças valem em poucos segundos.",
    topicos: [
      {
        titulo: "Planos",
        texto: "O valor padrão é o mesmo usado na cobrança: mudar aqui muda a página inicial e as próximas cobranças de quem não tem valor acordado. Pagamentos já registrados não mudam. “Mostrar na home” escolhe se o plano aparece no site.",
      },
      {
        titulo: "Tipos de treino",
        texto: "Aparecem na página inicial na ordem da lista: use as setas para subir ou descer. Treino desativado some do site mas continua nos cadastros. Sempre fica pelo menos um treino ativo.",
      },
      {
        titulo: "Depoimentos",
        itens: [
          <><b>Aprovar:</b> publica na página inicial.</>,
          <><b>Recusar:</b> não publica. O aluno vê “Não publicado” e pode reescrever.</>,
          <><b>Esconder / Mostrar:</b> tira ou devolve um depoimento publicado, sem recusar.</>,
          <><b>Ajustar texto:</b> corrige erros de digitação. O aluno é avisado de que o texto foi ajustado.</>,
        ],
        texto: "Se o aluno editar um depoimento publicado, ele sai do site e volta para “Para aprovar”. A aba Conteúdo mostra quantos estão esperando.",
      },
      {
        titulo: "Textos",
        texto: "Títulos e frases da página inicial. Campo vazio usa o texto padrão, que aparece em cinza dentro do campo.",
      },
    ],
  },
  {
    id: "admins",
    titulo: "Admins",
    icone: ShieldCheck,
    resumo: "Quem pode acessar este painel.",
    topicos: [
      {
        titulo: "Promover e rebaixar",
        passos: [
          "Em “Promover aluno”, busque pelo nome ou e-mail.",
          "Toque em “Promover”. A pessoa passa a entrar direto neste painel.",
        ],
        itens: [
          "Só aparece quem já entrou no site com o Google.",
          "Admins têm acesso total: alunos, pagamentos, calendário e outros admins.",
          "Você não pode rebaixar a si mesmo.",
        ],
      },
    ],
  },
];

export default function AjudaAdminPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AjudaAdmin />
    </Suspense>
  );
}

async function AjudaAdmin() {
  await requireAdmin();
  return (
    <Guia
      titulo="Como funciona o painel"
      intro="O passo a passo de cada aba do painel do admin e as regras que o sistema aplica sozinho. Nas telas do painel, o ícone de interrogação ao lado de um título mostra uma dica rápida."
      secoes={SECOES}
    />
  );
}
