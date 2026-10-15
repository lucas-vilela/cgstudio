import { test, expect } from "./support/test";
import { SUPABASE_URL } from "./supabase-local";
import { esperarServerAction } from "./support/rede";

// Home: estrutura, layout e login. O conteúdo vindo do banco (textos, planos, treinos…) é conferido
// em home-e-conteudo.serial.spec.ts, que é quem o altera.

test.describe("landing", () => {
  test("carrega com título e seções principais", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/CG Studio/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const id of ["modalidades", "planos", "horarios", "contato"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });

  test("não tem scroll horizontal", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("links do menu levam às seções (desktop)", async ({ page, isMobile }) => {
    test.skip(isMobile, "no celular o menu de âncoras fica escondido");
    await page.goto("/");
    const menu = page.getByRole("navigation", { name: "Principal" });
    for (const [rotulo, id] of [["Planos", "planos"], ["Horários", "horarios"], ["Contato", "contato"]]) {
      await menu.getByRole("link", { name: rotulo }).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });

  test("'Ver horários' rola até a seção de horários", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Ver horários" }).click();
    await expect(page.locator("#horarios")).toBeInViewport();
  });

  test("'Entrar com Google' chama a Server Action e leva ao OAuth do Supabase com o callback do app", async ({ page, baseURL }) => {
    await page.goto("/");
    const acao = esperarServerAction(page);
    const oauth = page.waitForRequest((r) => r.url().startsWith(`${SUPABASE_URL}/auth/v1/authorize`));
    await page.getByRole("button", { name: "Entrar com Google" }).first().click();
    await acao;
    const url = new URL((await oauth).url());
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("redirect_to")).toBe(`${baseURL}/auth/callback`);
    // PKCE: o desafio vai na URL e o verificador fica num cookie do app.
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    const cookies = await page.context().cookies(baseURL);
    expect(cookies.some((c) => c.name.endsWith("-code-verifier"))).toBe(true);
  });
});

test("dashboard redireciona visitante não logado para a home", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL("/");
});
