"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { createPlano, deletePlano, movePlano, updatePlano } from "@/app/dashboard/admin/conteudo-actions";
import { moneyInput, parseMoney } from "@/app/dashboard/admin/format";
import type { Plan, PlanoTipo } from "@/app/dashboard/admin/types";
import { descricaoPadrao, NOME_TIPO } from "@/lib/planos";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FieldSelect } from "../field-select";
import { EmptyNote, Panel } from "../section";
import { Tag } from "../tag";
import { toast } from "sonner";
import { Dica } from "@/components/ajuda/dica";

const TIPOS = [
  { value: "mensal", label: "Plano mensal" },
  { value: "trimestral", label: "Plano trimestral" },
  { value: "avulsa", label: "Aula avulsa (só na home)" },
];

const ROTULO_VALOR: Record<PlanoTipo, string> = {
  mensal: "Valor por mês (R$)",
  trimestral: "Valor do trimestre (R$)",
  avulsa: "Valor por aula (R$)",
};

type Msg = { ok: boolean; text: string } | null;

// Campos de um plano. `plano` null = novo. Usado no cartão (editar) e no diálogo (criar).
function usePlanoForm(plano: Plan | null) {
  const [tipo, setTipo] = useState<PlanoTipo>(plano?.tipo ?? "mensal");
  const [nome, setNome] = useState(plano?.nome ?? "");
  const [vezes, setVezes] = useState(String(plano?.vezes_semana ?? 1));
  const [valor, setValor] = useState(plano ? moneyInput(plano.valor_padrao) : "");
  const [descricao, setDescricao] = useState(plano?.descricao ?? "");
  const [exibir, setExibir] = useState(plano?.exibir_na_home ?? true);

  const avulsa = tipo === "avulsa";

  function parse(): { error: string } | {
    nome: string; tipo: PlanoTipo; vezesSemana: number; valorPadrao: number; descricao: string; exibirNaHome: boolean;
  } {
    const valorPadrao = parseMoney(valor);
    if (valorPadrao === null || Number.isNaN(valorPadrao)) return { error: "Informe um valor válido." };
    const vezesSemana = avulsa ? 1 : Number(vezes);
    if (!Number.isInteger(vezesSemana) || vezesSemana < 1 || vezesSemana > 7)
      return { error: "Aulas por semana deve ser de 1 a 7." };
    if (!nome.trim()) return { error: "Informe o nome do plano." };
    return { nome, tipo, vezesSemana, valorPadrao, descricao, exibirNaHome: exibir };
  }

  function campos(prefixo: string) {
    return (
      <>
        <div className="grid gap-1.5">
          <div className="flex items-center gap-1">
            <Label htmlFor={`${prefixo}-tipo`}>Tipo</Label>
            <Dica titulo="Tipos de plano" className="-my-2">
              Mensal: o pagamento soma 1 mês ao vencimento. Trimestral: o valor é o do trimestre e o pagamento
              soma 3 meses. Aula avulsa: aparece só na home, com o preço por aula; não é plano de aluno, então
              não aparece no cadastro nem na cobrança.
            </Dica>
          </div>
          <FieldSelect id={`${prefixo}-tipo`} value={tipo} onValueChange={(v) => setTipo(v as PlanoTipo)}
            options={TIPOS} />
        </div>
        <div className={avulsa ? "grid gap-3" : "grid grid-cols-[1fr_7rem] gap-3"}>
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefixo}-nome`}>Nome</Label>
            <Input id={`${prefixo}-nome`} value={nome} maxLength={30} placeholder={avulsa ? "Ex.: Avulsa" : "Ex.: 4x"}
              onChange={(e) => setNome(e.target.value)} className="h-10 md:h-8" />
          </div>
          {!avulsa && (
            <div className="grid gap-1.5">
              <Label htmlFor={`${prefixo}-vezes`}>Aulas/semana</Label>
              <Input id={`${prefixo}-vezes`} type="number" min={1} max={7} value={vezes}
                onChange={(e) => setVezes(e.target.value)} className="h-10 md:h-8" />
            </div>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefixo}-valor`}>{ROTULO_VALOR[tipo]}</Label>
          <Input id={`${prefixo}-valor`} inputMode="decimal" value={valor} placeholder="0,00"
            onChange={(e) => setValor(e.target.value)} className="h-10 md:h-8" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefixo}-desc`}>Descrição (opcional)</Label>
          <Input id={`${prefixo}-desc`} value={descricao} maxLength={120}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={descricaoPadrao({ tipo, vezes_semana: Number(vezes) || 1 })} className="h-10 md:h-8" />
        </div>
        <div className="flex min-h-11 items-center gap-3">
          <Switch id={`${prefixo}-home`} checked={exibir} onCheckedChange={setExibir}
            aria-label="Mostrar este plano na home" />
          <Label htmlFor={`${prefixo}-home`}>Mostrar na home</Label>
          <Dica titulo="Plano na página inicial" className="-ml-2">
            {avulsa
              ? "Desligado, a aula avulsa some da página inicial."
              : "Desligado, o plano some da página inicial mas continua disponível para cadastrar e cobrar alunos."}
          </Dica>
        </div>
      </>
    );
  }

  return { parse, campos, vezes, avulsa };
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

function PlanoCard({ plano, primeiro, ultimo }: { plano: Plan; primeiro: boolean; ultimo: boolean }) {
  const form = usePlanoForm(plano);
  const [msg, setMsg] = useState<Msg>(null);
  const [emUso, setEmUso] = useState<{ alunos: string[]; total: number } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [pending, start] = useTransition();
  const reduziu = !form.avulsa && plano.tipo !== "avulsa" && Number(form.vezes) < plano.vezes_semana;

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

  function mover(direcao: "up" | "down") {
    setMsg(null);
    start(async () => {
      const res = await movePlano(plano.id, direcao);
      if (!res.ok) setMsg({ ok: false, text: res.message });
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
        <div className="flex items-center gap-2">
          <Button type="button" size="icon-sm" variant="outline" disabled={pending || primeiro} onClick={() => mover("up")}
            className="min-h-11 min-w-11 md:min-h-7 md:min-w-7" aria-label={`Subir ${plano.nome}`}>
            <ArrowUp />
          </Button>
          <Button type="button" size="icon-sm" variant="outline" disabled={pending || ultimo} onClick={() => mover("down")}
            className="min-h-11 min-w-11 md:min-h-7 md:min-w-7" aria-label={`Descer ${plano.nome}`}>
            <ArrowDown />
          </Button>
          <Tag className="ml-auto">{NOME_TIPO[plano.tipo] ?? NOME_TIPO.mensal}</Tag>
          {!plano.exibir_na_home && <Tag>Fora da home</Tag>}
        </div>
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
        <DialogDescription>
          Aulas por semana é o limite de horários fixos de quem tiver o plano. Aula avulsa só aparece na home.
        </DialogDescription>
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
          <div className="flex items-center gap-1">
            <h2 id="planos-title" className="text-3xl">Planos</h2>
            <Dica titulo="Ordem dos planos">
              Use as setas para mudar a ordem em que os planos aparecem na home.
            </Dica>
          </div>
          <p className="text-sm text-muted-foreground">
            Aparecem na home na ordem abaixo. O valor padrão é o mesmo usado na cobrança: mudar aqui muda a home e
            as próximas cobranças de quem não tem valor acordado. Pagamentos já registrados não mudam.
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
          {planos.map((p, i) => (
            // Reinicia o formulário quando o servidor devolve dados novos. A ordem fica fora da key:
            // mover um plano não apaga o que está sendo digitado nos outros.
            <PlanoCard
              key={`${p.id}-${p.nome}-${p.tipo}-${p.vezes_semana}-${p.valor_padrao}-${p.descricao}-${p.exibir_na_home}`}
              plano={p} primeiro={i === 0} ultimo={i === planos.length - 1}
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
