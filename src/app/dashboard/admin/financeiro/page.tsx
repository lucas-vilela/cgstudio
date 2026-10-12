import Link from "next/link";
import { Suspense } from "react";
import { InadimplentesTable } from "@/components/dashboard/admin/inadimplentes-table";
import { PageLoading } from "@/components/dashboard/admin/page-loading";
import { PagamentosTable } from "@/components/dashboard/admin/pagamentos-table";
import { Panel } from "@/components/dashboard/admin/section";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "../guard";
import { brl, monthLabel, parseMonth, shiftMonth } from "../format";
import { getFinanceiroMes, getInadimplentes, getMemberName, getPagamentos } from "../queries";

type SearchParams = Promise<{ mes?: string | string[]; q?: string | string[]; aluno?: string | string[] }>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FinanceiroPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <FinanceiroContent searchParams={searchParams} />
    </Suspense>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold leading-none">{value}</p>
    </div>
  );
}

async function FinanceiroContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const ym = parseMonth(first(sp.mes));
  const q = (first(sp.q) ?? "").trim();
  const alunoParam = first(sp.aluno);
  const memberId = alunoParam && UUID.test(alunoParam) ? alunoParam : undefined;

  const [mes, inadimplentes, pagamentos, alunoNome] = await Promise.all([
    getFinanceiroMes(ym),
    getInadimplentes(),
    getPagamentos({ ym, memberId, q }),
    memberId ? getMemberName(memberId) : Promise.resolve(null),
  ]);

  const navBtn = buttonVariants({ variant: "outline" }) + " min-h-11 md:min-h-8";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl">Financeiro</h1>
        <nav aria-label="Mês" className="flex items-center gap-2">
          <Link href={`?mes=${shiftMonth(ym, -1)}`} className={navBtn} aria-label="Mês anterior">‹</Link>
          <span className="min-w-36 text-center text-sm font-semibold capitalize">{monthLabel(ym)}</span>
          <Link href={`?mes=${shiftMonth(ym, 1)}`} className={navBtn} aria-label="Próximo mês">›</Link>
        </nav>
      </div>

      <section aria-label="Entradas do mês" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recebido" value={brl(mes?.total_recebido ?? 0)} />
        <Stat label="Pix" value={brl(mes?.total_pix ?? 0)} />
        <Stat label="Dinheiro" value={brl(mes?.total_dinheiro ?? 0)} />
        <Stat label="Cartão" value={brl(mes?.total_cartao ?? 0)} />
      </section>
      <p className="-mt-3 text-sm text-muted-foreground">
        {mes?.qtd_pagamentos ?? 0} {mes?.qtd_pagamentos === 1 ? "pagamento" : "pagamentos"} em {monthLabel(ym)}.
      </p>

      <Panel aria-labelledby="inad-title">
        <h2 id="inad-title" className="text-3xl">Inadimplentes</h2>
        <p className="mb-3 text-sm text-muted-foreground">Alunos com vencimento passado (não conta pendentes).</p>
        <InadimplentesTable items={inadimplentes} />
      </Panel>

      <Panel aria-labelledby="hist-title">
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <h2 id="hist-title" className="text-3xl">
              {memberId ? `Histórico de ${alunoNome ?? "aluno"}` : "Pagamentos do mês"}
            </h2>
            {memberId && (
              <Link href={`?mes=${ym}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                ← Ver pagamentos do mês
              </Link>
            )}
          </div>
          {!memberId && (
            <form method="get" role="search" className="flex gap-2">
              <input type="hidden" name="mes" value={ym} />
              <Input name="q" type="search" defaultValue={q} placeholder="Filtrar por nome do aluno"
                aria-label="Filtrar pagamentos por aluno" className="h-10 md:h-8" />
              <button type="submit" className={buttonVariants({ variant: "secondary" }) + " min-h-10 md:min-h-8"}>
                Filtrar
              </button>
            </form>
          )}
        </div>
        <PagamentosTable
          items={pagamentos}
          linkAluno={(id) => (memberId ? null : `?aluno=${id}`)}
        />
      </Panel>
    </div>
  );
}
