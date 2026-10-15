import { test, expect, storageStatePath } from "./support/test";
import { addDias, addMes, dataBR, hojeSP, mesLabel, reBrl, shiftMes } from "./support/datas";
import { db, memberPorId, ok } from "./support/db";
import { abrirAdmin, esperarEnvioFila } from "./support/rede";
import { escolher, linhaAluno, painel, toast } from "./support/ui";

// Admin › Financeiro: registrar pagamento (fila → RPC registrar_pagamento) e os totais do mês.

test.use({ storageState: storageStatePath("admin") });

type Pagamento = { valor: number; forma: string; pago_em: string; observacao: string | null; client_id: string | null; registrado_por: string | null };
const pagamentosDe = async (memberId: string) =>
  (ok(await db.from("payments").select("valor,forma,pago_em,observacao,client_id,registrado_por").eq("member_id", memberId)) as Pagamento[])
    .map((p) => ({ ...p, valor: Number(p.valor) }));

const ADMIN_ID = "00000000-0000-0000-0000-00000000a001";

test.describe("registrar pagamento", () => {
  test("inadimplente: valor do plano sugerido, vencimento novo a partir de hoje e sai da lista de atraso", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: -7 });
    const snap = await abrirAdmin(page, "/dashboard/admin/financeiro");
    const inad = snap.inadimplentes.find((i) => i.member_id === aluno.id)!;
    expect(inad).toMatchObject({ dias_atraso: 7, valor_devido: 75, plano_nome: "1x" });

    const linha = painel(page, "Inadimplentes").locator("tbody tr").filter({ hasText: aluno.nome });
    await expect(linha).toContainText("7 dias de atraso");
    await expect(linha).toContainText(reBrl(75));

    await linha.getByRole("button", { name: `Registrar: ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Valor (R$)")).toHaveValue("75,00");
    await expect(dialogo.getByLabel("Data do pagamento")).toHaveValue(hojeSP());
    await escolher(dialogo, "Forma", "Dinheiro");
    await dialogo.getByLabel("Observação (opcional)").fill("  pago na recepção  ");

    const envio = esperarEnvioFila(page, "pagamento");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    const { pedido, resposta, snapshotDepois } = await envio;
    expect(resposta).toEqual({ ok: true });
    expect(pedido.payload).toEqual({
      member_id: aluno.id, forma: "dinheiro", valor: 75, pago_em: hojeSP(), observacao: "pago na recepção",
    });
    await expect(toast(page, `Pagamento de ${aluno.nome} registrado.`)).toBeVisible();

    // Banco: um pagamento com o id da fila (idempotência) e vencimento = hoje + 1 mês (estava vencido).
    expect(await pagamentosDe(aluno.id)).toEqual([
      { valor: 75, forma: "dinheiro", pago_em: hojeSP(), observacao: "pago na recepção", client_id: pedido.id, registrado_por: ADMIN_ID },
    ]);
    expect(await memberPorId(aluno.id)).toMatchObject({ status: "ativo", vencimento: addMes(hojeSP()) });

    const s = await snapshotDepois();
    expect(s.inadimplentes.some((i) => i.member_id === aluno.id)).toBe(false);
    await expect(painel(page, "Inadimplentes").getByText(aluno.nome)).toHaveCount(0);
    await expect(painel(page, "Pagamentos do mês").locator("tbody tr").filter({ hasText: aluno.nome })).toContainText(reBrl(75));
  });

  test("em dia com valor acordado: vencimento soma 1 mês ao vencimento atual (não a hoje)", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "2x", valorAcordado: 60, vencimentoEm: 10 });
    const antes = (await memberPorId(aluno.id))!.vencimento as string;
    await abrirAdmin(page);

    await linhaAluno(page, aluno.nome).getByRole("button", { name: `Registrar: ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Valor (R$)")).toHaveValue("60,00");
    const envio = esperarEnvioFila(page, "pagamento");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    expect((await envio).resposta).toEqual({ ok: true });

    expect(await memberPorId(aluno.id)).toMatchObject({ vencimento: addMes(antes), status: "ativo" });
    expect((await pagamentosDe(aluno.id)).map((p) => [p.valor, p.forma])).toEqual([[60, "pix"]]);
  });

  test("pendente vira ativo com o primeiro pagamento e data retroativa", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "pendente", plano: "3x" });
    await abrirAdmin(page);
    await linhaAluno(page, aluno.nome).getByRole("button", { name: `Registrar: ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    const ontem = addDias(hojeSP(), -1);
    await dialogo.getByLabel("Data do pagamento").fill(ontem);
    await dialogo.getByLabel("Valor (R$)").fill("99,9");
    await escolher(dialogo, "Forma", "Cartão");

    const envio = esperarEnvioFila(page, "pagamento");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    expect((await envio).pedido.payload).toMatchObject({ valor: 99.9, pago_em: ontem, forma: "cartao", observacao: null });

    expect(await memberPorId(aluno.id)).toMatchObject({ status: "ativo", vencimento: addMes(ontem) });
    await expect(linhaAluno(page, aluno.nome)).toContainText("Ativo");
    await expect(linhaAluno(page, aluno.nome)).toContainText(dataBR(addMes(ontem)));
  });

  test("validações do formulário: valor zero, sem plano e sem valor, observação longa", async ({ page, fabrica }) => {
    const semPlano = await fabrica.aluno({ login: false, status: "pendente", plano: null });
    await abrirAdmin(page);
    let enviados = 0;
    page.on("request", (r) => { if (r.url().endsWith("/api/admin/acoes")) enviados++; });

    await linhaAluno(page, semPlano.nome).getByRole("button", { name: `Registrar: ${semPlano.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Valor (R$)")).toHaveValue("");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    await expect(dialogo.getByRole("alert")).toHaveText("Informe o valor (o aluno não tem plano definido).");
    await dialogo.getByLabel("Valor (R$)").fill("0");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    await expect(dialogo.getByRole("alert")).toHaveText("Informe um valor maior que zero.");
    await dialogo.getByLabel("Valor (R$)").fill("abc");
    await dialogo.getByRole("button", { name: "Registrar" }).click();
    await expect(dialogo.getByRole("alert")).toHaveText("Informe um valor maior que zero.");

    await dialogo.getByRole("button", { name: "Cancelar" }).click();
    expect(enviados).toBe(0);
    expect(await pagamentosDe(semPlano.id)).toEqual([]);
  });
});

