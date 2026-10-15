import { randomUUID } from "node:crypto";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import { test, expect, USUARIOS, storageStatePath } from "./support/test";
import { addDias, addMes, hojeSP, proximasDatas } from "./support/datas";
import { anon, clienteComo, comoAdmin, db, memberPorEmail, memberPorId, ok } from "./support/db";
import type { Usuario } from "./supabase-local";

// Sem navegador: rotas /api/admin/* (status, corpo, cabeçalhos), idempotência da fila, RLS e as
// regras de negócio que vivem nas funções do banco.

let api: Record<Usuario | "anon", APIRequestContext>;

test.beforeAll(async ({ baseURL }) => {
  const ctx = (u?: Usuario) => pwRequest.newContext({ baseURL, storageState: u ? storageStatePath(u) : undefined });
  api = { anon: await ctx(), admin: await ctx("admin"), ana: await ctx("ana"), bruno: await ctx("bruno"), carla: await ctx("carla") };
});
test.afterAll(async () => {
  for (const c of Object.values(api)) await c.dispose();
});

const enviar = (quem: Usuario | "anon", corpo: unknown) =>
  api[quem].post("/api/admin/acoes", { data: corpo as object });

test.describe("GET /api/admin/snapshot", () => {
  test("sem sessão → 401; aluno → 403; ambos sem cache", async () => {
    const semSessao = await api.anon.get("/api/admin/snapshot", { maxRedirects: 0 });
    // O proxy só protege /dashboard: a rota responde ela mesma.
    expect(semSessao.status()).toBe(401);
    expect(await semSessao.json()).toEqual({ erro: "sessao" });
    expect(semSessao.headers()["cache-control"]).toContain("no-store");

    const aluno = await api.ana.get("/api/admin/snapshot");
    expect(aluno.status()).toBe(403);
    expect(await aluno.json()).toEqual({ erro: "nao_admin" });
    expect(aluno.headers()["cache-control"]).toContain("no-store");
  });

  test("admin → 200 com o formato que o app offline espera e dados batendo com o banco", async () => {
    const r = await api.admin.get("/api/admin/snapshot");
    expect(r.status()).toBe(200);
    expect(r.headers()["cache-control"]).toContain("no-store");
    const s = await r.json();

    expect(s).toMatchObject({
      user_id: "00000000-0000-0000-0000-00000000a001",
      hoje: hojeSP(),
      resumo: { ativos: expect.any(Number), recebidoMes: expect.any(Number), emAtraso: expect.any(Number) },
    });
    expect(Date.now() - Date.parse(s.gerado_em)).toBeLessThan(60_000);
    for (const k of ["members", "plans", "treinos", "slots", "vencimentos", "inadimplentes", "pagamentos", "anamneses", "avaliacoes"])
      expect(Array.isArray(s[k]), k).toBe(true);

    const ana = await memberPorEmail(USUARIOS.ana);
    const naFoto = s.members.find((m: { member_id: string }) => m.member_id === ana!.id);
    expect(naFoto).toMatchObject({
      nome: "Ana Souza", telefone: "11987654321", status: "ativo", plano_nome: "2x", valor: 80,
      vencimento: ana!.vencimento, tem_login: true, slots_usados: 2,
    });
    expect(s.plans.map((p: { nome: string }) => p.nome)).toEqual(expect.arrayContaining(["1x", "2x", "3x"]));
    // Bruno (seed) está em atraso; inadimplentes não incluem pendentes.
    const inad = s.inadimplentes.map((i: { nome: string }) => i.nome);
    expect(inad).toContain("Bruno Lima");
    expect(inad).not.toContain("Carla Mendes");
    // Dinheiro chega como número (o banco devolve numeric como texto).
    expect(typeof s.pagamentos[0].valor).toBe("number");
    expect(s.anamneses.find((a: { member_id: string }) => a.member_id === ana!.id)).toMatchObject({
      restricao_medica: true, updated_by_nome: null,
    });
  });
});

