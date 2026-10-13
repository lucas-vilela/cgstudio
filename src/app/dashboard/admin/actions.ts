"use server";

import { revalidatePath, updateTag } from "next/cache";
import { SLOTS_PUBLICOS_TAG } from "@/lib/slots";
import { admin, fail, type Result } from "./action-utils";
import { friendlyError } from "./errors";

export type { Result } from "./action-utils";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const refresh = () => revalidatePath("/dashboard/admin", "layout");
const refreshHome = () => updateTag(SLOTS_PUBLICOS_TAG);

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

export async function setUserRole(userId: string, role: "admin" | "member"): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { error } = await a.supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) return fail(friendlyError(error));
  refresh();
  return { ok: true, data: undefined };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ficha do aluno: apagar não tem volta, então não passa pela fila offline (só online).
export async function apagarAnamnese(memberId: string): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  if (!UUID_RE.test(memberId)) return fail("Aluno inválido.");
  const { error } = await a.supabase.from("member_anamneses").delete().eq("member_id", memberId);
  if (error) return fail(friendlyError(error, "Não foi possível apagar a anamnese."));
  refresh();
  return { ok: true, data: undefined };
}

export async function excluirAvaliacao(avaliacaoId: string): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  if (!UUID_RE.test(avaliacaoId)) return fail("Avaliação inválida.");
  const { error } = await a.supabase.from("member_avaliacoes").delete().eq("id", avaliacaoId);
  if (error) return fail(friendlyError(error, "Não foi possível excluir a avaliação."));
  refresh();
  return { ok: true, data: undefined };
}
