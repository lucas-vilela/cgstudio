import { Check } from "lucide-react";
import { SectionTitle } from "./section";
import { GoogleCta } from "./google-cta";

// Valores ilustrativos — ajustar com a tabela real da academia.
const plans = [
  { name: "Essencial", price: "99", note: "Musculação livre", perks: ["Acesso ao salão", "Avaliação inicial", "App de treino"], featured: false },
  { name: "Studio", price: "149", note: "Musculação + aulas em grupo", perks: ["Tudo do Essencial", "Funcional, spinning e boxe", "Reserva de vaga pelo app"], featured: true },
  { name: "Ilimitado", price: "199", note: "Tudo, sem restrição", perks: ["Tudo do Studio", "Mobilidade e workshops", "Traga um convidado por mês"], featured: false },
];

export function Plans() {
  return (
    <section id="planos" className="bg-[var(--cg-ink-2)] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle kicker="Planos">Sem fidelidade. Sem letra miúda.</SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.name}
              className={`flex flex-col rounded-2xl border p-7 ${p.featured ? "border-[var(--cg-signal)] bg-[var(--cg-ink)]" : "border-[var(--cg-line)]"}`}
            >
              <h3 className="cg-display text-3xl">{p.name}</h3>
              <p className="mt-1 text-sm text-[var(--cg-dim)]">{p.note}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-sm">R$</span>
                <span className="cg-display text-6xl">{p.price}</span>
                <span className="text-sm text-[var(--cg-dim)]">/mês</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--cg-signal)]" />
                    {perk}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-4">
          <GoogleCta />
          <span className="text-sm text-[var(--cg-dim)]">Entre com sua conta Google para escolher o plano.</span>
        </div>
      </div>
    </section>
  );
}
