import { createClient } from "@/lib/supabase/server";
import { todayISO } from "./format";
import type {
  AdminMember,
  AdminUser,
  Inadimplente,
  Pagamento,
  DepoimentoAdmin,
  Plan,
  SiteConfigRow,
  SlotRow,
  Treino,
  Vencimento,
} from "./types";

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

// Lê todas as linhas em páginas: o PostgREST corta cada resposta no max-rows (1000). Lista
// incompleta aqui faria alunos "sumirem" do app offline e o Salvar apagar treinos que não vieram.
async function todasAsPaginas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  oQue: string,
): Promise<T[]> {
  const TAM = 1000;
  const out: T[] = [];
  for (let de = 0; de < 100_000; de += TAM) {
    const rows = check(await pagina(de, de + TAM - 1), oQue) as T[];
    out.push(...rows);
    if (rows.length < TAM) break;
  }
  return out;
}

// Todos os alunos com situação financeira, treinos e se têm login (snapshot do app do admin).
export async function getAdminMembers(): Promise<AdminMember[]> {
  const supabase = await createClient();
  const [rows, extras, ligacoes] = await Promise.all([
    todasAsPaginas<AdminMember>(
      (de, ate) => supabase.from("member_financeiro").select("*").order("nome").order("member_id").range(de, ate),
      "member_financeiro",
    ),
    todasAsPaginas<{ id: string; valor_acordado: number | null; auth_user_id: string | null }>(
      (de, ate) => supabase.from("members").select("id,valor_acordado,auth_user_id").order("id").range(de, ate),
      "members",
    ),
    todasAsPaginas<{ member_id: string; treino_id: number }>(
      (de, ate) =>
        supabase.from("member_treinos").select("member_id,treino_id").order("member_id").order("treino_id").range(de, ate),
      "member_treinos",
    ),
  ]);
  const acordado = new Map<string, number>(
    extras.filter((m) => m.valor_acordado != null).map((m) => [m.id, num(m.valor_acordado)]),
  );
  const semLogin = new Set(extras.filter((m) => !m.auth_user_id).map((m) => m.id));
  const treinos = new Map<string, number[]>();
  for (const l of ligacoes) treinos.set(l.member_id, [...(treinos.get(l.member_id) ?? []), l.treino_id]);
  return rows.map((r) => ({
    ...r,
    valor: r.valor == null ? null : num(r.valor),
    valor_acordado: acordado.get(r.member_id) ?? null,
    treino_ids: treinos.get(r.member_id) ?? [],
    tem_login: !semLogin.has(r.member_id),
  }));
}

export async function getInadimplentes(): Promise<Inadimplente[]> {
  const supabase = await createClient();
  const rows = check(await supabase.from("inadimplentes").select("*"), "inadimplentes");
  return rows.map((r: Inadimplente) => ({
    ...r,
    valor_devido: r.valor_devido == null ? null : num(r.valor_devido),
  }));
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

// Pagamentos a partir de uma data (snapshot do app offline). Página a página: o PostgREST corta
// cada resposta em 1000 linhas.
export async function getPagamentosDesde(desde: string) {
  const supabase = await createClient();
  const PAGINA = 1000;
  const out: Pagamento[] = [];
  for (let de = 0; de < 20000; de += PAGINA) {
    const rows = check(
      await supabase
        .from("payments")
        .select("id,member_id,valor,pago_em,forma,observacao,members(nome)")
        .gte("pago_em", desde)
        .order("pago_em", { ascending: false })
        .order("id", { ascending: false })
        .range(de, de + PAGINA - 1),
      "payments",
    ) as (Omit<Pagamento, "nome"> & {
      members: { nome: string | null } | { nome: string | null }[] | null;
    })[];
    out.push(...rows.map(({ members, ...p }) => ({ ...p, valor: num(p.valor), nome: one(members)?.nome ?? null })));
    if (rows.length < PAGINA) break;
  }
  return out;
}
