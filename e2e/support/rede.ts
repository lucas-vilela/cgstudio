import { expect, type Page, type Response } from "@playwright/test";
import type { AdminSnapshot, RespostaAcao } from "../../src/lib/offline/tipos";

// Esperas e conferências de rede. O app lê o banco no servidor; no navegador só passam:
// - Server Actions: POST na própria página com o cabeçalho `next-action`;
// - o app offline do admin: GET /api/admin/snapshot e POST /api/admin/acoes.

export const ehServerAction = (r: Response) =>
  r.request().method() === "POST" && !!r.request().headers()["next-action"];

/** Registre ANTES do clique. Resolve com a resposta da próxima Server Action (sempre 200). */
export function esperarServerAction(page: Page) {
  return page.waitForResponse(ehServerAction).then((r) => {
    expect(r.status(), "Server Action respondeu").toBe(200);
    return r;
  });
}

const ehSnapshot = (r: Response) =>
  r.url().endsWith("/api/admin/snapshot") && r.request().method() === "GET";

/** Registre ANTES da navegação/ação. Resolve com o JSON do próximo snapshot (200). */
export async function esperarSnapshot(page: Page): Promise<AdminSnapshot> {
  const r = await page.waitForResponse(ehSnapshot);
  expect(r.status(), "GET /api/admin/snapshot").toBe(200);
  expect(r.headers()["cache-control"]).toContain("no-store");
  return (await r.json()) as AdminSnapshot;
}

export type EnvioFila = {
  pedido: { id: string; tipo: string; payload: Record<string, unknown> };
  resposta: RespostaAcao;
  status: number;
  /** O snapshot que o app pede depois de um envio aceito (a tela se atualiza com ele). */
  snapshotDepois: () => Promise<AdminSnapshot>;
};

// Marco = quando a resposta da ação começou a chegar. Server Actions respondem em streaming e o app
// reage aos primeiros bytes, antes do fim do corpo; snapshots a caminho antes da ação começaram antes.
const fimDa = (r: Response) => r.request().timing().startTime + Math.max(0, r.request().timing().responseStart);

/**
 * Registre ANTES da ação. Devolve uma função que espera o primeiro snapshot pedido depois de
 * `marco` (a resposta da ação): o app recarrega os dados do servidor depois de cada envio aceito.
 * Snapshots que já estavam a caminho antes da ação são ignorados.
 */
export function snapshotApos(page: Page) {
  const vistos: Response[] = [];
  const coletar = (r: Response) => { if (ehSnapshot(r)) vistos.push(r); };
  page.on("response", coletar);
  return async (marco: Response): Promise<AdminSnapshot> => {
    const fim = fimDa(marco);
    const depois = (s: Response) => s.request().timing().startTime >= fim - 5;
    const s = vistos.find(depois) ?? (await page.waitForResponse((x) => ehSnapshot(x) && depois(x)));
    page.off("response", coletar);
    expect(s.status()).toBe(200);
    return (await s.json()) as AdminSnapshot;
  };
}

/** Registre ANTES da ação. Resolve com o próximo POST /api/admin/acoes (do tipo pedido). */
export async function esperarEnvioFila(page: Page, tipo?: string): Promise<EnvioFila> {
  const proximo = snapshotApos(page);
  const r = await page.waitForResponse(
    (r) => r.url().endsWith("/api/admin/acoes") && r.request().method() === "POST"
      && (!tipo || r.request().postDataJSON()?.tipo === tipo),
  );
  return {
    pedido: r.request().postDataJSON(),
    resposta: (await r.json()) as RespostaAcao,
    status: r.status(),
    snapshotDepois: () => proximo(r),
  };
}

/** Conta os POSTs para /api/admin/acoes a partir de agora (para provar que nada saiu offline). */
export function contarEnviosFila(page: Page) {
  const contagem = { n: 0 };
  page.on("request", (req) => {
    if (req.url().endsWith("/api/admin/acoes") && req.method() === "POST") contagem.n++;
  });
  return contagem;
}

/**
 * Abre uma tela do app do admin e espera o primeiro snapshot (o app começa sem dados no aparelho).
 * Devolve o snapshot que a tela vai mostrar: as conferências de UI usam ele como verdade.
 *
 * `congelar`: recargas seguintes do snapshot falham (como sem rede), então a tela fica exatamente
 * com o primeiro — outros testes em paralelo criam alunos e pagamentos o tempo todo.
 */
export async function abrirAdmin(page: Page, caminho = "/dashboard/admin", { congelar = false } = {}) {
  if (congelar) {
    let n = 0;
    await page.route("**/api/admin/snapshot", (r) => (n++ === 0 ? r.continue() : r.abort("internetdisconnected")));
  }
  const snap = esperarSnapshot(page);
  await page.goto(caminho);
  const s = await snap;
  await expect(page.getByRole("status").filter({ hasText: "Online" })).toBeVisible();
  return s;
}
