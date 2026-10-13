"use client";

import { brl, DIAS, formatDate, hhmm } from "@/app/dashboard/admin/format";
import { formaLabel } from "@/app/dashboard/admin/types";
import { anamnesePreenchida, medidaLabel } from "@/lib/anamnese";
import type { AnamneseVisao, AvaliacaoVisao, MembroVisao, Visao } from "@/lib/offline/visao";
import { Button } from "@/components/ui/button";
import { VencimentoCell } from "../members-table";
import { EmptyNote, Panel } from "../section";
import { Tag } from "../tag";

const simNao = (v: boolean | null | undefined) => (v == null ? "Não informado" : v ? "Sim" : "Não");

function Item({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

export function Resumo({
  m, visao, anamnese, avaliacoes, irPara,
}: {
  m: MembroVisao;
  visao: Visao;
  anamnese: AnamneseVisao | undefined;
  avaliacoes: AvaliacaoVisao[];
  irPara: (aba: "anamnese" | "medidas") => void;
}) {
  const horarios = visao.slots
    .filter((s) => s.alunos.some((a) => a.member_id === m.member_id))
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));
  const treinos = visao.snapshot.treinos.filter((t) => m.treino_ids.includes(t.id));
  const pagamentos = visao.pagamentos.filter((p) => p.member_id === m.member_id).slice(0, 6);
  const ultima = avaliacoes[0];
  const cuidados = anamnese?.cuidados_treino?.trim();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel aria-labelledby="res-cuidados" className={cuidados ? "border-accent/70 lg:col-span-2" : "lg:col-span-2"}>
        <h3 id="res-cuidados" className="mb-2 font-display text-2xl">Cuidados no treino</h3>
        {cuidados ? (
          <p className="whitespace-pre-line break-words">{cuidados}</p>
        ) : anamnesePreenchida(anamnese) ? (
          <p className="text-sm text-muted-foreground">Nada anotado.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Anamnese não preenchida.</p>
            <Button size="sm" onClick={() => irPara("anamnese")} className="min-h-11 md:min-h-7">Preencher</Button>
          </div>
        )}
      </Panel>

      <Panel aria-labelledby="res-plano">
        <h3 id="res-plano" className="mb-3 font-display text-2xl">Plano</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Item titulo="Plano">{m.plano_nome ?? "Sem plano"}</Item>
          <Item titulo="Valor">
            {brl(m.valor)}
            {m.valor_acordado != null && <span className="text-xs text-muted-foreground"> (acordado)</span>}
          </Item>
          <Item titulo="Vencimento"><VencimentoCell m={m} /></Item>
          <Item titulo="Aluno desde">{m.desde ? formatDate(m.desde.slice(0, 10)) : "—"}</Item>
          <Item titulo="Autoriza imagem">{simNao(anamnese?.autoriza_imagem)}</Item>
          <Item titulo="Login Google">{m.tem_login ? "Sim" : "Não"}</Item>
        </dl>
      </Panel>

      <Panel aria-labelledby="res-horarios">
        <h3 id="res-horarios" className="mb-3 font-display text-2xl">Horários</h3>
        {horarios.length ? (
          <>
            <ul className="flex flex-wrap gap-2">
              {horarios.map((s) => (
                <li key={s.slot_id}>
                  <Tag className={s.ativo ? undefined : "opacity-60"}>
                    {DIAS[s.dia_semana]} {hhmm(s.hora_inicio)}{s.ativo ? "" : " (inativo)"}
                  </Tag>
                </li>
              ))}
            </ul>
            {m.vezes_semana != null && (
              <p className="mt-2 text-xs text-muted-foreground">{horarios.length} de {m.vezes_semana} do plano</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sem horário fixo.</p>
        )}
        {treinos.length > 0 && (
          <>
            <h4 className="mt-4 mb-2 text-xs text-muted-foreground">Tipos de treino</h4>
            <ul className="flex flex-wrap gap-2">
              {treinos.map((t) => <li key={t.id}><Tag className="font-medium">{t.nome}</Tag></li>)}
            </ul>
          </>
        )}
      </Panel>

      <Panel aria-labelledby="res-medidas">
        <h3 id="res-medidas" className="mb-3 font-display text-2xl">Medidas</h3>
        {ultima ? (
          <p className="text-sm">
            Peso {medidaLabel(ultima.peso_kg, "kg")} · cintura {medidaLabel(ultima.cintura_cm, "cm")}
            <span className="text-muted-foreground"> em {formatDate(ultima.data)}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação.</p>
        )}
        <Button size="sm" variant="outline" onClick={() => irPara("medidas")} className="mt-3 min-h-11 md:min-h-7">
          Ver medidas
        </Button>
      </Panel>

      <Panel aria-labelledby="res-pagamentos">
        <h3 id="res-pagamentos" className="mb-3 font-display text-2xl">Últimos pagamentos</h3>
        {pagamentos.length ? (
          <ul className="flex flex-col gap-2 text-sm">
            {pagamentos.map((p) => (
              <li key={p.fila_id ?? p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{formatDate(p.pago_em)} · {formaLabel(p.forma)}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  {p.erro ? <Tag hot title={p.erro}>Erro no envio</Tag> : p.pendente ? <Tag>Aguardando envio</Tag> : null}
                  {brl(p.valor)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote>Nenhum pagamento nos últimos 24 meses.</EmptyNote>
        )}
      </Panel>
    </div>
  );
}