test.describe("POST /api/admin/acoes", () => {
  test("autorização: sem sessão 401 'sessao', aluno 403 'sessao' (entra de novo como admin)", async () => {
    const corpo = { id: randomUUID(), tipo: "pagamento", payload: {} };
    const a = await enviar("anon", corpo);
    expect(a.status()).toBe(401);
    expect(await a.json()).toEqual({ ok: false, tipo: "sessao", mensagem: "Entre novamente para enviar." });
    const b = await enviar("bruno", corpo);
    expect(b.status()).toBe(403);
    expect((await b.json()).tipo).toBe("sessao");
  });

  test("pedido malformado → 400 'regra'", async () => {
    for (const corpo of [
      { id: "nao-e-uuid", tipo: "pagamento", payload: {} },
      { id: randomUUID(), tipo: "apagar_tudo", payload: {} },
      { id: randomUUID(), tipo: "pagamento", payload: null },
    ]) {
      const r = await enviar("admin", corpo);
      expect(r.status(), JSON.stringify(corpo)).toBe(400);
      expect(await r.json()).toEqual({ ok: false, tipo: "regra", mensagem: "Pedido inválido." });
    }
    const json = await api.admin.post("/api/admin/acoes", { headers: { "content-type": "application/json" }, data: "{oops" });
    expect(json.status()).toBe(400);
  });

  test("pagamento é idempotente pelo id do item: reenviar não grava de novo nem avança o vencimento", async ({ fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 5 });
    const venc = (await memberPorId(aluno.id))!.vencimento as string;
    const item = { id: randomUUID(), tipo: "pagamento", payload: { member_id: aluno.id, forma: "pix", valor: null, pago_em: hojeSP(), observacao: null } };

    for (let i = 0; i < 3; i++) {
      const r = await enviar("admin", item);
      expect(r.status()).toBe(200);
      expect(await r.json()).toEqual({ ok: true });
    }
    const pagos = ok(await db.from("payments").select("valor,client_id").eq("member_id", aluno.id)) as { valor: number; client_id: string }[];
    expect(pagos).toEqual([{ valor: 75, client_id: item.id }]); // valor null = valor do plano
    expect((await memberPorId(aluno.id))!.vencimento).toBe(addMes(venc));

    // Outro id = outro pagamento: vencimento avança mais um mês.
    expect(await (await enviar("admin", { ...item, id: randomUUID() })).json()).toEqual({ ok: true });
    expect(ok(await db.from("payments").select("id").eq("member_id", aluno.id))).toHaveLength(2);
    expect((await memberPorId(aluno.id))!.vencimento).toBe(addMes(addMes(venc)));
  });

  test("regras do pagamento viram recusa 'regra' com mensagem amigável", async ({ fabrica }) => {
    const semPlano = await fabrica.aluno({ login: false, status: "pendente", plano: null });
    const casos: [Record<string, unknown>, string][] = [
      [{ forma: "boleto" }, "Forma de pagamento inválida."],
      [{ valor: -1 }, "Informe um valor maior que zero."],
      [{ pago_em: "13/10/2026" }, "Data inválida."],
      [{ observacao: "x".repeat(301) }, "Observação muito longa (máx. 300)."],
      [{ valor: null }, "Valor inválido. Informe um valor maior que zero ou defina um plano."], // sem plano
      [{ member_id: randomUUID() }, "Aluno não encontrado."],
    ];
    for (const [mudanca, mensagem] of casos) {
      const payload = { member_id: semPlano.id, forma: "pix", valor: 10, pago_em: hojeSP(), observacao: null, ...mudanca };
      const r = await enviar("admin", { id: randomUUID(), tipo: "pagamento", payload });
      expect(await r.json(), JSON.stringify(mudanca)).toEqual({ ok: false, tipo: "regra", mensagem });
    }
    expect(ok(await db.from("payments").select("id").eq("member_id", semPlano.id))).toEqual([]);
  });

  test("cadastro reenviado com o mesmo member_id atualiza em vez de duplicar", async ({ fabrica }) => {
    const id = randomUUID();
    fabrica.registrarMembro(id);
    const base = { member_id: id, nome: "E2e Reenvio Teste", telefone: `119${Date.now().toString().slice(-8)}`, email: null, plan_id: null, valor_acordado: null, treino_ids: [] };
    expect(await (await enviar("admin", { id: randomUUID(), tipo: "aluno_criar", payload: base })).json()).toEqual({ ok: true });
    expect(await (await enviar("admin", { id: randomUUID(), tipo: "aluno_criar", payload: { ...base, nome: "E2e Reenvio Corrigido" } })).json()).toEqual({ ok: true });
    expect(ok(await db.from("members").select("nome,status").eq("id", id))).toEqual([{ nome: "E2e Reenvio Corrigido", status: "pendente" }]);
  });

  test("editar dados de aluno com conta Google é recusado", async ({ fabrica }) => {
    const aluno = await fabrica.aluno({ login: true, status: "ativo" });
    const r = await enviar("admin", { id: randomUUID(), tipo: "aluno_editar", payload: { member_id: aluno.id, campos: { nome: "Outro Nome" } } });
    expect(await r.json()).toEqual({ ok: false, tipo: "regra", mensagem: "Este aluno tem conta Google: nome, telefone e e-mail são dele." });
    expect((await memberPorId(aluno.id))!.nome).toBe(aluno.nome);
  });

  test("horário: entrar duas vezes não duplica; sair remove", async ({ fabrica }) => {
    const s = await fabrica.slot();
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    const payload = { slot_id: s.id, member_id: aluno.id };
    for (let i = 0; i < 2; i++)
      expect(await (await enviar("admin", { id: randomUUID(), tipo: "horario_entrar", payload })).json()).toEqual({ ok: true });
    expect(ok(await db.from("slot_members").select("member_id").eq("slot_id", s.id))).toHaveLength(1);
    expect(await (await enviar("admin", { id: randomUUID(), tipo: "horario_sair", payload })).json()).toEqual({ ok: true });
    expect(ok(await db.from("slot_members").select("member_id").eq("slot_id", s.id))).toHaveLength(0);
  });

  test("ficha: anamnese com campo desconhecido/data futura e medidas fora da faixa são recusadas", async ({ fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    const anamnese = (campos: Record<string, unknown>) =>
      enviar("admin", { id: randomUUID(), tipo: "anamnese_salvar", payload: { member_id: aluno.id, campos } }).then((r) => r.json());
    expect(await anamnese({ senha: "x" })).toEqual({ ok: false, tipo: "regra", mensagem: "Anamnese inválida." });
    expect(await anamnese({ data_nascimento: addDias(hojeSP(), 1) }))
      .toEqual({ ok: false, tipo: "regra", mensagem: "“Data de nascimento” não pode ser no futuro." });
    expect(await anamnese({ objetivos: "  Ganhar força  " })).toEqual({ ok: true });
    expect(ok(await db.from("member_anamneses").select("objetivos,updated_by").eq("member_id", aluno.id).single()))
      .toEqual({ objetivos: "Ganhar força", updated_by: "00000000-0000-0000-0000-00000000a001" });

    const medida = (m: Record<string, unknown>) =>
      enviar("admin", { id: randomUUID(), tipo: "avaliacao_salvar", payload: { id: randomUUID(), member_id: aluno.id, data: hojeSP(), ...m } }).then((r) => r.json());
    expect(await medida({})).toEqual({ ok: false, tipo: "regra", mensagem: "Informe pelo menos uma medida." });
    expect(await medida({ braco_cm: 300 })).toEqual({ ok: false, tipo: "regra", mensagem: "Braço: entre 10 e 250 cm." });
    expect(await medida({ peso_kg: 72.34 })).toEqual({ ok: true });
    expect(Number((ok(await db.from("member_avaliacoes").select("peso_kg").eq("member_id", aluno.id).single()) as { peso_kg: string }).peso_kg)).toBe(72.3);
  });
});

