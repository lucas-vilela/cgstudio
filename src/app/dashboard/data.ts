import { cache } from "react";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Member } from "./members";

export const getCurrentUser = cache(getUser);

export const isAdmin = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "admin";
});

export async function getOwnMember(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  return data as Member | null;
}

export async function listMembers(query: string) {
  const supabase = await createClient();
  let req = supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  // Remove caracteres que quebram a sintaxe do filtro .or() do PostgREST.
  const q = query.trim().replace(/[%,()*\\]/g, " ").trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const parts = [`nome.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (digits.length >= 3) parts.push(`telefone.ilike.%${digits}%`);
    req = req.or(parts.join(","));
  }
  const { data } = await req;
  return (data ?? []) as Member[];
}
