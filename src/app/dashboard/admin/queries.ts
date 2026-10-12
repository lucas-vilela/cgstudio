import { createClient } from "@/lib/supabase/server";
import { todayISO } from "./format";
import type {
  AdminMember,
  AdminUser,
  FinanceiroMes,
  Inadimplente,
  Pagamento,
  DepoimentoAdmin,
  Plan,
  SiteConfigRow,
  SlotRow,
  Treino,
  Vencimento,
} from "./types";

// Remove caracteres que quebram a sintaxe de filtro .or() do PostgREST.
const sanitize = (q: string) => q.trim().replace(/[%,()*\\]/g, " ").trim();

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));
const one = <T>(v: T | T[] | null | undefined) => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase
      .from("plans")
      .select("id,nome,vezes_semana,valor_padrao,descricao,exibir_na_home")
      .order("vezes_semana"),
    "plans",
  );
  return rows.map((p: Plan) => ({ ...p, valor_padrao: num(p.valor_padrao) }));
}

export async function getResumo() {
  const supabase = await createClient();
  const mes = `${todayISO().slice(0, 7)}-01`;
  const [ativos, mensal, atraso] = await Promise.all([
    supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "ativo"),
    supabase.from("financeiro_mensal").select("total_recebido").eq("mes", mes).maybeSingle(),
    supabase.from("inadimplentes").select("member_id", { count: "exact", head: true }),
  ]);
  if (ativos.error) throw new Error(`ativos: ${ativos.error.message}`);
  if (mensal.error) throw new Error(`financeiro_mensal: ${mensal.error.message}`);
  if (atraso.error) throw new Error(`inadimplentes: ${atraso.error.message}`);
  return {
    ativos: ativos.count ?? 0,
    recebidoMes: num(mensal.data?.total_recebido),
    emAtraso: atraso.count ?? 0,
  };
}

export async function getVencimentosProximos(): Promise<Vencimento[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase
      .from("vencimentos_proximos")
      .select("member_id,nome,plano_nome,valor,vencimento,dias_restantes")
      .order("vencimento")
      .order("nome"),
    "vencimentos_proximos",
  );
  return rows.map((r: Vencimento) => ({ ...r, valor: r.valor == null ? null : num(r.valor) }));
}

// Lê member_treinos em páginas: o PostgREST corta cada resposta no max-rows (1000), e uma lista
// incompleta faria o "Salvar" do aluno apagar ligações que não vieram.
async function getTodasLigacoesTreino(supabase: Awaited<ReturnType<typeof createClient>>) {
  const PAGINA = 1000;
  const todas: { member_id: string; treino_id: number }[] = [];
  for (let de = 0; ; de += PAGINA) {
    const page = check(
      await supabase
        .from("member_treinos")
        .select("member_id,treino_id")
        .order("member_id")
        .order("treino_id")
        .range(de, de + PAGINA - 1),
      "member_treinos",
    ) as { member_id: string; treino_id: number }[];
    todas.push(...page);
    if (page.length < PAGINA) return todas;
  }
}

export async function getAdminMembers(query: string): Promise<AdminMember[]> {
  const supabase = await createClient();
  let req = supabase.from("member_financeiro").select("*").order("nome").limit(500);
  const q = sanitize(query);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const parts = [`nome.ilike.%${q}%`, `email.ilike.%${q}%`];
    if (digits.length >= 3) parts.push(`telefone.ilike.%${digits}%`);
    req = req.or(parts.join(","));
  }
  const [fin, acordados, ligacoes] = await Promise.all([
    req,
    supabase.from("members").select("id,valor_acordado,auth_user_id"),
    getTodasLigacoesTreino(supabase),
  ]);
  const rows = check(fin, "member_financeiro");
  const extras = check(acordados, "members") as {
    id: string;
    valor_acordado: number | null;
    auth_user_id: string | null;
  }[];
  const acordado = new Map<string, number>(
    extras.filter((m) => m.valor_acordado != null).map((m) => [m.id, num(m.valor_acordado)]),
  );
  const semLogin = new Set(extras.filter((m) => !m.auth_user_id).map((m) => m.id));
  const treinos = new Map<string, number[]>();
  for (const l of ligacoes) {
    treinos.set(l.member_id, [...(treinos.get(l.member_id) ?? []), l.treino_id]);
  }
  return rows.map((r: AdminMember) => ({
    ...r,
    valor: r.valor == null ? null : num(r.valor),
    valor_acordado: acordado.get(r.member_id) ?? null,
    treino_ids: treinos.get(r.member_id) ?? [],
    tem_login: !semLogin.has(r.member_id),
  }));
}

