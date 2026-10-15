import Link from "next/link";
import { ArrowLeft, CalendarDays, CalendarPlus, IdCard, LogIn, MessageSquareQuote, UserRound } from "lucide-react";
import { Guia, type Secao } from "@/components/ajuda/guia";

// Guia do aluno: tudo o que dá para fazer em "Meu painel". Conteúdo estático; o proxy já exige login
// em /dashboard.

const SECOES: Secao[] = [
  {
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    icone: LogIn,
    resumo: "Como entrar e o que aparece no seu painel.",
    topicos: [
      {
        titulo: "Entrar no painel",
        passos: [
          "Na página inicial do studio, toque em “Entrar com Google”.",
          "Escolha sua conta Google. Na primeira vez, seu cadastro de aluno é criado automaticamente.",
          "Você cai em “Meu painel”, com sua agenda, seus dados e seu depoimento.",
        ],
        dica: "Se a recepção já cadastrou você com o mesmo e-mail da sua conta Google, o painel já abre com seu plano e seus horários.",
      },
      {
        titulo: "O que tem no painel",
        itens: [
          <><b>Agenda semanal:</b> os horários do studio, com vagas, onde você entra e sai das turmas.</>,
          <><b>Aula grátis:</b> aparece enquanto você ainda não é matriculado.</>,
          <><b>Seus dados:</b> nome e telefone.</>,
          <><b>Seu depoimento:</b> conte como é treinar no studio.</>,
        ],
      },
    ],
  },
  {
    id: "matricula",
    titulo: "Sua matrícula",
    icone: IdCard,
    resumo: "Status, plano e vencimento: o resumo no topo da agenda.",
    topicos: [
      {
        titulo: "Status da matrícula",
        itens: [
          <><b>Pendente:</b> você ainda não é matriculado. Pode agendar uma aula grátis.</>,
          <><b>Ativo:</b> matrícula em dia. Você pode entrar nos horários do seu plano.</>,
          <><b>Inativo:</b> o vencimento passou sem pagamento. Você mantém os horários que já tem, mas não entra em novos até regularizar.</>,
        ],
      },
      {
        titulo: "Plano e horários usados",
        texto: "O plano diz quantas vezes por semana você treina. A pílula “2 de 3 slots usados”, por exemplo, mostra quantos horários fixos você já ocupa. Para trocar de horário quando o limite estiver cheio, saia de um e entre em outro.",
      },
      {
        titulo: "Vencimento e pagamento",
        texto: (
          <>
            O pagamento é feito e registrado na recepção. Cada pagamento soma um mês ao seu vencimento (do dia 10 para o dia
            10 do mês seguinte). A pílula de vencimento fica em destaque quando faltam poucos dias ou se já venceu.
          </>
        ),
        dica: "Pagar antes de vencer não faz você perder dias: o novo mês é contado a partir do vencimento atual.",
      },
    ],
  },
  {
    id: "horarios",
    titulo: "Escolher horários",
    icone: CalendarDays,
    resumo: "Entre e saia das turmas da semana pela agenda.",
    topicos: [
      {
        titulo: "Entrar em um horário",
        passos: [
          "Em “Meus horários”, encontre o dia e a hora que você quer. No celular, toque no dia da semana no topo da agenda.",
          "Veja as vagas no cartão do horário. Horário lotado fica apagado.",
          "Toque em “Entrar”. O cartão passa a ser destacado como seu horário.",
        ],
        dica: "No celular, o símbolo de halter sobre o dia da semana indica que você já tem horário naquele dia.",
      },
      {
        titulo: "Sair de um horário",
        texto: "No cartão do seu horário, toque em “Sair”. A vaga fica livre para outro aluno na hora.",
      },
      {
        titulo: "Quando o botão “Entrar” não aparece",
        itens: [
          "Você já usa todos os horários do seu plano: saia de um para trocar.",
          "Sua matrícula está inativa: regularize o pagamento na recepção.",
          "Você ainda não tem plano definido: fale com o studio para escolher o seu.",
        ],
        texto: "A agenda sempre mostra uma mensagem explicando o motivo, logo acima dos horários.",
      },
    ],
  },
  {
    id: "aula-gratis",
    titulo: "Aula grátis",
    icone: CalendarPlus,
    resumo: "Para quem ainda não é aluno: conheça o studio sem custo.",
    topicos: [
      {
        titulo: "Agendar a aula grátis",
        passos: [
          "Abaixo da agenda, toque em “Agendar aula grátis”.",
          "Escolha o horário da semana.",
          "Escolha a data. O painel mostra quantas vagas tem naquele dia.",
          "Confirme. A data e a hora ficam no cartão “Aula grátis agendada”.",
        ],
        dica: "É uma aula grátis por pessoa. Chegue uns 10 minutos antes.",
      },
      {
        titulo: "Cancelar",
        texto: "Imprevisto? No cartão da aula agendada, toque em “Cancelar aula grátis” e agende outra data.",
      },
    ],
  },
  {
    id: "dados",
    titulo: "Seus dados",
    icone: UserRound,
    resumo: "Mantenha seu contato atualizado.",
    topicos: [
      {
        titulo: "Alterar nome e telefone",
        passos: ["Em “Seus dados”, corrija o nome ou o telefone.", "Toque em “Salvar alterações”."],
        texto: "O e-mail vem da sua conta Google e não pode ser alterado aqui. Plano e status são alterados pela recepção.",
      },
    ],
  },
  {
    id: "depoimento",
    titulo: "Depoimento",
    icone: MessageSquareQuote,
    resumo: "Conte como é treinar no studio e apareça na página inicial.",
    topicos: [
      {
        titulo: "Enviar um depoimento",
        passos: [
          "Em “Seu depoimento”, escreva entre 10 e 500 caracteres.",
          "Toque em “Enviar depoimento”.",
          "A recepção lê e aprova. Depois disso ele aparece na página inicial com seu primeiro nome e a inicial do sobrenome.",
        ],
        dica: "Só alunos com matrícula ativa podem enviar ou editar depoimento.",
      },
      {
        titulo: "O que cada selo significa",
        itens: [
          <><b>Em análise:</b> aguardando a recepção.</>,
          <><b>Publicado:</b> está na página inicial.</>,
          <><b>Publicação pausada:</b> a recepção tirou da página inicial por enquanto.</>,
          <><b>Não publicado:</b> não foi aprovado. Você pode reescrever e enviar de novo.</>,
        ],
        texto: "Se você editar um depoimento publicado, ele sai da página inicial e volta para análise.",
      },
    ],
  },
];

export default function AjudaAlunoPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-10">
      <Link href="/dashboard" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline md:min-h-0">
        <ArrowLeft aria-hidden className="size-4" />
        Voltar ao meu painel
      </Link>
      <Guia
        titulo="Como usar o seu painel"
        intro="Tudo o que você pode fazer no painel do aluno: horários, aula grátis, dados e depoimento."
        secoes={SECOES}
        rodape={
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Ainda com dúvida? Fale com a recepção do studio.
          </p>
        }
      />
    </main>
  );
}
