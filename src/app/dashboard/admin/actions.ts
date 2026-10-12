"use server";

import { revalidatePath, updateTag } from "next/cache";
import { SLOTS_PUBLICOS_TAG } from "@/lib/slots";
import { admin, fail, type Result } from "./action-utils";
import { friendlyError } from "./errors";
import { validateDadosAluno } from "../members";
import { FORMAS } from "./types";

export type { Result } from "./action-utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUS = ["ativo", "inativo", "pendente"];

const refresh = () => revalidatePath("/dashboard/admin", "layout");
const refreshHome = () => updateTag(SLOTS_PUBLICOS_TAG);

export async function registerPayment(input: {
  memberId: string;
  forma: string;
  valor: number | null;
  pagoEm: string | null;
  observacao: string | null;
}): Promise<Result<{ vencimento: string }>> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  if (!FORMAS.some((f) => f.value === input.forma)) return fail("Forma de pagamento inválida.");
  if (input.valor != null && !(input.valor > 0)) return fail("Informe um valor maior que zero.");
  if (input.pagoEm && !DATE_RE.test(input.pagoEm)) return fail("Data inválida.");
  const obs = input.observacao?.trim() || null;
  if (obs && obs.length > 300) return fail("Observação muito longa (máx. 300).");

  const { data, error } = await a.supabase.rpc("register_payment", {
    p_member_id: input.memberId,
    p_forma: input.forma,
    p_valor: input.valor,
    p_pago_em: input.pagoEm || null,
    p_observacao: obs,
  });
  if (error) return fail(friendlyError(error));
  refresh();
  return { ok: true, data: { vencimento: String(data) } };
}

export async function updateMember(input: {
  memberId: string;
  planId: number | null;
  valorAcordado: number | null;
  status: string;
  // null = não mexer nos treinos (só envia quando o admin mudou a seleção).
  treinoIds: number[] | null;
  // Só para aluno sem conta Google; quem tem conta mantém nome/telefone próprios e e-mail do Google.
  dados?: { nome: string; telefone: string; email: string } | null;
}): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  if (!STATUS.includes(input.status)) return fail("Status inválido.");
  if (input.valorAcordado != null && !(input.valorAcordado >= 0)) return fail("Valor inválido.");
  if (input.treinoIds && !input.treinoIds.every((id) => Number.isInteger(id) && id > 0))
    return fail("Treino inválido.");

  const patch: Record<string, unknown> = {
    plan_id: input.planId,
    valor_acordado: input.valorAcordado,
    status: input.status,
  };
  if (input.dados) {
    const dados = validateDadosAluno(input.dados);
    if ("error" in dados) return fail(dados.error);
    const { data: atual } = await a.supabase
      .from("members").select("auth_user_id").eq("id", input.memberId).maybeSingle();
    if (atual?.auth_user_id) return fail("Este aluno tem conta Google: nome, telefone e e-mail são dele.");
    Object.assign(patch, dados.data);
  }

  const { data, error } = await a.supabase
    .from("members")
    .update(patch)
    .eq("id", input.memberId)
    .select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível salvar."));

  refresh();
  if (input.treinoIds) {
    const { error: treinosError } = await a.supabase.rpc("set_member_treinos", {
      p_member_id: input.memberId,
      p_treino_ids: [...new Set(input.treinoIds)],
    });
    if (treinosError)
      return fail(friendlyError(treinosError, "Plano e status salvos, mas não foi possível salvar os treinos."));
  }
  return { ok: true, data: undefined };
}

export async function createMember(input: {
  nome: string;
  telefone: string;
  email: string;
  planId: number | null;
  valorAcordado: number | null;
  treinoIds: number[];
}): Promise<Result<{ id: string }>> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const dados = validateDadosAluno(input);
  if ("error" in dados) return fail(dados.error);
  if (input.valorAcordado != null && !(input.valorAcordado >= 0)) return fail("Valor inválido.");
  if (!input.treinoIds.every((id) => Number.isInteger(id) && id > 0)) return fail("Treino inválido.");

  // Nasce pendente: vira ativo no primeiro pagamento registrado (register_payment).
  const { data, error } = await a.supabase
    .from("members")
    .insert({
      ...dados.data,
      plan_id: input.planId,
      valor_acordado: input.valorAcordado,
      status: "pendente",
    })
    .select("id")
    .single();
  if (error || !data) return fail(friendlyError(error, "Não foi possível cadastrar o aluno."));
  refresh();

  if (input.treinoIds.length) {
    const { error: treinosError } = await a.supabase.rpc("set_member_treinos", {
      p_member_id: data.id,
      p_treino_ids: [...new Set(input.treinoIds)],
    });
    if (treinosError)
      return fail(friendlyError(treinosError, "Aluno cadastrado, mas não foi possível salvar os treinos."));
  }
  return { ok: true, data: { id: data.id } };
}

export async function deleteMemberSemLogin(memberId: string): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { error } = await a.supabase.rpc("excluir_aluno_sem_login", { p_member_id: memberId });
  if (error) return fail(friendlyError(error, "Não foi possível excluir o aluno."));
  refresh();
  return { ok: true, data: undefined };
}

type SlotInput = { diaSemana: number; horaInicio: string; horaFim: string; capacidade: number };

function validateSlot(s: SlotInput) {
  if (!Number.isInteger(s.diaSemana) || s.diaSemana < 0 || s.diaSemana > 6) return "Dia inválido.";
  if (!TIME_RE.test(s.horaInicio) || !TIME_RE.test(s.horaFim)) return "Horário inválido.";
  if (s.horaFim <= s.horaInicio) return "O fim deve ser depois do início.";
  if (!Number.isInteger(s.capacidade) || s.capacidade < 1 || s.capacidade > 50)
    return "Capacidade deve ser de 1 a 50.";
  return null;
}

export async function saveSlot(input: SlotInput & { id: number | null }): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const invalid = validateSlot(input);
  if (invalid) return fail(invalid);

  const row = {
    dia_semana: input.diaSemana,
    hora_inicio: input.horaInicio,
    hora_fim: input.horaFim,
    capacidade: input.capacidade,
  };
  if (input.id == null) {
    const { error } = await a.supabase.from("slots").insert(row);
    if (error) return fail(friendlyError(error, "Não foi possível criar o slot."));
  } else {
    const { data, error } = await a.supabase.from("slots").update(row).eq("id", input.id).select("id");
    if (error || !data?.length) return fail(friendlyError(error, "Não foi possível salvar o slot."));
  }
  refresh();
  refreshHome();
  return { ok: true, data: undefined };
}

export async function setSlotAtivo(slotId: number, ativo: boolean): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { data, error } = await a.supabase.from("slots").update({ ativo }).eq("id", slotId).select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível alterar o slot."));
  refresh();
  refreshHome();
  return { ok: true, data: undefined };
}

export async function removeSlotMember(slotId: number, memberId: string): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { data, error } = await a.supabase
    .from("slot_members")
    .delete()
    .eq("slot_id", slotId)
    .eq("member_id", memberId)
    .select("slot_id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível remover o aluno."));
  refresh();
  return { ok: true, data: undefined };
}

export async function setUserRole(userId: string, role: "admin" | "member"): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { error } = await a.supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) return fail(friendlyError(error));
  refresh();
  return { ok: true, data: undefined };
}
