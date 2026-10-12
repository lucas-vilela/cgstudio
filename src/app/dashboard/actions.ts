"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { validateMember, type FieldErrors } from "./members";

export type SaveState = {
  ok: boolean;
  message?: string;
  errors?: FieldErrors;
};

// Aluno edita só nome e telefone do próprio registro (trigger/RLS reforçam).
export async function saveMember(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const user = await getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Entre novamente." };

  const parsed = validateMember(Object.fromEntries(formData));
  if ("errors" in parsed) return { ok: false, errors: parsed.errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update(parsed.data)
    .eq("auth_user_id", user.id)
    .select("id");

  if (error || !data?.length)
    return { ok: false, message: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/dashboard");
  return { ok: true, message: "Dados salvos." };
}
