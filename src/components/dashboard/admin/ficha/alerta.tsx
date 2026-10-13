import { HeartPulse } from "lucide-react";
import { motivosAlerta, type Anamnese } from "@/lib/anamnese";

// Ícone ao lado do nome (listas e calendário) quando a anamnese pede atenção. Os motivos vão no
// rótulo acessível e no title (dica ao passar o mouse).
export function AlertaIcone({ anamnese }: { anamnese: Anamnese | null | undefined }) {
  const motivos = motivosAlerta(anamnese);
  if (!motivos.length) return null;
  const texto = `Atenção à saúde: ${motivos.join(" · ")}`;
  return (
    <span role="img" aria-label={texto} title={texto} className="inline-flex shrink-0 text-accent">
      <HeartPulse aria-hidden className="size-4" />
    </span>
  );
}

// Bloco no topo da ficha com os motivos por extenso.
export function AlertaSaude({ anamnese }: { anamnese: Anamnese | null | undefined }) {
  const motivos = motivosAlerta(anamnese);
  if (!motivos.length) return null;
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-accent/70 bg-surface p-4">
      <HeartPulse aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
      <div className="min-w-0">
        <p className="font-semibold">Atenção à saúde</p>
        <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          {motivos.map((m) => <li key={m} className="break-words">{m}</li>)}
        </ul>
      </div>
    </div>
  );
}
