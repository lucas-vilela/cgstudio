import type { Page } from "@playwright/test";
import { test, expect, storageStatePath } from "./support/test";
import { db, ok } from "./support/db";
import type { Slot } from "./support/fabrica";
import { abrirAdmin, esperarEnvioFila, esperarServerAction } from "./support/rede";
import { escolher, toast } from "./support/ui";

// Admin › Calendário: turmas por dia, alunos de cada horário (fila offline) e cadastro de horários
// (Server Actions saveSlot / setSlotAtivo).

test.use({ storageState: storageStatePath("admin") });

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const cartao = (page: Page, s: Pick<Slot, "dia_semana" | "hora_inicio" | "hora_fim">) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: DIAS[s.dia_semana], exact: true }) })
    .locator("li").filter({ hasText: `${s.hora_inicio.slice(0, 5)}–${s.hora_fim.slice(0, 5)}` });

const alunosDoSlot = async (slotId: number) =>
  (ok(await db.from("slot_members").select("member_id").eq("slot_id", slotId)) as { member_id: string }[]).map((r) => r.member_id);

const slotNoBanco = async (id: number) =>
  ok(await db.from("slots").select("dia_semana,hora_inicio,hora_fim,capacidade,ativo").eq("id", id).maybeSingle()) as
    { dia_semana: number; hora_inicio: string; hora_fim: string; capacidade: number; ativo: boolean } | null;

