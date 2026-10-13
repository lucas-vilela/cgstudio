"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { enviarDepoimento, type DepoimentoState } from "@/app/dashboard/depoimento-actions";
import type { OwnDepoimento } from "@/app/dashboard/data";
import type { MemberStatus } from "@/app/dashboard/members";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const initial: DepoimentoState = { ok: false };
const MIN = 10;
const MAX = 500;

const ESTADO: Record<OwnDepoimento["status"], { label: string; texto: string }> = {
  pendente: { label: "Em análise", texto: "Seu depoimento está em análise. Ele aparece na home assim que for aprovado." },
  aprovado: { label: "Publicado", texto: "Seu depoimento está publicado na home. Se editar, ele volta para análise e sai da home até ser aprovado de novo." },
  oculto: { label: "Publicação pausada", texto: "A recepção pausou a publicação do seu depoimento. Se editar, ele volta para análise." },
  recusado: { label: "Não publicado", texto: "Seu depoimento não foi publicado. Você pode reescrever e enviar de novo." },
};

export function DepoimentoForm({
  depoimento, status,
}: { depoimento: OwnDepoimento | null; status: MemberStatus }) {
  const [state, action, pending] = useActionState(enviarDepoimento, initial);
  const [texto, setTexto] = useState(depoimento?.texto ?? "");
  const ativo = status === "ativo";

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  const estado = depoimento ? ESTADO[depoimento.status] : null;
  const tamanho = texto.trim().length;
  const semMudanca = depoimento != null && depoimento.texto.trim() === texto.trim() && depoimento.status !== "recusado";
  const invalido = tamanho < MIN || tamanho > MAX;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Seu depoimento</CardTitle>
          {estado && <Badge variant="secondary">{estado.label}</Badge>}
        </div>
        <CardDescription>
          {ativo
            ? "Conte como é treinar no studio. Ele só aparece na home depois de aprovado pela recepção, com seu primeiro nome e a inicial do sobrenome."
            : "Só alunos com matrícula ativa podem enviar ou editar depoimento. Fale com a recepção."}
        </CardDescription>
      </CardHeader>
      <form action={action} noValidate className="flex flex-col gap-(--card-spacing)">
        <CardContent className="flex flex-col gap-3">
          {/* Os textos de estado falam em editar: para quem não pode editar, só o selo basta. */}
          {estado && ativo && <p className="text-sm text-muted-foreground">{estado.texto}</p>}
          {depoimento?.ajustado_pelo_admin && (
            <p role="status" className="text-sm text-muted-foreground">
              A recepção ajustou o texto do seu depoimento. É a versão que aparece abaixo.
            </p>
          )}
          <label htmlFor="depoimento-texto" className="sr-only">Depoimento</label>
          <Textarea
            id="depoimento-texto"
            name="texto"
            rows={5}
            maxLength={MAX}
            value={texto}
            disabled={!ativo}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="O que mudou na sua rotina depois que você começou a treinar?"
            aria-describedby="depoimento-contagem"
          />
          <p id="depoimento-contagem" className="text-xs text-muted-foreground">
            {tamanho}/{MAX} (mínimo {MIN})
          </p>
        </CardContent>
        <CardFooter className="gap-3">
          <Button type="submit" disabled={!ativo || pending || invalido || semMudanca}>
            {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
            {pending ? "Enviando…" : depoimento ? "Enviar alteração" : "Enviar depoimento"}
          </Button>
          {!state.ok && state.message && (
            <p role={state.ok ? "status" : "alert"}
              className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {state.message}
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