test.describe("RLS e permissões no banco", () => {
  test("aluno só enxerga a própria linha e não lê dados de outros nem de saúde", async () => {
    const sb = await clienteComo(USUARIOS.ana);
    const membros = ok(await sb.from("members").select("email")) as { email: string }[];
    expect(membros.map((m) => m.email)).toEqual([USUARIOS.ana]);
    expect(ok(await sb.from("payments").select("id"))).toEqual([]);
    expect(ok(await sb.from("member_anamneses").select("member_id"))).toEqual([]);
    expect(ok(await sb.from("member_avaliacoes").select("id"))).toEqual([]);
    expect(ok(await sb.from("inadimplentes").select("member_id"))).toEqual([]);
    const fin = ok(await sb.from("member_financeiro").select("nome")) as { nome: string }[];
    expect(fin.map((f) => f.nome)).toEqual(["Ana Souza"]);
  });

  test("aluno não muda o próprio status/plano/vencimento (trigger) mas muda o nome", async ({ fabrica }) => {
    const aluno = await fabrica.aluno({ status: "pendente" });
    const sb = await clienteComo(aluno.email);
    const tentativa = await sb.from("members").update({ status: "ativo" }).eq("id", aluno.id);
    expect(tentativa.error?.message).toContain("Apenas administradores podem alterar esses campos");
    ok(await sb.from("members").update({ nome: "E2e Nome Novo" }).eq("id", aluno.id));
    expect(await memberPorId(aluno.id)).toMatchObject({ status: "pendente", nome: "E2e Nome Novo" });
  });

  test("visitante: só dia/hora dos horários, nada de alunos", async () => {
    const sb = anon();
    expect(ok(await sb.from("slots").select("dia_semana,hora_inicio,hora_fim").limit(1))).toHaveLength(1);
    expect((await sb.from("slots").select("capacidade").limit(1)).error?.message).toMatch(/permission denied/);
    expect((await sb.from("members").select("id")).error?.message).toMatch(/permission denied/);
    expect((await sb.from("payments").select("id")).error?.message).toMatch(/permission denied/);
    expect((await sb.from("member_financeiro").select("member_id")).error?.message).toMatch(/permission denied/);
    // Depoimentos: o visitante só vê os aprovados.
    const deps = ok(await sb.from("depoimentos").select("status")) as { status: string }[];
    expect(new Set(deps.map((d) => d.status))).toEqual(new Set(["aprovado"]));
  });

  test("aluno não escreve no que é do admin (horários, planos, pagamentos)", async () => {
    const sb = await clienteComo(USUARIOS.ana);
    const ana = await memberPorEmail(USUARIOS.ana);
    expect((await sb.from("slots").insert({ dia_semana: 4, hora_inicio: "03:00", hora_fim: "04:00", capacidade: 1 })).error).not.toBeNull();
    expect((await sb.from("payments").insert({ member_id: ana!.id, valor: 1, pago_em: hojeSP(), forma: "pix" })).error).not.toBeNull();
    const plano = await sb.from("plans").update({ valor_padrao: 1 }).eq("nome", "1x").select("id");
    expect(plano.data ?? []).toEqual([]); // RLS filtra: nenhuma linha alterada
    expect(Number((ok(await db.from("plans").select("valor_padrao").eq("nome", "1x").single()) as { valor_padrao: string }).valor_padrao)).toBe(75);
  });
});