export async function getFinanceiroMes(ym: string): Promise<FinanceiroMes | null> {
  const supabase = await createClient();
  const row = check<FinanceiroMes | null>(
    await supabase.from("financeiro_mensal").select("*").eq("mes", `${ym}-01`).maybeSingle(),
    "financeiro_mensal",
  );
  if (!row) return null;
  return {
    mes: row.mes,
    total_recebido: num(row.total_recebido),
    qtd_pagamentos: row.qtd_pagamentos,
    total_pix: num(row.total_pix),
    total_dinheiro: num(row.total_dinheiro),
    total_cartao: num(row.total_cartao),
  };
}

export async function getInadimplentes(): Promise<Inadimplente[]> {
  const supabase = await createClient();
  const rows = check(await supabase.from("inadimplentes").select("*"), "inadimplentes");
  return rows.map((r: Inadimplente) => ({
    ...r,
    valor_devido: r.valor_devido == null ? null : num(r.valor_devido),
  }));
}

// Histórico: de um aluno (todo o período) ou do mês, opcionalmente filtrado por nome.
export async function getPagamentos(opts: {
  ym: string;
  memberId?: string;
  q?: string;
}): Promise<Pagamento[]> {
  const supabase = await createClient();
  let req = supabase
    .from("payments")
    .select("id,member_id,valor,pago_em,forma,observacao,members(nome)")
    .order("pago_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(300);

  if (opts.memberId) {
    req = req.eq("member_id", opts.memberId);
  } else {
    const [y, m] = opts.ym.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    req = req.gte("pago_em", `${opts.ym}-01`).lt("pago_em", next);
    const q = sanitize(opts.q ?? "");
    if (q) {
      const ids = check(
        await supabase.from("members").select("id").ilike("nome", `%${q}%`).limit(200),
        "members",
      ).map((r: { id: string }) => r.id);
      if (!ids.length) return [];
      req = req.in("member_id", ids);
    }
  }

  const rows = check(await req, "payments") as (Omit<Pagamento, "nome"> & {
    members: { nome: string | null } | { nome: string | null }[] | null;
  })[];
  return rows.map(({ members, ...p }) => ({
    ...p,
    valor: num(p.valor),
    nome: one(members)?.nome ?? null,
  }));
}

export async function getMemberName(memberId: string) {
  const supabase = await createClient();
  const row = check<{ nome: string | null } | null>(
    await supabase.from("members").select("nome").eq("id", memberId).maybeSingle(),
    "members",
  );
  return row?.nome ?? null;
}

export async function getSlots(): Promise<SlotRow[]> {
  const supabase = await createClient();
  const [slots, links] = await Promise.all([
    supabase.from("slots_vagas").select("*").order("dia_semana").order("hora_inicio"),
    supabase.from("slot_members").select("slot_id,member_id,members(nome,email)"),
  ]);
  const alunos = new Map<number, SlotRow["alunos"]>();
  for (const l of check(links, "slot_members") as {
    slot_id: number;
    member_id: string;
    members: { nome: string | null; email: string | null } | { nome: string | null; email: string | null }[] | null;
  }[]) {
    const m = one(l.members);
    const list = alunos.get(l.slot_id) ?? [];
    list.push({ member_id: l.member_id, nome: m?.nome ?? null, email: m?.email ?? null });
    alunos.set(l.slot_id, list);
  }
  return (check(slots, "slots_vagas") as Omit<SlotRow, "alunos">[]).map((s) => ({
    ...s,
    alunos: (alunos.get(s.slot_id) ?? []).sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")),
  }));
}

export async function getAdminsAndCandidates(): Promise<{
  admins: AdminUser[];
  candidatos: AdminUser[];
}> {
  const supabase = await createClient();
  const [roles, members] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "admin"),
    // Só quem tem conta Google pode virar admin.
    supabase.from("members").select("auth_user_id,nome,email").not("auth_user_id", "is", null).order("nome").limit(500),
  ]);
  const adminIds = new Set((check(roles, "user_roles") as { user_id: string }[]).map((r) => r.user_id));
  const byUser = new Map<string, AdminUser>();
  for (const m of check(members, "members") as { auth_user_id: string; nome: string | null; email: string | null }[])
    byUser.set(m.auth_user_id, { user_id: m.auth_user_id, nome: m.nome, email: m.email });

  const admins = [...adminIds]
    .map((id) => byUser.get(id) ?? { user_id: id, nome: null, email: null })
    .sort((a, b) => (a.nome ?? a.email ?? "").localeCompare(b.nome ?? b.email ?? ""));
  const candidatos = [...byUser.values()].filter((u) => !adminIds.has(u.user_id));
  return { admins, candidatos };
}

