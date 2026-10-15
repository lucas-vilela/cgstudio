"use client";

import { MessageSquareQuote, Plus } from "lucide-react";
import { formatDate } from "@/app/dashboard/admin/format";
import { Dica } from "@/components/ajuda/dica";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MEDIDAS, medidaLabel, type CampoMedida } from "@/lib/anamnese";
import type { AvaliacaoVisao } from "@/lib/offline/visao";
import { EmptyNote, Panel } from "../section";
import { GraficoLinha, numero, type Ponto } from "./grafico-linha";

// Evolução das medidas ao longo das avaliações e as percepções do aluno.
// Peso: linha com destaque. Circunferências (todas em cm): variação desde a primeira em barras
// divergentes + uma linha pequena por medida, cada uma na própria escala. Tudo também em tabela.

const MENOS = "−";
const sinal = (d: number) => `${d > 0 ? "+" : d < 0 ? MENOS : ""}${numero(Math.abs(d))}`;
const CIRCUNFERENCIAS = MEDIDAS.filter((m) => m.unidade === "cm");

function serie(asc: AvaliacaoVisao[], campo: CampoMedida): Ponto[] {
  return asc.flatMap((a) => (a[campo] == null ? [] : [{ data: a.data, valor: a[campo]! }]));
}

function Delta({ pontos, unidade }: { pontos: Ponto[]; unidade: string }) {
  const d = Math.round((pontos.at(-1)!.valor - pontos[0].valor) * 10) / 10;
  return (
    <span className="text-xs text-muted-foreground">
      {d === 0 ? "igual" : `${sinal(d)} ${unidade}`} desde {formatDate(pontos[0].data)}
    </span>
  );
}

