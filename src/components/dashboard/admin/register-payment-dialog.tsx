"use client";

import { useState } from "react";
import { toast } from "sonner";
import { moneyInput, parseMoney, todayISO } from "@/app/dashboard/admin/format";
import { corrigir, enfileirar } from "@/lib/offline/store";
import type { ItemFila } from "@/lib/offline/tipos";
import { msgGuardado, useAdminEstado } from "@/lib/offline/use-admin";
import { FORMAS, type Forma } from "@/app/dashboard/admin/types";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldSelect } from "./field-select";
import { Banknote } from "lucide-react";

// `pendente`: já há um pagamento deste aluno aguardando envio (evita registrar em dobro).
export type PaymentTarget = { id: string; nome: string | null; valor: number | null; pendente?: boolean };

function PaymentForm({
  member, onClose, corrigindo,
}: {
  member: PaymentTarget;
  onClose: () => void;
  // Item da fila com erro sendo corrigido (Pendências): mantém o mesmo id ao reenviar.
  corrigindo?: Extract<ItemFila, { tipo: "pagamento" }>;
}) {
  const inicial = corrigindo?.payload;
  const [valor, setValor] = useState(moneyInput(inicial?.valor ?? member.valor));
  const [forma, setForma] = useState<Forma>(inicial?.forma ?? "pix");
  const [data, setData] = useState(inicial?.pago_em ?? todayISO());
  const [obs, setObs] = useState(inicial?.observacao ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const { online } = useAdminEstado();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseMoney(valor);
    if (parsed !== null && !(parsed > 0)) return setError("Informe um valor maior que zero.");
    if (parsed === null && member.valor == null)
      return setError("Informe o valor (o aluno não tem plano definido).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setError("Informe a data do pagamento.");
    if (obs.trim().length > 300) return setError("Observação muito longa (máx. 300).");
    setPending(true);
    // A data é a do registro aqui; o vencimento novo é calculado pelo servidor no envio.
    const payload = {
      member_id: member.id, forma, valor: parsed, pago_em: data, observacao: obs.trim() || null,
    };
    const guardou = corrigindo
      ? await corrigir(corrigindo.id, payload)
      : (await enfileirar({ tipo: "pagamento", payload })) !== null;
    setPending(false);
    if (!guardou) return setError("Não foi possível guardar neste aparelho. Tente de novo; se continuar, recarregue a página.");
    toast.success(msgGuardado(online, `Pagamento de ${member.nome ?? "aluno"} registrado`));
    onClose();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Registrar pagamento</DialogTitle>
        <DialogDescription>{member.nome ?? "Aluno"}</DialogDescription>
      </DialogHeader>
      {member.pendente && !corrigindo && (
        <p role="alert" className="rounded-lg border border-accent/60 p-3 text-sm">
          Já existe um pagamento de {member.nome ?? "este aluno"} aguardando envio. Só registre outro se for
          mesmo um segundo pagamento.
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="pg-valor">Valor (R$)</Label>
        <Input id="pg-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
          placeholder="0,00" className="h-10 md:h-8" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pg-forma">Forma</Label>
        <FieldSelect id="pg-forma" value={forma} onValueChange={(v) => setForma(v as Forma)}
          options={FORMAS} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pg-data">Data do pagamento</Label>
        <Input id="pg-data" type="date" value={data} onChange={(e) => setData(e.target.value)}
          className="h-10 md:h-8" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pg-obs">Observação (opcional)</Label>
        <Textarea id="pg-obs" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} rows={2} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} className="min-h-11 md:min-h-8">
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} className="min-h-11 md:min-h-8">
          {pending ? "Registrando…" : "Registrar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Botão + dialog. O formulário só monta com o dialog aberto, então o estado reinicia a cada uso.
export { PaymentForm };

export function RegisterPaymentButton({
  member,
  label = "Registrar pagamento",
  variant = "default",
}: {
  member: PaymentTarget;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}
        className="min-h-11 md:min-h-7" aria-label={`${label}: ${member.nome ?? "aluno"}`}>
        <Banknote data-icon="inline-start" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          {open && <PaymentForm member={member} onClose={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
