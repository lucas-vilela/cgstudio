import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SENHA_TESTE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, SUPABASE_URL, USUARIOS, garantirBancoLocal,
} from "../supabase-local";

// Acesso direto ao banco local nos testes:
// - `db`: chave de serviço (ignora RLS) para criar/apagar fixtures e conferir tabelas.
// - `clienteComo(email)`: sessão de um usuário, para ler as views como o app lê (elas usam
//   private.hoje(), que só o papel authenticated executa) e para testar RLS.

garantirBancoLocal();

const semSessao = { auth: { persistSession: false, autoRefreshToken: false } };

export const db: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, semSessao);

export const anon = () => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, semSessao);

const clientes = new Map<string, Promise<SupabaseClient>>();

export function clienteComo(email: string): Promise<SupabaseClient> {
  let c = clientes.get(email);
  if (!c) {
    c = (async () => {
      const sb = anon();
      const { error } = await sb.auth.signInWithPassword({ email, password: SENHA_TESTE });
      if (error) throw new Error(`login de ${email}: ${error.message}`);
      return sb;
    })();
    clientes.set(email, c);
  }
  return c;
}

export const comoAdmin = () => clienteComo(USUARIOS.admin);

// Lança se o Supabase devolver erro: nos testes, erro de banco é sempre falha.
export function ok<T>(res: { data: T; error: { message: string } | null }, oQue = "consulta"): T {
  if (res.error) throw new Error(`${oQue}: ${res.error.message}`);
  return res.data;
}

export async function memberPorEmail(email: string) {
  return ok(await db.from("members").select("*").ilike("email", email).maybeSingle(), "members");
}

export async function memberPorId(id: string) {
  return ok(await db.from("members").select("*").eq("id", id).maybeSingle(), "members");
}

export async function planoId(nome: string): Promise<number> {
  const p = ok(await db.from("plans").select("id").eq("nome", nome).single(), "plans");
  return (p as { id: number }).id;
}

export async function treinoId(nome: string): Promise<number> {
  const t = ok(await db.from("treinos").select("id").eq("nome", nome).single(), "treinos");
  return (t as { id: number }).id;
}

/** Linha de member_financeiro como o admin vê (situação, dias para vencer, valor). */
export async function financeiro(memberId: string) {
  const sb = await comoAdmin();
  return ok(await sb.from("member_financeiro").select("*").eq("member_id", memberId).single(), "member_financeiro") as {
    status: string; plano_nome: string | null; vezes_semana: number | null; slots_usados: number;
    valor: number | null; vencimento: string | null; dias_para_vencer: number | null; situacao: string;
  };
}
