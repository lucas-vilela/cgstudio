"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, RotateCw, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { descreverItem } from "@/lib/offline/descricao";
import { descartar, tentarDeNovo } from "@/lib/offline/store";
import type { ItemFila } from "@/lib/offline/tipos";
import { useAdminEstado } from "@/lib/offline/use-admin";
import type { Visao } from "@/lib/offline/visao";
import { AvaliacaoForm } from "../ficha/medidas";
import { LinkAluno } from "../link-aluno";
import { MemberForm } from "../members-table";
import { PaymentForm } from "../register-payment-dialog";
import { Panel } from "../section";

function Linha({ item, visao, onCorrigir }: { item: ItemFila; visao: Visao; onCorrigir: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const corrigivel = item.tipo === "pagamento" || item.tipo === "aluno_criar" || item.tipo === "avaliacao_salvar";
  return (
    <li className="rounded-xl border border-accent/50 bg-surface-2 p-4">
      <p className="font-medium">{descreverItem(item, visao)}</p>
      <p className="mt-1 text-sm text-accent">{item.erro}</p>
      <p className="text-xs text-muted-foreground">Registrado em {new Date(item.criado_em).toLocaleString("pt-BR")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {corrigivel && (
          <Button size="sm" onClick={onCorrigir} className="min-h-11 md:min-h-7">
            <Pencil data-icon="inline-start" />Corrigir
          </Button>
        )}
        {item.tipo === "anamnese_salvar" && (
          <LinkAluno id={item.payload.member_id} aba="anamnese"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "min-h-11 hover:no-underline md:min-h-7")}>
            Abrir ficha
          </LinkAluno>
        )}
        <Button size="sm" variant="outline" onClick={() => void tentarDeNovo(item.id)} className="min-h-11 md:min-h-7">
          <RotateCw data-icon="inline-start" />Tentar de novo
        </Button>
        {/* Descartar não tem volta: o primeiro clique só pede confirmação. */}
        <Button size="sm" variant="destructive" className="min-h-11 md:min-h-7" onBlur={() => setConfirmar(false)}
          onClick={() => {
            if (!confirmar) return setConfirmar(true);
            void descartar(item.id).then(() => toast.success("Registro descartado."));
          }}>
          <Trash2 data-icon="inline-start" />{confirmar ? "Confirmar descarte" : "Descartar"}
        </Button>
      </div>
    </li>
  );
}

// "Pendências com erro": o servidor recusou. Nada é descartado sem o admin decidir.
export function Pendencias({ visao }: { visao: Visao }) {
  const { fila } = useAdminEstado();
  const [corrigindoId, setCorrigindoId] = useState<string | null>(null);
  const erros = fila.filter((i) => i.status === "erro");
  const corrigindo = erros.find((i) => i.id === corrigindoId);
  if (!erros.length) return null;

  const membro = (id: string) => visao.members.find((m) => m.member_id === id);

  return (
    <Panel id="pendencias" aria-labelledby="pend-title" className="border-accent/60">
      <h2 id="pend-title" className="text-3xl">Pendências com erro</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        O servidor não aceitou estes registros. Corrija e envie de novo, ou descarte.
      </p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {erros.map((i) => <Linha key={i.id} item={i} visao={visao} onCorrigir={() => setCorrigindoId(i.id)} />)}
      </ul>
      <Dialog open={!!corrigindo} onOpenChange={(o) => !o && setCorrigindoId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {corrigindo?.tipo === "pagamento" && (
            <PaymentForm
              corrigindo={corrigindo}
              member={{
                id: corrigindo.payload.member_id,
                nome: membro(corrigindo.payload.member_id)?.nome ?? null,
                valor: membro(corrigindo.payload.member_id)?.valor ?? null,
              }}
              onClose={() => setCorrigindoId(null)}
            />
          )}
          {corrigindo?.tipo === "avaliacao_salvar" && (
            <AvaliacaoForm
              memberId={corrigindo.payload.member_id}
              nome={membro(corrigindo.payload.member_id)?.nome ?? null}
              avaliacao={{ ...corrigindo.payload, erro: corrigindo.erro }}
              naServidor={(visao.snapshot.avaliacoes ?? []).some((a) => a.id === corrigindo.payload.id)}
              onClose={() => setCorrigindoId(null)}
            />
          )}
          {corrigindo?.tipo === "aluno_criar" && (
            <MemberForm
              member={null}
              corrigindo={corrigindo}
              plans={visao.plans}
              treinos={visao.snapshot.treinos}
              todos={visao.members}
              onClose={() => setCorrigindoId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
