import type { Locator, Page } from "@playwright/test";
import { test, expect, storageStatePath } from "./support/test";
import { db, ok } from "./support/db";
import { esperarServerAction } from "./support/rede";
import { toast } from "./support/ui";

// Depoimento ponta a ponta: aluno envia (RPC enviar_depoimento) → admin modera em Conteúdo →
// home mostra só os aprovados, com "Primeiro nome + inicial". A home é cacheada; as ações invalidam
// a tag do cache, então conferir a home logo depois prova a invalidação.

const depoimentoDe = async (memberId: string) =>
  ok(await db.from("depoimentos").select("id,texto,status,nome_exibicao,ajustado_pelo_admin,aprovado_em").eq("member_id", memberId).maybeSingle()) as
    { id: number; texto: string; status: string; nome_exibicao: string; ajustado_pelo_admin: boolean; aprovado_em: string | null } | null;

const naHome = (page: Page, texto: string) => page.locator("#depoimentos figure").filter({ hasText: texto });

async function abrirModeracao(page: Page) {
  await page.goto("/dashboard/admin/conteudo");
  await page.getByRole("tab", { name: /^Depoimentos/ }).click();
}

// `has` é relativo a cada item: o localizador interno parte da página, não do escopo.
const item = (escopo: Page | Locator, nome: string) =>
  escopo.getByRole("listitem").filter({ has: ("goto" in escopo ? escopo : escopo.page()).getByText(nome, { exact: true }) });

