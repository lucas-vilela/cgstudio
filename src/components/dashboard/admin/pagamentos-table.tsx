import Link from "next/link";
import { brl, formatDate } from "@/app/dashboard/admin/format";
import { formaLabel, type Pagamento } from "@/app/dashboard/admin/types";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyNote } from "./section";

export function PagamentosTable({
  items,
  linkAluno,
}: {
  items: Pagamento[];
  linkAluno: (memberId: string) => string | null;
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
          const href = linkAluno(p.member_id);
          return (
            <TableRow key={p.id}>
              <TableCell>{formatDate(p.pago_em)}</TableCell>
              <TableCell className="font-medium">
                {href ? (
                  <Link href={href} className="underline-offset-4 hover:underline">{p.nome ?? "—"}</Link>
                ) : (
                  (p.nome ?? "—")
                )}
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
