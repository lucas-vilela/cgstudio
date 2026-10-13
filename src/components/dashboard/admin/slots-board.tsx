"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSlot, setSlotAtivo } from "@/app/dashboard/admin/actions";
import { formatPhone } from "@/app/dashboard/members";
import { atualizar, enfileirar } from "@/lib/offline/store";
import { msgGuardado, useAdminEstado } from "@/lib/offline/use-admin";
import type { MembroVisao, SlotVisao } from "@/lib/offline/visao";
import { DIAS, hhmm } from "@/app/dashboard/admin/format";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldSelect } from "./field-select";
import { EmptyNote } from "./section";
import { Tag } from "./tag";
import { Pencil, Plus, Power, PowerOff, Search, UserMinus, UserPlus, Users } from "lucide-react";

const DAY_OPTIONS = DIAS.map((label, i) => ({ value: String(i), label }));
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function SlotForm({ slot, onClose }: { slot: SlotVisao | null; onClose: () => void }) {
  const [dia, setDia] = useState(String(slot?.dia_semana ?? 1));
  const [inicio, setInicio] = useState(slot ? hhmm(slot.hora_inicio) : "07:00");
  const [fim, setFim] = useState(slot ? hhmm(slot.hora_fim) : "08:00");
  const [cap, setCap] = useState(String(slot?.capacidade ?? 6));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const capacidade = Number(cap);
    if (!Number.isInteger(capacidade) || capacidade < 1) return setError("Informe a capacidade (mínimo 1).");
    if (slot && capacidade < slot.ocupados)
      return setError(`Já há ${slot.ocupados} alunos neste horário. Remova alunos antes de reduzir.`);
    if (!navigator.onLine) return setError("Criar ou editar horário precisa de conexão.");
    start(async () => {
      const res = await saveSlot({
        id: slot?.slot_id ?? null, diaSemana: Number(dia), horaInicio: inicio, horaFim: fim, capacidade,
      });
      if (!res.ok) return setError(res.message);
      toast.success(slot ? "Horário salvo." : "Horário criado.");
      await atualizar();
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">{slot ? "Editar horário" : "Novo horário"}</DialogTitle>
        <DialogDescription>Slot semanal fixo com capacidade máxima.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="sl-dia">Dia da semana</Label>
        <FieldSelect id="sl-dia" value={dia} onValueChange={setDia} options={DAY_OPTIONS} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="sl-ini">Início</Label>
          <Input id="sl-ini" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-10 md:h-8" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sl-fim">Fim</Label>
          <Input id="sl-fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} className="h-10 md:h-8" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="sl-cap">Capacidade</Label>
        <Input id="sl-cap" type="number" min={1} max={50} value={cap} onChange={(e) => setCap(e.target.value)} className="h-10 md:h-8" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">Cancelar</Button>
        <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">{pending ? "Salvando…" : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}

function SlotAlunos({
  slot, members, onClose,
}: { slot: SlotVisao; members: MembroVisao[]; onClose: () => void }) {
  const { online } = useAdminEstado();
  const [busca, setBusca] = useState("");
  const noHorario = new Set(slot.alunos.map((a) => a.member_id));
  const q = busca.trim().toLowerCase();
  const digitos = q.replace(/\D/g, "");
  const candidatos = q
    ? members
        .filter((m) => !noHorario.has(m.member_id))
        .filter((m) => (m.nome ?? "").toLowerCase().includes(q) || (digitos.length >= 3 && (m.telefone ?? "").includes(digitos)))
        .slice(0, 8)
    : [];

  // Admin pode tudo (decisão do dono): só avisa, não bloqueia.
  async function adicionar(m: MembroVisao) {
    if (!(await enfileirar({ tipo: "horario_entrar", payload: { slot_id: slot.slot_id, member_id: m.member_id } })))
      return void toast.error("Não foi possível guardar neste aparelho. Tente de novo.");
    const avisos: string[] = [];
    if (slot.ocupados + 1 > slot.capacidade) avisos.push("o horário ficou acima da capacidade");
    if (m.vezes_semana != null && m.slots_usados + 1 > m.vezes_semana)
      avisos.push(`${m.nome ?? "o aluno"} passou do limite do plano (${m.vezes_semana}x)`);
    if (m.status !== "ativo") avisos.push(`${m.nome ?? "o aluno"} não está ativo`);
    toast.success(msgGuardado(online, `${m.nome ?? "Aluno"} adicionado(a) ao horário`));
    if (avisos.length) toast.warning(`Atenção: ${avisos.join("; ")}.`, { duration: 7000 });
    setBusca("");
  }

  async function remover(a: SlotVisao["alunos"][number]) {
    if (!(await enfileirar({ tipo: "horario_sair", payload: { slot_id: slot.slot_id, member_id: a.member_id } })))
      return void toast.error("Não foi possível guardar neste aparelho. Tente de novo.");
    toast.success(msgGuardado(online, `${a.nome ?? "Aluno"} removido(a) do horário`));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">
          {DIAS[slot.dia_semana]} · {hhmm(slot.hora_inicio)}–{hhmm(slot.hora_fim)}
        </DialogTitle>
        <DialogDescription>
          {slot.ocupados} de {slot.capacidade} vagas ocupadas
          {slot.ocupados > slot.capacidade ? " (acima da capacidade)" : ""}.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="sl-busca">Adicionar aluno</Label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="sl-busca" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off"
            placeholder="Nome ou telefone" className="h-10 pl-8 md:h-8" />
        </div>
        {q && (
          candidatos.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum aluno encontrado fora deste horário.</p>
          ) : (
            <ul className="grid max-h-48 gap-1 overflow-y-auto">
              {candidatos.map((m) => (
                <li key={m.member_id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.nome ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.plano_nome, m.telefone && formatPhone(m.telefone)].filter(Boolean).join(" · ") || "Sem plano"}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void adicionar(m)} className="min-h-11 shrink-0 md:min-h-7"
                    aria-label={`Adicionar ${m.nome ?? "aluno"} ao horário`}>
                    <UserPlus data-icon="inline-start" />Adicionar
                  </Button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
      {slot.alunos.length === 0 ? (
        <EmptyNote>Nenhum aluno neste horário.</EmptyNote>
      ) : (
        <ul className="grid max-h-80 gap-2 overflow-y-auto">
          {slot.alunos.map((a) => (
            <li key={a.member_id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 truncate font-medium">
                  {a.nome ?? "—"}
                  {a.erro ? <Tag hot title={a.erro}>Erro no envio</Tag> : a.pendente ? <Tag>Aguardando envio</Tag> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void remover(a)}
                className="min-h-11 md:min-h-7" aria-label={`Remover ${a.nome ?? "aluno"} do horário`}>
                <UserMinus data-icon="inline-start" />
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
      <DialogFooter><Button onClick={onClose} className="min-h-11 md:min-h-8">Fechar</Button></DialogFooter>
    </>
  );
}

function SlotCard({ slot, onEdit, onAlunos }: { slot: SlotVisao; onEdit: () => void; onAlunos: () => void }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const lotado = slot.vagas === 0;
  const pct = Math.min(100, Math.round((slot.ocupados / slot.capacidade) * 100));

  function toggle() {
    setError("");
    if (!navigator.onLine) return setError("Ativar ou desativar horário precisa de conexão.");
    start(async () => {
      const res = await setSlotAtivo(slot.slot_id, !slot.ativo);
      if (!res.ok) return setError(res.message);
      toast.success(slot.ativo ? "Horário desativado." : "Horário ativado.");
      await atualizar();
    });
  }

  return (
    <li className={`rounded-xl border border-border bg-surface-2 p-4 ${slot.ativo ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-semibold">{hhmm(slot.hora_inicio)}–{hhmm(slot.hora_fim)}</p>
        {!slot.ativo ? <Tag>Desativado</Tag> : lotado ? <Tag>Lotado</Tag> : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {slot.ocupados} de {slot.capacidade} · {slot.vagas === 1 ? "1 vaga" : `${slot.vagas} vagas`}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" role="presentation">
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onAlunos} className="min-h-11 md:min-h-7"><Users data-icon="inline-start" />Alunos</Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="min-h-11 md:min-h-7"><Pencil data-icon="inline-start" />Editar</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={toggle} className="min-h-11 md:min-h-7">
          {slot.ativo ? <PowerOff data-icon="inline-start" /> : <Power data-icon="inline-start" />}
          {slot.ativo ? "Desativar" : "Ativar"}
        </Button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </li>
  );
}

export function SlotsBoard({ slots, members }: { slots: SlotVisao[]; members: MembroVisao[] }) {
  // `form`: undefined = fechado, null = novo, SlotVisao = editar. Ids evitam dado velho após revalidar.
  const [form, setForm] = useState<{ id: number | null } | undefined>();
  const [alunosId, setAlunosId] = useState<number | null>(null);
  const formSlot = form?.id != null ? (slots.find((s) => s.slot_id === form.id) ?? null) : null;
  const alunosSlot = alunosId != null ? slots.find((s) => s.slot_id === alunosId) : undefined;

  const days = WEEK_ORDER.filter((d) => (d >= 1 && d <= 5) || slots.some((s) => s.dia_semana === d));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ id: null })} className="min-h-11 md:min-h-8"><Plus data-icon="inline-start" />Novo horário</Button>
      </div>
      {days.map((d) => {
        const list = slots.filter((s) => s.dia_semana === d);
        return (
          <section key={d} aria-labelledby={`dia-${d}`}>
            <h2 id={`dia-${d}`} className="mb-3 text-2xl">{DIAS[d]}</h2>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Sem horários.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((s) => (
                  <SlotCard key={s.slot_id} slot={s} onEdit={() => setForm({ id: s.slot_id })}
                    onAlunos={() => setAlunosId(s.slot_id)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(undefined)}>
        <DialogContent>
          {form && <SlotForm key={form.id ?? "novo"} slot={formSlot} onClose={() => setForm(undefined)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!alunosSlot} onOpenChange={(o) => !o && setAlunosId(null)}>
        <DialogContent>
          {alunosSlot && <SlotAlunos slot={alunosSlot} members={members} onClose={() => setAlunosId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
