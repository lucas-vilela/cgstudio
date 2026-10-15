import { createServerClient } from "@supabase/ssr";
import type { BrowserContext } from "@playwright/test";
import { SENHA_TESTE, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../supabase-local";

// O app só tem login Google; nos testes logamos por senha e gravamos os cookies do @supabase/ssr,
// os mesmos que o proxy do Next lê.
export async function cookiesDeLogin(email: string, baseURL: string) {
  const jar = new Map<string, string>();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: SENHA_TESTE });
  if (error) throw new Error(`login de ${email}: ${error.message} (Supabase local está de pé? npm run db:reset)`);

  const { hostname } = new URL(baseURL);
  return [...jar].map(([name, value]) => ({
    name,
    value,
    domain: hostname,
    path: "/",
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: "Lax" as const,
  }));
}

/** Entra no contexto do navegador como `email` (troca a sessão atual, se houver). */
export async function entrar(context: BrowserContext, email: string, baseURL: string) {
  await context.clearCookies();
  await context.addCookies(await cookiesDeLogin(email, baseURL));
}
