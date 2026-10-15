import { test, expect, USUARIOS, storageStatePath } from "./support/test";
import { dataCurta, hojeSP } from "./support/datas";
import { clienteComo, ok } from "./support/db";

// Painel do aluno com os cenários do seed (só leitura). O esperado vem do banco, lido com a sessão
// do próprio aluno — como o servidor do app lê.

async function dadosDoAluno(email: string) {
  const sb = await clienteComo(email);
  const member = ok(await sb.from("members").select("id,nome,telefone,email,status").eq("email", email).single()) as {
    id: string; nome: string; telefone: string; status: string;
  };
  const fin = ok(await sb.from("member_financeiro").select("*").eq("member_id", member.id).single()) as {
    status: string; plano_nome: string | null; vezes_semana: number | null; slots_usados: number;
    vencimento: string | null; dias_para_vencer: number | null; situacao: string;
  };
  const meus = ok(await sb.from("slot_members").select("slot_id").eq("member_id", member.id)) as { slot_id: number }[];
  return { member, fin, meus };
}

const resumo = (page: import("@playwright/test").Page) => page.getByRole("list", { name: "Resumo da matrícula" });

test.describe("Ana (ativa, em dia, 2x)", () => {
  test.use({ storageState: storageStatePath("ana") });

  test("resumo da matrícula, horários marcados e dados do cadastro batem com o banco", async ({ page, isMobile }) => {
    const { member, fin, meus } = await dadosDoAluno(USUARIOS.ana);
    expect(fin.situacao, "seed: Ana em dia").toBe("em_dia");
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Meus horários" })).toBeVisible();
    await expect(resumo(page)).toContainText(`Ativo · plano ${fin.plano_nome}`);
    await expect(resumo(page)).toContainText(`${fin.slots_usados} de ${fin.vezes_semana} slots usados`);
    await expect(resumo(page)).toContainText(
      `Em dia · vence em ${fin.dias_para_vencer} dias (${dataCurta(fin.vencimento!)})`,
    );
    await expect(page.getByText("Ativo", { exact: true }).first()).toBeVisible(); // selo no topo

    // Plano 2x com 2 horários: nenhum "Entrar" habilitado e o aviso do limite.
    expect(meus).toHaveLength(2);
    await expect(page.getByText("Você já usa os 2 horários do seu plano. Saia de um para trocar.")).toBeVisible();
    if (!isMobile) await expect(page.locator('div.hidden.md\\:grid [data-state="meu"]')).toHaveCount(meus.length);

    await expect(page.getByLabel("Nome completo")).toHaveValue(member.nome);
    await expect(page.getByLabel("Telefone")).toHaveValue("(11) 98765-4321");
    await expect(page.getByLabel("E-mail")).toHaveValue(USUARIOS.ana);
    await expect(page.getByLabel("E-mail")).toBeDisabled();
  });

  test("celular: os dias com horário próprio têm marca e mostram 'Seu horário'", async ({ page, isMobile }) => {
    test.skip(!isMobile, "lista por dia só existe no celular");
    await page.goto("/dashboard");
    const dias = page.getByRole("group", { name: "Dia da semana" });
    for (const d of ["Seg", "Qua"]) {
      const botao = dias.getByRole("button", { name: new RegExp(`^${d}\\s*: você tem horário neste dia`) });
      await botao.click();
      await expect(botao).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('div.md\\:hidden [data-state="meu"]')).toContainText("07:00–08:00");
      await expect(page.locator('div.md\\:hidden [data-state="meu"]')).toContainText("Seu horário");
    }
    await dias.getByRole("button", { name: /^Ter$/ }).click();
    await expect(page.locator('div.md\\:hidden [data-state="meu"]')).toHaveCount(0);
  });

  test("depoimento publicado aparece com o selo e o texto do banco", async ({ page }) => {
    const sb = await clienteComo(USUARIOS.ana);
    const dep = ok(await sb.from("depoimentos").select("texto,status").single()) as { texto: string; status: string };
    expect(dep.status).toBe("aprovado");
    await page.goto("/dashboard");
    await expect(page.getByText("Publicado", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Depoimento")).toHaveValue(dep.texto);
    // Sem mudança no texto: nada para enviar.
    await expect(page.getByRole("button", { name: "Enviar alteração" })).toBeDisabled();
  });
});

test.describe("Bruno (ativo, vencimento passado, 3x)", () => {
  test.use({ storageState: storageStatePath("bruno") });

  test("pílula de atraso urgente com os dias do banco e limite do plano atingido", async ({ page }) => {
    const { fin } = await dadosDoAluno(USUARIOS.bruno);
    expect(fin.situacao, "seed: Bruno em atraso").toBe("em_atraso");
    await page.goto("/dashboard");

    const dias = Math.abs(fin.dias_para_vencer!);
    const pilula = resumo(page).getByText(`Em atraso · venceu há ${dias} ${dias === 1 ? "dia" : "dias"} (${dataCurta(fin.vencimento!)})`);
    await expect(pilula).toBeVisible();
    await expect(pilula).toHaveClass(/text-accent/);
    await expect(resumo(page)).toContainText("3 de 3 slots usados");
    await expect(page.getByText("Você já usa os 3 horários do seu plano. Saia de um para trocar.")).toBeVisible();
  });

  test("depoimento em análise", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Em análise", { exact: true })).toBeVisible();
    await expect(page.getByText("Seu depoimento está em análise.", { exact: false })).toBeVisible();
  });
});

test.describe("Carla (pendente, sem plano)", () => {
  test.use({ storageState: storageStatePath("carla") });

  test("não entra em horários, vê a aula grátis e não pode enviar depoimento", async ({ page }) => {
    const sb = await clienteComo(USUARIOS.carla);
    const trial = ok(await sb.from("trial_bookings").select("data,slot_id").maybeSingle()) as { data: string } | null;
    await page.goto("/dashboard");

    await expect(resumo(page)).toHaveText("Pendente");
    await expect(page.getByText("Você ainda não é aluno matriculado. Agende uma aula grátis para conhecer o studio.")).toBeVisible();
    // Pendente: sem botão "Entrar" em nenhum horário.
    await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);

    if (trial && trial.data > hojeSP()) {
      await expect(page.getByRole("heading", { name: "Aula grátis agendada" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancelar aula grátis" })).toBeEnabled();
    } else {
      await expect(page.getByRole("heading", { name: /Conheça o studio|Aula grátis realizada/ })).toBeVisible();
    }

    await expect(page.getByText("Só alunos com matrícula ativa podem enviar ou editar depoimento.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Depoimento")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar depoimento" })).toBeDisabled();
  });
});
