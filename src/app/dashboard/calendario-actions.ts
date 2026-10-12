"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ERRO_GENERICO,
  mensagemErro,
  type Resultado,
  type ResultadoVagas,
} from "./calendario-lib";

const ehId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const ehData = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// As regras (limite do plano, lotação, status) são impostas pelas RPCs; aqui só validamos
// o formato e traduzimos o código de erro.
async function rpc(fn: string, args?: Record<string, unknown>): Promise<Resultado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, message: mensagemErro(error) };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function entrarSlot(slotId: number): Promise<Resultado> {
  if (!ehId(slotId)) return { ok: false, message: ERRO_GENERICO };
  return rpc("join_slot", { p_slot_id: slotId });
}

export async function sairSlot(slotId: number): Promise<Resultado> {
  if (!ehId(slotId)) return { ok: false, message: ERRO_GENERICO };
  return rpc("leave_slot", { p_slot_id: slotId });
}

export async function agendarExperimental(slotId: number, data: string): Promise<Resultado> {
  if (!ehId(slotId) || !ehData(data)) return { ok: false, message: ERRO_GENERICO };
  return rpc("book_trial", { p_slot_id: slotId, p_data: data });
}

export async function cancelarExperimental(bookingId: number): Promise<Resultado> {
  if (!ehId(bookingId)) return { ok: false, message: ERRO_GENERICO };
  return rpc("cancel_trial", { p_booking_id: bookingId });
}

export async function vagasNaData(slotId: number, data: string): Promise<ResultadoVagas> {
  if (!ehId(slotId) || !ehData(data)) return { ok: false, message: ERRO_GENERICO };
  const supabase = await createClient();
  const { data: vagas, error } = await supabase.rpc("slot_vagas_na_data", {
    p_slot_id: slotId,
    p_data: data,
  });
  if (error || typeof vagas !== "number") return { ok: false, message: mensagemErro(error) };
  return { ok: true, vagas };
}
