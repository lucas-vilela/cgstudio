"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mail, MessageCircle, Pencil } from "lucide-react";
import { formatPhone, statusLabel } from "@/app/dashboard/members";
import { anamnesePreenchida } from "@/lib/anamnese";
import { navegar } from "@/lib/offline/navegacao";
import { lerRascunho } from "@/lib/offline/rascunhos";
import { avisarNavegacao, fichaHref, useQuery } from "@/lib/offline/secoes";
import type { Visao } from "@/lib/offline/visao";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberForm } from "../members-table";
import { RegisterPaymentButton } from "../register-payment-dialog";
import { Panel } from "../section";
import { Tag } from "../tag";
import { AlertaSaude } from "./alerta";
import { Acompanhamento } from "./acompanhamento";
import { AnamneseForm } from "./anamnese-form";
import { AvaliacaoForm, Medidas } from "./medidas";
import { Resumo } from "./resumo";
import { Dica } from "@/components/ajuda/dica";

type Aba = "resumo" | "anamnese" | "medidas" | "acompanhamento";
const ABAS: Aba[] = ["resumo", "anamnese", "medidas", "acompanhamento"];


function Voltar() {
  return (
    <a href="/dashboard/admin" onClick={(e) => navegar(e, "/dashboard/admin")}
      className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline md:min-h-0">
      <ArrowLeft aria-hidden className="size-4" />Alunos
    </a>
  );
}

export function FichaAluno({ visao, memberId }: { visao: Visao; memberId: string }) {
  const pedida = useQuery().get("aba");
  const aba: Aba = ABAS.includes(pedida as Aba) ? (pedida as Aba) : "resumo";
  const [editando, setEditando] = useState(false);
  const [novaAvaliacao, setNovaAvaliacao] = useState(false);
  const m = visao.members.find((x) => x.member_id === memberId);
  const anamnese = visao.anamneses.get(memberId);
  const avaliacoes = visao.avaliacoes.get(memberId) ?? [];

  // Saiu da ficha com a anamnese pela metade: o rascunho fica guardado, mas avisa.
  useEffect(() => () => {
    if (lerRascunho(memberId)) toast.warning("A anamnese tem alterações não salvas. Volte à ficha para salvar.");
  }, [memberId]);

  // A aba fica no endereço (replaceState: trocar de aba não empilha histórico).
  function irPara(nova: Aba) {
    window.history.replaceState(null, "", fichaHref(memberId, nova === "resumo" ? undefined : nova));
    avisarNavegacao();
  }

  if (!m) {
    return (
      <div className="flex flex-col gap-4">
        <Voltar />
        <Panel>
          <p className="font-semibold">Aluno não encontrado</p>
          <p className="text-sm text-muted-foreground">
            O cadastro pode ter sido excluído, ou ainda não chegou a este aparelho.
          </p>
        </Panel>
      </div>
    );
  }

  const tel = m.telefone ? formatPhone(m.telefone) : null;
  const trigger = "min-h-11 px-4 md:min-h-7";

  return (
    <div className="flex flex-col gap-5">
      <Voltar />
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl break-words">{m.nome ?? "Sem nome"}</h1>
          <Tag>{statusLabel(m.status)}</Tag>
          {m.erro ? (
            <Tag hot title={m.erro}>Erro no envio</Tag>
          ) : m.pendente ? (
            <Tag>Aguardando envio</Tag>
          ) : null}
          {!anamnesePreenchida(anamnese) && (
            <Tag className="text-muted-foreground">Sem anamnese</Tag>
          )}
          <Dica titulo="Ficha do aluno">
            Resumo junta cuidados, plano, horários, medidas e pagamentos. Na Anamnese, respostas que pedem cuidado geram o
            alerta de saúde. Em Medidas, registre cada avaliação; Acompanhamento mostra a evolução em gráficos e as
            percepções do aluno. O telefone abre o WhatsApp.
          </Dica>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {m.telefone && (
            <a href={`https://wa.me/55${m.telefone}`} target="_blank" rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline md:min-h-0">
              <MessageCircle aria-hidden className="size-4" />{tel}
            </a>
          )}
          {m.email && (
            <a href={`mailto:${m.email}`}
              className="inline-flex min-h-11 min-w-0 items-center gap-1.5 break-all underline-offset-4 hover:text-foreground hover:underline md:min-h-0">
              <Mail aria-hidden className="size-4 shrink-0" />{m.email}
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditando(true)} className="min-h-11 md:min-h-7">
            <Pencil data-icon="inline-start" />Editar cadastro
          </Button>
          <RegisterPaymentButton member={{ id: m.member_id, nome: m.nome, valor: m.valor, pendente: m.pagamentoPendente }} />
        </div>
      </header>

      <AlertaSaude anamnese={anamnese} />

      <Tabs value={aba} onValueChange={(v) => irPara(v as Aba)} className="gap-4">
        <TabsList className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-auto sm:flex sm:w-fit">
          <TabsTrigger value="resumo" className={trigger}>Resumo</TabsTrigger>
          <TabsTrigger value="anamnese" className={trigger}>Anamnese</TabsTrigger>
          <TabsTrigger value="medidas" className={trigger}>Medidas</TabsTrigger>
          <TabsTrigger value="acompanhamento" className={trigger}>Acompanhamento</TabsTrigger>
        </TabsList>
        <TabsContent value="resumo">
          <Resumo m={m} visao={visao} anamnese={anamnese} avaliacoes={avaliacoes} irPara={irPara} />
        </TabsContent>
        <TabsContent value="anamnese">
          <AnamneseForm key={memberId} memberId={memberId} anamnese={anamnese} />
        </TabsContent>
        <TabsContent value="medidas">
          <Medidas memberId={memberId} nome={m.nome} avaliacoes={avaliacoes}
            doServidor={new Set((visao.snapshot.avaliacoes ?? []).map((a) => a.id))} />
        </TabsContent>
        <TabsContent value="acompanhamento">
          <Acompanhamento avaliacoes={avaliacoes} onNova={() => setNovaAvaliacao(true)} />
        </TabsContent>
      </Tabs>

      <Dialog open={novaAvaliacao} onOpenChange={setNovaAvaliacao}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {novaAvaliacao && (
            <AvaliacaoForm memberId={memberId} nome={m.nome} avaliacao={null} naServidor={false}
              onClose={() => setNovaAvaliacao(false)} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {editando && (
            <MemberForm member={m} plans={visao.plans} treinos={visao.snapshot.treinos} todos={visao.members}
              onClose={() => setEditando(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
