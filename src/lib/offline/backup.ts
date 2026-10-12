import writeXlsxFile from "write-excel-file/browser";
import type { Cell, Row } from "write-excel-file/browser";
import { DIAS, formatDate, hhmm, todayISO } from "@/app/dashboard/admin/format";
import { formaLabel } from "@/app/dashboard/admin/types";
import { formatPhone, statusLabel } from "@/app/dashboard/members";
import type { ItemFila } from "./tipos";
import type { Visao } from "./visao";

// Backup em planilha (.xlsx) gerado no navegador a partir dos dados do aparelho: funciona offline.
// É para consulta/conferência; não há restauração a partir dela.

const titulo = (t: string): Cell => ({ value: t, fontWeight: "bold" });
const dinheiro = (v: number | null): Cell => (v == null ? null : { value: v, type: Number, format: "#,##0.00" });
const txt = (v: string | null | undefined): Cell => v ?? "";

function descreverFila(i: ItemFila, visao: Visao) {
  const nome = (id: string) => visao.members.find((m) => m.member_id === id)?.nome ?? "aluno";
  switch (i.tipo) {
    case "pagamento": return `Pagamento de ${nome(i.payload.member_id)} em ${formatDate(i.payload.pago_em)}`;
    case "aluno_criar": return `Cadastro de ${i.payload.nome}`;
    case "aluno_editar": return `Alteração de ${nome(i.payload.member_id)}`;
    case "horario_entrar": return `${nome(i.payload.member_id)} entrar em horário`;
    case "horario_sair": return `${nome(i.payload.member_id)} sair de horário`;
  }
}

export async function exportarPlanilha(visao: Visao, fila: ItemFila[]) {
  const treinoNome = new Map(visao.snapshot.treinos.map((t) => [t.id, t.nome]));

  const alunos: Row[] = [
    ["Nome", "Telefone", "E-mail", "Plano", "Valor (R$)", "Status", "Vencimento", "Treinos", "Login Google", "Situação do envio"].map(titulo),
    ...visao.members.map((m): Row => [
      txt(m.nome), m.telefone ? formatPhone(m.telefone) : "", txt(m.email), txt(m.plano_nome), dinheiro(m.valor),
      statusLabel(m.status), m.vencimento ? formatDate(m.vencimento) : "",
      m.treino_ids.map((id) => treinoNome.get(id) ?? "").filter(Boolean).join(", "),
      m.tem_login ? "Sim" : "Não", m.erro ? `Erro: ${m.erro}` : m.pendente ? "Aguardando envio" : "",
    ]),
  ];

  const pagamentos: Row[] = [
    ["Data", "Aluno", "Valor (R$)", "Forma", "Observação", "Situação do envio"].map(titulo),
    ...visao.pagamentos.map((p): Row => [
      formatDate(p.pago_em), txt(p.nome), dinheiro(p.valor), formaLabel(p.forma), txt(p.observacao),
      p.erro ? `Erro: ${p.erro}` : p.pendente ? "Aguardando envio" : "",
    ]),
  ];

  const horarios: Row[] = [
    ["Dia", "Início", "Fim", "Capacidade", "Ocupados", "Ativo", "Alunos"].map(titulo),
    ...visao.slots.map((s): Row => [
      DIAS[s.dia_semana], hhmm(s.hora_inicio), hhmm(s.hora_fim), s.capacidade, s.ocupados,
      s.ativo ? "Sim" : "Não", s.alunos.map((a) => a.nome ?? "—").join(", "),
    ]),
  ];

  const planos: Row[] = [
    ["Nome", "Aulas por semana", "Valor padrão (R$)", "Descrição", "Na home"].map(titulo),
    ...visao.plans.map((p): Row => [p.nome, p.vezes_semana, dinheiro(p.valor_padrao), txt(p.descricao), p.exibir_na_home ? "Sim" : "Não"]),
  ];

  const sheets = [
    { sheet: "Alunos", data: alunos, columns: [{ width: 30 }, { width: 18 }, { width: 30 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 30 }, { width: 12 }, { width: 30 }] },
    { sheet: "Pagamentos", data: pagamentos, columns: [{ width: 12 }, { width: 30 }, { width: 12 }, { width: 10 }, { width: 40 }, { width: 30 }] },
    { sheet: "Horários", data: horarios, columns: [{ width: 10 }, { width: 8 }, { width: 8 }, { width: 11 }, { width: 10 }, { width: 8 }, { width: 60 }] },
    { sheet: "Planos", data: planos, columns: [{ width: 12 }, { width: 16 }, { width: 16 }, { width: 40 }, { width: 10 }] },
  ];

  const pendentes = fila.filter((i) => i.status === "pendente" || i.status === "erro");
  if (pendentes.length) {
    sheets.push({
      sheet: "Aguardando envio",
      data: [
        [titulo("Atenção: estes registros ainda não chegaram ao servidor.")],
        ["Registrado em", "O quê", "Situação"].map(titulo),
        ...pendentes.map((i): Row => [
          new Date(i.criado_em).toLocaleString("pt-BR"), descreverFila(i, visao), i.erro ? `Erro: ${i.erro}` : "Aguardando envio",
        ]),
      ],
      columns: [{ width: 20 }, { width: 50 }, { width: 50 }],
    });
  }

  const dia = todayISO(); // data de quem exporta (o snapshot pode ser de outro dia, offline)
  await writeXlsxFile(sheets, { fontFamily: "Calibri", fontSize: 11 }).toFile(`cgstudio-backup-${dia}.xlsx`);
}
