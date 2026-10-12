"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  PLANS,
  STATUSES,
  validateMember,
  type FieldErrors,
} from "./members";

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

// Admin altera plano e/ou status. Autorização checada aqui e na RLS/trigger.
export async function updateMemberAdmin(
  memberId: string,
  patch: { plano?: string; status?: string },
): Promise<{ ok: boolean; message?: string }> {
  const update: Record<string, string> = {};
  if (patch.status !== undefined) {
    if (!STATUSES.some((s) => s.value === patch.status))
      return { ok: false, message: "Status inválido." };
    update.status = patch.status;
  }
  if (patch.plano !== undefined) {
    if (!PLANS.some((p) => p.value === patch.plano))
      return { ok: false, message: "Plano inválido." };
    update.plano = patch.plano;
  }
  if (!Object.keys(update).length) return { ok: false, message: "Nada para alterar." };

  const user = await getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const supabase = await createClient();
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (role?.role !== "admin") return { ok: false, message: "Sem permissão." };

  const { data, error } = await supabase
    .from("members")
    .update(update)
    .eq("id", memberId)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "Não foi possível salvar." };

  revalidatePath("/dashboard/admin");
  return { ok: true };
}
