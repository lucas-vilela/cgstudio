import { brl } from "@/app/dashboard/admin/format";
import { AlertCircle, Banknote, Users, type LucideIcon } from "lucide-react";

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        {label}
      </p>
      <p className="mt-1 font-display text-4xl font-bold leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SummaryCards({
  ativos,
  recebidoMes,
  emAtraso,
}: {
  ativos: number;
  recebidoMes: number;
  emAtraso: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
      <Stat icon={Users} label="Alunos ativos" value={String(ativos)} />
      <Stat icon={Banknote} label="Recebido no mês" value={brl(recebidoMes)} />
      <Stat
        icon={AlertCircle}
        label="Em atraso"
        value={String(emAtraso)}
        hint={emAtraso ? "Veja em Financeiro" : "Nenhum aluno em atraso"}
      />
    </div>
  );
}
