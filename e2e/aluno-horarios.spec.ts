import { test, expect } from "./support/test";
import { db, ok } from "./support/db";
import { esperarServerAction } from "./support/rede";
import { cartaoSlot } from "./support/ui";

// Entrar e sair de horários fixos (RPCs join_slot / leave_slot). Cada teste usa horários próprios.

const alocados = async (memberId: string) =>
  (ok(await db.from("slot_members").select("slot_id").eq("member_id", memberId)) as { slot_id: number }[]).map((r) => r.slot_id);

const resumo = (page: import("@playwright/test").Page) => page.getByRole("list", { name: "Resumo da matrícula" });

test.describe("horários do aluno", () => {
  test("entra num horário: vaga ocupada no banco, cartão vira 'Seu horário' e o limite do plano bloqueia o resto", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "1x", vencimentoEm: 15 });
    const a = await fabrica.slot({ capacidade: 3 });
    const b = await fabrica.slot({ capacidade: 3 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    const cartaoA = await cartaoSlot(page, a);
    await expect(cartaoA).toHaveAttribute("data-state", "livre");
    await expect(cartaoA).toContainText("3 vagas");
    await expect(cartaoA.getByRole("img")).toHaveAttribute("aria-label", "0 de 3 lugares ocupados");
    await expect(resumo(page)).toContainText("0 de 1 slot usado");

    const acao = esperarServerAction(page);
    await cartaoA.getByRole("button", { name: "Entrar" }).click();
    await acao;

    await expect(cartaoA).toHaveAttribute("data-state", "meu");
    await expect(cartaoA).toContainText("Seu horário");
    await expect(cartaoA).toContainText("2 vagas");
    await expect(cartaoA.getByRole("img")).toHaveAttribute("aria-label", "1 de 3 lugares ocupados");
    await expect(resumo(page)).toContainText("1 de 1 slot usado");
    expect(await alocados(aluno.id)).toEqual([a.id]);

    // Plano 1x cheio: aviso e "Entrar" desabilitado no outro horário.
    await expect(page.getByText("Você já usa os 1 horário do seu plano. Saia de um para trocar.")).toBeVisible();
    await expect((await cartaoSlot(page, b)).getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  test("sai do horário: vaga liberada no banco e na tela", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "2x", vencimentoEm: 15 });
    const s = await fabrica.slot({ capacidade: 2 });
    await fabrica.alocar(s.id, aluno.id);
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    const cartao = await cartaoSlot(page, s);
    await expect(cartao).toHaveAttribute("data-state", "meu");
    const acao = esperarServerAction(page);
    await cartao.getByRole("button", { name: "Sair" }).click();
    await acao;

    await expect(cartao).toHaveAttribute("data-state", "livre");
    await expect(cartao).toContainText("2 vagas");
    expect(await alocados(aluno.id)).toEqual([]);
  });

  test("horário lotado aparece esmaecido e sem botão", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "3x", vencimentoEm: 15 });
    const outro = await fabrica.aluno({ status: "ativo", plano: "3x", login: false });
    const s = await fabrica.slot({ capacidade: 1 });
    await fabrica.alocar(s.id, outro.id);
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    const cartao = await cartaoSlot(page, s);
    await expect(cartao).toHaveAttribute("data-state", "lotado");
    await expect(cartao).toContainText("Lotado");
    await expect(cartao).toHaveClass(/opacity-45/);
    await expect(cartao.getByRole("button")).toHaveCount(0);
  });

  test("corrida: o horário lota entre abrir a tela e clicar → erro do banco traduzido e nada gravado", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "3x", vencimentoEm: 15 });
    const outro = await fabrica.aluno({ status: "ativo", login: false });
    const s = await fabrica.slot({ capacidade: 1 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");
    const cartao = await cartaoSlot(page, s);
    await expect(cartao).toContainText("1 vaga");

    await fabrica.alocar(s.id, outro.id); // outra pessoa pega a última vaga
    const acao = esperarServerAction(page);
    await cartao.getByRole("button", { name: "Entrar" }).click();
    await acao;

    await expect(page.getByRole("alert").filter({ hasText: "Este horário acabou de lotar." })).toBeVisible();
    expect(await alocados(aluno.id)).toEqual([]);
  });

  test("matrícula inativa: mantém os horários, mas não entra em novos", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "inativo", plano: "2x", vencimentoEm: -10 });
    const meu = await fabrica.slot();
    const livre = await fabrica.slot();
    await fabrica.alocar(meu.id, aluno.id);
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await expect(page.getByText("Sua matrícula está inativa.", { exact: false })).toBeVisible();
    await expect(resumo(page)).toContainText("Inativo · plano 2x");
    await expect(await cartaoSlot(page, meu)).toHaveAttribute("data-state", "meu");
    await expect((await cartaoSlot(page, livre)).getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  test("ativo sem plano definido: aviso para falar com o studio", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: null, vencimentoEm: 5 });
    const s = await fabrica.slot();
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await expect(page.getByText("Você ainda não tem um plano definido. Fale com o studio para escolher o seu.")).toBeVisible();
    await expect((await cartaoSlot(page, s)).getByRole("button", { name: "Entrar" })).toBeDisabled();
  });

  test("vencimento em breve: pílula urgente quando vence amanhã", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "1x", vencimentoEm: 1 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");
    const pilula = resumo(page).getByText(/^Vence em breve · amanhã \(\d\d\/\d\d\)$/);
    await expect(pilula).toBeVisible();
    await expect(pilula).toHaveClass(/text-accent/);
  });
});
