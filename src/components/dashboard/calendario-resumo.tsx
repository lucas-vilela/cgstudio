import { pilulaVencimento, type Financeiro } from "@/app/dashboard/calendario-lib";

const STATUS = { pendente: "Pendente", ativo: "Ativo", inativo: "Inativo" } as const;

const pill = "inline-flex min-h-8 items-center rounded-full border px-3 text-[13px] font-medium";

export function CalendarioResumo({ f }: { f: Financeiro }) {
  const venc = pilulaVencimento(f);
  const mostraVenc = f.status !== "pendente";
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Resumo da matrícula">
      <li className={`${pill} border-border text-muted-foreground`}>
        {STATUS[f.status]}
        {f.plano_nome ? ` · plano ${f.plano_nome}` : ""}
      </li>
      {f.vezes_semana ? (
        <li className={`${pill} border-border`}>
          {f.slots_usados} de {f.vezes_semana} {f.vezes_semana === 1 ? "slot usado" : "slots usados"}
        </li>
      ) : null}
      {mostraVenc && (
        <li className={`${pill} ${venc.urgente ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
          {venc.texto}
        </li>
      )}
    </ul>
  );
}