// ---------------------------------------------------------------- CMS da home

export async function getTreinos(): Promise<Treino[]> {
  const supabase = await createClient();
  const rows = check(
    await supabase
      .from("treinos")
      .select("id,nome,descricao,icone,ordem,ativo,member_treinos(count)")
      .order("ordem")
      .order("id"),
    "treinos",
  ) as (Omit<Treino, "qtd_alunos"> & { member_treinos: { count: number }[] })[];
  return rows.map(({ member_treinos, ...t }) => ({ ...t, qtd_alunos: member_treinos[0]?.count ?? 0 }));
}

// Pendentes vêm todos (a contagem da navegação também conta todos); os demais, os 300 mais recentes.
export async function getDepoimentosAdmin(): Promise<DepoimentoAdmin[]> {
  const supabase = await createClient();
  const cols = "id,texto,status,ajustado_pelo_admin,nome_exibicao,created_at,updated_at,members(nome,status)";
  const [pendentes, demais] = await Promise.all([
    supabase.from("depoimentos").select(cols).eq("status", "pendente").order("updated_at"),
    supabase.from("depoimentos").select(cols).neq("status", "pendente")
      .order("updated_at", { ascending: false }).limit(300),
  ]);
  const rows = [...check(pendentes, "depoimentos"), ...check(demais, "depoimentos")] as (Omit<DepoimentoAdmin, "aluno_nome" | "aluno_status"> & {
    members: { nome: string | null; status: DepoimentoAdmin["aluno_status"] } | { nome: string | null; status: DepoimentoAdmin["aluno_status"] }[] | null;
  })[];
  return rows.map(({ members, ...d }) => ({
    ...d,
    aluno_nome: one(members)?.nome ?? null,
    aluno_status: one(members)?.status ?? null,
  }));
}

export async function getPendentesCount(): Promise<number> {
  const supabase = await createClient();
  const res = await supabase
    .from("depoimentos")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  if (res.error) throw new Error(`depoimentos: ${res.error.message}`);
  return res.count ?? 0;
}

export async function getSiteConfigAdmin(): Promise<SiteConfigRow> {
  const supabase = await createClient();
  const row = check<SiteConfigRow | null>(
    await supabase
      .from("site_config")
      .select(
        "whatsapp,instagram,hero_titulo,hero_destaque,hero_subtitulo,nota_modalidades,nota_planos,nota_horarios,nota_contato,meta_descricao",
      )
      .eq("id", 1)
      .maybeSingle(),
    "site_config",
  );
  return (
    row ?? {
      whatsapp: null, instagram: null, hero_titulo: null, hero_destaque: null, hero_subtitulo: null,
      nota_modalidades: null, nota_planos: null, nota_horarios: null, nota_contato: null, meta_descricao: null,
    }
  );
}
