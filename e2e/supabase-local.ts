import { execSync } from "node:child_process";

// Banco de testes: Supabase local (`supabase start`). As chaves vêm de `supabase status` (ou das
// variáveis E2E_SUPABASE_*) em vez de ficarem no código: o GitHub bloqueia push com chave secreta,
// mesmo a padrão da CLI local. Lido uma vez no processo principal; os workers herdam o env.
function statusLocal(): Record<string, string> {
  try {
    const out = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
  } catch {
    throw new Error("Supabase local não está rodando? (npm run db:start)");
  }
}

if (!process.env.E2E_SUPABASE_SECRET_KEY || !process.env.E2E_SUPABASE_PUBLISHABLE_KEY) {
  const st = statusLocal();
  process.env.E2E_SUPABASE_URL ??= st.API_URL;
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY ??= st.PUBLISHABLE_KEY;
  // Chave de serviço local: os testes criam e apagam os próprios dados (fixtures) com ela.
  process.env.E2E_SUPABASE_SECRET_KEY ??= st.SECRET_KEY;
}

export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_PUBLISHABLE_KEY = process.env.E2E_SUPABASE_PUBLISHABLE_KEY!;
export const SUPABASE_SECRET_KEY = process.env.E2E_SUPABASE_SECRET_KEY!;

// Usuários criados por supabase/seed.sql.
export const SENHA_TESTE = "senha-teste-123";
export const USUARIOS = {
  admin: "admin@cgstudio.test",
  ana: "ana@cgstudio.test",
  bruno: "bruno@cgstudio.test",
  carla: "carla@cgstudio.test",
} as const;
export type Usuario = keyof typeof USUARIOS;

export const storageStatePath = (usuario: Usuario) => `e2e/.auth/${usuario}.json`;

// Trava de segurança: os testes escrevem no banco, então só rodam contra localhost.
export function garantirBancoLocal() {
  const { hostname } = new URL(SUPABASE_URL);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`E2E recusado: SUPABASE_URL (${SUPABASE_URL}) não é local.`);
  }
}