test.describe("regras das funções do banco (RPC)", () => {
  test("join_slot: pendente, sem plano, limite e repetição", async ({ fabrica }) => {
    const s = await fabrica.slot({ capacidade: 5 });
    const s2 = await fabrica.slot({ capacidade: 5 });
    const pendente = await fabrica.aluno({ status: "pendente", plano: "1x" });
    const semPlano = await fabrica.aluno({ status: "ativo", plano: null });
    const ativo = await fabrica.aluno({ status: "ativo", plano: "1x", vencimentoEm: 9 });
    const erro = async (email: string, slot: number) => (await (await clienteComo(email)).rpc("join_slot", { p_slot_id: slot })).error?.message;

    expect(await erro(pendente.email, s.id)).toBe("aluno_nao_ativo");
    expect(await erro(semPlano.email, s.id)).toBe("sem_plano");
    expect(await erro(ativo.email, s.id)).toBeUndefined();
    expect(await erro(ativo.email, s.id)).toBe("ja_no_slot");
    expect(await erro(ativo.email, s2.id)).toBe("limite_slots");
    expect(await erro(ativo.email, 999_999_999)).toBe("slot_indisponivel");
    expect((await (await clienteComo(ativo.email)).rpc("leave_slot", { p_slot_id: s2.id })).error?.message).toBe("nao_alocado");
  });

  test("book_trial: só pendente, dia certo, a partir de amanhã, uma vez", async ({ fabrica }) => {
    const s = await fabrica.slot({ capacidade: 2 });
    const pendente = await fabrica.aluno({ status: "pendente" });
    const ativo = await fabrica.aluno({ status: "ativo", plano: "1x", vencimentoEm: 9 });
    const [d] = proximasDatas(hojeSP(), s.dia_semana);
    const reservar = async (email: string, data: string) =>
      (await (await clienteComo(email)).rpc("book_trial", { p_slot_id: s.id, p_data: data })).error?.message;

    expect(await reservar(ativo.email, d)).toBe("aluno_nao_pendente");
    expect(await reservar(pendente.email, hojeSP())).toBe("data_invalida");
    expect(await reservar(pendente.email, addDias(d, 1))).toBe("dia_incorreto");
    expect(await reservar(pendente.email, d)).toBeUndefined();
    expect(await reservar(pendente.email, addDias(d, 7))).toBe("experimental_ja_usada");
  });

  test("enviar_depoimento e regras de admin (rebaixar a si mesmo, excluir aluno com conta)", async ({ fabrica }) => {
    const aluno = await fabrica.aluno({ status: "ativo" });
    const sbAluno = await clienteComo(aluno.email);
    expect((await sbAluno.rpc("enviar_depoimento", { p_texto: "curto" })).error?.message).toBe("texto_invalido");

    const adm = await comoAdmin();
    expect((await adm.rpc("set_user_role", { p_user_id: "00000000-0000-0000-0000-00000000a001", p_role: "member" })).error?.message)
      .toBe("nao_pode_rebaixar_a_si_mesmo");
    expect((await adm.rpc("excluir_aluno_sem_login", { p_member_id: aluno.id })).error?.message).toBe("aluno_com_login");
    expect((await sbAluno.rpc("set_user_role", { p_user_id: aluno.userId, p_role: "admin" })).error?.message).toBe("nao_admin");
  });
});
