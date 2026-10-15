"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/app/dashboard/admin/format";

// Linha no tempo de uma medida (SVG desenhado na largura real do contêiner, para o texto não
// escalar). O eixo X é proporcional às datas: avaliações espaçadas aparecem espaçadas.
// Passar o mouse, tocar ou usar as setas (com o gráfico em foco) mostra o valor de cada data. O valor
// atual não vai na ponta da linha: quem usa o gráfico já o mostra em destaque no cabeçalho.

export type Ponto = { data: string; valor: number };

export const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dia = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000;

// Marcas "redondas" para o eixo Y: passo 1, 2, 2,5 ou 5 × 10^k.
function marcas(min: number, max: number, quantas: number) {
  const faixa = Math.max(max - min, 1);
  const bruto = faixa / Math.max(quantas - 1, 1);
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto) ?? 10 * pot;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const out: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) out.push(Math.round(v * 10) / 10);
  return out;
}

function useLargura() {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

export function GraficoLinha({
  pontos, unidade, rotulo, altura = 200, compacto = false,
}: {
  /** Em ordem de data, pelo menos dois. */
  pontos: Ponto[];
  unidade: string;
  rotulo: string;
  /** Altura total, incluindo a faixa das datas. */
  altura?: number;
  /** Versão pequena (vários gráficos lado a lado): margens menores e menos marcas no eixo. */
  compacto?: boolean;
}) {
  const [ref, w] = useLargura();
  const [ativo, setAtivo] = useState<number | null>(null);

  const m = compacto ? { t: 10, r: 12, b: 24, l: 36 } : { t: 22, r: 20, b: 26, l: 44 };
  const plotW = Math.max(w - m.l - m.r, 1);
  const plotH = altura - m.t - m.b;

  const valores = pontos.map((p) => p.valor);
  const ticks = marcas(Math.min(...valores), Math.max(...valores), compacto ? 3 : 4);
  const y0 = ticks[0];
  const y1 = ticks.at(-1)!;
  const y = (v: number) => m.t + plotH - ((v - y0) / (y1 - y0 || 1)) * plotH;

  const dias = pontos.map((p) => dia(p.data));
  const d0 = dias[0];
  const span = dias.at(-1)! - d0;
  // Todas na mesma data: espalha por ordem para não empilhar.
  const x = (i: number) => m.l + (span > 0 ? (dias[i] - d0) / span : i / Math.max(pontos.length - 1, 1)) * plotW;

  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join("");
  const area = `${linha}L${x(pontos.length - 1).toFixed(1)},${m.t + plotH}L${x(0).toFixed(1)},${m.t + plotH}Z`;

  // Datas no eixo: todas se couberem; senão a primeira e a última.
  const cabem = pontos.length * 46 <= plotW;
  const datasEixo = cabem ? pontos.map((_, i) => i) : [0, pontos.length - 1];

  function maisProximo(clientX: number, el: Element) {
    const px = clientX - el.getBoundingClientRect().left;
    let melhor = 0;
    for (let i = 1; i < pontos.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i;
    return melhor;
  }

  function teclado(e: React.KeyboardEvent) {
    const ult = pontos.length - 1;
    const atual = ativo ?? ult;
    const novo = { ArrowLeft: atual - 1, ArrowRight: atual + 1, Home: 0, End: ult }[e.key];
    if (novo === undefined) return;
    e.preventDefault();
    setAtivo(Math.min(ult, Math.max(0, novo)));
  }

  const primeiro = pontos[0];
  const ultimo = pontos.at(-1)!;
  const resumo = `${rotulo}: ${numero(primeiro.valor)} ${unidade} em ${formatDate(primeiro.data)} e ${numero(ultimo.valor)} ${unidade} em ${formatDate(ultimo.data)}, ${pontos.length} medições. Use as setas para ver cada data.`;
  const tip = ativo != null ? pontos[ativo] : null;

  return (
    <div ref={ref} className="relative w-full outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
      style={{ height: altura }} tabIndex={0} role="group" aria-label={resumo}
      onFocus={() => setAtivo((a) => a ?? pontos.length - 1)} onBlur={() => setAtivo(null)} onKeyDown={teclado}>
      {w > 0 && (
        <svg width={w} height={altura} aria-hidden className="block overflow-visible select-none"
          onPointerMove={(e) => setAtivo(maisProximo(e.clientX, e.currentTarget))}
          onPointerDown={(e) => setAtivo(maisProximo(e.clientX, e.currentTarget))}
          onPointerLeave={(e) => e.pointerType === "mouse" && setAtivo(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={m.l - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11}
                fill="var(--muted-foreground)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {numero(t)}
              </text>
            </g>
          ))}
          {datasEixo.map((i) => (
            <text key={i} x={x(i)} y={altura - 6} fontSize={11} fill="var(--muted-foreground)"
              textAnchor={i === 0 ? "start" : i === pontos.length - 1 ? "end" : "middle"}
              style={{ fontVariantNumeric: "tabular-nums" }}>
              {curta(pontos[i].data)}
            </text>
          ))}

          <path d={area} fill="var(--foreground)" opacity={0.07} />
          <path d={linha} fill="none" stroke="var(--foreground)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {tip && (
            <line x1={x(ativo!)} x2={x(ativo!)} y1={m.t} y2={m.t + plotH} stroke="var(--muted-foreground)" strokeWidth={1} />
          )}
          {pontos.map((p, i) => (
            <circle key={`${p.data}-${i}`} cx={x(i)} cy={y(p.valor)} r={i === ativo ? 6 : 4}
              fill={i === ativo ? "var(--accent)" : "var(--foreground)"} stroke="var(--surface)" strokeWidth={2} />
          ))}
          {/* Área de toque: o gráfico todo, não só a linha. */}
          <rect x={m.l} y={0} width={plotW} height={altura} fill="transparent" />
        </svg>
      )}
      {tip && w > 0 && (
        <div aria-hidden
          className="pointer-events-none absolute z-10 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
          // Dentro do gráfico, ao lado da linha vertical (do lado que tem mais espaço).
          style={x(ativo!) < w / 2
            ? { top: m.t, left: x(ativo!) + 10 }
            : { top: m.t, right: w - x(ativo!) + 10 }}>
          <p className="text-sm font-semibold text-foreground">{numero(tip.valor)} {unidade}</p>
          <p className="text-muted-foreground">{formatDate(tip.data)}</p>
        </div>
      )}
      {/* Leitor de tela: anuncia o ponto escolhido pelas setas. */}
      <p className="sr-only" aria-live="polite">{tip ? `${numero(tip.valor)} ${unidade} em ${formatDate(tip.data)}` : ""}</p>
    </div>
  );
}
