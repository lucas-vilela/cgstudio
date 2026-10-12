"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CMS_TAGS } from "@/lib/cms";
import { TREINO_ICONES } from "@/lib/treino-icones";
import { admin, done, fail, type Result } from "./action-utils";
import { friendlyError } from "./errors";
import type { DepoimentoStatus, SiteConfigRow } from "./types";

const refresh = () => revalidatePath("/dashboard/admin", "layout");

// ---------------------------------------------------------------- planos

export async function updatePlano(input: {
  id: number;
  valorPadrao: number;
  descricao: string;
  exibirNaHome: boolean;
}): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  if (!Number.isFinite(input.valorPadrao) || input.valorPadrao < 0 || input.valorPadrao > 100000)
    return fail("Valor inválido.");
  const descricao = input.descricao.trim();
  if (descricao.length > 120) return fail("Descrição muito longa (máx. 120).");

  const { data, error } = await a.supabase
    .from("plans")
    .update({
      valor_padrao: Math.round(input.valorPadrao * 100) / 100,
      descricao: descricao || null,
      exibir_na_home: !!input.exibirNaHome,
    })
    .eq("id", input.id)
    .select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível salvar o plano."));
  updateTag(CMS_TAGS.planos);
  refresh();
  return done();
}

// ---------------------------------------------------------------- treinos

function validateTreino(i: { nome: string; descricao: string; icone: string }) {
  const nome = i.nome.trim();
  const descricao = i.descricao.trim();
  if (!nome || nome.length > 60) return "Informe o nome (até 60 caracteres).";
  if (!descricao || descricao.length > 200) return "Informe a descrição (até 200 caracteres).";
  if (!Object.hasOwn(TREINO_ICONES, i.icone)) return "Ícone inválido.";
  return null;
}

export async function saveTreino(input: {
  id: number | null;
  nome: string;
  descricao: string;
  icone: string;
}): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const invalid = validateTreino(input);
  if (invalid) return fail(invalid);
  const row = { nome: input.nome.trim(), descricao: input.descricao.trim(), icone: input.icone };

  if (input.id == null) {
    const { data: ultimo } = await a.supabase
      .from("treinos")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await a.supabase.from("treinos").insert({ ...row, ordem: (ultimo?.ordem ?? 0) + 1 });
    if (error) return fail(friendlyError(error, "Não foi possível criar o treino."));
  } else {
    const { data, error } = await a.supabase.from("treinos").update(row).eq("id", input.id).select("id");
    if (error || !data?.length) return fail(friendlyError(error, "Não foi possível salvar o treino."));
  }
  updateTag(CMS_TAGS.treinos);
  refresh();
  return done();
}

export async function setTreinoAtivo(id: number, ativo: boolean): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { data, error } = await a.supabase.from("treinos").update({ ativo }).eq("id", id).select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível alterar o treino."));
  updateTag(CMS_TAGS.treinos);
  refresh();
  return done();
}

export async function deleteTreino(id: number): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { data, error } = await a.supabase.from("treinos").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível excluir o treino."));
  updateTag(CMS_TAGS.treinos);
  refresh();
  return done();
}

// Troca de lugar com o vizinho e renumera a lista inteira (evita empates em `ordem`).
export async function moveTreino(id: number, direcao: "up" | "down"): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const { data, error } = await a.supabase.from("treinos").select("id,ordem").order("ordem").order("id");
  if (error || !data) return fail(friendlyError(error, "Não foi possível reordenar."));
  const ids = data.map((t) => t.id);
  const i = ids.indexOf(id);
  const j = direcao === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return done();
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const atual = new Map(data.map((t) => [t.id, t.ordem]));
  for (const [pos, tid] of ids.entries()) {
    if (atual.get(tid) === pos + 1) continue;
    const res = await a.supabase.from("treinos").update({ ordem: pos + 1 }).eq("id", tid);
    if (res.error) return fail(friendlyError(res.error, "Não foi possível reordenar."));
  }
  updateTag(CMS_TAGS.treinos);
  refresh();
  return done();
}

// ---------------------------------------------------------------- depoimentos

const ACAO_STATUS = {
  aprovar: "aprovado",
  recusar: "recusado",
  esconder: "oculto",
  mostrar: "aprovado",
} as const satisfies Record<string, DepoimentoStatus>;

export async function moderarDepoimento(
  id: number,
  acao: keyof typeof ACAO_STATUS | "excluir",
): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);

  if (acao === "excluir") {
    const { data, error } = await a.supabase.from("depoimentos").delete().eq("id", id).select("id");
    if (error || !data?.length) return fail(friendlyError(error, "Não foi possível excluir."));
  } else {
    if (!Object.hasOwn(ACAO_STATUS, acao)) return fail("Ação inválida.");
    const status = ACAO_STATUS[acao];
    const { data, error } = await a.supabase.from("depoimentos").update({ status }).eq("id", id).select("id");
    if (error?.message?.includes("aluno_sem_nome"))
      return fail("O aluno está sem nome no cadastro. Preencha o nome dele antes de publicar.");
    if (error || !data?.length) return fail(friendlyError(error, "Não foi possível atualizar o depoimento."));
  }
  updateTag(CMS_TAGS.depoimentos);
  refresh();
  return done();
}

export async function editarDepoimento(id: number, texto: string): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const limpo = texto.trim();
  if (limpo.length < 10 || limpo.length > 500) return fail("O depoimento deve ter entre 10 e 500 caracteres.");
  const { data, error } = await a.supabase
    .from("depoimentos")
    .update({ texto: limpo, ajustado_pelo_admin: true })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível salvar o texto."));
  updateTag(CMS_TAGS.depoimentos);
  refresh();
  return done();
}

// ---------------------------------------------------------------- textos da home

const TEXTO_MAX: Record<Exclude<keyof SiteConfigRow, "whatsapp" | "instagram">, number> = {
  hero_titulo: 80,
  hero_destaque: 80,
  hero_subtitulo: 200,
  nota_modalidades: 200,
  nota_planos: 200,
  nota_horarios: 200,
  nota_contato: 200,
  meta_descricao: 300,
};

export async function saveSiteConfig(input: SiteConfigRow): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);

  const row: Record<string, string | null> = {};
  for (const [k, max] of Object.entries(TEXTO_MAX)) {
    const v = (input[k as keyof SiteConfigRow] ?? "").trim();
    if (v.length > max) return fail(`Texto muito longo em “${k}” (máx. ${max}).`);
    row[k] = v || null;
  }

  const whatsapp = (input.whatsapp ?? "").replace(/\D/g, "");
  if (whatsapp && !/^\d{10,15}$/.test(whatsapp))
    return fail("WhatsApp inválido. Use DDI + DDD + número (ex.: 5553984573198).");
  row.whatsapp = whatsapp || null;

  const instagram = (input.instagram ?? "").trim().replace(/^@/, "");
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram))
    return fail("Instagram inválido. Use só o nome de usuário (letras, números, ponto e _).");
  row.instagram = instagram || null;

  const { error } = await a.supabase.from("site_config").upsert({ id: 1, ...row });
  if (error) return fail(friendlyError(error, "Não foi possível salvar os textos."));
  updateTag(CMS_TAGS.textos);
  refresh();
  return done();
}
