import { test, expect, storageStatePath } from "./support/test";

// Páginas de ajuda (aluno e admin) e as dicas (?) do painel do admin. Só leitura.

test.describe("aluno", () => {
  test.use({ storageState: storageStatePath("ana") });

  test("abre o guia pelo botão 'Como usar' e navega pelo índice", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Como usar" }).click();
    await expect(page).toHaveURL(/\/dashboard\/ajuda$/);
    await expect(page.getByRole("heading", { name: "Como usar o seu painel", level: 1 })).toBeVisible();

    const indice = page.getByRole("navigation", { name: "Tópicos da ajuda" });
    await indice.getByRole("link", { name: "Aula grátis" }).click();
    await expect(page).toHaveURL(/#aula-gratis$/);
    await expect(page.getByRole("heading", { name: "Agendar a aula grátis" })).toBeInViewport();

    await page.getByRole("link", { name: "Voltar ao meu painel" }).click();
    await expect(page.getByRole("heading", { name: "Meus horários" })).toBeVisible();
  });

  test("aluno não vê a aba de ajuda do admin", async ({ page }) => {
    await page.goto("/dashboard/admin/ajuda");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Como funciona o painel" })).toHaveCount(0);
  });
});

test.describe("admin", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("abre o guia pela aba 'Ajuda' com todas as seções", async ({ page }) => {
    await page.goto("/dashboard/admin");
    await page.getByRole("navigation", { name: "Painel do admin" }).getByRole("link", { name: "Ajuda" }).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\/ajuda$/);
    await expect(page.getByRole("heading", { name: "Como funciona o painel", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ajuda" })).toHaveAttribute("aria-current", "page");

    for (const secao of [
      "Visão geral", "Alunos", "Ficha do aluno", "Pagamentos e vencimento", "Financeiro", "Calendário",
      "Conteúdo da página inicial", "Admins",
    ]) {
      await expect(page.getByRole("heading", { name: secao, level: 2 })).toBeVisible();
    }
  });

  test("dica abre ao tocar e fecha com Esc", async ({ page }) => {
    await page.goto("/dashboard/admin");
    const dica = page.getByRole("button", { name: "Dica: Vencimentos próximos" });
    await dica.click();
    const balao = page.getByRole("dialog");
    await expect(balao).toContainText("Use “Registrar” para lançar o pagamento aqui mesmo.");
    await page.keyboard.press("Escape");
    await expect(balao).toBeHidden();
  });

  test("dicas aparecem nas outras abas", async ({ page }) => {
    await page.goto("/dashboard/admin/financeiro");
    await expect(page.getByRole("button", { name: "Dica: Inadimplentes" })).toBeVisible();
    await page.goto("/dashboard/admin/calendario");
    await expect(page.getByRole("button", { name: "Dica: Horários" })).toBeVisible();
    await page.goto("/dashboard/admin/conteudo");
    await page.getByRole("tab", { name: /Depoimentos/ }).click();
    await expect(page.getByRole("button", { name: "Dica: Esconder ou recusar?" })).toBeVisible();
    await page.goto("/dashboard/admin/admins");
    await expect(page.getByRole("button", { name: "Dica: Promover aluno" })).toBeVisible();
  });
});
