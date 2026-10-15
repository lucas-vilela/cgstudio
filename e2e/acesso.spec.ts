import { test, expect, USUARIOS, storageStatePath } from "./support/test";
import { esperarServerAction } from "./support/rede";

// Quem pode abrir o quê: proxy (sem sessão → home), guarda de admin (aluno → 404) e logout.

const ROTAS_ADMIN = [
  "/dashboard/admin",
  "/dashboard/admin/financeiro",
  "/dashboard/admin/calendario",
  "/dashboard/admin/aluno?id=00000000-0000-0000-0000-00000000c001",
  "/dashboard/admin/conteudo",
  "/dashboard/admin/admins",
];

test.describe("visitante sem sessão", () => {
  for (const rota of ["/dashboard", ...ROTAS_ADMIN]) {
    test(`${rota} redireciona para a home`, async ({ page }) => {
      const resp = await page.request.get(rota, { maxRedirects: 0 });
      expect(resp.status()).toBe(307);
      expect(new URL(resp.headers().location, "http://x").pathname).toBe("/");

      await page.goto(rota);
      await expect(page).toHaveURL("/");
    });
  }

  test("callback do OAuth sem código volta para a home com erro", async ({ page }) => {
    await page.goto("/auth/callback");
    await expect(page).toHaveURL("/?auth_error=callback");
  });
});

test.describe("aluno logado", () => {
  test.use({ storageState: storageStatePath("ana") });

  test("vê o próprio painel e não vê o atalho do admin", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Meu painel" })).toBeVisible();
    await expect(page.getByText(USUARIOS.ana)).toBeVisible();
    await expect(page.getByRole("link", { name: "Painel admin" })).toHaveCount(0);
  });

  for (const rota of ["/dashboard/admin/conteudo", "/dashboard/admin/admins", "/dashboard/admin"]) {
    test(`não abre ${rota} (404)`, async ({ page }) => {
      await page.goto(rota);
      await expect(page.getByText("This page could not be found.")).toBeVisible();
      await expect(page.getByRole("heading", { name: /Conteúdo|Admins|Alunos/ })).toHaveCount(0);
    });
  }
});

test.describe("admin logado", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("entra direto no painel do admin, sem tela de cadastro de aluno", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard/admin");
    await expect(page.getByRole("heading", { name: "Alunos", level: 1 })).toBeVisible();
    await expect(page.getByText("Olá, Camila", { exact: true })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Painel do admin" });
    await expect(nav.getByRole("link", { name: /Alunos/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Meu cadastro" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeEnabled();
  });
});

// Logout revoga TODAS as sessões do usuário (escopo global do Supabase): sempre com usuário próprio.
test.describe("logout", () => {
  test("aluno sai: sessão encerrada no servidor e painel volta a pedir login", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "1x", vencimentoEm: 10 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");
    await expect(page.getByText(aluno.email)).toBeVisible();

    const acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Sair" }).click();
    await acao;
    await expect(page).toHaveURL("/");

    const cookies = await page.context().cookies();
    expect(cookies.filter((c) => c.name.startsWith("sb-") && c.value)).toHaveLength(0);
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/");
  });

  test("admin sai: dados do app offline são apagados do aparelho", async ({ page, fabrica, entrarComo }) => {
    const admin = await fabrica.aluno({ status: "ativo", admin: true });
    await entrarComo(admin.email);
    await page.goto("/dashboard/admin");
    await expect(page.getByRole("heading", { name: "Todos os alunos" })).toBeVisible();
    const snapshots = () => page.evaluate(() => new Promise<number>((res) => {
      const r = indexedDB.open("cgstudio-admin");
      r.onsuccess = () => {
        const q = r.result.transaction("snapshot").objectStore("snapshot").count();
        q.onsuccess = () => { res(q.result); r.result.close(); };
      };
    }));
    await expect.poll(snapshots).toBe(1);

    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL("/");
    expect(await snapshots()).toBe(0);
  });
});
