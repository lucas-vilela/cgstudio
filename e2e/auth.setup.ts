import { test as setup, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { USUARIOS, garantirBancoLocal, storageStatePath, type Usuario } from "./supabase-local";
import { db } from "./support/db";
import { limparRestos } from "./support/fabrica";
import { cookiesDeLogin } from "./support/sessao";

setup("banco local com seed e sem restos de execuções anteriores", async () => {
  garantirBancoLocal();
  const { data, error } = await db.from("members").select("email").in("email", Object.values(USUARIOS));
  expect(error, "Supabase local está rodando? (npm run db:start)").toBeNull();
  expect(data, "Seed aplicado? (npm run db:reset)").toHaveLength(4);
  await limparRestos();
});

// Loga os usuários do seed e salva os cookies em e2e/.auth/<usuario>.json.
for (const usuario of Object.keys(USUARIOS) as Usuario[]) {
  setup(`login: ${usuario}`, async ({ baseURL }) => {
    const state = { cookies: await cookiesDeLogin(USUARIOS[usuario], baseURL!), origins: [] };
    const path = storageStatePath(usuario);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(state, null, 2));
  });
}

// O `next dev` compila cada rota no primeiro acesso: aquece aqui para os testes não pagarem isso.
setup("aquece as rotas do app", async ({ request, baseURL }) => {
  setup.setTimeout(240_000);
  const cookies = await cookiesDeLogin(USUARIOS.admin, baseURL!);
  const headers = { cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; ") };
  for (const rota of [
    "/", "/dashboard", "/dashboard/admin", "/dashboard/admin/financeiro", "/dashboard/admin/calendario",
    "/dashboard/admin/aluno", "/dashboard/admin/conteudo", "/dashboard/admin/admins", "/api/admin/snapshot",
  ]) {
    const r = await request.get(rota, { headers, timeout: 180_000 });
    expect(r.status(), rota).toBeLessThan(500);
  }
});
