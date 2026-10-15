import { test, expect, storageStatePath } from "./support/test";
import { db, ok } from "./support/db";
import { esperarServerAction } from "./support/rede";
import { toast } from "./support/ui";

// Admin › Admins: promover e rebaixar (RPC set_user_role).

test.use({ storageState: storageStatePath("admin") });

const papel = async (userId: string) =>
  (ok(await db.from("user_roles").select("role").eq("user_id", userId).single()) as { role: string }).role;

test("promove aluno com conta a admin e depois rebaixa", async ({ page, fabrica }) => {
  const aluno = await fabrica.aluno({ status: "ativo" });
  await page.goto("/dashboard/admin/admins");
  await expect(page.getByRole("heading", { name: "Admins", level: 1 })).toBeVisible();

  await page.getByLabel("Buscar por nome ou e-mail").fill(aluno.email);
  let acao = esperarServerAction(page);
  await page.getByRole("button", { name: `Promover ${aluno.nome} a admin` }).click();
  await acao;
  await expect(toast(page, "Aluno promovido a admin.")).toBeVisible();
  expect(await papel(aluno.userId!)).toBe("admin");
  await expect(page.getByLabel("Buscar por nome ou e-mail")).toHaveValue("");

  const lista = page.locator("section").filter({ has: page.getByRole("heading", { name: "Admins", level: 2 }) });
  await expect(lista.getByText(aluno.nome)).toBeVisible();

  acao = esperarServerAction(page);
  await lista.getByRole("button", { name: `Rebaixar ${aluno.nome}` }).click();
  await acao;
  await expect(toast(page, "Admin rebaixado a aluno.")).toBeVisible();
  expect(await papel(aluno.userId!)).toBe("member");
  await expect(lista.getByText(aluno.nome)).toHaveCount(0);
});

test("o admin logado não pode se rebaixar e quem não tem conta não aparece para promover", async ({ page }) => {
  await page.goto("/dashboard/admin/admins");
  const lista = page.locator("section").filter({ has: page.getByRole("heading", { name: "Admins", level: 2 }) });
  const eu = lista.getByRole("listitem").filter({ hasText: "Camila Admin" });
  await expect(eu.getByText("Você")).toBeVisible();
  await expect(eu.getByRole("button", { name: "Rebaixar Camila Admin" })).toBeDisabled();
  await expect(eu.getByRole("button", { name: "Rebaixar Camila Admin" })).toHaveAttribute("title", "Você não pode rebaixar a si mesmo");

  // Diego foi cadastrado pelo admin (sem conta Google): não pode virar admin.
  await page.getByLabel("Buscar por nome ou e-mail").fill("Diego");
  await expect(page.getByText("Nenhum aluno encontrado.")).toBeVisible();
});
