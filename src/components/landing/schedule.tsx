import { SectionTitle } from "./section-title";
import { CalendarDays } from "lucide-react";

// Horários ilustrativos — o calendário real fica no painel do aluno.
const rows = [
  ["Segunda a sexta", "07h às 20h"],
  ["Sábado", "Sob agendamento"],
];

export function Schedule() {
  return (
    <section id="horarios" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Horários" note="Turmas fixas de segunda a sexta. Entre com sua conta Google para ver as vagas e escolher os seus horários.">
          Horários que cabem na semana
        </SectionTitle>
        <dl className="rounded-[20px] border border-border bg-surface px-6">
          {rows.map(([d, h]) => (
            <div key={d} className="flex items-baseline justify-between gap-4 border-b border-border py-5 last:border-0">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays aria-hidden className="size-4" />
                {d}
              </dt>
              <dd className="text-lg font-semibold">{h}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
