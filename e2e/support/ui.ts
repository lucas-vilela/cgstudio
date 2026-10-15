import { expect, type Locator, type Page } from "@playwright/test";
import type { Slot } from "./fabrica";

// Localizadores que dependem do layout: várias telas têm uma versão de celular (cartões) e outra de
// desktop (tabela/grade) no DOM ao mesmo tempo, uma delas escondida por CSS.

const ehCelular = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

/** Toast do sonner com o texto. */
export const toast = (page: Page, texto: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: texto });

/** Escolhe uma opção num select do Base UI (FieldSelect) pelo rótulo do campo. */
export async function escolher(escopo: Page | Locator, rotulo: string | RegExp, opcao: string | RegExp) {
  await escopo.getByRole("combobox", { name: rotulo }).click();
  const page = "goto" in escopo ? escopo : escopo.page();
  await page.getByRole("option", { name: opcao, exact: typeof opcao === "string" }).click();
}

// ---------------------------------------------------------------- calendário do aluno

const hhmm = (t: string) => t.slice(0, 5);

/** Cartão de um horário na agenda do aluno (grade no desktop, lista do dia no celular). */
export async function cartaoSlot(page: Page, slot: Slot): Promise<Locator> {
  const faixa = `${hhmm(slot.hora_inicio)}–${hhmm(slot.hora_fim)}`;
  if (ehCelular(page)) {
    const curto = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][slot.dia_semana];
    const dia = page.getByRole("group", { name: "Dia da semana" }).getByRole("button", { name: new RegExp(`^${curto}`) });
    if ((await dia.getAttribute("aria-pressed")) !== "true") await dia.click();
    return page.locator("div.md\\:hidden [data-state]").filter({ hasText: faixa });
  }
  // Grade: rótulo da linha (hora de início) e, depois dele, uma célula por dia a partir de segunda.
  const coluna = [7, 1, 2, 3, 4, 5, 6][slot.dia_semana];
  return page
    .locator("div.hidden.md\\:grid > div")
    .filter({ hasText: new RegExp(`^${hhmm(slot.hora_inicio)}$`) })
    .locator(`xpath=following-sibling::div[${coluna}]`)
    .locator("[data-state]");
}

// ---------------------------------------------------------------- listas do admin

/** Linha (desktop) ou cartão (celular) de um aluno na lista "Todos os alunos". */
export function linhaAluno(page: Page, nome: string): Locator {
  return ehCelular(page)
    ? page.locator("ul.md\\:hidden > li").filter({ hasText: nome })
    : page.locator("div.hidden.md\\:block tbody tr").filter({ hasText: nome });
}

/** Painel (section) pelo título visível. */
export const painel = (page: Page, titulo: string | RegExp) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: titulo, exact: typeof titulo === "string" }) });

export async function esperarDialogoFechar(page: Page) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/**
 * Espera os toasts sumirem com o ponteiro longe deles (o sonner pausa o tempo enquanto o ponteiro
 * está em cima). No celular eles ficam no topo, por cima da barra de abas do admin.
 */
export async function esperarToastsSumirem(page: Page) {
  const { height } = page.viewportSize() ?? { height: 600 };
  await page.mouse.move(1, height - 1);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 20_000 });
}
