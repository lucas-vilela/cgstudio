"use client";

import type { Visao } from "@/lib/offline/visao";
import { SlotsBoard } from "../slots-board";

export function CalendarioSecao({ visao }: { visao: Visao }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl">Calendário</h1>
        <p className="text-sm text-muted-foreground">Horários semanais, capacidade e alunos de cada turma.</p>
      </div>
      <SlotsBoard slots={visao.slots} members={visao.members} anamneses={visao.anamneses} />
    </div>
  );
}
