import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { MembersTable } from "@/components/dashboard/members-table";
import { MembersSearch } from "@/components/dashboard/members-search";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser, isAdmin, listMembers } from "../data";

type SearchParams = Promise<{ q?: string | string[] }>;

export default function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  // searchParams e a sessão são dados de runtime: leitura dentro de Suspense.
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-5xl px-4 py-10 text-sm text-muted-foreground" aria-busy>
          Carregando…
        </main>
      }
    >
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!(await isAdmin(user.id))) notFound();

  const { q } = await searchParams;
  const query = Array.isArray(q) ? (q[0] ?? "") : (q ?? "");
  const members = await listMembers(query);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Alunos</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} {members.length === 1 ? "aluno" : "alunos"}
            {query ? ` para “${query}”` : ""}
          </p>
        </div>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Meu cadastro
        </Link>
      </header>
      <MembersSearch defaultValue={query} />
      <MembersTable members={members} />
    </main>
  );
}
