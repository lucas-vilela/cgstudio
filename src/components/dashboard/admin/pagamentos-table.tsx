import { brl, formatDate } from "@/app/dashboard/admin/format";
import { formaLabel } from "@/app/dashboard/admin/types";
import type { PagamentoVisao } from "@/lib/offline/visao";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyNote } from "./section";
import { Tag } from "./tag";

export function PagamentosTable({
  items,
  onAluno,
}: {
  items: PagamentoVisao[];
  onAluno?: (memberId: string) => void;
}) {
  if (!items.length) return <EmptyNote>Nenhum pagamento registrado.</EmptyNote>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Aluno</TableHead>
          <TableHead>Forma</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="hidden md:table-cell">Observação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => {
          return (
            <TableRow key={p.fila_id ?? p.id}>
              <TableCell>{formatDate(p.pago_em)}</TableCell>
              <TableCell className="font-medium">
                <div className="flex flex-wrap items-center gap-1.5">
                  {onAluno ? (
                    <button type="button" onClick={() => onAluno(p.member_id)}
                      className="min-h-11 text-left underline-offset-4 hover:underline md:min-h-0">
                      {p.nome ?? "—"}
                    </button>
                  ) : (
                    (p.nome ?? "—")
                  )}
                  {p.erro ? <Tag hot title={p.erro}>Erro no envio</Tag> : p.pendente ? <Tag>Aguardando envio</Tag> : null}
                </div>
              </TableCell>
              <TableCell>{formaLabel(p.forma)}</TableCell>
              <TableCell className="text-right">{brl(p.valor)}</TableCell>
              <TableCell className="hidden max-w-64 truncate text-muted-foreground md:table-cell">
                {p.observacao ?? "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
