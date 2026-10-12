"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CMS_TAGS } from "@/lib/cms";
import { TREINO_ICONES } from "@/lib/treino-icones";
import { admin, done, fail, type Result } from "./action-utils";
import { friendlyError } from "./errors";
import type { DepoimentoStatus, SiteConfigRow } from "./types";

const refresh = () => revalidatePath("/dashboard/admin", "layout");

// ---------------------------------------------------------------- planos

type PlanoInput = {
  nome: string;
  vezesSemana: number;
  valorPadrao: number;
  descricao: string;
  exibirNaHome: boolean;
};

function validatePlano(i: PlanoInput) {
  const nome = i.nome.trim();
  if (!nome || nome.length > 30) return "Informe o nome do plano (até 30 caracteres).";
  if (!Number.isInteger(i.vezesSemana) || i.vezesSemana < 1 || i.vezesSemana > 7)
    return "Aulas por semana deve ser de 1 a 7.";
  if (!Number.isFinite(i.valorPadrao) || i.valorPadrao < 0 || i.valorPadrao > 100000) return "Valor inválido.";
  if (i.descricao.trim().length > 120) return "Descrição muito longa (máx. 120).";
  return null;
}

const planoRow = (i: PlanoInput) => ({
  nome: i.nome.trim(),
  vezes_semana: i.vezesSemana,
  valor_padrao: Math.round(i.valorPadrao * 100) / 100,
  descricao: i.descricao.trim() || null,
  exibir_na_home: !!i.exibirNaHome,
});

export async function createPlano(input: PlanoInput): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const invalid = validatePlano(input);
  if (invalid) return fail(invalid);
  const { error } = await a.supabase.from("plans").insert(planoRow(input));
  if (error) return fail(friendlyError(error, "Não foi possível criar o plano."));
  updateTag(CMS_TAGS.planos);
  refresh();
  return done();
}

export async function updatePlano(input: PlanoInput & { id: number }): Promise<Result> {
  const a = await admin();
  if ("error" in a) return fail(a.error);
  const invalid = validatePlano(input);
  if (invalid) return fail(invalid);
  const { data, error } = await a.supabase
    .from("plans")
    .update(planoRow(input))
    .eq("id", input.id)
    .select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível salvar o plano."));
  updateTag(CMS_TAGS.planos);
  refresh();
  return done();
}

// Plano em uso não é excluído: devolve quem usa (até 10 nomes + total) para a tela listar.
// A FK members.plan_id (on delete restrict) garante a regra no banco mesmo numa corrida.
export async function deletePlano(
  id: number,
): Promise<Result<{ excluido: true } | { excluido: false; alunos: string[]; total: number }>> {
  const a = await admin();
  if ("error" in a) return fail(a.error);

  const { data: alunos, count, error: usoError } = await a.supabase
    .from("members")
    .select("nome,email,telefone", { count: "exact" })
    .eq("plan_id", id)
    .order("nome")
    .limit(10);
  if (usoError) return fail(friendlyError(usoError, "Não foi possível verificar o plano."));
  if (count) {
    return {
      ok: true,
      data: {
        excluido: false,
        total: count,
        alunos: (alunos ?? []).map((m) => m.nome ?? m.email ?? m.telefone ?? "Aluno sem nome"),
      },
    };
  }

  const { data, error } = await a.supabase.from("plans").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(friendlyError(error, "Não foi possível excluir o plano."));
  updateTag(CMS_TAGS.planos);
  refresh();
  return { ok: true, data: { excluido: true } };
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
