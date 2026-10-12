import { brl, formatDate } from "@/app/dashboard/admin/format";
import type { Inadimplente } from "@/app/dashboard/admin/types";
import { formatPhone } from "@/app/dashboard/members";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RegisterPaymentButton } from "./register-payment-dialog";
import { EmptyNote } from "./section";
import { Tag } from "./tag";

export function InadimplentesTable({ items }: { items: Inadimplente[] }) {
  if (!items.length) return <EmptyNote>Nenhum aluno em atraso.</EmptyNote>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aluno</TableHead>
          <TableHead className="hidden md:table-cell">Contato</TableHead>
          <TableHead>Venceu</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead className="text-right"><span className="sr-only">Ação</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.member_id}>
            <TableCell>
              <div className="font-medium">{i.nome ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{i.plano_nome ?? "Sem plano"}</div>
            </TableCell>
            <TableCell className="hidden text-muted-foreground md:table-cell">
              {i.telefone ? formatPhone(i.telefone) : (i.email ?? "—")}
            </TableCell>
            <TableCell>
              <div className="flex flex-col items-start gap-1">
                <Tag>{i.dias_atraso} {i.dias_atraso === 1 ? "dia" : "dias"} de atraso</Tag>
                <span className="text-xs text-muted-foreground">{formatDate(i.vencimento)}</span>
              </div>
            </TableCell>
            <TableCell>{brl(i.valor_devido)}</TableCell>
            <TableCell className="text-right">
              <RegisterPaymentButton
                label="Registrar"
                member={{ id: i.member_id, nome: i.nome, valor: i.valor_devido }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
