import writeXlsxFile from "write-excel-file/browser";
import type { Cell, Row } from "write-excel-file/browser";
import { DIAS, formatDate, hhmm, todayISO } from "@/app/dashboard/admin/format";
import { formaLabel } from "@/app/dashboard/admin/types";
import { formatPhone, statusLabel } from "@/app/dashboard/members";
import { anamnesePreenchida, MEDIDAS, PERGUNTAS, type CampoAnamnese } from "@/lib/anamnese";
import { descreverItem } from "./descricao";
import type { ItemFila } from "./tipos";
import type { Visao } from "./visao";

// Backup em planilha (.xlsx) gerado no navegador a partir dos dados do aparelho: funciona offline.
// É para consulta/conferência; não há restauração a partir dela.

const titulo = (t: string): Cell => ({ value: t, fontWeight: "bold" });
const dinheiro = (v: number | null): Cell => (v == null ? null : { value: v, type: Number, format: "#,##0.00" });
const txt = (v: string | null | undefined): Cell => v ?? "";

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

  // Ficha do aluno: as perguntas da folha como cabeçalho, uma linha por aluno com anamnese.
  const nomeDe = new Map(visao.members.map((m) => [m.member_id, m.nome]));
  const campos = Object.keys(PERGUNTAS) as CampoAnamnese[];
  const resposta = (v: unknown): Cell =>
    v == null ? "" : typeof v === "boolean" ? (v ? "Sim" : "Não") : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? formatDate(String(v)) : String(v);
  const anamneses: Row[] = [
    ["Aluno", ...campos.map((k) => PERGUNTAS[k]), "Atualizada em"].map(titulo),
    ...[...visao.anamneses.values()]
      .filter((a) => anamnesePreenchida(a))
      .sort((a, b) => (nomeDe.get(a.member_id) ?? "").localeCompare(nomeDe.get(b.member_id) ?? ""))
      .map((a): Row => [
        txt(nomeDe.get(a.member_id)), ...campos.map((k) => resposta(a[k])),
        a.updated_at ? new Date(a.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
      ]),
  ];
  const medida = (v: number | null): Cell => (v == null ? null : { value: v, type: Number, format: "0.0" });
  const medidas: Row[] = [
    ["Aluno", "Data", ...MEDIDAS.map((m) => `${m.rotulo} (${m.unidade})`), "Observação"].map(titulo),
    ...[...visao.avaliacoes.values()].flat()
      .sort((a, b) => (nomeDe.get(a.member_id) ?? "").localeCompare(nomeDe.get(b.member_id) ?? "") || a.data.localeCompare(b.data))
      .map((a): Row => [txt(nomeDe.get(a.member_id)), formatDate(a.data), ...MEDIDAS.map((m) => medida(a[m.campo])), txt(a.observacao)]),
  ];

  const sheets = [
    { sheet: "Alunos", data: alunos, columns: [{ width: 30 }, { width: 18 }, { width: 30 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 30 }, { width: 12 }, { width: 30 }] },
    { sheet: "Pagamentos", data: pagamentos, columns: [{ width: 12 }, { width: 30 }, { width: 12 }, { width: 10 }, { width: 40 }, { width: 30 }] },
    { sheet: "Horários", data: horarios, columns: [{ width: 10 }, { width: 8 }, { width: 8 }, { width: 11 }, { width: 10 }, { width: 8 }, { width: 60 }] },
    { sheet: "Planos", data: planos, columns: [{ width: 12 }, { width: 16 }, { width: 16 }, { width: 40 }, { width: 10 }] },
    { sheet: "Anamnese", data: anamneses, columns: [{ width: 30 }, ...campos.map(() => ({ width: 28 })), { width: 14 }] },
    { sheet: "Medidas", data: medidas, columns: [{ width: 30 }, { width: 12 }, ...MEDIDAS.map(() => ({ width: 14 })), { width: 40 }] },
  ];

  const pendentes = fila.filter((i) => i.status === "pendente" || i.status === "erro");
  if (pendentes.length) {
    sheets.push({
      sheet: "Aguardando envio",
      data: [
        [titulo("Atenção: estes registros ainda não chegaram ao servidor.")],
        ["Registrado em", "O quê", "Situação"].map(titulo),
        ...pendentes.map((i): Row => [
          new Date(i.criado_em).toLocaleString("pt-BR"), descreverItem(i, visao), i.erro ? `Erro: ${i.erro}` : "Aguardando envio",
        ]),
      ],
      columns: [{ width: 20 }, { width: 50 }, { width: 50 }],
    });
  }

  const dia = todayISO(); // data de quem exporta (o snapshot pode ser de outro dia, offline)
  await writeXlsxFile(sheets, { fontFamily: "Calibri", fontSize: 11 }).toFile(`cgstudio-backup-${dia}.xlsx`);
}
