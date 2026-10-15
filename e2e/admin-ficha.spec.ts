import type { Page } from "@playwright/test";
import { test, expect, storageStatePath } from "./support/test";
import { addDias, dataBR, hojeSP } from "./support/datas";
import { comoAdmin, db, memberPorEmail, ok } from "./support/db";
import { abrirAdmin, contarEnviosFila, esperarEnvioFila, esperarServerAction } from "./support/rede";
import { esperarToastsSumirem, linhaAluno, toast } from "./support/ui";

// Admin › ficha do aluno (/dashboard/admin/aluno?id=…): resumo, anamnese e medidas.

test.use({ storageState: storageStatePath("admin") });

const ADMIN = "00000000-0000-0000-0000-00000000a001"; // auth.users.id do admin do seed
let ANA: string; // members.id da Ana (gerado pelo trigger de cadastro)

test.beforeAll(async () => {
  ANA = (await memberPorEmail("ana@cgstudio.test"))!.id;
});

// A anamnese e as medidas têm trigger de carimbo (updated_by): gravamos como o admin, igual ao app.
const comoAdminInserir = async (tabela: string, row: Record<string, unknown>) =>
  ok(await (await comoAdmin()).from(tabela).insert(row), tabela);

const anamneseNoBanco = async (memberId: string) =>
  ok(await db.from("member_anamneses").select("*").eq("member_id", memberId).maybeSingle()) as Record<string, unknown> | null;
const avaliacoesNoBanco = async (memberId: string) =>
  (ok(await db.from("member_avaliacoes").select("id,data,peso_kg,cintura_cm,quadril_cm,observacao").eq("member_id", memberId)) as
    { id: string; data: string; peso_kg: number | null; cintura_cm: number | null; quadril_cm: number | null; observacao: string | null }[])
    .map((a) => ({ ...a, peso_kg: a.peso_kg == null ? null : Number(a.peso_kg), cintura_cm: a.cintura_cm == null ? null : Number(a.cintura_cm) }));

const aba = (page: Page, nome: "Resumo" | "Anamnese" | "Medidas") => page.getByRole("tab", { name: nome });
const simNao = (page: Page, pergunta: string | RegExp) =>
  page.getByRole("radiogroup", { name: pergunta });

