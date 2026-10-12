"use client";

import { useState, useTransition } from "react";
import { updateMember } from "@/app/dashboard/admin/actions";
import { brl, diasLabel, formatDate, moneyInput, parseMoney } from "@/app/dashboard/admin/format";
import type { AdminMember, Plan } from "@/app/dashboard/admin/types";
import { formatPhone, statusLabel, STATUSES } from "@/app/dashboard/members";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FieldSelect } from "./field-select";
import { RegisterPaymentButton } from "./register-payment-dialog";
import { EmptyNote } from "./section";
import { Tag } from "./tag";
import { Pencil } from "lucide-react";

const NO_PLAN = "none";

function VencimentoCell({ m }: { m: AdminMember }) {
  if (!m.vencimento) return <span className="text-muted-foreground">Sem vencimento</span>;
  const dias = m.dias_para_vencer ?? 0;
  return (
    <div className="flex flex-col items-start gap-1">
      <span>{formatDate(m.vencimento)}</span>
      {m.situacao === "em_atraso" ? (
        <Tag>Em atraso · {diasLabel(dias)}</Tag>
      ) : m.situacao === "vence_em_breve" ? (
        <Tag hot={dias <= 1}>Vence {diasLabel(dias)}</Tag>
      ) : (
        <span className="text-xs text-muted-foreground">Em dia</span>
      )}
    </div>
  );
}

function EditForm({ member, plans, onClose }: { member: AdminMember; plans: Plan[]; onClose: () => void }) {
  const [planId, setPlanId] = useState(member.plan_id ? String(member.plan_id) : NO_PLAN);
  const [valor, setValor] = useState(moneyInput(member.valor_acordado));
  const [status, setStatus] = useState<string>(member.status);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const padrao = plans.find((p) => String(p.id) === planId)?.valor_padrao ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseMoney(valor);
    if (parsed !== null && Number.isNaN(parsed)) return setError("Valor acordado inválido.");
    start(async () => {
      const res = await updateMember({
        memberId: member.member_id,
        planId: planId === NO_PLAN ? null : Number(planId),
        valorAcordado: parsed,
        status,
      });
      if (res.ok) onClose();
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Editar aluno</DialogTitle>
        <DialogDescription>{member.nome ?? member.email}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="ed-plano">Plano</Label>
        <FieldSelect id="ed-plano" value={planId} onValueChange={setPlanId}
          options={[
            { value: NO_PLAN, label: "Sem plano" },
            ...plans.map((p) => ({ value: String(p.id), label: `${p.nome} · ${brl(p.valor_padrao)}` })),
          ]} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ed-valor">Valor acordado (R$)</Label>
        <Input id="ed-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
          placeholder={padrao != null ? `Padrão do plano: ${moneyInput(padrao)}` : "Sem valor"}
          className="h-10 md:h-8" />
        <p className="text-xs text-muted-foreground">Deixe vazio para usar o valor padrão do plano.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ed-status">Status</Label>
        <FieldSelect id="ed-status" value={status} onValueChange={setStatus} options={[...STATUSES]} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
        <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MembersTable({ members, plans }: { members: AdminMember[]; plans: Plan[] }) {
  const [editing, setEditing] = useState<AdminMember | null>(null);

  if (!members.length) return <EmptyNote>Nenhum aluno encontrado.</EmptyNote>;

  const valorCell = (m: AdminMember) => (
    <div className="flex flex-col items-start gap-0.5">
      <span>{brl(m.valor)}</span>
      {m.valor_acordado != null && <span className="text-xs text-muted-foreground">acordado</span>}
    </div>
  );
  const actions = (m: AdminMember) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditing(m)} className="min-h-11 md:min-h-7"
        aria-label={`Editar ${m.nome ?? "aluno"}`}>
        <Pencil data-icon="inline-start" />
        Editar
      </Button>
      <RegisterPaymentButton member={{ id: m.member_id, nome: m.nome, valor: m.valor }} label="Registrar" />
    </div>
  );

  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.member_id}>
                <TableCell>
                  <div className="font-medium">{m.nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.email}{m.telefone ? ` · ${formatPhone(m.telefone)}` : ""}
                  </div>
                </TableCell>
                <TableCell>
                  {m.plano_nome ?? "—"}
                  {m.vezes_semana != null && (
                    <div className="text-xs text-muted-foreground">
                      {m.slots_usados} de {m.vezes_semana} slots
                    </div>
                  )}
                </TableCell>
                <TableCell>{valorCell(m)}</TableCell>
                <TableCell><VencimentoCell m={m} /></TableCell>
                <TableCell><Tag>{statusLabel(m.status)}</Tag></TableCell>
                <TableCell>{actions(m)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Celular: cartões */}
      <ul className="flex flex-col gap-3 md:hidden">
        {members.map((m) => (
          <li key={m.member_id} className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.nome ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <Tag>{statusLabel(m.status)}</Tag>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Plano</dt><dd>{m.plano_nome ?? "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Valor</dt><dd>{valorCell(m)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Vence</dt><dd><VencimentoCell m={m} /></dd></div>
            </dl>
            <div className="mt-3">{actions(m)}</div>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <EditForm key={editing.member_id} member={editing} plans={plans} onClose={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
