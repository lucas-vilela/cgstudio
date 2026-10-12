"use client";

import { useState, useTransition } from "react";
import {
  bloqueioEntrar,
  DIAS,
  dataCurta,
  diaDaSemana,
  hhmm,
  type Acoes,
  type Experimental,
  type Financeiro,
  type SlotVaga,
} from "@/app/dashboard/calendario-lib";
import { Halter } from "./calendario-halter";
import { CalendarioExperimental } from "./calendario-experimental";
import { CalendarioResumo } from "./calendario-resumo";
import { CalendarioSlot } from "./calendario-slot";

type Props = {
  slots: SlotVaga[];
  financeiro: Financeiro;
  meusSlotIds: number[];
  experimental: Experimental | null;
  /** "YYYY-MM-DD" em America/Sao_Paulo, calculado no servidor. */
  hoje: string;
  acoes: Acoes;
};

type Pendente = { slotId: number; tipo: "entrar" | "sair" } | null;

export function CalendarioAluno({ slots, financeiro, meusSlotIds, experimental, hoje, acoes }: Props) {
  const [diaMobile, setDiaMobile] = useState<number>(() => {
    const d = diaDaSemana(hoje);
    return d >= 1 && d <= 5 ? d : 1;
  });
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState<Pendente>(null);
  const [isPending, startTransition] = useTransition();

  const meus = new Set(meusSlotIds);
  const bloqueio = bloqueioEntrar(financeiro);
  const semana = slots.filter((s) => s.ativo && s.dia_semana >= 1 && s.dia_semana <= 5);
  const horarios = [...new Set(semana.map((s) => `${s.hora_inicio}|${s.hora_fim}`))].sort();
  const porCelula = (dow: number, h: string) =>
    semana.find((s) => s.dia_semana === dow && `${s.hora_inicio}|${s.hora_fim}` === h);
  const gratis = experimental && experimental.data > hoje ? experimental : null;

  function executar(tipo: "entrar" | "sair", slotId: number) {
    setErro(null);
    setPendente({ slotId, tipo });
    startTransition(async () => {
      try {
        const r = await acoes[tipo](slotId);
        if (!r.ok) setErro(r.message);
      } catch {
        setErro("Sem conexão com o servidor. Tente novamente.");
      } finally {
        setPendente(null);
      }
    });
  }

  function celula(slot: SlotVaga, mostrarHora: boolean) {
    return (
      <CalendarioSlot
        key={slot.slot_id}
        slot={slot}
        meu={meus.has(slot.slot_id)}
        gratisEm={gratis?.slot_id === slot.slot_id ? dataCurta(gratis.data) : undefined}
        podeEntrar={!bloqueio}
        semBotaoEntrar={financeiro.status === "pendente"}
        mostrarHora={mostrarHora}
        carregando={pendente?.slotId === slot.slot_id ? pendente.tipo : null}
        ocupado={isPending}
        onEntrar={() => executar("entrar", slot.slot_id)}
        onSair={() => executar("sair", slot.slot_id)}
      />
    );
  }

  return (
    <section aria-labelledby="agenda-titulo" className="flex flex-col gap-4">
      <div className="rounded-[20px] border border-border bg-surface p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-3">
          <p className="cg-label">Agenda semanal</p>
          <h2 id="agenda-titulo" className="text-3xl">
            Meus horários
          </h2>
          <CalendarioResumo f={financeiro} />
        </div>

        {bloqueio && (
          <p className="mb-4 rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted-foreground">
            {bloqueio.texto}
          </p>
        )}
        <p role="alert" aria-live="assertive" className={erro ? "mb-4 rounded-xl border border-accent p-3 text-sm" : "sr-only"}>
          {erro}
        </p>

        {semana.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
            <Halter className="!h-[26px] !w-[18px] text-accent" />
            <p>Os horários da semana ainda não foram cadastrados.</p>
          </div>
        ) : (
          <>
            {/* Celular: um dia por vez */}
            <div className="md:hidden">
              <div role="group" aria-label="Dia da semana" className="mb-3 grid grid-cols-5 gap-1.5">
                {DIAS.map((d) => {
                  const ativo = diaMobile === d.dow;
                  const temMeu = semana.some((s) => s.dia_semana === d.dow && meus.has(s.slot_id));
                  return (
                    <button
                      key={d.dow}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setDiaMobile(d.dow)}
                      className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs font-semibold uppercase tracking-wider outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        ativo ? "border-foreground bg-foreground text-background" : "border-border bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      {d.curto}
                      {temMeu ? (
                        <>
                          <Halter className={ativo ? "text-accent" : "text-accent"} />
                          <span className="sr-only">: você tem horário neste dia</span>
                        </>
                      ) : (
                        <span className="h-[13px]" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2">
                {semana.filter((s) => s.dia_semana === diaMobile).length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Sem horários neste dia.</p>
                ) : (
                  semana
                    .filter((s) => s.dia_semana === diaMobile)
                    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
                    .map((s) => celula(s, true))
                )}
              </div>
            </div>

            {/* Desktop: grade seg–sex */}
            <div className="hidden grid-cols-[64px_repeat(5,1fr)] gap-2 md:grid">
              <div />
              {DIAS.map((d) => (
                <div key={d.dow} className="pb-1 text-center text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {d.curto}
                </div>
              ))}
              {horarios.map((h) => (
                <GradeLinha key={h} h={h} celula={(dow) => porCelula(dow, h)} render={(s) => celula(s, false)} />
              ))}
            </div>
          </>
        )}

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-[3px] bg-accent" /> Seu horário
          </li>
          <li className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-[3px] border border-border bg-surface-2" /> Com vaga
          </li>
          <li className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-[3px] border border-border bg-surface-2 opacity-45" /> Lotado
          </li>
        </ul>
      </div>

      {financeiro.status === "pendente" && (
        <CalendarioExperimental slots={semana} experimental={experimental} hoje={hoje} acoes={acoes} />
      )}
    </section>
  );
}

function GradeLinha({
  h,
  celula,
  render,
}: {
  h: string;
  celula: (dow: number) => SlotVaga | undefined;
  render: (s: SlotVaga) => React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-start pt-3 text-[13px] font-medium text-muted-foreground">{hhmm(h.split("|")[0])}</div>
      {DIAS.map((d) => {
        const s = celula(d.dow);
        return <div key={d.dow}>{s ? render(s) : null}</div>;
      })}
    </>
  );
}
