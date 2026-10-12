import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase";

export const SLOTS_PUBLICOS_TAG = "slots-publicos";

export type SlotPublico = { dia_semana: number; hora_inicio: string; hora_fim: string };

// Horários ativos para a home (visitante sem login). Só dia/hora: a política `slots read public`
// e o grant por coluna do papel anon (migration 0005) não expõem capacidade nem vagas.
export async function getSlotsPublicos(): Promise<SlotPublico[]> {
  try {
    return await buscarSlots();
  } catch (e) {
    // A falha dos horários não derruba a home; a seção mostra o aviso de "em breve".
    console.error("[slots] falha ao carregar horários:", e);
    return [];
  }
}

async function buscarSlots(): Promise<SlotPublico[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(SLOTS_PUBLICOS_TAG);

  const { data, error } = await createPublicClient()
    .from("slots")
    .select("dia_semana, hora_inicio, hora_fim")
    .eq("ativo", true)
    .order("hora_inicio");

  if (error) throw new Error(`Falha ao carregar horários: ${error.message}`);
  return data;
}
