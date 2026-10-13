import type { AdminMember, Plan, SlotRow } from "@/app/dashboard/admin/types";
import type { AdminSnapshot, ItemFila, PagamentoSnapshot } from "./tipos";

// O que as telas mostram: snapshot do servidor + fila local aplicada por cima. Itens da fila
// aparecem marcados ("aguardando envio" / "com erro"); números calculados pelo servidor
// (vencimento, situação, resumo) não são inventados para o que ainda não foi enviado.

export type Marca = { pendente?: boolean; erro?: string };
export type MembroVisao = AdminMember & Marca & { pagamentoPendente?: boolean };
export type PagamentoVisao = PagamentoSnapshot & Marca & { fila_id?: string };
export type SlotVisao = Omit<SlotRow, "alunos"> & {
  alunos: (SlotRow["alunos"][number] & Marca)[];
};

export type Visao = {
  snapshot: AdminSnapshot;
  members: MembroVisao[];
  slots: SlotVisao[];
  pagamentos: PagamentoVisao[];
  plans: Plan[];
  // Alunos com pagamento aguardando envio (marca nas listas que vêm prontas do servidor).
  pagamentosPendentes: Set<string>;
};

const marca = (i: ItemFila): Marca => (i.status === "erro" ? { erro: i.erro } : { pendente: true });

function aplicarPlano(m: MembroVisao, plans: Plan[]): MembroVisao {
  const p = plans.find((x) => x.id === m.plan_id);
  return {
    ...m,
    plano_nome: p?.nome ?? null,
    vezes_semana: p?.vezes_semana ?? null,
    valor: m.valor_acordado ?? p?.valor_padrao ?? null,
  };
}

export function montarVisao(snapshot: AdminSnapshot, fila: ItemFila[]): Visao {
  const plans = snapshot.plans;
  const members = new Map<string, MembroVisao>(snapshot.members.map((m) => [m.member_id, { ...m }]));
  const slots: SlotVisao[] = snapshot.slots.map((s) => ({ ...s, alunos: s.alunos.map((a) => ({ ...a })) }));
  const pagamentos: PagamentoVisao[] = [];

  for (const item of fila) {
    switch (item.tipo) {
      case "aluno_criar": {
        const p = item.payload;
        members.set(
          p.member_id,
          aplicarPlano(
            {
              member_id: p.member_id,
              nome: p.nome,
              email: p.email,
              telefone: p.telefone.replace(/\D/g, ""),
              status: "pendente",
              plan_id: p.plan_id,
              plano_nome: null,
              vezes_semana: null,
              slots_usados: 0,
              valor: null,
              valor_acordado: p.valor_acordado,
              vencimento: null,
              dias_para_vencer: null,
              situacao: "sem_vencimento",
              treino_ids: p.treino_ids,
              tem_login: false,
              ...marca(item),
            },
            plans,
          ),
        );
        break;
      }
      case "aluno_editar": {
        const atual = members.get(item.payload.member_id);
        if (!atual) break;
        const c = item.payload.campos;
        const editado: MembroVisao = {
          ...atual,
          ...("plan_id" in c ? { plan_id: c.plan_id ?? null } : {}),
          ...("valor_acordado" in c ? { valor_acordado: c.valor_acordado ?? null } : {}),
          ...(c.status ? { status: c.status } : {}),
          ...(c.nome !== undefined ? { nome: c.nome } : {}),
          ...(c.telefone !== undefined ? { telefone: c.telefone.replace(/\D/g, "") } : {}),
          ...("email" in c ? { email: c.email ?? null } : {}),
          ...(c.treino_ids ? { treino_ids: c.treino_ids } : {}),
          ...marca(item),
        };
        members.set(atual.member_id, aplicarPlano(editado, plans));
        break;
      }
      case "pagamento": {
        const p = item.payload;
        const m = members.get(p.member_id);
        if (m) members.set(p.member_id, { ...m, pagamentoPendente: true, ...(item.status === "erro" ? { erro: item.erro } : {}) });
        pagamentos.push({
          id: -1,
          fila_id: item.id,
          member_id: p.member_id,
          nome: m?.nome ?? null,
          valor: p.valor ?? m?.valor ?? 0,
          pago_em: p.pago_em,
          forma: p.forma,
          observacao: p.observacao,
          ...marca(item),
        });
        break;
      }
      case "horario_entrar":
      case "horario_sair": {
        const s = slots.find((x) => x.slot_id === item.payload.slot_id);
        const m = members.get(item.payload.member_id);
        if (!s) break;
        const ja = s.alunos.findIndex((a) => a.member_id === item.payload.member_id);
        if (item.tipo === "horario_entrar" && ja < 0) {
          s.alunos.push({ member_id: item.payload.member_id, nome: m?.nome ?? null, email: m?.email ?? null, ...marca(item) });
          if (m) members.set(m.member_id, { ...m, slots_usados: m.slots_usados + 1 });
        } else if (item.tipo === "horario_sair" && ja >= 0) {
          s.alunos.splice(ja, 1);
          if (m) members.set(m.member_id, { ...m, slots_usados: Math.max(0, m.slots_usados - 1) });
        }
        s.ocupados = s.alunos.length;
        s.vagas = Math.max(0, s.capacidade - s.ocupados);
        break;
      }
    }
  }

  for (const s of slots) s.alunos.sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
  return {
    snapshot,
    members: [...members.values()].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
    slots,
    pagamentos: [...pagamentos, ...snapshot.pagamentos],
    plans,
    pagamentosPendentes: new Set(fila.filter((i) => i.tipo === "pagamento").map((i) => i.payload.member_id)),
  };
}