test.describe("ficha da Ana (seed, só leitura)", () => {
  test("abre pela lista sem recarregar a página e mostra contato, alertas e resumo", async ({ page }) => {
    const snap = await abrirAdmin(page, "/dashboard/admin", { congelar: true });
    const docs: string[] = [];
    page.on("request", (r) => { if (r.resourceType() === "document") docs.push(r.url()); });
    await linhaAluno(page, "Ana Souza").getByRole("link", { name: "Ana Souza" }).click();

    await expect(page).toHaveURL(`/dashboard/admin/aluno?id=${ANA}`);
    expect(docs, "ficha abre por pushState").toEqual([]);
    await expect(page.getByRole("heading", { name: "Ana Souza", level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Painel do admin" }).getByRole("link", { name: /Alunos/ }))
      .toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "(11) 98765-4321" })).toHaveAttribute("href", "https://wa.me/5511987654321");
    await expect(page.getByRole("link", { name: "ana@cgstudio.test" })).toHaveAttribute("href", "mailto:ana@cgstudio.test");

    const alerta = page.getByRole("note");
    await expect(alerta).toContainText("Atenção à saúde");
    await expect(alerta.getByRole("listitem")).toHaveText([
      "Restrição médica: Evitar impacto no joelho esquerdo",
      "Cuidados: Aquecer bem antes de agachamentos",
    ]);

    await expect(aba(page, "Resumo")).toHaveAttribute("aria-selected", "true");
    const cuidados = page.locator("section").filter({ has: page.getByRole("heading", { name: "Cuidados no treino" }) });
    await expect(cuidados).toContainText("Aquecer bem antes de agachamentos");
    const horarios = page.locator("section").filter({ has: page.getByRole("heading", { name: "Horários" }) });
    await expect(horarios.getByRole("listitem").first()).toHaveText("Segunda 07:00");
    await expect(horarios).toContainText("Quarta 07:00");
    await expect(horarios).toContainText("2 de 2 do plano");
    await expect(horarios).toContainText("Funcional");

    const ultimas = snap.avaliacoes!.filter((a) => a.member_id === ANA).sort((a, b) => b.data.localeCompare(a.data));
    const medidas = page.locator("section").filter({ has: page.getByRole("heading", { name: "Medidas", exact: true }) });
    await expect(medidas).toContainText(`Peso 66,2 kg · cintura 71,5 cm em ${dataBR(ultimas[0].data)}`);

    const pagos = snap.pagamentos.filter((p) => p.member_id === ANA);
    const pagamentos = page.locator("section").filter({ has: page.getByRole("heading", { name: "Últimos pagamentos" }) });
    await expect(pagamentos.getByRole("listitem")).toHaveCount(Math.min(6, pagos.length));

    await page.getByRole("link", { name: "Alunos", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Todos os alunos" })).toBeVisible();
  });

  test("abas ficam no endereço; anamnese e medidas vêm preenchidas do banco", async ({ page }) => {
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${ANA}&aba=anamnese`);
    await expect(aba(page, "Anamnese")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Data de nascimento")).toHaveValue("1990-05-12");
    await expect(page.getByLabel("Endereço")).toHaveValue("Rua das Flores, 123");
    await expect(simNao(page, /recomendação ou restrição médica/).getByRole("radio", { name: "Sim" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Detalhar")).toHaveValue("Evitar impacto no joelho esquerdo");
    await expect(page.getByText(/^Atualizada em \d\d\/\d\d\/\d{4}/)).toBeVisible();

    await aba(page, "Medidas").click();
    await expect(page).toHaveURL(`/dashboard/admin/aluno?id=${ANA}&aba=medidas`);
    await expect(page.getByText("2 avaliações")).toBeVisible();
    const ultima = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Última ·/ }) });
    await expect(ultima).toContainText("66,2 kg");
    await expect(ultima).toContainText("−2,3 kg desde");
    await expect(ultima).toContainText("−2,5 cm desde"); // cintura 74 → 71,5
    await expect(page.getByText("Inicial", { exact: true })).toBeVisible();

    await aba(page, "Resumo").click();
    await expect(page).toHaveURL(`/dashboard/admin/aluno?id=${ANA}`);
  });

  test("id inexistente: aviso de aluno não encontrado", async ({ page }) => {
    await abrirAdmin(page, "/dashboard/admin/aluno?id=00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Aluno não encontrado")).toBeVisible();
  });
});

test.describe("anamnese", () => {
  test("preenche por partes: envia só o alterado (com pares Sim/detalhe) e grava com carimbo do admin", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 9 });
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${aluno.id}`);
    await expect(page.getByText("Sem anamnese")).toBeVisible();
    await page.getByRole("button", { name: "Preencher" }).click();
    await expect(page).toHaveURL(new RegExp(`aba=anamnese`));
    await expect(page.getByText("Ainda não preenchida.", { exact: false })).toBeVisible();

    const nasc = addDias(hojeSP(), -365 * 30 - 10);
    await page.getByLabel("Data de nascimento").fill(nasc);
    await expect(page.getByText(/^(29|30) anos$/)).toBeVisible();
    await page.getByLabel("Endereço").fill("  Av. Teste, 100  ");
    const doenca = simNao(page, /doença crônica/);
    await doenca.getByRole("radio", { name: "Sim" }).click();
    await page.getByLabel("Se sim, qual(is)?").fill("Hipertensão");
    await page.getByLabel("O que a professora precisa saber na aula").fill("Medir a pressão antes");
    await expect(page.getByText("5 alterações não salvas")).toBeVisible();

    const envio = esperarEnvioFila(page, "anamnese_salvar");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    const { pedido, resposta, snapshotDepois } = await envio;
    expect(resposta).toEqual({ ok: true });
    expect(pedido.payload).toEqual({
      member_id: aluno.id,
      campos: {
        data_nascimento: nasc, endereco: "Av. Teste, 100", doenca_cronica: true, doenca_cronica_quais: "Hipertensão",
        cuidados_treino: "Medir a pressão antes",
      },
    });
    await expect(toast(page, "Anamnese salva.")).toBeVisible();

    expect(await anamneseNoBanco(aluno.id)).toMatchObject({
      data_nascimento: nasc, endereco: "Av. Teste, 100", doenca_cronica: true, doenca_cronica_quais: "Hipertensão",
      cuidados_treino: "Medir a pressão antes", medicacao_continua: null, updated_by: ADMIN,
    });
    const snap = await snapshotDepois();
    expect(snap.anamneses!.find((a) => a.member_id === aluno.id)).toMatchObject({ updated_by_nome: "Camila Admin" });
    await expect(page.getByText(/^Atualizada em .* por Camila Admin$/)).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Doença crônica: Hipertensão");
    await expect(page.getByRole("note")).toContainText("Cuidados: Medir a pressão antes");
  });

  test("marcar 'Não' limpa o detalhe dependente no banco", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    await comoAdminInserir("member_anamneses", { member_id: aluno.id, medicacao_continua: true, medicacao_quais: "Losartana" });
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${aluno.id}&aba=anamnese`);
    await expect(page.getByLabel("Qual(is)?")).toHaveValue("Losartana");

    await simNao(page, /medicação contínua/).getByRole("radio", { name: "Não" }).click();
    await expect(page.getByLabel("Qual(is)?")).toHaveCount(0);
    const envio = esperarEnvioFila(page, "anamnese_salvar");
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    const { pedido } = await envio;
    expect(pedido.payload.campos).toEqual({ medicacao_continua: false, medicacao_quais: null });
    expect(await anamneseNoBanco(aluno.id)).toMatchObject({ medicacao_continua: false, medicacao_quais: null });
  });

  test("data no futuro é recusada antes de enviar; Desfazer volta ao que estava", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${aluno.id}&aba=anamnese`);
    const envios = contarEnviosFila(page);
    await page.getByLabel("Data de nascimento").fill(addDias(hojeSP(), 1));
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "não pode ser no futuro" }))
      .toHaveText("“Data de nascimento” não pode ser no futuro.");

    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.getByLabel("Data de nascimento")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Salvar", exact: true })).toHaveCount(0);
    expect(envios.n).toBe(0);
    expect(await anamneseNoBanco(aluno.id)).toBeNull();
  });

  test("rascunho não salvo sobrevive a sair da ficha (com aviso) e voltar", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${aluno.id}&aba=anamnese`);
    await page.getByLabel("O que busca com o treino").fill("Correr 5 km");
    await page.getByRole("link", { name: "Alunos", exact: true }).first().click();
    await expect(toast(page, "A anamnese tem alterações não salvas. Volte à ficha para salvar.")).toBeVisible();
    await esperarToastsSumirem(page);

    await linhaAluno(page, aluno.nome).getByRole("link", { name: aluno.nome }).click();
    await aba(page, "Anamnese").click();
    await expect(page.getByLabel("O que busca com o treino")).toHaveValue("Correr 5 km");
    await expect(page.getByText("1 alteração não salva")).toBeVisible();
  });

  test("apagar anamnese (pedido de exclusão de dados de saúde) em dois cliques", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    await comoAdminInserir("member_anamneses", { member_id: aluno.id, objetivos: "Postura", restricao_medica: true });
    await comoAdminInserir("member_avaliacoes", { id: crypto.randomUUID(), member_id: aluno.id, data: hojeSP(), peso_kg: 70 });
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${aluno.id}&aba=anamnese`);

    await page.getByRole("button", { name: "Apagar anamnese" }).click();
    expect(await anamneseNoBanco(aluno.id)).not.toBeNull();
    const acao = esperarServerAction(page);
    await page.getByRole("button", { name: "Confirmar: apagar anamnese" }).click();
    await acao;
    await expect(toast(page, "Anamnese apagada.")).toBeVisible();
    expect(await anamneseNoBanco(aluno.id)).toBeNull();
    expect(await avaliacoesNoBanco(aluno.id), "medidas não são apagadas").toHaveLength(1);
    await expect(page.getByText("Sem anamnese")).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
  });
});

