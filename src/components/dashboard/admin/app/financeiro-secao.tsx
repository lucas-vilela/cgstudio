"use client";

import { useState } from "react";
import { brl, monthLabel, shiftMonth } from "@/app/dashboard/admin/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Visao } from "@/lib/offline/visao";
import { InadimplentesTable } from "../inadimplentes-table";
import { PagamentosTable } from "../pagamentos-table";
import { Panel } from "../section";
import { Dica } from "@/components/ajuda/dica";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold leading-none">{value}</p>
    </div>
  );
}

// Totais do mês calculados aqui a partir dos pagamentos baixados (últimos 24 meses), incluindo os
// que ainda aguardam envio — a tela diz quantos são.
export function FinanceiroSecao({ visao }: { visao: Visao }) {
  const [ym, setYm] = useState(visao.snapshot.hoje.slice(0, 7));
  const [q, setQ] = useState("");
  const [alunoId, setAlunoId] = useState<string | null>(null);

  const doMes = visao.pagamentos.filter((p) => p.pago_em.startsWith(ym) && !p.erro);
  const soma = (f?: string) => doMes.filter((p) => !f || p.forma === f).reduce((t, p) => t + p.valor, 0);
  const aguardando = doMes.filter((p) => p.pendente).length;

  const termo = q.trim().toLowerCase();
  const lista = alunoId
    ? visao.pagamentos.filter((p) => p.member_id === alunoId)
    : visao.pagamentos.filter((p) => p.pago_em.startsWith(ym) && (!termo || (p.nome ?? "").toLowerCase().includes(termo)));
  const alunoNome = alunoId ? (visao.members.find((m) => m.member_id === alunoId)?.nome ?? "aluno") : null;
  const navBtn = "min-h-11 md:min-h-8";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-4xl">Financeiro</h1>
        <nav aria-label="Mês" className="flex items-center gap-2">
          <Button variant="outline" className={navBtn} aria-label="Mês anterior" onClick={() => setYm(shiftMonth(ym, -1))}>‹</Button>
          <span className="min-w-36 text-center text-sm font-semibold first-letter:uppercase">{monthLabel(ym)}</span>
          <Button variant="outline" className={navBtn} aria-label="Próximo mês" onClick={() => setYm(shiftMonth(ym, 1))}>›</Button>
        </nav>
      </div>

      <section aria-label="Entradas do mês" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Recebido" value={brl(soma())} />
        <Stat label="Pix" value={brl(soma("pix"))} />
        <Stat label="Dinheiro" value={brl(soma("dinheiro"))} />
        <Stat label="Cartão" value={brl(soma("cartao"))} />
      </section>
      <p className="-mt-3 text-sm text-muted-foreground">
        {doMes.length} {doMes.length === 1 ? "pagamento" : "pagamentos"} em {monthLabel(ym)}
        {aguardando ? ` (${aguardando} aguardando envio)` : ""}.
      </p>

      <Panel aria-labelledby="inad-title">
        <div className="flex items-center gap-1">
          <h2 id="inad-title" className="text-3xl">Inadimplentes</h2>
          <Dica titulo="Inadimplentes">
            Quem tem pagamento aguardando envio aparece marcado: não cobre de novo, ele só ainda não chegou ao servidor.
          </Dica>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">Alunos com vencimento passado (não conta pendentes).</p>
        <InadimplentesTable items={visao.snapshot.inadimplentes} pendentes={visao.pagamentosPendentes} />
      </Panel>

      <Panel aria-labelledby="hist-title">
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-1">
              <h2 id="hist-title" className="text-3xl">{alunoId ? `Histórico de ${alunoNome}` : "Pagamentos do mês"}</h2>
              {!alunoId && (
                <Dica titulo="Histórico do aluno">Toque no nome de um aluno para ver todos os pagamentos dele.</Dica>
              )}
            </div>
            {alunoId && (
              <button type="button" onClick={() => setAlunoId(null)}
                className="min-h-11 text-sm text-muted-foreground underline-offset-4 hover:underline md:min-h-0">
                ← Ver pagamentos do mês
              </button>
            )}
          </div>
          {!alunoId && (
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome do aluno"
              aria-label="Filtrar pagamentos por aluno" className="h-10 md:h-8" />
          )}
        </div>
        <PagamentosTable items={lista} onAluno={alunoId ? undefined : setAlunoId} />
      </Panel>
    </div>
  );
}
