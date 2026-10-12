import { createClient } from "@/lib/supabase/server";
import type { Experimental, Financeiro, SlotVaga } from "./calendario-lib";

export type DadosCalendario = {
  slots: SlotVaga[];
  financeiro: Financeiro;
  meusSlotIds: number[];
  experimental: Experimental | null;
};

// Tudo é lido com a sessão do aluno: a RLS entrega só a própria linha/alocações.
// Retorna null se alguma leitura falhar (ex.: migration 0003 ainda não aplicada).
export async function getDadosCalendario(memberId: string): Promise<DadosCalendario | null> {
  const supabase = await createClient();

  const [slots, fin, meus, trial] = await Promise.all([
    supabase.from("slots_vagas").select("*").eq("ativo", true).order("hora_inicio"),
    supabase.from("member_financeiro").select("*").eq("member_id", memberId).maybeSingle(),
    supabase.from("slot_members").select("slot_id").eq("member_id", memberId),
    supabase.from("trial_bookings").select("id, slot_id, data").eq("member_id", memberId).maybeSingle(),
  ]);

  if (slots.error || fin.error || meus.error || trial.error || !fin.data) return null;

  return {
    slots: slots.data as SlotVaga[],
    financeiro: fin.data as Financeiro,
    meusSlotIds: (meus.data ?? []).map((r) => r.slot_id as number),
    experimental: (trial.data as Experimental | null) ?? null,
  };
}
