import { Suspense } from "react";
import { AdminApp } from "@/components/dashboard/admin/app/admin-app";
import { PageLoading } from "@/components/dashboard/admin/page-loading";
import { requireAdmin } from "../guard";

// Alunos, Financeiro e Calendário: o mesmo app de cliente, que lê os dados salvos no aparelho
// (funciona offline) e sincroniza com o servidor quando há conexão.
export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Conteudo />
    </Suspense>
  );
}

async function Conteudo() {
  const user = await requireAdmin();
  return <AdminApp userId={user.id} />;
}
