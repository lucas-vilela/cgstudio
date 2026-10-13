// Só servidor: usado pelas rotas /api/admin/*.
import type { createClient } from "@/lib/supabase/server";
import { validarAvaliacao, validarCamposAnamnese, type CamposAnamnese } from "@/lib/anamnese";
import type { AcaoFila, CamposAluno, RespostaAcao } from "@/lib/offline/tipos";
import { STATUSES, validateDadosAluno } from "../members";
import { friendlyError } from "./errors";
import { todayISO } from "./format";
import { FORMAS } from "./types";

// Executa no servidor um item da fila do app offline do admin. Toda ação é idempotente pelo id do
// item: repetir o mesmo item não grava duas vezes. As regras do banco (RLS, RPCs, constraints)
// continuam valendo; aqui só validamos formato e traduzimos o resultado para a fila.

type Supabase = Awaited<ReturnType<typeof createClient>>;
type PgError = { code?: string; message?: string } | null | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const regra = (mensagem: string): RespostaAcao => ({ ok: false, tipo: "regra", mensagem });
const OK: RespostaAcao = { ok: true };

// Erro do Postgres/PostgREST (tem `code`) é recusa de regra; sem código é falha de rede/servidor.
function traduz(error: PgError, fallback: string): RespostaAcao {
  if (error?.code) return regra(friendlyError(error, fallback));
  return { ok: false, tipo: "temporario", mensagem: "Falha de comunicação. Vai tentar de novo." };
}

const idsValidos = (ids: unknown) =>
  Array.isArray(ids) && ids.every((id) => Number.isInteger(id) && id > 0);

async function salvarTreinos(sb: Supabase, memberId: string, ids: number[]) {
  const { error } = await sb.rpc("set_member_treinos", {
    p_member_id: memberId,
    p_treino_ids: [...new Set(ids)],
  });
  return error;
}

async function pagamento(sb: Supabase, id: string, p: Extract<AcaoFila, { tipo: "pagamento" }>["payload"]) {
  if (!UUID.test(p.member_id)) return regra("Aluno inválido.");
  if (!FORMAS.some((f) => f.value === p.forma)) return regra("Forma de pagamento inválida.");
  if (p.valor != null && !(p.valor > 0)) return regra("Informe um valor maior que zero.");
  if (!DATE.test(p.pago_em)) return regra("Data inválida.");
  const obs = p.observacao?.trim() || null;
  if (obs && obs.length > 300) return regra("Observação muito longa (máx. 300).");

  const { error } = await sb.rpc("registrar_pagamento", {
    p_client_id: id,
    p_member_id: p.member_id,
    p_forma: p.forma,
    p_valor: p.valor,
    p_pago_em: p.pago_em,
    p_observacao: obs,
  });
  return error ? traduz(error, "Não foi possível registrar o pagamento.") : OK;
}

async function alunoCriar(sb: Supabase, p: Extract<AcaoFila, { tipo: "aluno_criar" }>["payload"]) {
  if (!UUID.test(p.member_id)) return regra("Cadastro inválido.");
  const dados = validateDadosAluno({ nome: p.nome, telefone: p.telefone, email: p.email ?? "" });
  if ("error" in dados) return regra(dados.error);
  if (p.valor_acordado != null && !(p.valor_acordado >= 0)) return regra("Valor inválido.");
  if (!idsValidos(p.treino_ids)) return regra("Treino inválido.");

  const campos = { ...dados.data, plan_id: p.plan_id, valor_acordado: p.valor_acordado };
  const { error } = await sb.from("members").insert({ id: p.member_id, ...campos, status: "pendente" });
  if (error) {
    if (!(error.code === "23505" && error.message?.includes("members_pkey")))
      return traduz(error, "Não foi possível cadastrar o aluno.");
    // Mesmo id já gravado = reenvio (talvez corrigido em Pendências): aplica os dados enviados
    // agora, sem mexer no status. Só vale para cadastro sem login (o feito pelo admin).
    const { error: upErr } = await sb.from("members").update(campos).eq("id", p.member_id).is("auth_user_id", null);
    if (upErr) return traduz(upErr, "Não foi possível atualizar o cadastro.");
  }

  if (p.treino_ids.length) {
    const tErr = await salvarTreinos(sb, p.member_id, p.treino_ids);
    if (tErr) return traduz(tErr, "Aluno cadastrado, mas não foi possível salvar os treinos.");
  }
  return OK;
}

