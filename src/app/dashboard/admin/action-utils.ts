import { createClient, getUser } from "@/lib/supabase/server";
import { isAdmin } from "../data";

export type Result<T = void> = { ok: true; data: T } | { ok: false; message: string };

export const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
export const done = (): Result => ({ ok: true, data: undefined });

// Autorização no servidor: a RLS/RPC do banco também exigem admin (defesa em profundidade).
export async function admin(): Promise<
  { error: string } | { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } }
> {
  const user = await getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  if (!(await isAdmin(user.id))) return { error: "Apenas administradores podem fazer isso." };
  return { supabase: await createClient(), user };
}
