"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { excluirAvaliacao } from "@/app/dashboard/admin/actions";
import { formatDate, todayISO } from "@/app/dashboard/admin/format";
import {
  MEDIDAS, medidaInput, medidaLabel, parseMedida, validarAvaliacao, type CampoMedida,
} from "@/lib/anamnese";
import { atualizar, corrigir, descartar, enfileirar, novoId } from "@/lib/offline/store";
import type { ItemFila } from "@/lib/offline/tipos";
import { msgGuardado, useAdminEstado } from "@/lib/offline/use-admin";
import type { AvaliacaoVisao } from "@/lib/offline/visao";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyNote, Panel } from "../section";
import { Tag } from "../tag";

type ItemAvaliacao = Extract<ItemFila, { tipo: "avaliacao_salvar" }>;

// Criar (avaliacao = null) e corrigir. Corrigir usa o mesmo id: no servidor é upsert; se a avaliação
// ainda está na fila, o item da fila é substituído em vez de criar outro.
export function AvaliacaoForm({
  memberId, nome, avaliacao, naServidor, onClose,
}: {
  memberId: string;
  nome: string | null;
  avaliacao: AvaliacaoVisao | null;
  naServidor: boolean;
  onClose: () => void;
}) {
  const { online, fila } = useAdminEstado();
  const hoje = todayISO();
  const [data, setData] = useState(avaliacao?.data ?? hoje);
  const [valores, setValores] = useState<Record<CampoMedida, string>>(
    () => Object.fromEntries(MEDIDAS.map((m) => [m.campo, medidaInput(avaliacao?.[m.campo] ?? null)])) as Record<CampoMedida, string>,
  );
  const [observacao, setObservacao] = useState(avaliacao?.observacao ?? "");
  const [percepcoes, setPercepcoes] = useState(avaliacao?.percepcoes ?? "");
  const [erro, setErro] = useState("");
  const [pendente, setPendente] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const naFila = avaliacao
    ? fila.filter((i): i is ItemAvaliacao => i.tipo === "avaliacao_salvar" && i.payload.id === avaliacao.id)
    : [];

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const medidas = {} as Record<CampoMedida, number | null>;
    for (const m of MEDIDAS) {
      const v = parseMedida(valores[m.campo]);
      if (Number.isNaN(v)) return setErro(`${m.rotulo}: use só números, com até uma casa decimal (ex.: 78,5).`);
      medidas[m.campo] = v;
    }
    const v = validarAvaliacao(
      { id: avaliacao?.id ?? novoId(), member_id: memberId, data, ...medidas, observacao, percepcoes },
      hoje,
    );
    if ("error" in v) return setErro(v.error);

    setPendente(true);
    const ultimo = naFila.at(-1);
    const guardou = ultimo
      ? await corrigir(ultimo.id, v.data)
      : (await enfileirar({ tipo: "avaliacao_salvar", payload: v.data })) !== null;
    setPendente(false);
    if (!guardou) return setErro("Não foi possível guardar neste aparelho. Tente de novo; se continuar, recarregue a página.");
    toast.success(msgGuardado(online, avaliacao ? "Medidas corrigidas" : "Medidas registradas"));
    onClose();
  }

  async function excluir() {
    if (!avaliacao) return;
    if (naServidor && !online) return setErro("Excluir uma avaliação já enviada precisa de conexão.");
    if (!confirmarExclusao) return setConfirmarExclusao(true);
    setPendente(true);
    for (const i of naFila) await descartar(i.id);
    if (naServidor) {
      const res = await excluirAvaliacao(avaliacao.id);
      if (!res.ok) {
        setPendente(false);
        return setErro(res.message);
      }
      await atualizar();
    }
    setPendente(false);
    toast.success("Avaliação excluída.");
    onClose();
  }

  return (
    <form onSubmit={salvar} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{avaliacao ? "Corrigir medidas" : "Nova avaliação"}</DialogTitle>
        <DialogDescription>{nome ?? "Aluno"} · preencha o que foi medido; o resto pode ficar vazio.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="av-data">Data</Label>
        <Input id="av-data" type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)}
          className="h-10 w-full sm:w-48 md:h-8" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {MEDIDAS.map((m) => (
          <div key={m.campo} className="grid gap-1.5">
            <Label htmlFor={`av-${m.campo}`}>{m.rotulo} ({m.unidade})</Label>
            <Input id={`av-${m.campo}`} inputMode="decimal" autoComplete="off" value={valores[m.campo]}
              onChange={(e) => setValores((cur) => ({ ...cur, [m.campo]: e.target.value }))}
              className="h-10 md:h-8" />
          </div>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="av-obs">Observação (opcional)</Label>
        <Textarea id="av-obs" value={observacao} maxLength={500} onChange={(e) => setObservacao(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="av-percepcoes">Percepções do aluno (opcional)</Label>
        <Textarea id="av-percepcoes" value={percepcoes} maxLength={1000} rows={4}
          onChange={(e) => setPercepcoes(e.target.value)} aria-describedby="av-percepcoes-ajuda"
          placeholder="Ex.: dorme melhor, sobe escada sem cansar, a dor no ombro voltou…" />
        <p id="av-percepcoes-ajuda" className="text-xs text-muted-foreground">
          O que o aluno sente que melhorou ou piorou e a fita não mede. Aparece em Acompanhamento.
        </p>
      </div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter className="sm:justify-between">
        {avaliacao ? (
          // Excluir não tem volta: o primeiro clique só pede confirmação.
          <Button type="button" variant="destructive" disabled={pendente} onClick={() => void excluir()}
            onBlur={() => setConfirmarExclusao(false)} className="min-h-11 md:min-h-8">
            <Trash2 data-icon="inline-start" />
            {confirmarExclusao ? "Confirmar exclusão" : "Excluir"}
          </Button>
        ) : <span />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
          <Button type="submit" disabled={pendente} className="min-h-11 md:min-h-8">
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

const MENOS = "−";
function diferenca(atual: number | null, primeira: number | null, unidade: string) {
  if (atual == null || primeira == null) return null;
  const d = Math.round((atual - primeira) * 10) / 10;
  if (d === 0) return `igual`;
  return `${d > 0 ? "+" : MENOS}${String(Math.abs(d)).replace(".", ",")} ${unidade}`;
}

const marcaEnvio = (a: AvaliacaoVisao) =>
  a.erro ? <Tag hot title={a.erro}>Erro no envio</Tag> : a.pendente ? <Tag>Aguardando envio</Tag> : null;

export function Medidas({
  memberId, nome, avaliacoes, doServidor,
}: { memberId: string; nome: string | null; avaliacoes: AvaliacaoVisao[]; doServidor: Set<string> }) {
  // undefined = fechado, null = nova, AvaliacaoVisao = corrigir.
  const [editando, setEditando] = useState<AvaliacaoVisao | null | undefined>(undefined);
  const ultima = avaliacoes[0];
  const primeira = avaliacoes.at(-1);
  const comparar = avaliacoes.length > 1 && primeira && ultima;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {avaliacoes.length
            ? `${avaliacoes.length} ${avaliacoes.length === 1 ? "avaliação" : "avaliações"}`
            : "Nenhuma avaliação ainda."}
        </p>
        <Button onClick={() => setEditando(null)} className="min-h-11 md:min-h-8">
          <Plus data-icon="inline-start" />Nova avaliação
        </Button>
      </div>

      {ultima ? (
        <Panel aria-labelledby="medidas-ultima">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 id="medidas-ultima" className="font-display text-2xl">Última · {formatDate(ultima.data)}</h3>
            {marcaEnvio(ultima)}
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MEDIDAS.map((m) => {
              const dif = comparar ? diferenca(ultima[m.campo], primeira[m.campo], m.unidade) : null;
              return (
                <div key={m.campo} className="rounded-lg border border-border bg-surface-2 p-3">
                  <dt className="text-xs text-muted-foreground">{m.rotulo}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{medidaLabel(ultima[m.campo], m.unidade)}</dd>
                  {dif && (
                    <dd className="text-xs text-muted-foreground tabular-nums">
                      {dif} desde {formatDate(primeira?.data)}
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
          {ultima.observacao && <p className="mt-3 text-sm text-muted-foreground">{ultima.observacao}</p>}
          {ultima.percepcoes && (
            <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted-foreground">Percepções do aluno</p>
              <p className="mt-1 text-sm whitespace-pre-line">{ultima.percepcoes}</p>
            </div>
          )}
        </Panel>
      ) : (
        <Panel><EmptyNote>Registre a avaliação física inicial para comparar depois.</EmptyNote></Panel>
      )}

      {avaliacoes.length > 0 && (
        <Panel aria-labelledby="medidas-todas">
          <h3 id="medidas-todas" className="mb-3 font-display text-2xl">Todas as avaliações</h3>
          <ul className="flex flex-col gap-2">
            {avaliacoes.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {formatDate(a.data)}
                    {a.id === primeira?.id && avaliacoes.length > 1 && <Tag>Inicial</Tag>}
                    {marcaEnvio(a)}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {MEDIDAS.filter((m) => a[m.campo] != null)
                      .map((m) => `${m.rotulo} ${medidaLabel(a[m.campo], m.unidade)}`)
                      .join(" · ")}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditando(a)} className="min-h-11 shrink-0 md:min-h-7"
                  aria-label={`Corrigir avaliação de ${formatDate(a.data)}`}>
                  <Pencil data-icon="inline-start" />Corrigir
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Dialog open={editando !== undefined} onOpenChange={(o) => !o && setEditando(undefined)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {editando !== undefined && (
            <AvaliacaoForm key={editando?.id ?? "nova"} memberId={memberId} nome={nome} avaliacao={editando}
              naServidor={!!editando && doServidor.has(editando.id)} onClose={() => setEditando(undefined)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