async function alunoEditar(sb: Supabase, p: { member_id: string; campos: CamposAluno }) {
  if (!UUID.test(p.member_id)) return regra("Aluno inválido.");
  const c = p.campos ?? {};
  const patch: Record<string, unknown> = {};

  if ("plan_id" in c) {
    if (c.plan_id != null && !(Number.isInteger(c.plan_id) && c.plan_id > 0)) return regra("Plano inválido.");
    patch.plan_id = c.plan_id ?? null;
  }
  if ("valor_acordado" in c) {
    if (c.valor_acordado != null && !(c.valor_acordado >= 0)) return regra("Valor inválido.");
    patch.valor_acordado = c.valor_acordado ?? null;
  }
  if ("status" in c) {
    if (!STATUSES.some((s) => s.value === c.status)) return regra("Status inválido.");
    patch.status = c.status;
  }
  const mexeDados = "nome" in c || "telefone" in c || "email" in c;
  if (mexeDados) {
    const { data: atual, error } = await sb
      .from("members").select("auth_user_id,nome,telefone,email").eq("id", p.member_id).maybeSingle();
    if (error) return traduz(error, "Não foi possível salvar.");
    if (!atual) return regra("Aluno não encontrado.");
    if (atual.auth_user_id) return regra("Este aluno tem conta Google: nome, telefone e e-mail são dele.");
    const dados = validateDadosAluno({
      nome: c.nome ?? atual.nome ?? "",
      telefone: c.telefone ?? atual.telefone ?? "",
      email: ("email" in c ? c.email : atual.email) ?? "",
    });
    if ("error" in dados) return regra(dados.error);
    if ("nome" in c) patch.nome = dados.data.nome;
    if ("telefone" in c) patch.telefone = dados.data.telefone;
    if ("email" in c) patch.email = dados.data.email;
  }

  if (Object.keys(patch).length) {
    const { data, error } = await sb.from("members").update(patch).eq("id", p.member_id).select("id");
    if (error) return traduz(error, "Não foi possível salvar.");
    if (!data?.length) return regra("Aluno não encontrado.");
  }
  if ("treino_ids" in c) {
    if (!idsValidos(c.treino_ids)) return regra("Treino inválido.");
    const tErr = await salvarTreinos(sb, p.member_id, c.treino_ids ?? []);
    if (tErr) return traduz(tErr, "Não foi possível salvar os treinos.");
  }
  return OK;
}

// Admin pode tudo no horário (decisão do dono): sem checar vaga, limite do plano ou status.
async function horario(sb: Supabase, entrar: boolean, p: { slot_id: number; member_id: string }) {
  if (!Number.isInteger(p.slot_id) || !UUID.test(p.member_id)) return regra("Horário ou aluno inválido.");
  const { error } = entrar
    ? await sb.from("slot_members").upsert(
        { slot_id: p.slot_id, member_id: p.member_id },
        { onConflict: "slot_id,member_id", ignoreDuplicates: true },
      )
    : await sb.from("slot_members").delete().eq("slot_id", p.slot_id).eq("member_id", p.member_id);
  return error ? traduz(error, "Não foi possível alterar o horário.") : OK;
}

// Envia só os campos alterados: o upsert do PostgREST atualiza exatamente essas colunas, então uma
// edição offline não desfaz o que outro admin mudou em outros campos. Repetir = mesmo resultado.
async function anamneseSalvar(sb: Supabase, p: { member_id: string; campos: CamposAnamnese }) {
  if (!UUID.test(p.member_id)) return regra("Aluno inválido.");
  const v = validarCamposAnamnese(p.campos, todayISO());
  if ("error" in v) return regra(v.error);
  if (!Object.keys(v.data).length) return OK;
  const { error } = await sb
    .from("member_anamneses")
    .upsert({ member_id: p.member_id, ...v.data }, { onConflict: "member_id" });
  return error ? traduz(error, "Não foi possível salvar a anamnese.") : OK;
}

// Criar e corrigir avaliação: upsert pelo id gerado no aparelho (idempotente).
async function avaliacaoSalvar(sb: Supabase, p: unknown) {
  const v = validarAvaliacao(p, todayISO());
  if ("error" in v) return regra(v.error);
  const { error } = await sb.from("member_avaliacoes").upsert(v.data, { onConflict: "id" });
  return error ? traduz(error, "Não foi possível salvar as medidas.") : OK;
}

export async function executarAcao(sb: Supabase, id: string, acao: AcaoFila): Promise<RespostaAcao> {
  switch (acao.tipo) {
    case "pagamento": return pagamento(sb, id, acao.payload);
    case "aluno_criar": return alunoCriar(sb, acao.payload);
    case "aluno_editar": return alunoEditar(sb, acao.payload);
    case "horario_entrar": return horario(sb, true, acao.payload);
    case "horario_sair": return horario(sb, false, acao.payload);
    case "anamnese_salvar": return anamneseSalvar(sb, acao.payload);
    case "avaliacao_salvar": return avaliacaoSalvar(sb, acao.payload);
    default: return regra("Tipo de ação desconhecido.");
  }
}
