"use client";

import { useState, useTransition } from "react";
import { Check, EyeOff, Eye, Pencil, Trash2, X } from "lucide-react";
import { editarDepoimento, moderarDepoimento } from "@/app/dashboard/admin/conteudo-actions";
import { formatDate } from "@/app/dashboard/admin/format";
import type { DepoimentoAdmin } from "@/app/dashboard/admin/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyNote, Panel } from "../section";
import { Tag } from "../tag";
import { toast } from "sonner";
import { Dica } from "@/components/ajuda/dica";

type Acao = "aprovar" | "recusar" | "esconder" | "mostrar" | "excluir";

const ACAO_MSG: Record<Acao, string> = {
  aprovar: "Depoimento publicado na home.",
  recusar: "Depoimento recusado.",
  esconder: "Depoimento escondido da home.",
  mostrar: "Depoimento de volta na home.",
  excluir: "Depoimento excluído.",
};

function EditarTexto({ item, onClose }: { item: DepoimentoAdmin; onClose: () => void }) {
  const [texto, setTexto] = useState(item.texto);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (texto.trim() === item.texto.trim()) return onClose();
    start(async () => {
      const res = await editarDepoimento(item.id, texto);
      if (res.ok) {
        toast.success("Texto do depoimento ajustado.");
        onClose();
      }
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Ajustar depoimento</DialogTitle>
        <DialogDescription>
          O texto abaixo substitui o enviado por {item.aluno_nome ?? "o aluno"}. Ele verá que foi ajustado.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="dp-texto">Texto</Label>
        <Textarea id="dp-texto" rows={6} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <p className="text-xs text-muted-foreground">{texto.length}/500</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
        <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">{pending ? "Salvando…" : "Salvar texto"}</Button>
      </DialogFooter>
    </form>
  );
}

function Item({ item, onEdit }: { item: DepoimentoAdmin; onEdit: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const nome = item.aluno_nome ?? "Aluno sem nome";

  function run(acao: Acao) {
    setError("");
    start(async () => {
      const res = await moderarDepoimento(item.id, acao);
      if (!res.ok) setError(res.message);
      else toast.success(ACAO_MSG[acao]);
    });
  }

  const btn = "min-h-11 md:min-h-7";
  return (
    <li className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{nome}</p>
        {/* Destaque para o admin decidir se revisa o depoimento de quem saiu. */}
        {item.aluno_status === "inativo" && <Tag hot>Aluno inativo</Tag>}
        {item.aluno_status === "pendente" && <Tag>Aluno pendente</Tag>}
        {item.ajustado_pelo_admin && <Tag>Ajustado</Tag>}
        <span className="text-xs text-muted-foreground">
          Na home como “{item.nome_exibicao}” · {formatDate(item.updated_at)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{item.texto}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(item.status === "pendente" || item.status === "recusado") && (
          <Button size="sm" disabled={pending} onClick={() => run("aprovar")} className={btn}
            aria-label={`Aprovar depoimento de ${nome}`}>
            <Check data-icon="inline-start" />Aprovar
          </Button>
        )}
        {item.status === "pendente" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("recusar")} className={btn}
            aria-label={`Recusar depoimento de ${nome}`}>
            <X data-icon="inline-start" />Recusar
          </Button>
        )}
        {item.status === "aprovado" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("esconder")} className={btn}
            aria-label={`Esconder depoimento de ${nome}`}>
            <EyeOff data-icon="inline-start" />Esconder
          </Button>
        )}
        {item.status === "oculto" && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run("mostrar")} className={btn}
            aria-label={`Mostrar depoimento de ${nome}`}>
            <Eye data-icon="inline-start" />Mostrar
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={onEdit} className={btn}
          aria-label={`Ajustar texto de ${nome}`}>
          <Pencil data-icon="inline-start" />Ajustar texto
        </Button>
        {(item.status === "recusado" || item.status === "oculto") && (
          // Excluir não tem volta: o primeiro clique só pede confirmação.
          <Button size="sm" variant="destructive" disabled={pending}
            onClick={() => (confirmarExclusao ? run("excluir") : setConfirmarExclusao(true))}
            onBlur={() => setConfirmarExclusao(false)} className={btn}
            aria-label={confirmarExclusao ? `Confirmar exclusão do depoimento de ${nome}` : `Excluir depoimento de ${nome}`}>
            <Trash2 data-icon="inline-start" />{confirmarExclusao ? "Confirmar exclusão" : "Excluir"}
          </Button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </li>
  );
}

function Grupo({
  titulo, itens, vazio, onEdit,
}: { titulo: string; itens: DepoimentoAdmin[]; vazio: string; onEdit: (id: number) => void }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-2xl">{titulo} <span className="text-base text-muted-foreground">({itens.length})</span></h3>
      {itens.length === 0 ? (
        <EmptyNote>{vazio}</EmptyNote>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {itens.map((d) => <Item key={`${d.id}-${d.updated_at}`} item={d} onEdit={() => onEdit(d.id)} />)}
        </ul>
      )}
    </section>
  );
}

export function DepoimentosModeracao({ depoimentos }: { depoimentos: DepoimentoAdmin[] }) {
  const [editId, setEditId] = useState<number | null>(null);
  const editando = editId != null ? depoimentos.find((d) => d.id === editId) : undefined;
  const por = (...s: DepoimentoAdmin["status"][]) => depoimentos.filter((d) => s.includes(d.status));

  return (
    <Panel aria-labelledby="dep-title" className="grid gap-6">
      <div>
        <div className="flex items-center gap-1">
          <h2 id="dep-title" className="text-3xl">Depoimentos</h2>
          <Dica titulo="Esconder ou recusar?">
            Esconder tira da home um depoimento já publicado, e dá para mostrar de novo. Recusar diz ao aluno que não foi
            publicado, e ele pode reescrever. “Ajustar texto” corrige erros; o aluno é avisado.
          </Dica>
        </div>
        <p className="text-sm text-muted-foreground">
          Enviados pelos alunos no painel deles. Só os publicados aparecem na home. Se o aluno editar um
          depoimento publicado, ele sai da home e volta para a fila.
        </p>
      </div>
      <Grupo titulo="Para aprovar" itens={por("pendente")} vazio="Nenhum depoimento esperando aprovação." onEdit={setEditId} />
      <Grupo titulo="Publicados" itens={por("aprovado")} vazio="Nenhum depoimento publicado." onEdit={setEditId} />
      <Grupo titulo="Escondidos e recusados" itens={por("oculto", "recusado")} vazio="Nada por aqui." onEdit={setEditId} />

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          {editando && <EditarTexto key={editando.id} item={editando} onClose={() => setEditId(null)} />}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
