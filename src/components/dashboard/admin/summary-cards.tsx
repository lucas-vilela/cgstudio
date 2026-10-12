import { brl } from "@/app/dashboard/admin/format";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
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
      <Stat label="Alunos ativos" value={String(ativos)} />
      <Stat label="Recebido no mês" value={brl(recebidoMes)} />
      <Stat
        label="Em atraso"
        value={String(emAtraso)}
        hint={emAtraso ? "Veja em Financeiro" : "Nenhum aluno em atraso"}
      />
    </div>
  );
}
