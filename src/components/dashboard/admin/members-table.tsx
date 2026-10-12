"use client";

import { useState, useTransition } from "react";
import { createMember, deleteMemberSemLogin, updateMember } from "@/app/dashboard/admin/actions";
import { brl, diasLabel, formatDate, moneyInput, parseMoney } from "@/app/dashboard/admin/format";
import type { AdminMember, Plan, Treino } from "@/app/dashboard/admin/types";
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
import { Pencil, Plus, Trash2 } from "lucide-react";

const NO_PLAN = "none";

const mesmosTreinos = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

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

// Um formulário para criar (member = null) e editar. Nome, telefone e e-mail só aparecem para quem
// não tem conta Google: os de quem tem conta são do próprio aluno / do Google.
function MemberForm({
  member, plans, treinos, onClose,
}: { member: AdminMember | null; plans: Plan[]; treinos: Treino[]; onClose: () => void }) {
  const novo = member === null;
  const editaDados = novo || !member.tem_login;
  const [nome, setNome] = useState(member?.nome ?? "");
  const [telefone, setTelefone] = useState(member?.telefone ? formatPhone(member.telefone) : "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [planId, setPlanId] = useState(member?.plan_id ? String(member.plan_id) : NO_PLAN);
  const [valor, setValor] = useState(moneyInput(member?.valor_acordado ?? null));
  const [status, setStatus] = useState<string>(member?.status ?? "pendente");
  const [treinoIds, setTreinoIds] = useState<number[]>(member?.treino_ids ?? []);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const padrao = plans.find((p) => String(p.id) === planId)?.valor_padrao ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseMoney(valor);
    if (parsed !== null && Number.isNaN(parsed)) return setError("Valor acordado inválido.");
    if (editaDados && nome.trim().length < 2) return setError("Informe o nome completo.");
    if (editaDados && !/^\d{10,11}$/.test(telefone.replace(/\D/g, "")))
      return setError("Telefone inválido. Use DDD + número.");
    const plano = planId === NO_PLAN ? null : Number(planId);
    start(async () => {
      const res = novo
        ? await createMember({ nome, telefone, email, planId: plano, valorAcordado: parsed, treinoIds })
        : await updateMember({
            memberId: member.member_id,
            planId: plano,
            valorAcordado: parsed,
            status,
            treinoIds: mesmosTreinos(treinoIds, member.treino_ids) ? null : treinoIds,
            dados: editaDados ? { nome, telefone, email } : null,
          });
      if (res.ok) onClose();
      else setError(res.message);
    });
  }

  function excluir() {
    if (!member) return;
    if (!confirmarExclusao) return setConfirmarExclusao(true);
    setError("");
    start(async () => {
      const res = await deleteMemberSemLogin(member.member_id);
      if (res.ok) onClose();
      else setError(res.message);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{novo ? "Novo aluno" : "Editar aluno"}</DialogTitle>
        <DialogDescription>
          {novo
            ? "Para quem não vai entrar no site. Se tiver e-mail e entrar com o Google depois, a conta é ligada a este cadastro."
            : member.nome ?? member.email}
        </DialogDescription>
      </DialogHeader>
      {editaDados && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="ed-nome">Nome completo</Label>
            <Input id="ed-nome" value={nome} maxLength={100} autoComplete="off"
              onChange={(e) => setNome(e.target.value)} className="h-10 md:h-8" />
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ed-telefone">Telefone</Label>
              <Input id="ed-telefone" type="tel" inputMode="tel" value={telefone} placeholder="(53) 91234-5678"
                autoComplete="off" onChange={(e) => setTelefone(e.target.value)} className="h-10 md:h-8" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ed-email">E-mail (opcional)</Label>
              <Input id="ed-email" type="email" value={email} autoComplete="off"
                onChange={(e) => setEmail(e.target.value)} className="h-10 md:h-8" />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            O telefone identifica o aluno e não pode repetir entre cadastros.
          </p>
        </>
      )}
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
      {novo ? (
        <p className="text-xs text-muted-foreground">
          O aluno começa como pendente e fica ativo quando você registrar o primeiro pagamento.
        </p>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="ed-status">Status</Label>
          <FieldSelect id="ed-status" value={status} onValueChange={setStatus} options={[...STATUSES]} />
        </div>
      )}
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">Tipos de treino</legend>
        {treinos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum tipo de treino cadastrado.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {treinos.map((t) => (
              <label key={t.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm md:min-h-9">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={treinoIds.includes(t.id)}
                  onChange={(e) =>
                    setTreinoIds((cur) => (e.target.checked ? [...cur, t.id] : cur.filter((x) => x !== t.id)))
                  }
                />
                <span className="truncate">{t.nome}{t.ativo ? "" : " (inativo)"}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Só a recepção vê isto; o aluno não.</p>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="sm:justify-between">
        {member && !member.tem_login ? (
          // Excluir não tem volta: o primeiro clique só pede confirmação.
          <Button type="button" variant="destructive" disabled={pending} onClick={excluir}
            onBlur={() => setConfirmarExclusao(false)} className="min-h-11 md:min-h-8">
            <Trash2 data-icon="inline-start" />
            {confirmarExclusao ? "Confirmar exclusão" : "Excluir cadastro"}
          </Button>
        ) : <span />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
          <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">
            {pending ? "Salvando…" : novo ? "Cadastrar" : "Salvar"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function MembersTable({
  members, plans, treinos,
}: { members: AdminMember[]; plans: Plan[]; treinos: Treino[] }) {
  // undefined = fechado, null = novo aluno, AdminMember = editar.
  const [editing, setEditing] = useState<AdminMember | null | undefined>(undefined);

  const valorCell = (m: AdminMember) => (
    <div className="flex flex-col items-start gap-0.5">
      <span>{brl(m.valor)}</span>
      {m.valor_acordado != null && <span className="text-xs text-muted-foreground">acordado</span>}
    </div>
  );
  const nomesTreino = new Map(treinos.map((t) => [t.id, t.nome]));
  const treinoTags = (m: AdminMember) =>
    m.treino_ids.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-1">
        {m.treino_ids.map((id) => (
          <Tag key={id} className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {nomesTreino.get(id) ?? "Treino"}
          </Tag>
        ))}
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

  const nomeCell = (m: AdminMember) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{m.nome ?? "—"}</span>
      {!m.tem_login && <Tag className="px-2 py-0.5 text-[11px]">Sem login</Tag>}
    </div>
  );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)} className="min-h-11 md:min-h-8">
          <Plus data-icon="inline-start" />
          Novo aluno
        </Button>
      </div>
      {members.length === 0 ? (
        <EmptyNote>Nenhum aluno encontrado.</EmptyNote>
      ) : (
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
                  {nomeCell(m)}
                  <div className="text-xs text-muted-foreground">
                    {m.email}{m.telefone ? ` · ${formatPhone(m.telefone)}` : ""}
                  </div>
                  {treinoTags(m)}
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
                {nomeCell(m)}
                <p className="truncate text-xs text-muted-foreground">
                  {m.email ?? (m.telefone ? formatPhone(m.telefone) : "")}
                </p>
                {treinoTags(m)}
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
      </>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {editing !== undefined && (
            <MemberForm key={editing?.member_id ?? "novo"} member={editing} plans={plans} treinos={treinos} onClose={() => setEditing(undefined)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
