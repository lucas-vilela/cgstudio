import { diasLabel, formatDate } from "@/app/dashboard/admin/format";
import type { Vencimento } from "@/app/dashboard/admin/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RegisterPaymentButton } from "./register-payment-dialog";
import { EmptyNote, Panel } from "./section";
import { Tag } from "./tag";
import { LinkAluno } from "./link-aluno";

export function VencimentosProximos({ items, pendentes }: { items: Vencimento[]; pendentes?: Set<string> }) {
  return (
    <Panel aria-labelledby="venc-title">
      <h2 id="venc-title" className="text-3xl">Vencimentos próximos</h2>
      <p className="mb-3 text-sm text-muted-foreground">Quem vence nos próximos 5 dias.</p>
      {items.length === 0 ? (
        <EmptyNote>Nenhum vencimento nos próximos 5 dias.</EmptyNote>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead className="text-right"><span className="sr-only">Ação</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((v) => (
              <TableRow key={v.member_id}>
                <TableCell className="font-medium">
                  <LinkAluno id={v.member_id}>{v.nome ?? "—"}</LinkAluno>
                  {pendentes?.has(v.member_id) && <Tag className="mt-1 block w-fit">Pagamento aguardando envio</Tag>}
                </TableCell>
                <TableCell>{v.plano_nome ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Tag hot={v.dias_restantes <= 1}>{diasLabel(v.dias_restantes)}</Tag>
                    <span className="text-xs text-muted-foreground">{formatDate(v.vencimento)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <RegisterPaymentButton
                    label="Registrar"
                    member={{ id: v.member_id, nome: v.nome, valor: v.valor, pendente: pendentes?.has(v.member_id) }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
