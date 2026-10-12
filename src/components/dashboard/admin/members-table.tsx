"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteMemberSemLogin } from "@/app/dashboard/admin/actions";
import { atualizar, corrigir, enfileirar, novoId } from "@/lib/offline/store";
import type { CamposAluno, ItemFila } from "@/lib/offline/tipos";
import { msgGuardado, useAdminEstado } from "@/lib/offline/use-admin";
import type { MembroVisao } from "@/lib/offline/visao";
import { brl, diasLabel, formatDate, moneyInput, parseMoney } from "@/app/dashboard/admin/format";
import type { Plan, Treino } from "@/app/dashboard/admin/types";
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

function VencimentoCell({ m }: { m: MembroVisao }) {
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
export function MemberForm({
  member, plans, treinos, todos, onClose, corrigindo,
}: {
  member: MembroVisao | null;
  plans: Plan[];
  treinos: Treino[];
  todos: MembroVisao[]; // para avisar de telefone repetido já offline
  onClose: () => void;
  // Cadastro da fila com erro sendo corrigido (Pendências): mantém o mesmo id ao reenviar.
  corrigindo?: Extract<ItemFila, { tipo: "aluno_criar" }>;
}) {
  const novo = member === null;
  const { online } = useAdminEstado();
  const editaDados = novo || !member.tem_login;
  // Corrigindo um cadastro recusado: começa com o que foi enviado.
  const base = corrigindo?.payload;
  const [nome, setNome] = useState(base?.nome ?? member?.nome ?? "");
  const [telefone, setTelefone] = useState(formatPhone(base?.telefone ?? member?.telefone ?? "") || "");
  const [email, setEmail] = useState(base?.email ?? member?.email ?? "");
  const [planId, setPlanId] = useState(
    (base ? base.plan_id : member?.plan_id) ? String(base ? base.plan_id : member?.plan_id) : NO_PLAN,
  );
  const [valor, setValor] = useState(moneyInput(base ? base.valor_acordado : (member?.valor_acordado ?? null)));
  const [status, setStatus] = useState<string>(member?.status ?? "pendente");
  const [treinoIds, setTreinoIds] = useState<number[]>(base?.treino_ids ?? member?.treino_ids ?? []);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const padrao = plans.find((p) => String(p.id) === planId)?.valor_padrao ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseMoney(valor);
    if (parsed !== null && Number.isNaN(parsed)) return setError("Valor acordado inválido.");
    const tel = telefone.replace(/\D/g, "");
    if (editaDados && nome.trim().length < 2) return setError("Informe o nome completo.");
    if (editaDados && !/^\d{10,11}$/.test(tel)) return setError("Telefone inválido. Use DDD + número.");
    if (editaDados && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("E-mail inválido.");
    const outro = (m: MembroVisao) => m.member_id !== member?.member_id && m.member_id !== corrigindo?.payload.member_id;
    if (editaDados && todos.some((m) => outro(m) && m.telefone === tel))
      return setError("Este telefone já está em uso por outro cadastro. Informe outro número.");
    const mail = email.trim().toLowerCase() || null;
    if (editaDados && mail && todos.some((m) => outro(m) && m.email?.toLowerCase() === mail))
      return setError("Este e-mail já está em uso por outro cadastro.");
    const plano = planId === NO_PLAN ? null : Number(planId);

    setPending(true);
    if (novo) {
      const payload = {
        member_id: corrigindo?.payload.member_id ?? novoId(),
        nome: nome.trim(), telefone: tel, email: mail,
        plan_id: plano, valor_acordado: parsed, treino_ids: treinoIds,
      };
      if (corrigindo) await corrigir(corrigindo.id, payload);
      else await enfileirar({ tipo: "aluno_criar", payload });
      toast.success(msgGuardado(online, `${payload.nome} cadastrado(a)`));
    } else {
      // Só os campos que mudaram: não desfaz o que outro admin ou a rotina diária mudou.
      const campos: CamposAluno = {};
      if (plano !== member.plan_id) campos.plan_id = plano;
      if (parsed !== member.valor_acordado) campos.valor_acordado = parsed;
      if (status !== member.status) campos.status = status as CamposAluno["status"];
      if (!mesmosTreinos(treinoIds, member.treino_ids)) campos.treino_ids = treinoIds;
      if (editaDados) {
        if (nome.trim() !== (member.nome ?? "")) campos.nome = nome.trim();
        if (tel !== (member.telefone ?? "")) campos.telefone = tel;
        if (mail !== (member.email?.toLowerCase() ?? null)) campos.email = mail;
      }
      if (Object.keys(campos).length) {
        await enfileirar({ tipo: "aluno_editar", payload: { member_id: member.member_id, campos } });
        toast.success(msgGuardado(online, `Alterações de ${member.nome ?? "aluno"} salvas`));
      }
    }
    setPending(false);
    onClose();
  }

  function excluir() {
    if (!member) return;
    if (!online) return setError("Excluir cadastro precisa de conexão.");
    if (!confirmarExclusao) return setConfirmarExclusao(true);
    setError("");
    setPending(true);
    void deleteMemberSemLogin(member.member_id).then(async (res) => {
      setPending(false);
      if (!res.ok) return setError(res.message);
      toast.success(`Cadastro de ${member.nome ?? "aluno"} excluído.`);
      await atualizar();
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{corrigindo ? "Corrigir cadastro" : novo ? "Novo aluno" : "Editar aluno"}</DialogTitle>
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
        {member && !member.tem_login && !member.pendente && !member.erro ? (
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
            {pending ? "Salvando…" : corrigindo ? "Enviar de novo" : novo ? "Cadastrar" : "Salvar"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function MembersTable({
  members, todos, plans, treinos,
}: { members: MembroVisao[]; todos: MembroVisao[]; plans: Plan[]; treinos: Treino[] }) {
  // undefined = fechado, null = novo aluno, MembroVisao = editar.
  const [editing, setEditing] = useState<MembroVisao | null | undefined>(undefined);

  const valorCell = (m: MembroVisao) => (
    <div className="flex flex-col items-start gap-0.5">
      <span>{brl(m.valor)}</span>
      {m.valor_acordado != null && <span className="text-xs text-muted-foreground">acordado</span>}
    </div>
  );
  const nomesTreino = new Map(treinos.map((t) => [t.id, t.nome]));
  const treinoTags = (m: MembroVisao) =>
    m.treino_ids.length > 0 && (
      <div className="mt-1 flex flex-wrap gap-1">
        {m.treino_ids.map((id) => (
          <Tag key={id} className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {nomesTreino.get(id) ?? "Treino"}
          </Tag>
        ))}
      </div>
    );
  const actions = (m: MembroVisao) => (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditing(m)} className="min-h-11 md:min-h-7"
        aria-label={`Editar ${m.nome ?? "aluno"}`}>
        <Pencil data-icon="inline-start" />
        Editar
      </Button>
      <RegisterPaymentButton member={{ id: m.member_id, nome: m.nome, valor: m.valor }} label="Registrar" />
    </div>
  );

  const nomeCell = (m: MembroVisao) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-medium">{m.nome ?? "—"}</span>
      {!m.tem_login && <Tag className="px-2 py-0.5 text-[11px]">Sem login</Tag>}
      {m.erro ? (
        <Tag hot className="px-2 py-0.5 text-[11px]" title={m.erro}>Erro no envio</Tag>
      ) : m.pendente ? (
        <Tag className="px-2 py-0.5 text-[11px]">Aguardando envio</Tag>
      ) : null}
      {m.pagamentoPendente && <Tag className="px-2 py-0.5 text-[11px]">Pagamento aguardando envio</Tag>}
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
                    {[m.email, m.telefone && formatPhone(m.telefone)].filter(Boolean).join(" · ")}
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
            <MemberForm key={editing?.member_id ?? "novo"} member={editing} plans={plans} treinos={treinos} todos={todos} onClose={() => setEditing(undefined)} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
