import { SectionTitle } from "./section";

const rows = [
  ["Segunda a sexta", "05h30 às 22h30"],
  ["Sábado", "08h às 14h"],
  ["Domingo e feriados", "09h às 12h"],
];
const classes = [
  ["06h30", "Funcional"],
  ["12h15", "Spinning"],
  ["18h30", "Boxe"],
  ["19h30", "Mobilidade"],
];

export function Schedule() {
  return (
    <section id="horarios" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <SectionTitle kicker="Horários">Abre cedo. Fecha tarde.</SectionTitle>
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <h3 className="mb-4 text-sm tracking-[0.2em] text-[var(--cg-dim)] uppercase">Funcionamento</h3>
          <dl className="divide-y divide-[var(--cg-line)] border-y border-[var(--cg-line)]">
            {rows.map(([d, h]) => (
              <div key={d} className="flex justify-between gap-4 py-4">
                <dt>{d}</dt>
                <dd className="cg-display text-2xl text-[var(--cg-signal)]">{h}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="mb-4 text-sm tracking-[0.2em] text-[var(--cg-dim)] uppercase">Aulas em grupo (seg a sex)</h3>
          <ul className="divide-y divide-[var(--cg-line)] border-y border-[var(--cg-line)]">
            {classes.map(([h, c]) => (
              <li key={h} className="flex justify-between gap-4 py-4">
                <span className="cg-display text-2xl">{h}</span>
                <span className="text-[var(--cg-dim)]">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
