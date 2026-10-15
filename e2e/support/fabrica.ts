import { randomUUID } from "node:crypto";
import { SENHA_TESTE } from "../supabase-local";
import { addDias, hojeSP } from "./datas";
import { comoAdmin, db, ok, planoId, treinoId } from "./db";

// Fixtures por teste. Tudo que é criado aqui leva a marca "E2E" (nome/e-mail) ou fica em horário
// de madrugada (00:00–05:59, faixa que o studio não usa) e é apagado ao fim do teste — e também no
// início da suíte, caso uma execução anterior tenha sido interrompida (ver limparRestos).

let seq = 0;
const tag = () => `${Date.now().toString(36)}${process.pid.toString(36)}${(seq++).toString(36)}`;

/** Telefone celular de SP único (11 dígitos). */
export function telefoneUnico() {
  const n = `${Date.now() % 1e5}${Math.floor(Math.random() * 1e4)}`.padStart(9, "0").slice(-8);
  return `119${n}`;
}

export type Plano = "1x" | "2x" | "3x";

export type OpcoesAluno = {
  /** Primeiro nome; o sobrenome é sempre "Teste" (home mostra "Nome T."). */
  nome?: string;
  status?: "ativo" | "inativo" | "pendente";
  plano?: Plano | null;
  valorAcordado?: number | null;
  /** Vencimento em dias a partir de hoje (SP). null = sem vencimento. */
  vencimentoEm?: number | null;
  telefone?: string | null;
  /** Com conta (auth.users + login). Sem conta = cadastrado pelo admin. */
  login?: boolean;
  admin?: boolean;
  treinos?: string[];
};

export type Aluno = {
  id: string;
  userId: string | null;
  email: string;
  nome: string;
  telefone: string | null;
};

export type Slot = {
  id: number;
  dia_semana: number;
  hora_inicio: string; // "02:17"
  hora_fim: string;
  capacidade: number;
};

export class Fabrica {
  private usuarios: string[] = [];
  private membros: string[] = [];
  private slots: number[] = [];

  constructor(private readonly slotBase: number) {}

  private slotSeq = 0;

  async aluno(o: OpcoesAluno = {}): Promise<Aluno> {
    const t = tag();
    const nome = `${o.nome ?? `E2e${t}`} Teste`;
    const email = `e2e-${t}@cgstudio.test`;
    const telefone = o.telefone === undefined ? telefoneUnico() : o.telefone;
    let id: string;
    let userId: string | null = null;

    if (o.login ?? true) {
      const { data, error } = await db.auth.admin.createUser({
        email, password: SENHA_TESTE, email_confirm: true, user_metadata: { full_name: nome },
      });
      if (error) throw new Error(`createUser: ${error.message}`);
      userId = data.user.id;
      this.usuarios.push(userId);
      const m = ok(await db.from("members").select("id").eq("auth_user_id", userId).single(), "member do usuário");
      id = (m as { id: string }).id;
      if (o.admin) ok(await db.from("user_roles").update({ role: "admin" }).eq("user_id", userId), "user_roles");
    } else {
      id = randomUUID();
      ok(await (await comoAdmin()).from("members").insert({ id, nome, email }), "insert member");
      this.membros.push(id);
    }

    const patch: Record<string, unknown> = {
      telefone,
      status: o.status ?? "pendente",
      plan_id: o.plano ? await planoId(o.plano) : null,
      valor_acordado: o.valorAcordado ?? null,
      vencimento: o.vencimentoEm == null ? null : addDias(hojeSP(), o.vencimentoEm),
    };
    // O trigger que protege plano/status/vencimento exige admin (a chave de serviço não passa nele).
    ok(await (await comoAdmin()).from("members").update(patch).eq("id", id), "update member");

    if (o.treinos?.length) {
      const rows = await Promise.all(o.treinos.map(async (n) => ({ member_id: id, treino_id: await treinoId(n) })));
      ok(await db.from("member_treinos").insert(rows), "member_treinos");
    }
    return { id, userId, email, nome, telefone };
  }

  /**
   * Horário só deste teste, numa linha da grade só dele: madrugada, e o minuto vem do índice do
   * worker (testes em paralelo nunca usam o mesmo horário).
   */
  /** Faixa de horário exclusiva deste worker (não grava nada). */
  horarioLivre() {
    const minutos = this.slotBase + (this.slotSeq++ % 18);
    const hh = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
    return { inicio: hh(minutos), fim: hh(minutos + 45) };
  }

  async slot(o: { dia?: number; capacidade?: number; ativo?: boolean } = {}): Promise<Slot> {
    const h = this.horarioLivre();
    const row = {
      dia_semana: o.dia ?? 4, // quinta: sempre na grade (seg–sex), longe do fim de semana
      hora_inicio: h.inicio,
      hora_fim: h.fim,
      capacidade: o.capacidade ?? 3,
      ativo: o.ativo ?? true,
    };
    const s = ok(await db.from("slots").insert(row).select("id").single(), "insert slot") as { id: number };
    this.slots.push(s.id);
    return { id: s.id, ...row };
  }

  async alocar(slotId: number, memberId: string) {
    ok(await db.from("slot_members").insert({ slot_id: slotId, member_id: memberId }), "slot_members");
  }

  async pagamento(memberId: string, valor: number, pagoEmDias = 0, forma = "pix") {
    ok(
      await db.from("payments").insert({ member_id: memberId, valor, pago_em: addDias(hojeSP(), pagoEmDias), forma }),
      "payments",
    );
  }

  async depoimento(memberId: string, texto: string, status: "pendente" | "aprovado" | "recusado" | "oculto" = "pendente") {
    const d = ok(await db.from("depoimentos").insert({ member_id: memberId, texto, status }).select("id").single(), "depoimentos");
    return (d as { id: number }).id;
  }

  /** Registra algo criado pela própria tela (ex.: aluno cadastrado pelo admin) para apagar no fim. */
  registrarMembro(id: string) {
    this.membros.push(id);
  }
  registrarSlot(id: number) {
    this.slots.push(id);
  }

  async limpar() {
    if (this.slots.length) await db.from("slots").delete().in("id", this.slots);
    if (this.membros.length) await db.from("members").delete().in("id", this.membros);
    // Apagar o usuário apaga o member (on delete cascade) e, com ele, pagamentos, horários etc.
    for (const u of this.usuarios) await db.auth.admin.deleteUser(u);
  }
}

/** Apaga o que sobrou de execuções interrompidas. */
export async function limparRestos() {
  await db.from("slots").delete().lt("hora_inicio", "06:00");
  await db.from("members").delete().or("email.ilike.e2e-%,nome.ilike.e2e%");
  await db.from("plans").delete().ilike("nome", "E2E%");
  await db.from("treinos").delete().ilike("nome", "E2E%");
  for (let page = 1; ; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const lixo = (data?.users ?? []).filter((u) => u.email?.startsWith("e2e-"));
    for (const u of lixo) await db.auth.admin.deleteUser(u.id);
    if (!data || data.users.length < 200) break;
  }
}
