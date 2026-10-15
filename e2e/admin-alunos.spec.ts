import { test, expect, storageStatePath } from "./support/test";
import { dataBR, reBrl } from "./support/datas";
import { db, memberPorId, ok, planoId, treinoId } from "./support/db";
import { telefoneUnico } from "./support/fabrica";
import { abrirAdmin, esperarEnvioFila, esperarServerAction, snapshotApos } from "./support/rede";
import { escolher, linhaAluno, painel, toast } from "./support/ui";

// Admin › Alunos (app offline): a tela é montada a partir do snapshot (GET /api/admin/snapshot) e
// cada alteração vai pela fila (POST /api/admin/acoes). Conferimos as três camadas: o que a tela
// mostra = o que veio no snapshot; o que a fila envia; o que ficou gravado no banco.

test.use({ storageState: storageStatePath("admin") });

const treinosDe = async (memberId: string) =>
  (ok(await db.from("member_treinos").select("treino_id").eq("member_id", memberId)) as { treino_id: number }[])
    .map((r) => r.treino_id).sort();

const formatar = (t: string) => `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;

test.describe("lista de alunos", () => {
  test("cards de resumo, vencimentos e contagem vêm do snapshot", async ({ page }) => {
    const snap = await abrirAdmin(page, "/dashboard/admin", { congelar: true });

    const cards = page.locator("div.grid.sm\\:grid-cols-3").first();
    await expect(cards).toContainText(`Alunos ativos${snap.resumo.ativos}`);
    await expect(cards).toContainText(reBrl(snap.resumo.recebidoMes));
    await expect(cards).toContainText(`Em atraso${snap.resumo.emAtraso}`);

    await expect(page.getByText(`${snap.members.length} alunos`, { exact: true })).toBeVisible();

    const venc = painel(page, "Vencimentos próximos");
    if (snap.vencimentos.length === 0) {
      await expect(venc).toContainText("Nenhum vencimento nos próximos 5 dias.");
    } else {
      await expect(venc.locator("tbody tr")).toHaveCount(snap.vencimentos.length);
      for (const v of snap.vencimentos) await expect(venc).toContainText(v.nome ?? "—");
    }
    // Seed: Diego vence em 3 dias.
    expect(snap.vencimentos.map((v) => v.nome)).toContain("Diego Rocha");
  });

  test("linha de cada aluno do seed: plano, valor, vencimento, status, marcas", async ({ page }) => {
    const snap = await abrirAdmin(page, "/dashboard/admin", { congelar: true });
    const ana = snap.members.find((m) => m.nome === "Ana Souza")!;
    const diego = snap.members.find((m) => m.nome === "Diego Rocha")!;
    const bruno = snap.members.find((m) => m.nome === "Bruno Lima")!;
    expect(ana).toMatchObject({ plano_nome: "2x", status: "ativo", situacao: "em_dia", tem_login: true, slots_usados: 2 });
    expect(diego).toMatchObject({ tem_login: false, plano_nome: "1x" });
    expect(bruno.situacao).toBe("em_atraso");

    const linhaAna = linhaAluno(page, "Ana Souza");
    await expect(linhaAna).toContainText("2x");
    await expect(linhaAna).toContainText(reBrl(80));
    await expect(linhaAna).toContainText(dataBR(ana.vencimento!));
    await expect(linhaAna).toContainText("Ativo");
    await expect(linhaAna).toContainText("Funcional");
    await expect(linhaAna).toContainText("Pilates");
    // Anamnese do seed tem restrição médica e cuidados: ícone de alerta com os motivos.
    await expect(linhaAna.getByRole("img", { name: /Atenção à saúde: Restrição médica: Evitar impacto no joelho esquerdo/ })).toBeVisible();
    await expect(linhaAna.getByText("Sem login")).toHaveCount(0);

    await expect(linhaAluno(page, "Diego Rocha").getByText("Sem login")).toBeVisible();
    await expect(linhaAluno(page, "Bruno Lima")).toContainText(/Em atraso · há \d+ dias/);
  });

  test("busca por nome, e-mail e telefone (filtra no aparelho)", async ({ page }) => {
    await abrirAdmin(page);
    const busca = page.getByRole("searchbox", { name: "Buscar alunos" });

    await busca.fill("diego@cgstudio");
    await expect(page.getByText("1 aluno para “diego@cgstudio”")).toBeVisible();
    await expect(linhaAluno(page, "Diego Rocha")).toBeVisible();

    await busca.fill("(11) 98765-4321");
    await expect(page.getByText(/^1 aluno para/)).toBeVisible();
    await expect(linhaAluno(page, "Ana Souza")).toBeVisible();

    await busca.fill("nao-existe-ninguem");
    await expect(page.getByText("Nenhum aluno encontrado.")).toBeVisible();
  });
});

test.describe("cadastro pelo admin (aluno sem login)", () => {
  test("cria aluno: validações locais, envio pela fila e registro no banco", async ({ page, fabrica }) => {
    await abrirAdmin(page);
    await page.getByRole("button", { name: "Novo aluno" }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("heading", { name: "Novo aluno" })).toBeVisible();
    const cadastrar = dialogo.getByRole("button", { name: "Cadastrar" });

    // Validações antes de guardar (nada sai para o servidor).
    await cadastrar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("Informe o nome completo.");
    const nome = `E2e${Date.now().toString(36)} Cadastro`;
    await dialogo.getByLabel("Nome completo").fill(nome);
    await dialogo.getByLabel("Telefone").fill("123");
    await cadastrar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("Telefone inválido. Use DDD + número.");
    await dialogo.getByLabel("Telefone").fill("(11) 98765-4321"); // da Ana
    await cadastrar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("Este telefone já está em uso por outro cadastro. Informe outro número.");
    const tel = telefoneUnico();
    await dialogo.getByLabel("Telefone").fill(formatar(tel));
    await dialogo.getByLabel("E-mail (opcional)").fill("sem-arroba");
    await cadastrar.click();
    await expect(dialogo.getByRole("alert")).toHaveText("E-mail inválido.");

    const email = `e2e-${Date.now().toString(36)}@cgstudio.test`;
    await dialogo.getByLabel("E-mail (opcional)").fill(email.toUpperCase());
    await escolher(dialogo, "Plano", /^2x ·/);
    await dialogo.getByLabel("Valor acordado (R$)").fill("70,50");
    await dialogo.getByRole("checkbox", { name: "Funcional" }).check();

    const envio = esperarEnvioFila(page, "aluno_criar");
    await cadastrar.click();
    const { pedido, resposta, status, snapshotDepois } = await envio;
    fabrica.registrarMembro(pedido.payload.member_id as string);

    expect(status).toBe(200);
    expect(resposta).toEqual({ ok: true });
    expect(pedido.payload).toEqual({
      member_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      nome, telefone: tel, email, plan_id: await planoId("2x"), valor_acordado: 70.5,
      treino_ids: [await treinoId("Funcional")],
    });
    await expect(toast(page, `${nome} cadastrado(a).`)).toBeVisible();

    const m = await memberPorId(pedido.payload.member_id as string);
    expect(m).toMatchObject({
      nome, telefone: tel, email, status: "pendente", auth_user_id: null,
      plan_id: await planoId("2x"), valor_acordado: 70.5, vencimento: null,
    });
    expect(await treinosDe(m!.id)).toEqual([await treinoId("Funcional")]);

    // Depois do envio a tela recarrega do servidor: aparece sem "Aguardando envio".
    const s = await snapshotDepois();
    expect(s.members.find((x) => x.member_id === m!.id)).toMatchObject({ tem_login: false, status: "pendente" });
    const linha = linhaAluno(page, nome);
    await expect(linha.getByText("Sem login")).toBeVisible();
    await expect(linha.getByText("Aguardando envio")).toHaveCount(0);
    await expect(linha).toContainText("Pendente");
  });

  test("edita só o que mudou (payload parcial) e o banco recebe plano, valor, status, treinos e nome", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "pendente", plano: "1x", treinos: ["Funcional"] });
    await abrirAdmin(page);
    await page.getByRole("button", { name: `Editar ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByRole("heading", { name: "Editar aluno" })).toBeVisible();
    await expect(dialogo.getByLabel("Nome completo")).toHaveValue(aluno.nome);

    const novoNome = `${aluno.nome} Editado`;
    await dialogo.getByLabel("Nome completo").fill(novoNome);
    await escolher(dialogo, "Plano", /^3x ·/);
    await dialogo.getByLabel("Valor acordado (R$)").fill("90");
    await escolher(dialogo, "Status", "Ativo");
    await dialogo.getByRole("checkbox", { name: "Funcional" }).uncheck();
    await dialogo.getByRole("checkbox", { name: "Pilates" }).check();

    const envio = esperarEnvioFila(page, "aluno_editar");
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    const { pedido, resposta } = await envio;
    expect(resposta).toEqual({ ok: true });
    // Telefone e e-mail não mudaram: não vão no pedido (não desfaz edição de outro admin).
    expect(pedido.payload).toEqual({
      member_id: aluno.id,
      campos: { nome: novoNome, plan_id: await planoId("3x"), valor_acordado: 90, status: "ativo", treino_ids: [await treinoId("Pilates")] },
    });
    await expect(toast(page, `Alterações de ${aluno.nome} salvas.`)).toBeVisible();

    expect(await memberPorId(aluno.id)).toMatchObject({
      nome: novoNome, plan_id: await planoId("3x"), valor_acordado: 90, status: "ativo", telefone: aluno.telefone,
    });
    expect(await treinosDe(aluno.id)).toEqual([await treinoId("Pilates")]);
    await expect(linhaAluno(page, novoNome)).toContainText("3x");
  });

  test("salvar sem mudar nada não envia nada", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 9 });
    await abrirAdmin(page);
    let enviados = 0;
    page.on("request", (r) => { if (r.url().endsWith("/api/admin/acoes")) enviados++; });
    await page.getByRole("button", { name: `Editar ${aluno.nome}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(enviados).toBe(0);
  });

  test("aluno com conta Google: nome/telefone/e-mail não são editáveis pelo admin", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: true, status: "ativo", plano: "1x", vencimentoEm: 9 });
    await abrirAdmin(page);
    await page.getByRole("button", { name: `Editar ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo.getByLabel("Nome completo")).toHaveCount(0);
    await expect(dialogo.getByLabel("Telefone")).toHaveCount(0);
    await expect(dialogo.getByRole("button", { name: "Excluir cadastro" })).toHaveCount(0);

    await escolher(dialogo, "Status", "Inativo");
    const envio = esperarEnvioFila(page, "aluno_editar");
    await dialogo.getByRole("button", { name: "Salvar" }).click();
    const { pedido } = await envio;
    expect(pedido.payload).toEqual({ member_id: aluno.id, campos: { status: "inativo" } });
    expect((await memberPorId(aluno.id))!.status).toBe("inativo");
  });

  test("exclui cadastro sem login em dois cliques (Server Action) e some do banco e da lista", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "pendente" });
    await abrirAdmin(page);
    await page.getByRole("button", { name: `Editar ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Excluir cadastro" }).click();
    await expect(dialogo.getByRole("button", { name: "Confirmar exclusão" })).toBeVisible();
    expect(await memberPorId(aluno.id)).not.toBeNull(); // o primeiro clique só pede confirmação

    const proximo = snapshotApos(page);
    const acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Confirmar exclusão" }).click();
    const resp = await acao;
    await expect(toast(page, `Cadastro de ${aluno.nome} excluído.`)).toBeVisible();
    expect(await memberPorId(aluno.id)).toBeNull();
    expect((await proximo(resp)).members.some((m) => m.member_id === aluno.id)).toBe(false);
    await expect(linhaAluno(page, aluno.nome)).toHaveCount(0);
  });

  test("não exclui aluno com pagamento registrado (regra do banco)", async ({ page, fabrica }) => {
    const aluno = await fabrica.aluno({ login: false, status: "ativo", plano: "1x", vencimentoEm: 20 });
    await fabrica.pagamento(aluno.id, 75, -10);
    await abrirAdmin(page);
    await page.getByRole("button", { name: `Editar ${aluno.nome}` }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Excluir cadastro" }).click();
    const acao = esperarServerAction(page);
    await dialogo.getByRole("button", { name: "Confirmar exclusão" }).click();
    await acao;
    await expect(dialogo.getByRole("alert")).toHaveText("Este aluno tem pagamentos registrados e não pode ser excluído.");
    expect(await memberPorId(aluno.id)).not.toBeNull();
  });
});
