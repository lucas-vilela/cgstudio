import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { UserRound } from "lucide-react";
import { AdminNav } from "@/components/dashboard/admin/admin-nav";
import { PwaAdmin } from "@/components/dashboard/admin/app/pwa";
import { getPendentesCount } from "./queries";

// Contagem de depoimentos pendentes é dado de sessão: busca dentro de Suspense, com a barra
// já visível (sem o número) enquanto carrega ou se a consulta falhar.
async function AdminNavComContagem() {
  await connection(); // só no request: o cliente do Supabase lê relógio/cookies
  const pendentes = await getPendentesCount().catch(() => 0);
  return <AdminNav pendentes={pendentes} />;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:py-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="cg-label">Painel do admin</p>
            <PwaAdmin />
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            <UserRound aria-hidden className="size-4" />
            Meu cadastro
          </Link>
        </div>
        <Suspense fallback={<AdminNav />}>
          <AdminNavComContagem />
        </Suspense>
      </header>
      {children}
    </main>
  );
}
