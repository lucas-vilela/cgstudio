import { Suspense } from "react";
import { MembersTable } from "@/components/dashboard/admin/members-table";
import { PageLoading } from "@/components/dashboard/admin/page-loading";
import { Panel } from "@/components/dashboard/admin/section";
import { SummaryCards } from "@/components/dashboard/admin/summary-cards";
import { VencimentosProximos } from "@/components/dashboard/admin/vencimentos-proximos";
import { MembersSearch } from "@/components/dashboard/members-search";
import { requireAdmin } from "./guard";
import { getAdminMembers, getPlans, getResumo, getTreinos, getVencimentosProximos } from "./queries";

type SearchParams = Promise<{ q?: string | string[] }>;

export default function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  // Sessão e searchParams são dados de runtime: leitura dentro de Suspense.
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const { q } = await searchParams;
  const query = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");

  const [resumo, vencimentos, members, plans, treinos] = await Promise.all([
    getResumo(),
    getVencimentosProximos(),
    getAdminMembers(query),
    getPlans(),
    getTreinos(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl">Alunos</h1>
      <SummaryCards {...resumo} />
      <VencimentosProximos items={vencimentos} />
      <Panel aria-labelledby="alunos-title">
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <h2 id="alunos-title" className="text-3xl">Todos os alunos</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "aluno" : "alunos"}
              {query ? ` para “${query}”` : ""}
            </p>
          </div>
          <MembersSearch defaultValue={query} />
        </div>
        <MembersTable members={members} plans={plans} treinos={treinos} />
      </Panel>
    </div>
  );
}
