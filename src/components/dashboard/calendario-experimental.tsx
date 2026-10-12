"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, CalendarPlus, Loader2 } from "lucide-react";
import {
  dataComDia,
  dataCurta,
  faixa,
  nomeDia,
  proximasDatas,
  type Acoes,
  type Experimental,
  type SlotVaga,
} from "@/app/dashboard/calendario-lib";
import { Button } from "@/components/ui/button";
import { Halter } from "./calendario-halter";

type Props = { slots: SlotVaga[]; experimental: Experimental | null; hoje: string; acoes: Acoes };

type Vagas = { chave: string; texto: string; ok: boolean } | null;

const caixa = "rounded-[20px] border border-border bg-surface p-4 sm:p-6";

export function CalendarioExperimental({ slots, experimental, hoje, acoes }: Props) {
  const [aberto, setAberto] = useState(false);
  const [slotId, setSlotId] = useState<number | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [vagas, setVagas] = useState<Vagas>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const slot = slots.find((s) => s.slot_id === slotId) ?? null;
  const datas = slot ? proximasDatas(hoje, slot.dia_semana) : [];
  const chave = slotId && data ? `${slotId}|${data}` : null;

  // Consulta as vagas da data escolhida (capacidade - fixos - experimentais do dia).
  useEffect(() => {
    if (!slotId || !data || !chave) return;
    let cancelado = false;
    acoes
      .vagasNaData(slotId, data)
      .then((r) => {
        if (cancelado) return;
        if (!r.ok) return setVagas({ chave, texto: r.message, ok: false });
        setVagas({
          chave,
          ok: r.vagas > 0,
          texto: r.vagas <= 0 ? "Lotado nessa data" : r.vagas === 1 ? "1 vaga nessa data" : `${r.vagas} vagas nessa data`,
        });
      })
      .catch(() => !cancelado && setVagas({ chave, texto: "Não foi possível consultar as vagas.", ok: false }));
    return () => {
      cancelado = true;
    };
  }, [slotId, data, chave, acoes]);

  const consultando = !!chave && vagas?.chave !== chave;
  const podeConfirmar = !!slotId && !!data && vagas?.chave === chave && vagas.ok && !isPending;

  function executar(fn: () => ReturnType<Acoes["agendarExperimental"]>, depois?: () => void) {
    setErro(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (!r.ok) setErro(r.message);
        else depois?.();
      } catch {
        setErro("Sem conexão com o servidor. Tente novamente.");
      }
    });
  }

  const mensagemErro = (
    <p role="alert" className={erro ? "rounded-xl border border-accent p-3 text-sm" : "sr-only"}>
      {erro}
    </p>
  );

  // Já usada: agendada (futura) ou realizada.
  if (experimental) {
    const futura = experimental.data > hoje;
    const s = slots.find((x) => x.slot_id === experimental.slot_id);
    return (
      <div className={`${caixa} flex flex-col gap-3`}>
        <p className="cg-label">Aula grátis</p>
        {futura ? (
          <>
            <h2 className="text-2xl">Aula grátis agendada</h2>
            <p className="text-muted-foreground">
              {dataComDia(experimental.data)}
              {s ? ` · ${faixa(s)}` : ""}. Chegue uns 10 minutos antes.
            </p>
            {mensagemErro}
            <Button
              variant="outline"
              className="h-11 w-full sm:w-fit"
              disabled={isPending}
              onClick={() => executar(() => acoes.cancelarExperimental(experimental.id))}
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Cancelando…
                </>
              ) : (
                "Cancelar aula grátis"
              )}
            </Button>
          </>
        ) : (
          <>
            <h2 className="text-2xl">Aula grátis realizada</h2>
            <p className="text-muted-foreground">
              Você usou sua aula grátis em {dataCurta(experimental.data)}. Fale com o studio para se matricular e escolher seus horários.
            </p>
          </>
        )}
      </div>
    );
  }

  if (!aberto)
    return (
      <div className={`${caixa} flex flex-col gap-3`}>
        <p className="cg-label">Aula grátis</p>
        <h2 className="text-2xl">Conheça o studio</h2>
        <p className="max-w-prose text-muted-foreground">
          Escolha um horário e um dia para fazer uma aula experimental, sem custo. É uma por pessoa.
        </p>
        <Button className="h-11 w-full sm:w-fit sm:px-6" onClick={() => setAberto(true)} disabled={slots.length === 0}>
          <CalendarPlus data-icon="inline-start" />
          Agendar aula grátis
        </Button>
      </div>
    );

  return (
    <div className={`${caixa} flex flex-col gap-5`}>
      <div className="flex flex-col gap-3">
        <p className="cg-label">Aula grátis</p>
        <h2 className="text-2xl">Agendar aula grátis</h2>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="gratis-slot" className="text-sm font-medium">
          1. Horário
        </label>
        <select
          id="gratis-slot"
          className="h-11 rounded-lg border border-input bg-surface-2 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={slotId ?? ""}
          onChange={(e) => {
            setSlotId(e.target.value ? Number(e.target.value) : null);
            setData(null);
            setVagas(null);
            setErro(null);
          }}
        >
          <option value="">Escolha um horário…</option>
          {[...slots]
            .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
            .map((s) => (
              <option key={s.slot_id} value={s.slot_id}>
                {nomeDia(s.dia_semana)} · {faixa(s)}
              </option>
            ))}
        </select>
      </div>

      {slot && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">2. Data</legend>
          <div className="flex flex-wrap gap-2">
            {datas.map((d) => (
              <label
                key={d}
                className={`flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                  data === d ? "border-accent bg-accent text-white" : "border-border bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name="gratis-data"
                  value={d}
                  checked={data === d}
                  onChange={() => {
                    setData(d);
                    setErro(null);
                  }}
                  className="sr-only"
                />
                {dataCurta(d)}
              </label>
            ))}
          </div>
          <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
            {consultando ? "Consultando vagas…" : vagas?.chave === chave ? vagas?.texto : ""}
          </p>
        </fieldset>
      )}

      {mensagemErro}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="h-11 sm:px-6"
          disabled={!podeConfirmar}
          onClick={() =>
            slotId && data && executar(() => acoes.agendarExperimental(slotId, data), () => setAberto(false))
          }
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" /> Agendando…
            </>
          ) : (
            <>
              <Halter /> Confirmar aula grátis
            </>
          )}
        </Button>
        <Button variant="outline" className="h-11" disabled={isPending} onClick={() => setAberto(false)}>
          <ArrowLeft data-icon="inline-start" />
          Voltar
        </Button>
      </div>
    </div>
  );
}
