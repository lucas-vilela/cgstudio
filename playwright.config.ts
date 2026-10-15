import { defineConfig, devices } from "@playwright/test";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, garantirBancoLocal } from "./e2e/supabase-local";

garantirBancoLocal();

// Porta e pasta de build próprias: roda junto do seu `next dev` (3000, .next) sem
// reaproveitar por engano um servidor apontando para o Supabase de produção.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

// Suítes por tipo de arquivo:
//   *.spec.ts         fluxos de tela; cada teste cria e apaga os próprios dados → paralelo, desktop e celular
//   *.api.spec.ts     rotas HTTP, RLS e regras do banco, sem navegador
//   *.serial.spec.ts  conteúdo global da home (textos, planos, treinos): um teste por vez
const ESPECIAIS = [/\.api\.spec\.ts$/, /\.serial\.spec\.ts$/];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: isCI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 60_000,
  },
  projects: [
    // Confere o seed, apaga restos, loga os usuários do seed (e2e/.auth/<usuario>.json) e aquece as rotas.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: ESPECIAIS, dependencies: ["setup"] },
    // Mesmo viewport usado nos ajustes de layout do celular (375px).
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      testIgnore: ESPECIAIS,
      dependencies: ["setup"],
    },
    { name: "api", testMatch: /\.api\.spec\.ts$/, dependencies: ["setup"] },
    {
      name: "serial",
      testMatch: /\.serial\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      fullyParallel: false,
      workers: 1,
      dependencies: ["setup"],
    },
  ],
  // Local: sobe (ou reaproveita) o `next dev`. CI: testa o build de produção.
  // process.env tem prioridade sobre o .env.local, então o app usa o banco local.
  webServer: {
    command: isCI ? `npm run build && npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      NEXT_DIST_DIR: ".next-test",
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_PUBLISHABLE_KEY,
    },
  },
});