test.describe("aluno envia", () => {
  test("contador, envio, estado 'Em análise' e linha no banco com o nome de exibição", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ nome: `Dep${Date.now().toString(36)}`, status: "ativo", plano: "1x", vencimentoEm: 9 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    const campo = page.getByLabel("Depoimento");
    const enviar = page.getByRole("button", { name: "Enviar depoimento" });
    await expect(page.getByText("0/500 (mínimo 10)")).toBeVisible();
    await expect(enviar).toBeDisabled();
    await campo.fill("Curto");
    await expect(page.getByText("5/500 (mínimo 10)")).toBeVisible();
    await expect(enviar).toBeDisabled();

    const texto = `Treino excelente, equipe atenciosa. ${aluno.nome}`;
    await campo.fill(texto);
    await expect(enviar).toBeEnabled();
    const acao = esperarServerAction(page);
    await enviar.click();
    await acao;

    await expect(toast(page, "Recebemos seu depoimento. Ele aparece na home depois da aprovação.")).toBeVisible();
    await expect(page.getByText("Em análise", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar alteração" })).toBeDisabled(); // sem mudança
    const primeiro = aluno.nome.split(" ")[0];
    expect(await depoimentoDe(aluno.id)).toMatchObject({ texto, status: "pendente", nome_exibicao: `${primeiro} T.`, ajustado_pelo_admin: false });
  });

  test("aluno inativo não envia", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "inativo", plano: "1x", vencimentoEm: -30 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");
    await expect(page.getByLabel("Depoimento")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar depoimento" })).toBeDisabled();
    expect(await depoimentoDe(aluno.id)).toBeNull();
  });
});

test.describe("admin modera e a home acompanha", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("aprovar publica na home; esconder tira; mostrar volta", async ({ page, fabrica, outraJanela }) => {
    const aluno = await fabrica.aluno({ nome: `Apr${Date.now().toString(36)}`, status: "ativo" });
    const texto = `Aulas incríveis e turma pequena. ${aluno.nome}`;
    await fabrica.depoimento(aluno.id, texto);
    const exibicao = `${aluno.nome.split(" ")[0]} T.`;
    const visitante = await outraJanela("visitante");

    await abrirModeracao(page);
    const paraAprovar = page.getByRole("heading", { name: /^Para aprovar/ }).locator("xpath=..");
    await expect(item(paraAprovar, aluno.nome)).toContainText(`Na home como “${exibicao}”`);

    let acao = esperarServerAction(page);
    await page.getByRole("button", { name: `Aprovar depoimento de ${aluno.nome}` }).click();
    await acao;
    await expect(toast(page, "Depoimento publicado na home.")).toBeVisible();
    const aprovado = await depoimentoDe(aluno.id);
    expect(aprovado).toMatchObject({ status: "aprovado", nome_exibicao: exibicao });
    expect(aprovado!.aprovado_em).not.toBeNull();

    await visitante.goto("/");
    await expect(naHome(visitante, texto)).toContainText(exibicao);

    acao = esperarServerAction(page);
    await page.getByRole("button", { name: `Esconder depoimento de ${aluno.nome}` }).click();
    await acao;
    await expect(toast(page, "Depoimento escondido da home.")).toBeVisible();
    expect(await depoimentoDe(aluno.id)).toMatchObject({ status: "oculto", aprovado_em: null });
    await visitante.reload();
    await expect(naHome(visitante, texto)).toHaveCount(0);

    acao = esperarServerAction(page);
    await page.getByRole("button", { name: `Mostrar depoimento de ${aluno.nome}` }).click();
    await acao;
    expect((await depoimentoDe(aluno.id))!.status).toBe("aprovado");
    await visitante.reload();
    await expect(naHome(visitante, texto)).toBeVisible();
  });

  test("ajustar texto: banco marca o ajuste e o aluno vê o aviso", async ({ page, fabrica, outraJanela }) => {
    const aluno = await fabrica.aluno({ nome: `Aju${Date.now().toString(36)}`, status: "ativo", plano: "1x", vencimentoEm: 9 });
    await fabrica.depoimento(aluno.id, "texto original com erro de digitacao");
    await abrirModeracao(page);

    await page.getByRole("button", { name: `Ajustar texto de ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Texto").fill("Texto original, sem erro de digitação.");
    await expect(dialogo.getByText("38/500")).toBeVisible();
    const acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Salvar texto" }).click();
    await acao;
    await expect(toast(page, "Texto do depoimento ajustado.")).toBeVisible();
    expect(await depoimentoDe(aluno.id)).toMatchObject({ texto: "Texto original, sem erro de digitação.", ajustado_pelo_admin: true });
    await expect(item(page, aluno.nome).getByText("Ajustado", { exact: true })).toBeVisible();

    const alunoPage = await outraJanela({ email: aluno.email });
    await alunoPage.goto("/dashboard");
    await expect(alunoPage.getByText("A recepção ajustou o texto do seu depoimento. É a versão que aparece abaixo.")).toBeVisible();
    await expect(alunoPage.getByLabel("Depoimento")).toHaveValue("Texto original, sem erro de digitação.");
  });

  test("recusar e excluir (dois cliques)", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ nome: `Rec${Date.now().toString(36)}`, status: "ativo" });
    await fabrica.depoimento(aluno.id, "Depoimento que vai ser recusado.");
    await abrirModeracao(page);

    let acao = esperarServerAction(page);
    await page.getByRole("button", { name: `Recusar depoimento de ${aluno.nome}` }).click();
    await acao;
    await expect(toast(page, "Depoimento recusado.")).toBeVisible();
    expect((await depoimentoDe(aluno.id))!.status).toBe("recusado");
    const recusados = page.getByRole("heading", { name: /^Escondidos e recusados/ }).locator("xpath=..");
    await expect(recusados.getByText(aluno.nome, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Excluir depoimento de ${aluno.nome}` }).click();
    expect(await depoimentoDe(aluno.id)).not.toBeNull();
    acao = esperarServerAction(page);
    await page.getByRole("button", { name: `Confirmar exclusão do depoimento de ${aluno.nome}` }).click();
    await acao;
    await expect(toast(page, "Depoimento excluído.")).toBeVisible();
    expect(await depoimentoDe(aluno.id)).toBeNull();
  });
});

test("aluno edita depoimento publicado: volta para análise e sai da home", async ({ page, fabrica, entrarComo, outraJanela }) => {
  const aluno = await fabrica.aluno({ nome: `Edi${Date.now().toString(36)}`, status: "ativo", plano: "1x", vencimentoEm: 9 });
  const texto = `Publicado e depois editado. ${aluno.nome}`;
  await fabrica.depoimento(aluno.id, texto, "aprovado");
  await entrarComo(aluno.email);
  await page.goto("/dashboard");
  await expect(page.getByText("Publicado", { exact: true })).toBeVisible();

  await page.getByLabel("Depoimento").fill(`${texto} Agora com mais detalhes.`);
  const acao = esperarServerAction(page);
  await page.getByRole("button", { name: "Enviar alteração" }).click();
  await acao;
  await expect(page.getByText("Em análise", { exact: true })).toBeVisible();
  expect((await depoimentoDe(aluno.id))!.status).toBe("pendente");

  const visitante = await outraJanela("visitante");
  await visitante.goto("/");
  await expect(naHome(visitante, texto)).toHaveCount(0);
});