test.describe("totais e histórico", () => {
  test("totais do mês por forma = soma dos pagamentos do snapshot; navegação entre meses", async ({ page }) => {
    const snap = await abrirAdmin(page, "/dashboard/admin/financeiro", { congelar: true });
    const ym = snap.hoje.slice(0, 7);
    const doMes = snap.pagamentos.filter((p) => p.pago_em.startsWith(ym));
    const soma = (f?: string) => doMes.filter((p) => !f || p.forma === f).reduce((t, p) => t + p.valor, 0);

    const nav = page.getByRole("navigation", { name: "Mês" });
    await expect(nav).toContainText(new RegExp(mesLabel(ym), "i"));
    const entradas = page.getByRole("region", { name: "Entradas do mês" });
    for (const [rotulo, forma] of [["Recebido", undefined], ["Pix", "pix"], ["Dinheiro", "dinheiro"], ["Cartão", "cartao"]] as const) {
      await expect(entradas.locator("div").filter({ hasText: new RegExp(`^${rotulo}`) })).toContainText(reBrl(soma(forma)));
    }
    await expect(page.getByText(new RegExp(`^${doMes.length} pagamentos? em ${mesLabel(ym)}`, "i"))).toBeVisible();
    await expect(painel(page, "Pagamentos do mês").locator("tbody tr")).toHaveCount(doMes.length || 0);

    // Mês anterior: o seed tem pagamentos de 27–40 dias atrás.
    const anterior = shiftMes(ym, -1);
    await nav.getByRole("button", { name: "Mês anterior" }).click();
    await expect(nav).toContainText(new RegExp(mesLabel(anterior), "i"));
    const doAnterior = snap.pagamentos.filter((p) => p.pago_em.startsWith(anterior));
    await expect(page.getByText(new RegExp(`^${doAnterior.length} pagamentos? em ${mesLabel(anterior)}`, "i"))).toBeVisible();
    await expect(entradas.locator("div").filter({ hasText: /^Recebido/ }))
      .toContainText(reBrl(doAnterior.reduce((t, p) => t + p.valor, 0)));
    await nav.getByRole("button", { name: "Próximo mês" }).click();
    await expect(nav).toContainText(new RegExp(mesLabel(ym), "i"));
  });

  test("filtra por nome e abre o histórico completo do aluno", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 20 });
    await fabrica.pagamento(aluno.id, 75, 0, "pix");
    await fabrica.pagamento(aluno.id, 70, -35, "dinheiro"); // mês passado (ou retrasado)
    await abrirAdmin(page, "/dashboard/admin/financeiro");

    const lista = painel(page, "Pagamentos do mês");
    await page.getByRole("searchbox", { name: "Filtrar pagamentos por aluno" }).fill(aluno.nome.slice(0, 12));
    await expect(lista.locator("tbody tr")).toHaveCount(1);

    await lista.getByRole("button", { name: aluno.nome }).click();
    const historico = painel(page, `Histórico de ${aluno.nome}`);
    await expect(historico.locator("tbody tr")).toHaveCount(2);
    await expect(historico).toContainText(reBrl(70));
    await expect(historico).toContainText(reBrl(75));
    await page.getByRole("button", { name: "← Ver pagamentos do mês" }).click();
    await expect(page.getByRole("heading", { name: "Pagamentos do mês" })).toBeVisible();
  });
});
