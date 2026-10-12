import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { isAdmin } from "@/app/dashboard/data";

// Autorização das rotas do app offline do admin. A RLS/RPCs também exigem admin.
type Auth =
  | { ok: false; status: 401 | 403; resposta: NextResponse }
  | { ok: true; user: { id: string }; supabase: Awaited<ReturnType<typeof createClient>> };

export async function adminDaRequisicao(): Promise<Auth> {
  const user = await getUser();
  if (!user) return { ok: false, status: 401, resposta: NextResponse.json({ erro: "sessao" }, { status: 401, headers: semCache }) };
  if (!(await isAdmin(user.id)))
    return { ok: false, status: 403, resposta: NextResponse.json({ erro: "nao_admin" }, { status: 403, headers: semCache }) };
  return { ok: true, user, supabase: await createClient() };
}

export const semCache = { "Cache-Control": "no-store" };
