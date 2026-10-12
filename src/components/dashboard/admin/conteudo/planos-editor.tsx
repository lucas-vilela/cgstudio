"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createPlano, deletePlano, updatePlano } from "@/app/dashboard/admin/conteudo-actions";
import { moneyInput, parseMoney } from "@/app/dashboard/admin/format";
import type { Plan } from "@/app/dashboard/admin/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyNote, Panel } from "../section";
import { toast } from "sonner";

const aulas = (n: number) => `${n} ${n === 1 ? "aula" : "aulas"} por semana`;

type Msg = { ok: boolean; text: string } | null;

// Campos de um plano. `plano` null = novo. Usado no cartão (editar) e no diálogo (criar).
function usePlanoForm(plano: Plan | null) {
  const [nome, setNome] = useState(plano?.nome ?? "");
  const [vezes, setVezes] = useState(String(plano?.vezes_semana ?? 1));
  const [valor, setValor] = useState(plano ? moneyInput(plano.valor_padrao) : "");
  const [descricao, setDescricao] = useState(plano?.descricao ?? "");
  const [exibir, setExibir] = useState(plano?.exibir_na_home ?? true);

  function parse(): { error: string } | {
    nome: string; vezesSemana: number; valorPadrao: number; descricao: string; exibirNaHome: boolean;
  } {
    const valorPadrao = parseMoney(valor);
    if (valorPadrao === null || Number.isNaN(valorPadrao)) return { error: "Informe um valor válido." };
    const vezesSemana = Number(vezes);
    if (!Number.isInteger(vezesSemana) || vezesSemana < 1 || vezesSemana > 7)
      return { error: "Aulas por semana deve ser de 1 a 7." };
    if (!nome.trim()) return { error: "Informe o nome do plano." };
    return { nome, vezesSemana, valorPadrao, descricao, exibirNaHome: exibir };
  }

  function campos(prefixo: string) {
    return (
      <>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefixo}-nome`}>Nome</Label>
            <Input id={`${prefixo}-nome`} value={nome} maxLength={30} placeholder="Ex.: 4x"
              onChange={(e) => setNome(e.target.value)} className="h-10 md:h-8" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefixo}-vezes`}>Aulas/semana</Label>
            <Input id={`${prefixo}-vezes`} type="number" min={1} max={7} value={vezes}
              onChange={(e) => setVezes(e.target.value)} className="h-10 md:h-8" />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefixo}-valor`}>Valor padrão (R$)</Label>
          <Input id={`${prefixo}-valor`} inputMode="decimal" value={valor} placeholder="0,00"
            onChange={(e) => setValor(e.target.value)} className="h-10 md:h-8" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefixo}-desc`}>Descrição (opcional)</Label>
          <Input id={`${prefixo}-desc`} value={descricao} maxLength={120}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={aulas(Number(vezes) || 1)} className="h-10 md:h-8" />
        </div>
        <div className="flex min-h-11 items-center gap-3">
          <Switch id={`${prefixo}-home`} checked={exibir} onCheckedChange={setExibir}
            aria-label="Mostrar este plano na home" />
          <Label htmlFor={`${prefixo}-home`}>Mostrar na home</Label>
        </div>
      </>
    );
  }

  return { parse, campos, vezes };
}

