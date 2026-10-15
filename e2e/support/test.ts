import { test as base, expect, type Page } from "@playwright/test";
import { USUARIOS, storageStatePath, type Usuario } from "../supabase-local";
import { Fabrica } from "./fabrica";
import { entrar } from "./sessao";

type Fixtures = {
  /** Cria dados só deste teste e apaga tudo no fim. */
  fabrica: Fabrica;
  /** Troca a sessão da página atual para `email`. */
  entrarComo: (email: string) => Promise<void>;
  /** Abre uma segunda janela: logada (usuário do seed ou e-mail) ou de visitante sem login. */
  outraJanela: (quem: Usuario | { email: string } | "visitante") => Promise<Page>;
};

// O segundo parâmetro das fixtures se chama `usar` (e não `use`) para a regra de hooks do React
// no ESLint não confundir com o hook `use`.
export const test = base.extend<Fixtures>({
  fabrica: async ({}, usar, testInfo) => {
    // Faixa de minutos exclusiva do worker: horários criados em paralelo nunca coincidem.
    const f = new Fabrica(testInfo.parallelIndex * 18);
    await usar(f);
    await f.limpar();
  },

  entrarComo: async ({ context, baseURL }, usar) => {
    await usar((email) => entrar(context, email, baseURL!));
  },

  outraJanela: async ({ browser, baseURL }, usar) => {
    const abertas: Page[] = [];
    await usar(async (quem) => {
      const base = { baseURL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" };
      const ctx = typeof quem === "string" && quem !== "visitante"
        ? await browser.newContext({ ...base, storageState: storageStatePath(quem) })
        : await browser.newContext(base);
      if (typeof quem === "object") await entrar(ctx, quem.email, baseURL!);
      const p = await ctx.newPage();
      abertas.push(p);
      return p;
    });
    for (const p of abertas) await p.context().close();
  },
});

export { expect, USUARIOS, storageStatePath };