test.describe("medidas", () => {
  test("nova avaliação: validações, envio pela fila e números no banco", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${aluno.id}&aba=medidas`);
    await expect(page.getByText("Nenhuma avaliação ainda.")).toBeVisible();
    await page.getByRole("button", { name: "Nova avaliação" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Data")).toHaveValue(hojeSP());
    const salvar = dialogo.getByRole("button", { name: "Salvar" });

    await salvar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("Informe pelo menos uma medida.");
    await dialogo.getByLabel("Peso (kg)").fill("abc");
    await salvar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("Peso: use só números, com até uma casa decimal (ex.: 78,5).");
    await dialogo.getByLabel("Peso (kg)").fill("10");
    await salvar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("Peso: entre 20 e 300 kg.");
    await dialogo.getByLabel("Peso (kg)").fill("70,5");
    await dialogo.getByLabel("Cintura (cm)").fill("80");
    await dialogo.getByLabel("Data").fill(addDias(hojeSP(), 1));
    await salvar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("A data da avaliação não pode ser no futuro.");
    await dialogo.getByLabel("Data").fill(hojeSP());
    await dialogo.getByLabel("Observação (opcional)").fill("Avaliação inicial");

    const envio = esperarEnvioFila(page, "avaliacao_salvar");
    await salvar.click();
    const { pedido, resposta } = await envio;
    expect(resposta).toEqual({ ok: true });
    expect(pedido.payload).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/), member_id: aluno.id, data: hojeSP(),
      peso_kg: 70.5, cintura_cm: 80, quadril_cm: null, coxa_cm: null, peito_cm: null, braco_cm: null,
      observacao: "Avaliação inicial",
    });
    await expect(toast(page, "Medidas registradas.")).toBeVisible();
    expect(await avaliacoesNoBanco(aluno.id)).toEqual([
      { id: pedido.payload.id, data: hojeSP(), peso_kg: 70.5, cintura_cm: 80, quadril_cm: null, observacao: "Avaliação inicial" },
    ]);
    await expect(page.getByRole("heading", { name: `Última · ${dataBR(hojeSP())}` })).toBeVisible();
  });

  test("corrigir usa o mesmo id (upsert) e excluir apaga do banco", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo" });
    const id = crypto.randomUUID();
    const data = addDias(hojeSP(), -7);
    await comoAdminInserir("member_avaliacoes", { id, member_id: aluno.id, data, peso_kg: 80, quadril_cm: 100 });
    await abrirAdmin(page, `/dashboard/admin/aluno?id=${aluno.id}&aba=medidas`);

    await page.getByRole("button", { name: `Corrigir avaliação de ${dataBR(data)}` }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Peso (kg)")).toHaveValue("80");
    await dialogo.getByLabel("Peso (kg)").fill("79,4");
    const envio = esperarEnvioFila(page, "avaliacao_salvar");
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    expect((await envio).pedido.payload).toMatchObject({ id, peso_kg: 79.4, quadril_cm: 100 });
    await expect(toast(page, "Medidas corrigidas.")).toBeVisible();
    expect(await avaliacoesNoBanco(aluno.id)).toEqual([expect.objectContaining({ id, peso_kg: 79.4 })]);

    await page.getByRole("button", { name: `Corrigir avaliação de ${dataBR(data)}` }).click();
    await dialogo.getByRole("button", { name: "Excluir" }).click();
    const acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Confirmar exclusão" }).click();
    await acao;
    await expect(toast(page, "Avaliação excluída.")).toBeVisible();
    expect(await avaliacoesNoBanco(aluno.id)).toEqual([]);
    await expect(page.getByText("Nenhuma avaliação ainda.")).toBeVisible();
  });
});
