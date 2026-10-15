import type { Page } from "@playwright/test";
import { test, expect, storageStatePath } from "./support/test";
import { comoAdmin, db, ok } from "./support/db";
import { esperarServerAction } from "./support/rede";
import { toast } from "./support/ui";

// Conteúdo global da home (projeto `serial`: um teste por vez, porque mudam o que todo visitante vê).
// 1) a home mostra o que está no banco; 2) o que o admin muda em Conteúdo aparece na home na hora
//    (as ações invalidam o cache da home) e volta ao original no fim.

const PADRAO = {
  hero_titulo: "Corpo em ação,",
  hero_destaque: "mente em equilíbrio.",
  whatsapp: "5553984573198",
  instagram: "studioclaricegeiger",
};

type Config = Record<string, string | null>;
const configNoBanco = async () =>
  (ok(await db.from("site_config").select("*").eq("id", 1).maybeSingle()) as Config | null) ?? {};
const valor = (c: Config, k: keyof typeof PADRAO) => (c[k]?.trim() ? c[k]!.trim() : PADRAO[k]);

const preco = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

async function home(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("home mostra o conteúdo do banco", () => {
  test("topo e contato: textos do site_config (ou o padrão quando vazio)", async ({ page }) => {
    const c = await configNoBanco();
    await home(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(valor(c, "hero_titulo"));
    await expect(page.getByRole("heading", { level: 1 }).locator("em")).toHaveText(valor(c, "hero_destaque"));
    const contato = page.locator("#contato");
    await expect(contato.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", `https://wa.me/${valor(c, "whatsapp")}`);
    await expect(contato.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", `https://instagram.com/${valor(c, "instagram")}`);
    await expect(contato).toContainText(`@${valor(c, "instagram")}`);
  });

  test("planos visíveis na home, em ordem de frequência, com preço", async ({ page }) => {
    const planos = ok(await db.from("plans").select("nome,valor_padrao,vezes_semana,descricao").eq("exibir_na_home", true).order("vezes_semana")) as
      { nome: string; valor_padrao: string; vezes_semana: number; descricao: string | null }[];
    await home(page);
    const cartoes = page.locator("#planos li");
    await expect(cartoes).toHaveCount(planos.length);
    for (const [i, p] of planos.entries()) {
      await expect(cartoes.nth(i).getByRole("heading")).toHaveText(p.nome);
      await expect(cartoes.nth(i)).toContainText(`R$${preco.format(Number(p.valor_padrao))}/mês`);
      await expect(cartoes.nth(i)).toContainText(p.descricao ?? `${p.vezes_semana} ${p.vezes_semana === 1 ? "aula" : "aulas"} por semana`);
    }
  });

  test("modalidades = treinos ativos na ordem definida", async ({ page }) => {
    const treinos = ok(await db.from("treinos").select("nome,descricao").eq("ativo", true).order("ordem").order("nome")) as { nome: string; descricao: string }[];
    await home(page);
    await expect(page.locator("#modalidades li h3")).toHaveText(treinos.map((t) => t.nome));
  });

  test("horários do seed agrupados por dia; depoimento aprovado da Ana", async ({ page }) => {
    await home(page);
    const horarios = page.locator("#horarios");
    for (const dia of ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]) {
      const linha = horarios.locator("dl > div").filter({ has: page.getByText(dia, { exact: true }) });
      for (const h of ["07:00 às 08:00", "08:00 às 09:00", "18:00 às 19:00", "19:00 às 20:00"]) await expect(linha).toContainText(h);
    }
    await expect(horarios.locator("dl > div").filter({ hasText: "Sábado" })).toContainText("09:00 às 10:00");
    // Visitante não vê capacidade nem vagas.
    await expect(horarios).not.toContainText(/\d+ vagas?|lotado/i);

    const ana = page.locator("#depoimentos figure").filter({ hasText: "Melhor estúdio que já frequentei" });
    await expect(ana.locator("figcaption")).toContainText("Ana S.");
    // Pendente do Bruno não aparece.
    await expect(page.locator("#depoimentos")).not.toContainText("Treinos muito bons, horários flexíveis.");
  });
});

test.describe("admin › Conteúdo altera a home", () => {
  test.use({ storageState: storageStatePath("admin") });

  test.afterAll(async () => {
    // Rede de segurança se um teste falhar no meio (na volta normal, a própria tela restaura).
    await db.from("plans").delete().ilike("nome", "E2E%");
    await db.from("treinos").delete().ilike("nome", "E2E%");
  });

  test("planos: criar, editar preço, esconder da home e excluir", async ({ page, outraJanela }) => {
    const visitante = await outraJanela("visitante");
    await page.goto("/dashboard/admin/conteudo");
    await expect(page.getByRole("tab", { name: "Planos" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Novo plano" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByLabel("Nome").fill("E2E 4x");
    await dialogo.getByLabel("Aulas/semana").fill("8");
    await dialogo.getByLabel("Valor padrão (R$)").fill("120,00");
    await dialogo.getByRole("button", { name: "Criar plano" }).click();
    await expect(dialogo.getByRole("alert")).toHaveText("Aulas por semana deve ser de 1 a 7.");
    await dialogo.getByLabel("Aulas/semana").fill("4");
    await dialogo.getByLabel("Descrição (opcional)").fill("Quatro aulas na semana");
    let acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Criar plano" }).click();
    await acao;
    await expect(toast(page, "Plano E2E 4x criado.")).toBeVisible();
    expect(ok(await db.from("plans").select("vezes_semana,valor_padrao,descricao,exibir_na_home").eq("nome", "E2E 4x").single()))
      .toEqual({ vezes_semana: 4, valor_padrao: 120, descricao: "Quatro aulas na semana", exibir_na_home: true });

    await visitante.goto("/");
    const cartao = visitante.locator("#planos li").filter({ has: visitante.getByRole("heading", { name: "E2E 4x" }) });
    await expect(cartao).toContainText("R$120/mês");
    await expect(cartao).toContainText("Quatro aulas na semana");

    // Editar: o cartão do plano é um formulário próprio.
    const form = page.locator("li").filter({ has: page.locator('input[value="E2E 4x"]') });
    await form.getByLabel("Valor padrão (R$)").fill("135,5");
    acao = esperarServerAction(page);
    await form.getByRole("button", { name: "Salvar" }).click();
    await acao;
    await expect(toast(page, "Plano E2E 4x salvo.")).toBeVisible();
    await visitante.reload();
    await expect(cartao).toContainText("R$135,5/mês");

    await form.getByRole("switch", { name: "Mostrar este plano na home" }).click();
    acao = esperarServerAction(page);
    await form.getByRole("button", { name: "Salvar" }).click();
    await acao;
    expect((ok(await db.from("plans").select("exibir_na_home").eq("nome", "E2E 4x").single()) as { exibir_na_home: boolean }).exibir_na_home).toBe(false);
    await visitante.reload();
    await expect(cartao).toHaveCount(0);

    const form2 = page.locator("li").filter({ has: page.locator('input[value="E2E 4x"]') });
    await form2.getByRole("button", { name: "Excluir o plano E2E 4x" }).click();
    acao = esperarServerAction(page);
    await form2.getByRole("button", { name: "Confirmar exclusão do plano E2E 4x" }).click();
    await acao;
    await expect(toast(page, "Plano E2E 4x excluído.")).toBeVisible();
    expect(ok(await db.from("plans").select("id").eq("nome", "E2E 4x"))).toEqual([]);
  });

  test("plano em uso não é excluído: a tela lista quem usa", async ({ page }) => {
    const usam = ok(await (await comoAdmin()).from("members").select("nome", { count: "exact" }).eq("plan_id",
      (ok(await db.from("plans").select("id").eq("nome", "1x").single()) as { id: number }).id)) as { nome: string }[];
    await page.goto("/dashboard/admin/conteudo");
    const form = page.locator("li").filter({ has: page.locator('input[value="1x"]') });
    await form.getByRole("button", { name: "Excluir o plano 1x" }).click();
    const acao = esperarServerAction(page);
    await form.getByRole("button", { name: "Confirmar exclusão do plano 1x" }).click();
    await acao;
    const aviso = form.getByRole("alert");
    await expect(aviso).toContainText(`Não dá para excluir: ${usam.length} ${usam.length === 1 ? "aluno usa" : "alunos usam"} este plano.`);
    await expect(aviso).toContainText("Diego Rocha");
    expect(ok(await db.from("plans").select("id").eq("nome", "1x"))).toHaveLength(1);
  });

  test("treinos: criar, editar, reordenar, desativar e excluir refletem em Modalidades", async ({ page, outraJanela }) => {
    const visitante = await outraJanela("visitante");
    await page.goto("/dashboard/admin/conteudo");
    await page.getByRole("tab", { name: "Treinos" }).click();

    for (const nome of ["E2E Treino A", "E2E Treino B"]) {
      await page.getByRole("button", { name: "Novo treino" }).click();
      const dialogo = page.getByRole("dialog");
      await dialogo.getByLabel("Nome").fill(nome);
      await dialogo.getByLabel("Descrição curta").fill(`Descrição do ${nome}`);
      const acao = esperarServerAction(page);
      await dialogo.getByRole("button", { name: "Salvar" }).click();
      await acao;
      await expect(toast(page, "Treino criado.").first()).toBeVisible();
      await expect(dialogo).toHaveCount(0);
    }
    const ordem = async () =>
      (ok(await db.from("treinos").select("nome").order("ordem").order("id")) as { nome: string }[]).map((t) => t.nome);
    expect((await ordem()).slice(-2)).toEqual(["E2E Treino A", "E2E Treino B"]);
    await visitante.goto("/");
    await expect(visitante.locator("#modalidades li h3").last()).toHaveText("E2E Treino B");

    let acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Subir E2E Treino B" }).click();
    await acao;
    await expect.poll(async () => (await ordem()).slice(-2)).toEqual(["E2E Treino B", "E2E Treino A"]);
    await visitante.reload();
    await expect(visitante.locator("#modalidades li h3").last()).toHaveText("E2E Treino A");

    const linhaA = page.locator("li").filter({ has: page.getByText("E2E Treino A", { exact: true }) });
    acao = esperarServerAction(page);
    await linhaA.getByRole("button", { name: "Desativar" }).click();
    await acao;
    await expect(linhaA.getByText("Desativado")).toBeVisible();
    await visitante.reload();
    await expect(visitante.locator("#modalidades")).not.toContainText("E2E Treino A");

    for (const nome of ["E2E Treino A", "E2E Treino B"]) {
      await page.getByRole("button", { name: `Excluir ${nome}` }).click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo.getByRole("heading", { name: `Excluir “${nome}”?` })).toBeVisible();
      acao = esperarServerAction(page);
      await dialogo.getByRole("button", { name: "Excluir" }).click();
      await acao;
      await expect(dialogo).toHaveCount(0);
    }
    expect((await ordem()).filter((n) => n.startsWith("E2E"))).toEqual([]);
    await visitante.reload();
    await expect(visitante.locator("#modalidades")).not.toContainText("E2E Treino");
  });

  test("textos da home: salvar muda a home; WhatsApp inválido é recusado; restaurar volta ao padrão", async ({ page, outraJanela }) => {
    const original = await configNoBanco();
    const visitante = await outraJanela("visitante");
    await page.goto("/dashboard/admin/conteudo");
    await page.getByRole("tab", { name: "Textos" }).click();

    const titulo = page.getByLabel("Título", { exact: true });
    await expect(titulo).toHaveAttribute("placeholder", PADRAO.hero_titulo);
    await titulo.fill("E2E título de teste,");
    await page.getByLabel("Destaque (em vermelho)").fill("E2E destaque.");
    await page.getByLabel("WhatsApp").fill("123");
    let acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Salvar textos" }).click();
    await acao;
    await expect(page.getByRole("alert").filter({ hasText: "WhatsApp" })).toHaveText("WhatsApp inválido. Use DDI + DDD + número (ex.: 5553984573198).");
    expect((await configNoBanco()).hero_titulo ?? null).toBe(original.hero_titulo ?? null);

    await page.getByLabel("WhatsApp").fill("55 11 99999-0000");
    await page.getByLabel("Instagram").fill("@e2e.studio");
    acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Salvar textos" }).click();
    await acao;
    await expect(toast(page, "Textos da home salvos.")).toBeVisible();
    expect(await configNoBanco()).toMatchObject({
      hero_titulo: "E2E título de teste,", hero_destaque: "E2E destaque.", whatsapp: "5511999990000", instagram: "e2e.studio",
    });

    await visitante.goto("/");
    await expect(visitante.getByRole("heading", { level: 1 })).toContainText("E2E título de teste,");
    await expect(visitante.getByRole("heading", { level: 1 }).locator("em")).toHaveText("E2E destaque.");
    await expect(visitante.locator("#contato").getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/5511999990000");
    await expect(visitante.locator("#contato")).toContainText("(11) 99999-0000");
    await expect(visitante.locator("#contato")).toContainText("@e2e.studio");

    // Restaura exatamente o que havia (vazio = texto padrão).
    for (const [rotulo, k] of [["Título", "hero_titulo"], ["Destaque (em vermelho)", "hero_destaque"], ["WhatsApp", "whatsapp"], ["Instagram", "instagram"]] as const)
      await page.getByLabel(rotulo, { exact: true }).fill(original[k] ?? "");
    acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Salvar textos" }).click();
    await acao;
    const restaurado = await configNoBanco();
    for (const k of ["hero_titulo", "hero_destaque", "whatsapp", "instagram"]) expect(restaurado[k] ?? null).toBe(original[k] ?? null);
    await visitante.reload();
    await expect(visitante.getByRole("heading", { level: 1 })).toContainText(valor(original, "hero_titulo"));
  });

  test("contador de depoimentos pendentes na navegação = itens 'Para aprovar'", async ({ page }) => {
    await page.goto("/dashboard/admin/conteudo");
    await page.getByRole("tab", { name: /^Depoimentos/ }).click();
    // O grupo é a <section> logo acima do título (o painel inteiro também é uma <section>).
    const grupo = page.getByRole("heading", { name: /^Para aprovar/ }).locator("xpath=..");
    const n = await grupo.getByRole("listitem").count();
    expect(n).toBeGreaterThan(0); // seed: Bruno
    await expect(grupo.getByRole("heading", { name: /^Para aprovar/ })).toContainText(`(${n})`);
    await expect(page.getByRole("tab", { name: `Depoimentos (${n})` })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Painel do admin" });
    await expect(nav.getByLabel(`${n} ${n === 1 ? "depoimento" : "depoimentos"} para aprovar`)).toHaveText(String(n));
  });
});
