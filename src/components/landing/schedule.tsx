import { CalendarDays } from "lucide-react";
import { DIAS, hhmm } from "@/app/dashboard/admin/format";
import { getSlotsPublicos } from "@/lib/slots";
import { SectionTitle } from "./section-title";

// Segunda a sábado, depois domingo.
const ORDEM = [1, 2, 3, 4, 5, 6, 0];

export async function Schedule() {
  const slots = await getSlotsPublicos();
  const porDia = ORDEM.map((d) => ({
    dia: d,
    faixas: slots.filter((s) => s.dia_semana === d),
  })).filter((g) => g.faixas.length > 0);

  return (
    <section id="horarios" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Horários" note="Turmas fixas, com poucas pessoas por horário. Entre com sua conta Google para ver as vagas e escolher os seus horários.">
          Horários que cabem na semana
        </SectionTitle>
        {porDia.length === 0 ? (
          <p className="rounded-[20px] border border-border bg-surface px-6 py-5 text-muted-foreground">
            Os horários serão divulgados em breve. Fale com a gente para saber das turmas.
          </p>
        ) : (
          <dl className="rounded-[20px] border border-border bg-surface px-6">
            {porDia.map(({ dia, faixas }) => (
              <div key={dia} className="flex flex-col gap-3 border-b border-border py-5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <dt className="flex items-center gap-2 text-muted-foreground sm:w-40 sm:shrink-0">
                  <CalendarDays aria-hidden className="size-4" />
                  {DIAS[dia]}
                </dt>
                <dd className="flex flex-wrap gap-2 sm:justify-end">
                  {faixas.map((f) => (
                    <span key={`${f.hora_inicio}-${f.hora_fim}`} className="rounded-full border border-border px-3 py-1 text-sm font-semibold">
                      {hhmm(f.hora_inicio)} às {hhmm(f.hora_fim)}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
