import { brl, DIAS, formatDate, hhmm } from "@/app/dashboard/admin/format";
import type { ItemFila } from "./tipos";
import type { Visao } from "./visao";

// Descrição curta de um item da fila (Pendências e planilha).
export function descreverItem(item: ItemFila, visao: Visao) {
  const nome = (id: string) => visao.members.find((m) => m.member_id === id)?.nome ?? "aluno";
  switch (item.tipo) {
    case "pagamento":
      return `Pagamento de ${nome(item.payload.member_id)} · ${item.payload.valor != null ? brl(item.payload.valor) : "valor do plano"} em ${formatDate(item.payload.pago_em)}`;
    case "aluno_criar":
      return `Cadastro de ${item.payload.nome}`;
    case "aluno_editar":
      return `Alteração de ${nome(item.payload.member_id)}`;
    case "horario_entrar":
    case "horario_sair": {
      const s = visao.slots.find((x) => x.slot_id === item.payload.slot_id);
      const h = s ? `${DIAS[s.dia_semana]} ${hhmm(s.hora_inicio)}` : "horário";
      return `${nome(item.payload.member_id)} ${item.tipo === "horario_entrar" ? "entrar em" : "sair de"} ${h}`;
    }
  }
}
