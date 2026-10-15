"use client";

import type { Visao } from "@/lib/offline/visao";
import { SlotsBoard } from "../slots-board";
import { Dica } from "@/components/ajuda/dica";

export function CalendarioSecao({ visao }: { visao: Visao }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-1">
          <h1 className="text-4xl">Calendário</h1>
          <Dica titulo="Horários">
            Cada horário se repete toda semana. “Desativar” tira o horário da agenda dos alunos sem apagar nada; quem
            estava nele continua lá quando você ativar de novo.
          </Dica>
        </div>
        <p className="text-sm text-muted-foreground">Horários semanais, capacidade e alunos de cada turma.</p>
      </div>
      <SlotsBoard slots={visao.slots} members={visao.members} anamneses={visao.anamneses} />
    </div>
  );
}