test.describe("quadro de horários", () => {
  test("todos os dias aparecem e cada cartão mostra ocupação do snapshot", async ({ page }) => {
    const snap = await abrirAdmin(page, "/dashboard/admin/calendario", { congelar: true });
    for (const d of ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"])
      await expect(page.getByRole("heading", { name: d, exact: true })).toBeVisible();

    // Seed: segunda 07:00 tem só a Ana.
    const seg7 = snap.slots.find((s) => s.dia_semana === 1 && s.hora_inicio.startsWith("07:00"))!;
    expect(seg7.alunos.map((a) => a.nome)).toEqual(["Ana Souza"]);
    await expect(cartao(page, seg7)).toContainText(`${seg7.ocupados} de ${seg7.capacidade} · ${seg7.vagas} vagas`);
    await cartao(page, seg7).getByRole("button", { name: "Alunos" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("heading", { name: "Segunda · 07:00–08:00" })).toBeVisible();
    await expect(dialogo.getByRole("link", { name: "Ana Souza" })).toBeVisible();
    await expect(dialogo.getByRole("img", { name: /Atenção à saúde/ })).toBeVisible();
  });

  test("adiciona e remove aluno do horário pela fila; avisa (sem bloquear) quem não está ativo", async ({ page, fabrica }) => {
    const s = await fabrica.slot({ capacidade: 2 });
    const aluno = await fabrica.aluno({ login: false, status: "pendente", plano: "1x" });
    await abrirAdmin(page, "/dashboard/admin/calendario");

    await expect(cartao(page, s)).toContainText("0 de 2 · 2 vagas");
    await cartao(page, s).getByRole("button", { name: "Alunos" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByText("Nenhum aluno neste horário.")).toBeVisible();
    await dialogo.getByLabel("Adicionar aluno").fill(aluno.nome);

    const entrar = esperarEnvioFila(page, "horario_entrar");
    await dialogo.getByRole("button", { name: `Adicionar ${aluno.nome} ao horário` }).click();
    const { pedido, resposta } = await entrar;
    expect(pedido.payload).toEqual({ slot_id: s.id, member_id: aluno.id });
    expect(resposta).toEqual({ ok: true });
    await expect(toast(page, `${aluno.nome} adicionado(a) ao horário.`)).toBeVisible();
    await expect(toast(page, `Atenção: ${aluno.nome} não está ativo.`)).toBeVisible();
    expect(await alunosDoSlot(s.id)).toEqual([aluno.id]);
    await expect(dialogo).toContainText("1 de 2 vagas ocupadas.");

    const sair = esperarEnvioFila(page, "horario_sair");
    await dialogo.getByRole("button", { name: `Remover ${aluno.nome} do horário` }).click();
    expect((await sair).resposta).toEqual({ ok: true });
    expect(await alunosDoSlot(s.id)).toEqual([]);
    await expect(dialogo.getByText("Nenhum aluno neste horário.")).toBeVisible();
  });

  test("admin pode passar da capacidade e do limite do plano: grava e avisa", async ({ page, fabrica }) => {
    const s = await fabrica.slot({ capacidade: 1 });
    const outro = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 9 });
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 9 });
    const s2 = await fabrica.slot();
    await fabrica.alocar(s.id, outro.id);
    await fabrica.alocar(s2.id, aluno.id); // já usa o 1 horário do plano
    await abrirAdmin(page, "/dashboard/admin/calendario");

    await expect(cartao(page, s).getByText("Lotado")).toBeVisible();
    await cartao(page, s).getByRole("button", { name: "Alunos" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Adicionar aluno").fill(aluno.nome);
    const entrar = esperarEnvioFila(page, "horario_entrar");
    await dialogo.getByRole("button", { name: `Adicionar ${aluno.nome} ao horário` }).click();
    expect((await entrar).resposta).toEqual({ ok: true });

    await expect(toast(page, `Atenção: o horário ficou acima da capacidade; ${aluno.nome} passou do limite do plano (1x).`)).toBeVisible();
    expect((await alunosDoSlot(s.id)).sort()).toEqual([aluno.id, outro.id].sort());
    await expect(dialogo).toContainText("2 de 1 vagas ocupadas (acima da capacidade).");
  });

  test("busca de alunos no horário ignora quem já está nele", async ({ page, fabrica }) => {
    const s = await fabrica.slot();
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 9 });
    await fabrica.alocar(s.id, aluno.id);
    await abrirAdmin(page, "/dashboard/admin/calendario");
    await cartao(page, s).getByRole("button", { name: "Alunos" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Adicionar aluno").fill(aluno.nome);
    await expect(dialogo.getByText("Nenhum aluno encontrado fora deste horário.")).toBeVisible();
  });
});

test.describe("cadastro de horários (precisa de conexão)", () => {
  test("cria horário: validação no servidor, gravação e cartão no dia certo", async ({ page, fabrica }) => {
    const h = fabrica.horarioLivre();
    await abrirAdmin(page, "/dashboard/admin/calendario");
    await page.getByRole("button", { name: "Novo horário" }).click();
    const dialogo = page.getByRole("dialog");
    await escolher(dialogo, "Dia da semana", "Quinta");
    await dialogo.getByLabel("Início").fill(h.fim);
    await dialogo.getByLabel("Fim").fill(h.inicio);
    await dialogo.getByLabel("Capacidade").fill("5");

    let acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    await acao;
    await expect(dialogo.getByRole("alert")).toHaveText("O fim deve ser depois do início.");

    await dialogo.getByLabel("Início").fill(h.inicio);
    await dialogo.getByLabel("Fim").fill(h.fim);
    acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    await acao;
    await expect(toast(page, "Horário criado.")).toBeVisible();

    const criado = ok(await db.from("slots").select("id,dia_semana,capacidade,ativo").eq("dia_semana", 4)
      .eq("hora_inicio", h.inicio).eq("hora_fim", h.fim)) as { id: number; capacidade: number; ativo: boolean }[];
    expect(criado).toHaveLength(1);
    fabrica.registrarSlot(criado[0].id);
    expect(criado[0]).toMatchObject({ capacidade: 5, ativo: true });
    await expect(cartao(page, { dia_semana: 4, hora_inicio: h.inicio, hora_fim: h.fim })).toContainText("0 de 5 · 5 vagas");
  });

  test("edita capacidade (não deixa ficar abaixo dos ocupados) e desativa/ativa", async ({ page, fabrica }) => {
    const s = await fabrica.slot({ capacidade: 3 });
    const a = await fabrica.aluno({ login: false, status: "ativo", plano: "3x", vencimentoEm: 9 });
    const b = await fabrica.aluno({ login: false, status: "ativo", plano: "3x", vencimentoEm: 9 });
    await fabrica.alocar(s.id, a.id);
    await fabrica.alocar(s.id, b.id);
    await abrirAdmin(page, "/dashboard/admin/calendario");

    await cartao(page, s).getByRole("button", { name: "Editar" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Capacidade")).toHaveValue("3");
    await dialogo.getByLabel("Capacidade").fill("1");
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    await expect(dialogo.getByRole("alert")).toHaveText("Já há 2 alunos neste horário. Remova alunos antes de reduzir.");
    expect((await slotNoBanco(s.id))!.capacidade).toBe(3);

    await dialogo.getByLabel("Capacidade").fill("8");
    const acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    await acao;
    await expect(toast(page, "Horário salvo.")).toBeVisible();
    expect((await slotNoBanco(s.id))!.capacidade).toBe(8);
    await expect(cartao(page, s)).toContainText("2 de 8 · 6 vagas");

    const desativar = esperarServerAction(page);
    await cartao(page, s).getByRole("button", { name: "Desativar" }).click();
    await desativar;
    await expect(toast(page, "Horário desativado.")).toBeVisible();
    await expect(cartao(page, s).getByText("Desativado")).toBeVisible();
    expect((await slotNoBanco(s.id))!.ativo).toBe(false);
    // Os alunos continuam ligados ao horário desativado.
    expect(await alunosDoSlot(s.id)).toHaveLength(2);

    const ativar = esperarServerAction(page);
    await cartao(page, s).getByRole("button", { name: "Ativar" }).click();
    await ativar;
    expect((await slotNoBanco(s.id))!.ativo).toBe(true);
  });

  test("horário desativado some da agenda do aluno", async ({ page, fabrica, outraJanela }) => {
    const s = await fabrica.slot({ capacidade: 3 });
    const aluno = await fabrica.aluno({ status: "ativo", plano: "2x", vencimentoEm: 9 });
    await abrirAdmin(page, "/dashboard/admin/calendario");
    const acao = esperarServerAction(page);
    await cartao(page, s).getByRole("button", { name: "Desativar" }).click();
    await acao;

    const alunoPage = await outraJanela({ email: aluno.email });
    await alunoPage.goto("/dashboard");
    await expect(alunoPage.getByRole("heading", { name: "Meus horários" })).toBeVisible();
    await expect(alunoPage.getByText(`${s.hora_inicio}–${s.hora_fim}`)).toHaveCount(0);
    await expect(alunoPage.locator("div.hidden.md\\:grid > div").filter({ hasText: new RegExp(`^${s.hora_inicio}$`) })).toHaveCount(0);
  });

  test("offline: criar/editar e ativar horário pedem conexão", async ({ page, context, fabrica }) => {
    const s = await fabrica.slot();
    await abrirAdmin(page, "/dashboard/admin/calendario");
    await context.setOffline(true);
    await cartao(page, s).getByRole("button", { name: "Desativar" }).click();
    await expect(cartao(page, s).getByRole("alert")).toHaveText("Ativar ou desativar horário precisa de conexão.");
    await cartao(page, s).getByRole("button", { name: "Editar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("Criar ou editar horário precisa de conexão.");
    expect((await slotNoBanco(s.id))!.ativo).toBe(true);
    await context.setOffline(false);
  });
});
