import { CalendarCheck } from "lucide-react";
import { getPlanosHome, getSiteConfig } from "@/lib/cms";
import { SectionTitle } from "./section-title";

const preco = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export async function Plans() {
  const [planos, c] = await Promise.all([getPlanosHome(), getSiteConfig()]);
  if (planos.length === 0) return null;
  return (
    <section id="planos" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Planos" note={c.nota_planos}>
          Escolha sua frequência
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {planos.map((p) => (
            <li key={p.nome} className="rounded-[20px] border border-border bg-surface p-7">
              <h3 className="flex items-center gap-2 text-4xl">
                <CalendarCheck aria-hidden className="size-6 text-accent" />
                {p.nome}
              </h3>
              <p className="mt-1 text-muted-foreground">
                {p.descricao ?? `${p.vezes_semana} ${p.vezes_semana === 1 ? "aula" : "aulas"} por semana`}
              </p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-sm text-muted-foreground">R$</span>
                <span className="font-display text-6xl font-bold leading-none">{preco.format(p.valor_padrao)}</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
