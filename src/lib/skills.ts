import { cacheLife } from "next/cache";
import { createPublicClient, type Skill } from "@/lib/supabase";

export async function getSkills(): Promise<Skill[]> {
  "use cache";
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("skills")
    .select("id, slug, name, category, description, use_case, url, kind")
    .order("id");

  if (error) throw new Error(`Falha ao carregar skills: ${error.message}`);
  return data;
}
