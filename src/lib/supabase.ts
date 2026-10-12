import { createClient } from "@supabase/supabase-js";

export type Skill = {
  id: number;
  slug: string;
  name: string;
  category: string;
  description: string;
  use_case: string | null;
  url: string | null;
  kind: "skill" | "repository" | "area";
};

// Cliente anônimo e sem sessão: o catálogo é público (RLS libera só SELECT),
// então não depende de cookies e pode rodar dentro de `use cache`.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
