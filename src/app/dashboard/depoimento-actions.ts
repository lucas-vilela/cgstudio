"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CMS_TAGS } from "@/lib/cms";
import { createClient, getUser } from "@/lib/supabase/server";
import { friendlyError } from "./admin/errors";

export type DepoimentoState = { ok: boolean; message?: string };

// Aluno envia ou edita o próprio depoimento. As regras (aluno ativo, 10–500 caracteres, volta para
// "em análise") vivem na função do banco; aqui só autenticamos e traduzimos o erro.
export async function enviarDepoimento(_prev: DepoimentoState, formData: FormData): Promise<DepoimentoState> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Entre novamente." };

  const texto = String(formData.get("texto") ?? "").trim();
  if (texto.length < 10 || texto.length > 500)
    return { ok: false, message: "O depoimento deve ter entre 10 e 500 caracteres." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("enviar_depoimento", { p_texto: texto });
  if (error) return { ok: false, message: friendlyError(error, "Não foi possível enviar. Tente novamente.") };

  // Se o depoimento estava publicado, a edição o tira da home: o cache precisa cair agora.
  updateTag(CMS_TAGS.depoimentos);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/admin", "layout");
  return { ok: true, message: "Recebemos seu depoimento. Ele aparece na home depois da aprovação." };
}
