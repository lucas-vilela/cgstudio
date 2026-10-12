import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase";

// Tags de cache da leitura pública da home. As ações do admin chamam `updateTag` com elas.
export const CMS_TAGS = {
  planos: "home-planos",
  treinos: "home-treinos",
  depoimentos: "home-depoimentos",
  textos: "home-textos",
} as const;

export type PlanoHome = {
  nome: string;
  vezes_semana: number;
  valor_padrao: number;
  descricao: string | null;
};
export type TreinoHome = { nome: string; descricao: string; icone: string };
export type DepoimentoHome = { id: number; texto: string; nome_exibicao: string };

export type SiteConfig = {
  whatsapp: string;
  instagram: string;
  hero_titulo: string;
  hero_destaque: string;
  hero_subtitulo: string;
  nota_modalidades: string;
  nota_planos: string;
  nota_horarios: string;
  nota_contato: string;
  meta_descricao: string;
};

// Textos que existem hoje na home. O banco manda; isto só cobre falha de consulta ou campo vazio.
export const SITE_CONFIG_PADRAO: SiteConfig = {
  whatsapp: "5553984573198",
  instagram: "studioclaricegeiger",
  hero_titulo: "Corpo em ação,",
  hero_destaque: "mente em equilíbrio.",
  hero_subtitulo: "Turmas pequenas, atenção ao seu movimento e horários que cabem na sua semana.",
  nota_modalidades: "Aulas conduzidas de perto, com poucas pessoas por horário.",
  nota_planos: "Cobrança mensal, pela frequência semanal. Pagamento combinado direto com o studio.",
  nota_horarios:
    "Turmas fixas, com poucas pessoas por horário. Entre com sua conta Google para ver as vagas e escolher os seus horários.",
  nota_contato: "Fale com a gente para tirar dúvidas ou marcar sua aula experimental.",
  meta_descricao:
    "CG Studio: studio de movimento com turmas pequenas e atenção ao seu movimento. Conheça modalidades, planos e horários.",
};

export const TREINOS_PADRAO: TreinoHome[] = [
  { nome: "Funcional", descricao: "Circuitos em turma pequena para força, fôlego e coordenação.", icone: "dumbbell" },
  { nome: "Pilates", descricao: "Controle, postura e respiração, com ajuste individual.", icone: "activity" },
  { nome: "Alongamento e mobilidade", descricao: "Mais amplitude de movimento e menos tensão no dia a dia.", icone: "person-standing" },
  { nome: "Treino em dupla ou trio", descricao: "Atenção próxima do professor, no seu ritmo.", icone: "users" },
];

// Falha de consulta nunca derruba a home: registra e devolve o padrão. O erro fica FORA do
// `use cache` de propósito, para o padrão não ficar guardado no cache por minutos.
async function seguro<T>(fn: () => Promise<T>, padrao: T, o_que: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[cms] falha ao carregar ${o_que}:`, e);
    return padrao;
  }
}

async function buscarPlanos(): Promise<PlanoHome[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CMS_TAGS.planos);
  const { data, error } = await createPublicClient()
    .from("plans")
    .select("nome, vezes_semana, valor_padrao, descricao")
    .eq("exibir_na_home", true)
    .order("vezes_semana");
  if (error) throw new Error(error.message);
  return data.map((p) => ({ ...p, valor_padrao: Number(p.valor_padrao) }));
}

async function buscarTreinos(): Promise<TreinoHome[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CMS_TAGS.treinos);
  const { data, error } = await createPublicClient()
    .from("treinos")
    .select("nome, descricao, icone")
    .eq("ativo", true)
    .order("ordem")
    .order("nome");
  if (error) throw new Error(error.message);
  return data;
}

async function buscarDepoimentos(): Promise<DepoimentoHome[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CMS_TAGS.depoimentos);
  const { data, error } = await createPublicClient()
    .from("depoimentos")
    .select("id, texto, nome_exibicao")
    .eq("status", "aprovado")
    .order("id", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  return data;
}

async function buscarTextos(): Promise<Partial<SiteConfig>> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CMS_TAGS.textos);
  const { data, error } = await createPublicClient()
    .from("site_config")
    .select(
      "whatsapp, instagram, hero_titulo, hero_destaque, hero_subtitulo, nota_modalidades, nota_planos, nota_horarios, nota_contato, meta_descricao",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? {};
}

// Preço errado é pior que nenhum: se a consulta falhar, a seção Planos some (não usa padrão).
export async function getPlanosHome(): Promise<PlanoHome[]> {
  return seguro(buscarPlanos, [], "planos");
}

export async function getTreinosHome(): Promise<TreinoHome[]> {
  const treinos = await seguro(buscarTreinos, TREINOS_PADRAO, "treinos");
  return treinos.length ? treinos : TREINOS_PADRAO;
}

export async function getDepoimentosHome(): Promise<DepoimentoHome[]> {
  return seguro(buscarDepoimentos, [], "depoimentos");
}

// Campo nulo ou em branco no banco cai no texto padrão.
export async function getSiteConfig(): Promise<SiteConfig> {
  const linha = await seguro(buscarTextos, {} as Partial<SiteConfig>, "textos");
  const out = { ...SITE_CONFIG_PADRAO };
  for (const k of Object.keys(out) as (keyof SiteConfig)[]) {
    const v = linha[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}