function Status({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"}
      className={msg.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
      {msg.text}
    </p>
  );
}

function PlanoCard({ plano }: { plano: Plan }) {
  const form = usePlanoForm(plano);
  const [msg, setMsg] = useState<Msg>(null);
  const [emUso, setEmUso] = useState<{ alunos: string[]; total: number } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();
  const reduziu = Number(form.vezes) < plano.vezes_semana;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const dados = form.parse();
    if ("error" in dados) return setMsg({ ok: false, text: dados.error });
    start(async () => {
      const res = await updatePlano({ id: plano.id, ...dados });
      if (res.ok) toast.success(`Plano ${dados.nome.trim()} salvo.`);
      setMsg(res.ok ? null : { ok: false, text: res.message });
    });
  }

  function excluir() {
    setMsg(null);
    setEmUso(null);
    if (!confirmar) return setConfirmar(true);
    start(async () => {
      const res = await deletePlano(plano.id);
      setConfirmar(false);
      if (!res.ok) return setMsg({ ok: false, text: res.message });
      if (res.data.excluido) toast.success(`Plano ${plano.nome} excluído.`);
      else setEmUso({ alunos: res.data.alunos, total: res.data.total });
    });
  }

  return (
    <li className="rounded-xl border border-border bg-surface-2 p-4">
      <form onSubmit={submit} className="grid gap-3" noValidate>
        {form.campos(`pl-${plano.id}`)}
        {reduziu && (
          <p className="text-xs text-muted-foreground">
            Quem já está em mais horários que o novo limite continua neles; o limite vale para entrar em
            horários novos.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">
            <Save data-icon="inline-start" />
            {pending ? "Salvando…" : "Salvar"}
          </Button>
          {/* Excluir não tem volta: o primeiro clique só pede confirmação. */}
          <Button type="button" variant="destructive" disabled={pending} onClick={excluir}
            onBlur={() => setConfirmar(false)} className="min-h-11 md:min-h-8"
            aria-label={confirmar ? `Confirmar exclusão do plano ${plano.nome}` : `Excluir o plano ${plano.nome}`}>
            <Trash2 data-icon="inline-start" />
            {confirmar ? "Confirmar exclusão" : "Excluir"}
          </Button>
        </div>
        <Status msg={msg} />
        {emUso && (
          <div role="alert" className="rounded-lg border border-accent/60 p-3 text-sm">
            <p className="font-medium">
              Não dá para excluir: {emUso.total} {emUso.total === 1 ? "aluno usa" : "alunos usam"} este plano.
            </p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {emUso.alunos.map((n, i) => <li key={`${i}-${n}`}>{n}</li>)}
            </ul>
            {emUso.total > emUso.alunos.length && (
              <p className="mt-1 text-muted-foreground">e mais {emUso.total - emUso.alunos.length}.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Troque o plano deles em Alunos e tente de novo.</p>
          </div>
        )}
      </form>
    </li>
  );
}

function NovoPlano({ onClose }: { onClose: () => void }) {
  const form = usePlanoForm(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const dados = form.parse();
    if ("error" in dados) return setMsg({ ok: false, text: dados.error });
    start(async () => {
      const res = await createPlano(dados);
      if (res.ok) {
        toast.success(`Plano ${dados.nome.trim()} criado.`);
        onClose();
      }
      else setMsg({ ok: false, text: res.message });
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Novo plano</DialogTitle>
        <DialogDescription>Aulas por semana é o limite de horários fixos de quem tiver o plano.</DialogDescription>
      </DialogHeader>
      {form.campos("novo-plano")}
      <Status msg={msg} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
        <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">{pending ? "Criando…" : "Criar plano"}</Button>
      </DialogFooter>
    </form>
  );
}

export function PlanosEditor({ planos }: { planos: Plan[] }) {
  const [novo, setNovo] = useState(false);
  return (
    <Panel aria-labelledby="planos-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="planos-title" className="text-3xl">Planos</h2>
          <p className="text-sm text-muted-foreground">
            O valor padrão é o mesmo usado na cobrança: mudar aqui muda a home e as próximas cobranças de quem
            não tem valor acordado. Pagamentos já registrados não mudam.
          </p>
        </div>
        <Button onClick={() => setNovo(true)} className="min-h-11 md:min-h-8">
          <Plus data-icon="inline-start" />Novo plano
        </Button>
      </div>
      {planos.length === 0 ? (
        <EmptyNote>Nenhum plano cadastrado.</EmptyNote>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {planos.map((p) => (
            // Reinicia o formulário quando o servidor devolve dados novos.
            <PlanoCard
              key={`${p.id}-${p.nome}-${p.vezes_semana}-${p.valor_padrao}-${p.descricao}-${p.exibir_na_home}`}
              plano={p}
            />
          ))}
        </ul>
      )}
      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>{novo && <NovoPlano onClose={() => setNovo(false)} />}</DialogContent>
      </Dialog>
    </Panel>
  );
}
