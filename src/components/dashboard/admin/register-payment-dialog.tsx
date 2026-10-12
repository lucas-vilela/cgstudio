"use client";

import { useState, useTransition } from "react";
import { registerPayment } from "@/app/dashboard/admin/actions";
import { formatDate, moneyInput, parseMoney, todayISO } from "@/app/dashboard/admin/format";
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

export type PaymentTarget = { id: string; nome: string | null; valor: number | null };

function PaymentForm({ member, onClose }: { member: PaymentTarget; onClose: () => void }) {
  const [valor, setValor] = useState(moneyInput(member.valor));
  const [forma, setForma] = useState<Forma>("pix");
  const [data, setData] = useState(todayISO);
  const [obs, setObs] = useState("");
  const [error, setError] = useState("");
  const [novoVenc, setNovoVenc] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseMoney(valor);
    if (parsed !== null && !(parsed > 0)) return setError("Informe um valor maior que zero.");
    if (parsed === null && member.valor == null)
      return setError("Informe o valor (o aluno não tem plano definido).");
    start(async () => {
      const res = await registerPayment({
        memberId: member.id,
        forma,
        valor: parsed,
        pagoEm: data || null,
        observacao: obs,
      });
      if (res.ok) setNovoVenc(res.data.vencimento);
      else setError(res.message);
    });
  }

  if (novoVenc)
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Pagamento registrado</DialogTitle>
          <DialogDescription>
            {member.nome ?? "Aluno"} está ativo. Novo vencimento: <b>{formatDate(novoVenc)}</b>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </>
    );

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Registrar pagamento</DialogTitle>
        <DialogDescription>{member.nome ?? "Aluno"}</DialogDescription>
      </DialogHeader>
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
