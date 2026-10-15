import { Suspense } from "react";
import { connection } from "next/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AdminNav } from "@/components/dashboard/admin/admin-nav";
import { PwaAdmin } from "@/components/dashboard/admin/app/pwa";
import { getCurrentUser } from "../data";
import { getPendentesCount } from "./queries";

// Contagem de depoimentos pendentes é dado de sessão: busca dentro de Suspense, com a barra
// já visível (sem o número) enquanto carrega ou se a consulta falhar.
async function AdminNavComContagem() {
  await connection(); // só no request: o cliente do Supabase lê relógio/cookies
  const pendentes = await getPendentesCount().catch(() => 0);
  return <AdminNav pendentes={pendentes} />;
}

// Sair apaga do aparelho os dados do app offline deste admin (precisa do id da sessão).
async function SairAdmin() {
  await connection();
  const user = await getCurrentUser();
  return <SignOutButton variant="ghost" limparDadosDe={user?.id} />;
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
          <Suspense fallback={<SignOutButton variant="ghost" disabled />}>
            <SairAdmin />
          </Suspense>
        </div>
        <Suspense fallback={<AdminNav />}>
          <AdminNavComContagem />
        </Suspense>
      </header>
      {children}
    </main>
  );
}
