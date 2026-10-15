import { test, expect, USUARIOS } from "./support/test";
import { memberPorEmail, memberPorId } from "./support/db";
import { telefoneUnico } from "./support/fabrica";
import { esperarServerAction } from "./support/rede";
import { toast } from "./support/ui";

// "Seus dados": o aluno edita nome e telefone (Server Action saveMember).

test.describe("cadastro do aluno", () => {
  test("salva nome e telefone normalizados no banco", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "1x", vencimentoEm: 10 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    const novo = telefoneUnico();
    await page.getByLabel("Nome completo").fill(`  Maria   das Dores ${aluno.nome}  `);
    await page.getByLabel("Telefone").fill(`(${novo.slice(0, 2)}) ${novo.slice(2, 7)}-${novo.slice(7)}`);
    const acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await acao;

    await expect(toast(page, "Dados salvos.")).toBeVisible();
    const m = await memberPorId(aluno.id);
    expect(m).toMatchObject({ nome: `Maria das Dores ${aluno.nome}`, telefone: novo });

    // Depois de recarregar, o formulário mostra o que está no banco (telefone formatado).
    await page.reload();
    await expect(page.getByLabel("Nome completo")).toHaveValue(`Maria das Dores ${aluno.nome}`);
    await expect(page.getByLabel("Telefone")).toHaveValue(`(${novo.slice(0, 2)}) ${novo.slice(2, 7)}-${novo.slice(7)}`);
  });

  test("validação no servidor: nome curto e telefone inválido não gravam nada", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo" });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await page.getByLabel("Nome completo").fill("A");
    await page.getByLabel("Telefone").fill("1234");
    const acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await acao;

    await expect(page.locator("#nome-error")).toHaveText("Informe o nome completo.");
    await expect(page.locator("#telefone-error")).toHaveText("Telefone inválido. Use DDD + número.");
    await expect(page.getByLabel("Nome completo")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Telefone")).toHaveAttribute("aria-describedby", "telefone-error");
    expect(await memberPorId(aluno.id)).toMatchObject({ nome: aluno.nome, telefone: aluno.telefone });
  });

  test("telefone de outro aluno é recusado pelo banco (unique) com mensagem amigável", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo" });
    const ana = await memberPorEmail(USUARIOS.ana);
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await page.getByLabel("Telefone").fill(ana!.telefone);
    const acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await acao;

    await expect(page.locator("#telefone-error")).toHaveText(
      "Este telefone já está em uso por outro cadastro. Informe outro número.",
    );
    expect((await memberPorId(aluno.id))!.telefone).toBe(aluno.telefone);
  });
});