function Variacao({ itens }: { itens: { rotulo: string; unidade: string; pontos: Ponto[] }[] }) {
  const linhas = itens.map((i) => ({
    ...i,
    d: Math.round((i.pontos.at(-1)!.valor - i.pontos[0].valor) * 10) / 10,
  }));
  const maior = Math.max(...linhas.map((l) => Math.abs(l.d)), 0.1);
  return (
    <>
      <ul aria-label="Legenda" className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <i className="h-2.5 w-3 rounded-[2px] bg-[var(--viz-diminui)]" />Diminuiu
        </li>
        <li className="flex items-center gap-1.5">
          <i className="h-2.5 w-3 rounded-[2px] bg-[var(--viz-aumenta)]" />Aumentou
        </li>
      </ul>
      <ul className="flex flex-col gap-3">
        {linhas.map((l) => {
          const proporcao = Math.abs(l.d) / maior;
          // Barra cresce do zero (centro) até no máximo metade da trilha menos o espaço do rótulo.
          const largura = `calc((50% - 4rem) * ${proporcao})`;
          const ponta = `calc(50% + (50% - 4rem) * ${proporcao} + 0.375rem)`;
          return (
            <li key={l.rotulo} className="grid items-center gap-1 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] sm:gap-3">
              {/* Celular: nome em cima e barra na largura toda; a partir de sm, lado a lado. */}
              <div className="flex min-w-0 items-baseline justify-between gap-2 sm:block">
                <p className="truncate text-sm font-medium">{l.rotulo}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {numero(l.pontos[0].valor)} → {numero(l.pontos.at(-1)!.valor)} {l.unidade}
                </p>
              </div>
              <div className="relative h-7">
                <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-border" />
                {l.d !== 0 && (
                  <span aria-hidden
                    className={`absolute top-1/2 h-3.5 -translate-y-1/2 ${l.d < 0 ? "rounded-l-[4px] bg-[var(--viz-diminui)]" : "rounded-r-[4px] bg-[var(--viz-aumenta)]"}`}
                    style={l.d < 0 ? { right: "50%", width: largura } : { left: "50%", width: largura }} />
                )}
                <span className="absolute top-1/2 -translate-y-1/2 text-xs font-semibold whitespace-nowrap tabular-nums"
                  style={l.d < 0 ? { right: ponta } : l.d > 0 ? { left: ponta } : { left: "calc(50% + 0.375rem)" }}>
                  {l.d === 0 ? "igual" : `${sinal(l.d)} ${l.unidade}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Acompanhamento({
  avaliacoes, onNova,
}: { avaliacoes: AvaliacaoVisao[]; onNova: () => void }) {
  const asc = [...avaliacoes].sort((a, b) => a.data.localeCompare(b.data));
  const percepcoes = avaliacoes.filter((a) => a.percepcoes); // mais recente primeiro
  const peso = serie(asc, "peso_kg");
  const circ = CIRCUNFERENCIAS.map((m) => ({ ...m, pontos: serie(asc, m.campo) }));
  const comLinha = circ.filter((c) => c.pontos.length >= 2);
  const umaSo = circ.filter((c) => c.pontos.length === 1);

  if (!avaliacoes.length) {
    return (
      <Panel>
        <EmptyNote>Registre a primeira avaliação para começar o acompanhamento.</EmptyNote>
        <div className="flex justify-center">
          <Button onClick={onNova} className="min-h-11 md:min-h-8"><Plus data-icon="inline-start" />Nova avaliação</Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <p className="text-sm text-muted-foreground">
            {asc.length === 1
              ? `1 avaliação, em ${formatDate(asc[0].data)}`
              : `${asc.length} avaliações, de ${formatDate(asc[0].data)} a ${formatDate(asc.at(-1)!.data)}`}
          </p>
          <Dica titulo="Acompanhamento" className="-my-2">
            Os gráficos mostram cada medida ao longo das avaliações, com as datas na distância real entre elas.
            Passe o mouse ou toque no gráfico para ver o valor de cada data. As percepções vêm do campo livre da avaliação.
          </Dica>
        </div>
        <Button onClick={onNova} className="min-h-11 md:min-h-8"><Plus data-icon="inline-start" />Nova avaliação</Button>
      </div>

      {asc.length === 1 && (
        <Panel><EmptyNote>Os gráficos aparecem a partir da segunda avaliação.</EmptyNote></Panel>
      )}

      {peso.length >= 2 && (
        <Panel aria-labelledby="acomp-peso">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h3 id="acomp-peso" className="font-display text-2xl">Peso</h3>
            <p className="flex flex-col items-end">
              <span className="text-3xl font-semibold leading-none">{numero(peso.at(-1)!.valor)} kg</span>
              <Delta pontos={peso} unidade="kg" />
            </p>
          </div>
          <GraficoLinha pontos={peso} unidade="kg" rotulo="Peso" altura={220} />
        </Panel>
      )}

      {comLinha.length > 0 && (
        <Panel aria-labelledby="acomp-variacao">
          <h3 id="acomp-variacao" className="font-display text-2xl">Variação das medidas</h3>
          <p className="mb-3 text-sm text-muted-foreground">Da primeira para a última medição de cada uma.</p>
          <Variacao itens={comLinha} />
        </Panel>
      )}

      {comLinha.length > 0 && (
        <Panel aria-labelledby="acomp-circ">
          <h3 id="acomp-circ" className="font-display text-2xl">Circunferências</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Cada gráfico tem a própria escala, para mostrar a tendência de cada medida.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comLinha.map((c) => (
              <li key={c.campo} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{c.rotulo}</p>
                  <p className="flex flex-col items-end">
                    <span className="font-semibold">{numero(c.pontos.at(-1)!.valor)} cm</span>
                    <Delta pontos={c.pontos} unidade="cm" />
                  </p>
                </div>
                <GraficoLinha pontos={c.pontos} unidade="cm" rotulo={c.rotulo} altura={130} compacto />
              </li>
            ))}
          </ul>
          {umaSo.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Com uma medição só (gráfico a partir da segunda):{" "}
              {umaSo.map((c) => `${c.rotulo} ${medidaLabel(c.pontos[0].valor, "cm")}`).join(" · ")}.
            </p>
          )}
        </Panel>
      )}

      <Panel aria-labelledby="acomp-percepcoes">
        <h3 id="acomp-percepcoes" className="font-display text-2xl">Percepções do aluno</h3>
        <p className="mb-3 text-sm text-muted-foreground">O que o aluno sente que mudou e a fita não mede.</p>
        {percepcoes.length === 0 ? (
          <EmptyNote>
            Nenhuma percepção registrada. Na próxima avaliação, preencha “Percepções do aluno”.
          </EmptyNote>
        ) : (
          <ol className="flex flex-col gap-3">
            {percepcoes.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-lg border border-border bg-surface-2 p-3">
                <MessageSquareQuote aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{formatDate(a.data)}</p>
                  <p className="mt-1 text-sm break-words whitespace-pre-line">{a.percepcoes}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {asc.length >= 2 && (
        <details className="group rounded-xl border border-border bg-surface p-4 md:p-5">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold md:min-h-0">
            Ver todas as medidas em tabela
          </summary>
          <div className="mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {MEDIDAS.map((m) => <TableHead key={m.campo} className="text-right">{m.rotulo}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {asc.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">{formatDate(a.data)}</TableCell>
                    {MEDIDAS.map((m) => (
                      <TableCell key={m.campo} className="text-right tabular-nums">{medidaLabel(a[m.campo], m.unidade)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      )}
    </div>
  );
}
