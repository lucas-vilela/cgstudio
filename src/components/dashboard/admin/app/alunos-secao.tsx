"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Visao } from "@/lib/offline/visao";
import { MembersTable } from "../members-table";
import { Panel } from "../section";
import { SummaryCards } from "../summary-cards";
import { VencimentosProximos } from "../vencimentos-proximos";

export function AlunosSecao({ visao }: { visao: Visao }) {
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const digitos = q.replace(/\D/g, "");
  const members = q
    ? visao.members.filter(
        (m) =>
          (m.nome ?? "").toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q) ||
          (digitos.length >= 3 && (m.telefone ?? "").includes(digitos)),
      )
    : visao.members;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl">Alunos</h1>
      <SummaryCards {...visao.snapshot.resumo} />
      <VencimentosProximos items={visao.snapshot.vencimentos} pendentes={visao.pagamentosPendentes} />
      <Panel aria-labelledby="alunos-title">
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <h2 id="alunos-title" className="text-3xl">Todos os alunos</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} {members.length === 1 ? "aluno" : "alunos"}
              {q ? ` para “${busca.trim()}”` : ""}
            </p>
          </div>
          <div className="relative" role="search">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar alunos" className="pl-8" />
          </div>
        </div>
        <MembersTable members={members} todos={visao.members} plans={visao.plans} treinos={visao.snapshot.treinos} />
      </Panel>
    </div>
  );
}
