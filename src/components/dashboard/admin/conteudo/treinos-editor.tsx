"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import {
  deleteTreino, moveTreino, saveTreino, setTreinoAtivo,
} from "@/app/dashboard/admin/conteudo-actions";
import type { Treino } from "@/app/dashboard/admin/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ICONE_OPTIONS, TreinoIcon } from "@/lib/treino-icones";
import { FieldSelect } from "../field-select";
import { EmptyNote, Panel } from "../section";
import { Tag } from "../tag";
import { toast } from "sonner";

function TreinoForm({ treino, onClose }: { treino: Treino | null; onClose: () => void }) {
  const [nome, setNome] = useState(treino?.nome ?? "");
  const [descricao, setDescricao] = useState(treino?.descricao ?? "");
  const [icone, setIcone] = useState(treino?.icone ?? "dumbbell");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nome.trim()) return setError("Informe o nome.");
    if (!descricao.trim()) return setError("Informe a descrição.");
    start(async () => {
      const res = await saveTreino({ id: treino?.id ?? null, nome, descricao, icone });
      if (res.ok) {
        toast.success(treino ? "Treino salvo." : "Treino criado.");
        onClose();
      }
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{treino ? "Editar treino" : "Novo treino"}</DialogTitle>
        <DialogDescription>Aparece na seção Modalidades da home.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="tr-nome">Nome</Label>
        <Input id="tr-nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} className="h-10 md:h-8" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tr-desc">Descrição curta</Label>
        <Textarea id="tr-desc" value={descricao} maxLength={200} rows={3} onChange={(e) => setDescricao(e.target.value)} />
        <p className="text-xs text-muted-foreground">{descricao.length}/200</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tr-icone">Ícone</Label>
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg border border-border">
            <TreinoIcon name={icone} className="size-5 text-accent" />
          </span>
          <FieldSelect id="tr-icone" value={icone} onValueChange={setIcone} options={ICONE_OPTIONS} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
        <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">{pending ? "Salvando…" : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}

function ConfirmDelete({ treino, onClose }: { treino: Treino; onClose: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function confirm() {
    setError("");
    start(async () => {
      const res = await deleteTreino(treino.id);
      if (res.ok) {
        toast.success(`Treino ${treino.nome} excluído.`);
        onClose();
      }
      else setError(res.message);
    });
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Excluir “{treino.nome}”?</DialogTitle>
        <DialogDescription>
          {treino.qtd_alunos > 0
            ? `${treino.qtd_alunos} ${treino.qtd_alunos === 1 ? "aluno está ligado" : "alunos estão ligados"} a este treino. A ligação some; os alunos não são afetados além disso.`
            : "Nenhum aluno está ligado a este treino."}{" "}
          Esta ação não pode ser desfeita. Para só esconder da home, use Desativar.
        </DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={confirm} className="min-h-11 md:min-h-8">
          <Trash2 data-icon="inline-start" />
          {pending ? "Excluindo…" : "Excluir"}
        </Button>
      </DialogFooter>
    </>
  );
}

function TreinoRow({
  treino, primeiro, ultimo, onEdit, onDelete,
}: { treino: Treino; primeiro: boolean; ultimo: boolean; onEdit: () => void; onDelete: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError("");
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.message ?? "Não foi possível concluir.");
    });
  }

  return (
    <li className={`rounded-xl border border-border bg-surface-2 p-4 ${treino.ativo ? "" : "opacity-60"}`}>
      <div className="flex items-start gap-3">
        <TreinoIcon name={treino.icone} aria-hidden className="mt-1 size-6 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{treino.nome}</p>
            {!treino.ativo && <Tag>Desativado</Tag>}
            <Tag className="font-medium text-muted-foreground">
              {treino.qtd_alunos} {treino.qtd_alunos === 1 ? "aluno" : "alunos"}
            </Tag>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{treino.descricao}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="icon-sm" variant="outline" disabled={pending || primeiro} onClick={() => run(() => moveTreino(treino.id, "up"))}
          className="min-h-11 min-w-11 md:min-h-7 md:min-w-7" aria-label={`Subir ${treino.nome}`}>
          <ArrowUp />
        </Button>
        <Button size="icon-sm" variant="outline" disabled={pending || ultimo} onClick={() => run(() => moveTreino(treino.id, "down"))}
          className="min-h-11 min-w-11 md:min-h-7 md:min-w-7" aria-label={`Descer ${treino.nome}`}>
          <ArrowDown />
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="min-h-11 md:min-h-7"><Pencil data-icon="inline-start" />Editar</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setTreinoAtivo(treino.id, !treino.ativo))} className="min-h-11 md:min-h-7">
          {treino.ativo ? <PowerOff data-icon="inline-start" /> : <Power data-icon="inline-start" />}
          {treino.ativo ? "Desativar" : "Ativar"}
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={onDelete} className="min-h-11 md:min-h-7"
          aria-label={`Excluir ${treino.nome}`}>
          <Trash2 data-icon="inline-start" />Excluir
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </li>
  );
}

export function TreinosEditor({ treinos }: { treinos: Treino[] }) {
  // undefined = fechado, null = novo, número = id em edição (ids evitam dado velho após revalidar).
  const [form, setForm] = useState<{ id: number | null } | undefined>();
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const editando = form?.id != null ? (treinos.find((t) => t.id === form.id) ?? null) : null;
  const excluindo = excluirId != null ? treinos.find((t) => t.id === excluirId) : undefined;

  return (
    <Panel aria-labelledby="treinos-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="treinos-title" className="text-3xl">Tipos de treino</h2>
          <p className="text-sm text-muted-foreground">
            Aparecem na home na ordem abaixo. Sempre fica pelo menos um treino ativo.
          </p>
        </div>
        <Button onClick={() => setForm({ id: null })} className="min-h-11 md:min-h-8"><Plus data-icon="inline-start" />Novo treino</Button>
      </div>
      {treinos.length === 0 ? (
        <EmptyNote>Nenhum tipo de treino cadastrado.</EmptyNote>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {treinos.map((t, i) => (
            // A key muda com ativo/ordem: a mensagem de erro some quando o treino muda de verdade.
            <TreinoRow key={`${t.id}-${t.ativo}-${t.ordem}`} treino={t} primeiro={i === 0} ultimo={i === treinos.length - 1}
              onEdit={() => setForm({ id: t.id })} onDelete={() => setExcluirId(t.id)} />
          ))}
        </ul>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(undefined)}>
        <DialogContent>
          {form && <TreinoForm key={form.id ?? "novo"} treino={editando} onClose={() => setForm(undefined)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!excluindo} onOpenChange={(o) => !o && setExcluirId(null)}>
        <DialogContent>
          {excluindo && <ConfirmDelete treino={excluindo} onClose={() => setExcluirId(null)} />}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
