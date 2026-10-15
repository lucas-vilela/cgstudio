import { unzipSync, strFromU8 } from "fflate";
import { readFile } from "node:fs/promises";
import { test, expect, storageStatePath } from "./support/test";
import { hojeSP } from "./support/datas";
import { db, memberPorId, ok } from "./support/db";
import { telefoneUnico } from "./support/fabrica";
import { abrirAdmin, contarEnviosFila, esperarEnvioFila } from "./support/rede";
import { esperarToastsSumirem, linhaAluno, toast } from "./support/ui";

// App offline do admin: a fila guarda no aparelho (IndexedDB) o que foi registrado sem conexão e
// envia quando a conexão volta. Conferimos: nada sai offline, o envio acontece ao voltar, o banco
// recebe uma vez só, e recusas do servidor viram "Pendências com erro".

test.use({ storageState: storageStatePath("admin") });

const status = (page: import("@playwright/test").Page) => page.getByRole("status").filter({ hasText: /Online|Offline/ });
const pagamentos = async (memberId: string) =>
  ok(await db.from("payments").select("id,valor,client_id").eq("member_id", memberId)) as { id: number; valor: number; client_id: string }[];

async function registrarPagamento(page: import("@playwright/test").Page, nome: string) {
  await linhaAluno(page, nome).getByRole("button", { name: `Registrar: ${nome}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Registrar" }).click();
}

test.describe("sem conexão", () => {
  test("pagamento offline fica na fila e é enviado uma vez quando a conexão volta", async ({ page, context, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 2 });
    await abrirAdmin(page);
    const envios = contarEnviosFila(page);

    await context.setOffline(true);
    await expect(status(page)).toContainText("Offline");
    await expect(toast(page, "Sem conexão. Você pode continuar registrando")).toBeVisible();
    // Sem conexão não há "Atualizar".
    await expect(page.getByRole("button", { name: "Atualizar" })).toHaveCount(0);

    await registrarPagamento(page, aluno.nome);
    await expect(toast(page, `Pagamento de ${aluno.nome} registrado. Será enviado quando a conexão voltar.`)).toBeVisible();
    await expect(status(page)).toContainText("1 registro aguardando envio");
    await expect(linhaAluno(page, aluno.nome).getByText("Pagamento aguardando envio")).toBeVisible();
    await esperarToastsSumirem(page);
    // No Financeiro (troca de tela offline), o pagamento já aparece marcado.
    await page.getByRole("navigation", { name: "Painel do admin" }).getByRole("link", { name: /Financeiro/ }).click();
    await expect(page).toHaveURL("/dashboard/admin/financeiro");
    await expect(page.getByText(/\(1 aguardando envio\)/)).toBeVisible();

    await page.waitForTimeout(500);
    expect(envios.n, "nada é enviado offline").toBe(0);
    expect(await pagamentos(aluno.id)).toEqual([]);

    const envio = esperarEnvioFila(page, "pagamento");
    await context.setOffline(false);
    const { pedido, resposta } = await envio;
    expect(resposta).toEqual({ ok: true });
    await expect(toast(page, "Conexão de volta.")).toBeVisible();
    await expect(toast(page, "1 registro enviado.")).toBeVisible();
    await expect(status(page)).toContainText("Online");
    await expect(status(page)).not.toContainText("aguardando envio");

    const rows = await pagamentos(aluno.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].client_id).toBe(pedido.id);
    expect(envios.n).toBe(1);
  });

  test("a fila sobrevive a recarregar a página (IndexedDB) e é enviada depois", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "2x", vencimentoEm: 4 });
    await abrirAdmin(page);
    // Servidor inalcançável (falha de rede só nesta rota): o item fica pendente.
    await page.route("**/api/admin/acoes", (r) => r.abort("internetdisconnected"));
    await registrarPagamento(page, aluno.nome);
    await expect(status(page)).toContainText("1 registro aguardando envio");

    await page.reload();
    await expect(status(page)).toContainText("1 registro aguardando envio");
    await expect(linhaAluno(page, aluno.nome).getByText("Pagamento aguardando envio")).toBeVisible();
    expect(await pagamentos(aluno.id)).toEqual([]);

    await page.unroute("**/api/admin/acoes");
    const envio = esperarEnvioFila(page, "pagamento");
    await page.getByRole("button", { name: "Atualizar" }).click();
    expect((await envio).resposta).toEqual({ ok: true });
    await expect(status(page)).not.toContainText("aguardando envio");
    expect(await pagamentos(aluno.id)).toHaveLength(1);
  });

  test("navegação offline: Alunos/Financeiro/Calendário trocam sem servidor; Conteúdo avisa que precisa de conexão", async ({ page, context }) => {
    await abrirAdmin(page);
    const documentos: string[] = [];
    page.on("request", (r) => { if (r.resourceType() === "document") documentos.push(r.url()); });
    await context.setOffline(true);
    await expect(toast(page, "Sem conexão.")).toBeVisible();
    await esperarToastsSumirem(page); // no celular o aviso cobre a barra de abas
    const nav = page.getByRole("navigation", { name: "Painel do admin" });

    await nav.getByRole("link", { name: /Calendário/ }).click();
    await expect(page.getByRole("heading", { name: "Calendário", level: 1 })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Calendário/ })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: /Financeiro/ }).click();
    await expect(page.getByRole("heading", { name: "Financeiro", level: 1 })).toBeVisible();
    await nav.getByRole("link", { name: /Alunos/ }).click();
    await expect(page.getByRole("heading", { name: "Alunos", level: 1 })).toBeVisible();

    await nav.getByRole("link", { name: /Conteúdo/ }).click();
    await expect(toast(page, "Esta aba precisa de conexão com a internet.")).toBeVisible();
    await expect(page).toHaveURL("/dashboard/admin");
    expect(documentos, "trocar de tela não recarrega a página").toEqual([]);
  });

  test("exportar planilha funciona offline e inclui a aba 'Aguardando envio'", async ({ page, context, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 3 });
    await abrirAdmin(page);
    await context.setOffline(true);
    await registrarPagamento(page, aluno.nome);
    await expect(status(page)).toContainText("1 registro aguardando envio");

    const baixou = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar planilha" }).click();
    const download = await baixou;
    expect(download.suggestedFilename()).toBe(`cgstudio-backup-${hojeSP()}.xlsx`);
    await expect(toast(page, "Planilha exportada.")).toBeVisible();

    const arquivos = unzipSync(new Uint8Array(await readFile((await download.path())!)));
    const workbook = strFromU8(arquivos["xl/workbook.xml"]);
    for (const aba of ["Alunos", "Pagamentos", "Horários", "Planos", "Anamnese", "Medidas", "Aguardando envio"])
      expect(workbook).toContain(`name="${aba}"`);
    const textos = strFromU8(arquivos["xl/sharedStrings.xml"] ?? new Uint8Array());
    expect(textos).toContain(aluno.nome);
    expect(textos).toContain("Ana Souza");
    // Volta online para a fila não ficar pendurada no fim do teste.
    const envio = esperarEnvioFila(page, "pagamento");
    await context.setOffline(false);
    await envio;
  });
});

test.describe("recusas do servidor e pendências", () => {
  test("cadastro offline com telefone que já existe: vira pendência, bloqueia o pagamento dele e é corrigido", async ({ page, context, fabrica }) => {
    await abrirAdmin(page);
    await context.setOffline(true);

    const tel = telefoneUnico();
    const nome = `E2e${Date.now().toString(36)} Offline`;
    await page.getByRole("button", { name: "Novo aluno" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nome completo").fill(nome);
    await dialogo.getByLabel("Telefone").fill(tel);
    await dialogo.getByLabel("Valor acordado (R$)").fill("50");
    await dialogo.getByRole("button", { name: "Cadastrar" }).click();
    await expect(toast(page, `${nome} cadastrado(a). Será enviado quando a conexão voltar.`)).toBeVisible();
    const linha = linhaAluno(page, nome);
    await expect(linha.getByText("Aguardando envio", { exact: true })).toBeVisible();

    // Pagamento do aluno que ainda nem chegou ao servidor.
    await registrarPagamento(page, nome);
    await expect(status(page)).toContainText("2 registros aguardando envio");

    // Enquanto isso, alguém cadastra o mesmo telefone em outro aparelho.
    await fabrica.aluno({ login: false, telefone: tel });

    const recusa = esperarEnvioFila(page, "aluno_criar");
    await context.setOffline(false);
    const { pedido, resposta } = await recusa;
    fabrica.registrarMembro(pedido.payload.member_id as string);
    expect(resposta).toEqual({
      ok: false, tipo: "regra", mensagem: "Este telefone já está em uso por outro cadastro. Informe outro número.",
    });

    const pend = page.locator("#pendencias");
    const item = (desc: string) => pend.locator("li").filter({ has: page.getByText(desc, { exact: true }) });
    await expect(pend.getByRole("heading", { name: "Pendências com erro" })).toBeVisible();
    await expect(pend.locator("li")).toHaveCount(2);
    await expect(item(`Cadastro de ${nome}`)).toContainText("Este telefone já está em uso");
    await expect(pend.locator("li").filter({ hasText: new RegExp(`^Pagamento de ${nome}`) }))
      .toContainText(`Aguardando o cadastro de ${nome}, que falhou. Corrija o cadastro primeiro.`);
    await expect(status(page).getByRole("link", { name: "2 com erro" })).toBeVisible();
    await expect(toast(page, "1 registro não foi aceito pelo servidor. Veja em Pendências.")).toBeVisible();
    expect(await memberPorId(pedido.payload.member_id as string)).toBeNull();

    // Corrige o telefone: mesmo id; o pagamento que esperava é liberado e também vai.
    await item(`Cadastro de ${nome}`).getByRole("button", { name: "Corrigir" }).click();
    const corrigir = page.getByRole("dialog");
    await expect(corrigir.getByRole("heading", { name: "Corrigir cadastro" })).toBeVisible();
    await expect(corrigir.getByLabel("Nome completo")).toHaveValue(nome);
    const novoTel = telefoneUnico();
    await corrigir.getByLabel("Telefone").fill(novoTel);
    const reenvio = esperarEnvioFila(page, "aluno_criar");
    const pagamento = esperarEnvioFila(page, "pagamento");
    await corrigir.getByRole("button", { name: "Enviar de novo" }).click();
    const r2 = await reenvio;
    expect(r2.pedido.id, "reenvio mantém o id do item (idempotência)").toBe(pedido.id);
    expect(r2.pedido.payload.member_id).toBe(pedido.payload.member_id);
    expect(r2.resposta).toEqual({ ok: true });
    expect((await pagamento).resposta).toEqual({ ok: true });

    await expect(page.locator("#pendencias")).toHaveCount(0);
    const m = await memberPorId(pedido.payload.member_id as string);
    expect(m).toMatchObject({ nome, telefone: novoTel, valor_acordado: 50, status: "ativo" }); // ativo: pagou
    expect(await pagamentos(m!.id)).toHaveLength(1);
  });

  test("descartar pendência pede confirmação e apaga só do aparelho", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 2 });
    await abrirAdmin(page);
    await page.route("**/api/admin/acoes", (r) =>
      r.fulfill({ status: 200, json: { ok: false, tipo: "regra", mensagem: "Recusado no teste." } }));
    const envio = esperarEnvioFila(page, "pagamento");
    await registrarPagamento(page, aluno.nome);
    await envio;

    const item = page.locator("#pendencias li").filter({ hasText: `Pagamento de ${aluno.nome}` });
    await expect(item).toContainText("Recusado no teste.");
    await expect(linhaAluno(page, aluno.nome).getByText("Erro no envio")).toBeVisible();
    await item.getByRole("button", { name: "Descartar" }).click();
    await expect(item.getByRole("button", { name: "Confirmar descarte" })).toBeVisible();
    await item.getByRole("button", { name: "Confirmar descarte" }).click();
    await expect(toast(page, "Registro descartado.")).toBeVisible();
    await expect(page.locator("#pendencias")).toHaveCount(0);
    expect(await pagamentos(aluno.id)).toEqual([]);
  });

  test("sessão expirada no envio: aviso para entrar de novo e nada se perde", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 2 });
    // Congela os snapshots desde a abertura: um que já estivesse a caminho (com a sessão ainda boa)
    // chegaria com 200 depois do 401 e limparia o aviso — correto no app, mas corrida no teste.
    await abrirAdmin(page, "/dashboard/admin", { congelar: true });
    // Sessão expirada de verdade: as duas rotas do app respondem 401.
    await page.route("**/api/admin/acoes", (r) =>
      r.fulfill({ status: 401, json: { ok: false, tipo: "sessao", mensagem: "Entre novamente para enviar." } }));
    await page.route("**/api/admin/snapshot", (r) => r.fulfill({ status: 401, json: { erro: "sessao" } }));
    const envio = esperarEnvioFila(page, "pagamento");
    await registrarPagamento(page, aluno.nome);
    expect((await envio).status).toBe(401);

    await expect(toast(page, "Sua sessão expirou. Entre novamente para enviar os registros guardados.")).toBeVisible();
    await expect(status(page)).toContainText("Sua sessão expirou.");
    await expect(status(page).getByRole("link", { name: "Entre novamente" })).toHaveAttribute("href", "/");
    await expect(status(page)).toContainText("1 registro aguardando envio");

    await page.unroute("**/api/admin/acoes");
    await page.unroute("**/api/admin/snapshot");
    const ok2 = esperarEnvioFila(page, "pagamento");
    await page.getByRole("button", { name: "Atualizar" }).click();
    expect((await ok2).resposta).toEqual({ ok: true });
    await expect(status(page)).not.toContainText("Sua sessão expirou.");
    expect(await pagamentos(aluno.id)).toHaveLength(1);
  });

  test("falha do servidor (500) é repetida automaticamente", async ({ page, fabrica }) => {
    test.setTimeout(60_000);
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 2 });
    await abrirAdmin(page);
    let tentativas = 0;
    await page.route("**/api/admin/acoes", (r) => {
      tentativas++;
      return tentativas === 1
        ? r.fulfill({ status: 500, json: { ok: false, tipo: "temporario", mensagem: "Falha no servidor. Vai tentar de novo." } })
        : r.continue();
    });
    const primeira = esperarEnvioFila(page, "pagamento");
    await registrarPagamento(page, aluno.nome);
    expect((await primeira).status).toBe(500);
    await expect(status(page)).toContainText("1 registro aguardando envio");

    // Nova tentativa em ~10 s (backoff), sem ação do usuário.
    const segunda = esperarEnvioFila(page, "pagamento");
    expect((await segunda).resposta).toEqual({ ok: true });
    expect(tentativas).toBe(2);
    expect(await pagamentos(aluno.id)).toHaveLength(1);
  });

  test("logout com registro não enviado pede confirmação", async ({ page, context, fabrica, entrarComo }) => {
    const admin = await fabrica.aluno({ status: "ativo", admin: true });
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 2 });
    await entrarComo(admin.email);
    await abrirAdmin(page);
    await context.setOffline(true);
    await registrarPagamento(page, aluno.nome);
    await expect(status(page)).toContainText("1 registro aguardando envio");

    // O logout é Server Action: volta a conexão para ele poder rodar, com a fila travada.
    await page.route("**/api/admin/acoes", (r) => r.abort("internetdisconnected"));
    await context.setOffline(false);
    const sair = page.getByRole("button", { name: "Sair", exact: true });
    await sair.click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("heading", { name: "Sair mesmo assim?" })).toBeVisible();
    await expect(dialogo).toContainText("1 registro ainda não foi enviado ao servidor.");
    await dialogo.getByRole("button", { name: "Ficar" }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(page).toHaveURL("/dashboard/admin");

    await sair.click();
    await page.getByRole("dialog").getByRole("button", { name: "Sair e apagar" }).click();
    await expect(page).toHaveURL("/");
    expect(await pagamentos(aluno.id)).toEqual([]);
  });
});
