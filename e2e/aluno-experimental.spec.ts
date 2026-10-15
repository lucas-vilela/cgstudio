import type { Page } from "@playwright/test";
import { test, expect } from "./support/test";
import { addDias, dataCurta, diaDaSemana, hojeSP, proximasDatas } from "./support/datas";
import { clienteComo, db, ok } from "./support/db";
import { ehServerAction } from "./support/rede";

// Aula grátis do aluno pendente (RPCs slot_vagas_na_data, book_trial, cancel_trial).

const reserva = async (memberId: string) =>
  ok(await db.from("trial_bookings").select("id,slot_id,data").eq("member_id", memberId).maybeSingle()) as
    { id: number; slot_id: number; data: string } | null;

async function abrirFormulario(page: Page, slotId: number) {
  await page.getByRole("button", { name: "Agendar aula grátis" }).click();
  await expect(page.getByRole("heading", { name: "Agendar aula grátis" })).toBeVisible();
  await page.getByLabel("1. Horário").selectOption(String(slotId));
}

test.describe("aula grátis", () => {
  test("agenda: consulta de vagas por data (Server Action), reserva gravada e cancelamento", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "pendente" });
    const s = await fabrica.slot({ capacidade: 3 });
    const datas = proximasDatas(hojeSP(), s.dia_semana);
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Conheça o studio" })).toBeVisible();
    await abrirFormulario(page, s.id);

    // Quatro próximas datas que caem no dia do horário.
    const opcoes = page.getByRole("group", { name: "2. Data" }).getByRole("radio");
    await expect(opcoes).toHaveCount(4);
    for (const [i, d] of datas.entries()) await expect(opcoes.nth(i)).toHaveAttribute("value", d);
    const confirmar = page.getByRole("button", { name: "Confirmar aula grátis" });
    await expect(confirmar).toBeDisabled();

    const consulta = page.waitForResponse(ehServerAction);
    await page.getByText(dataCurta(datas[1]), { exact: true }).click();
    const r = await consulta;
    expect(r.status()).toBe(200);
    expect(r.request().postData()).toContain(String(s.id));
    expect(r.request().postData()).toContain(datas[1]);
    await expect(page.getByText("3 vagas nessa data")).toBeVisible();
    await expect(confirmar).toBeEnabled();

    const agendar = page.waitForResponse(ehServerAction);
    await confirmar.click();
    expect((await agendar).status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Aula grátis agendada" })).toBeVisible();
    await expect(page.getByText(new RegExp(`${dataCurta(datas[1])} · ${s.hora_inicio}–${s.hora_fim}`))).toBeVisible();
    expect(await reserva(aluno.id)).toMatchObject({ slot_id: s.id, data: datas[1] });
    // A vaga da data é descontada (capacidade − fixos − experimentais do dia).
    const sb = await clienteComo(aluno.email);
    expect(ok(await sb.rpc("slot_vagas_na_data", { p_slot_id: s.id, p_data: datas[1] }))).toBe(2);

    const cancelar = page.waitForResponse(ehServerAction);
    await page.getByRole("button", { name: "Cancelar aula grátis" }).click();
    expect((await cancelar).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Conheça o studio" })).toBeVisible();
    expect(await reserva(aluno.id)).toBeNull();
  });

  test("data lotada: aviso e confirmação bloqueada", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "pendente" });
    const fixo = await fabrica.aluno({ status: "ativo", login: false });
    const s = await fabrica.slot({ capacidade: 1 });
    await fabrica.alocar(s.id, fixo.id);
    const [d] = proximasDatas(hojeSP(), s.dia_semana);
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await abrirFormulario(page, s.id);
    await page.getByText(dataCurta(d), { exact: true }).click();
    await expect(page.getByText("Lotado nessa data")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar aula grátis" })).toBeDisabled();
    expect(await reserva(aluno.id)).toBeNull();
  });

  test("só uma por pessoa: com reserva no banco, o formulário não aparece", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "pendente" });
    // Fora do dia de hoje: no celular a agenda abre no dia atual e o horário ficaria à vista.
    const s = await fabrica.slot({ dia: diaDaSemana(hojeSP()) === 3 ? 2 : 3 });
    const [d] = proximasDatas(hojeSP(), s.dia_semana);
    ok(await db.from("trial_bookings").insert({ member_id: aluno.id, slot_id: s.id, data: d }));
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Aula grátis agendada" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agendar aula grátis" })).toHaveCount(0);
    // Na agenda, o horário reservado mostra a marca da aula grátis.
    await expect(page.getByText(`Aula grátis em ${dataCurta(d)}`).filter({ visible: true })).toHaveCount(
      page.viewportSize()!.width < 768 ? 0 : 1,
    );
  });

  test("aula grátis já feita (data passada): mensagem de matrícula, sem cancelar", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "pendente" });
    const s = await fabrica.slot();
    const passada = addDias(hojeSP(), -3);
    ok(await db.from("trial_bookings").insert({ member_id: aluno.id, slot_id: s.id, data: passada }));
    await entrarComo(aluno.email);
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Aula grátis realizada" })).toBeVisible();
    await expect(page.getByText(`Você usou sua aula grátis em ${dataCurta(passada)}.`, { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar aula grátis" })).toHaveCount(0);
  });

  test("aluno ativo não vê a aula grátis", async ({ page, fabrica, entrarComo }) => {
    const aluno = await fabrica.aluno({ status: "ativo", plano: "1x", vencimentoEm: 10 });
    await entrarComo(aluno.email);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Meus horários" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Agendar aula grátis" })).toHaveCount(0);
  });
});
