import { SectionTitle } from "./section-title";

// Valores fictícios (especificacao-v1.md) — trocar pelos reais.
const plans = [
  { name: "1x", price: "75", note: "1 aula por semana" },
  { name: "2x", price: "80", note: "2 aulas por semana" },
  { name: "3x", price: "100", note: "3 aulas por semana" },
];

export function Plans() {
  return (
    <section id="planos" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Planos" note="Cobrança mensal, pela frequência semanal. Pagamento combinado direto com o studio.">
          Escolha sua frequência
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <li key={p.name} className="rounded-[20px] border border-border bg-surface p-7">
              <h3 className="text-4xl">{p.name}</h3>
              <p className="mt-1 text-muted-foreground">{p.note}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="font-display text-6xl font-bold leading-none">{p.price}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
