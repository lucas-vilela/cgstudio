"use server";

import { revalidatePath, updateTag } from "next/cache";
import { SLOTS_PUBLICOS_TAG } from "@/lib/slots";
import { admin, fail, type Result } from "./action-utils";
import { friendlyError } from "./errors";
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
}): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  if (!STATUS.includes(input.status)) return fail("Status inválido.");
  if (input.valorAcordado != null && !(input.valorAcordado >= 0)) return fail("Valor inválido.");
  if (input.treinoIds && !input.treinoIds.every((id) => Number.isInteger(id) && id > 0))
    return fail("Treino inválido.");

  const { data, error } = await a.supabase
    .from("members")
    .update({ plan_id: input.planId, valor_acordado: input.valorAcordado, status: input.status })
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
