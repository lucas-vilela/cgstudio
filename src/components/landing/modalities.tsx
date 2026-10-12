import { SectionTitle } from "./section";

const items = [
  ["Musculação", "Salão amplo, periodização individual e acompanhamento na execução."],
  ["Funcional", "Circuitos em grupo de até 12 pessoas. Força, fôlego e coordenação."],
  ["Spinning", "45 minutos de pedal com trilha, intervalos e muito suor."],
  ["Boxe", "Técnica de base, saco e mitt. Sem precisar de luta marcada."],
  ["Mobilidade", "Alongamento ativo e controle de movimento para treinar sem dor."],
];

export function Modalities() {
  return (
    <section id="modalidades" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <SectionTitle kicker="Modalidades">Escolha o seu ringue.</SectionTitle>
      <ul className="divide-y divide-[var(--cg-line)] border-y border-[var(--cg-line)]">
        {items.map(([name, desc], i) => (
          <li key={name} className="group grid grid-cols-[3rem_1fr] items-baseline gap-x-4 gap-y-1 py-6 md:grid-cols-[4rem_1fr_1.2fr] md:py-8">
            <span className="cg-display text-xl text-[var(--cg-signal)]">0{i + 1}</span>
            <h3 className="cg-display text-3xl transition group-hover:translate-x-2 md:text-5xl">{name}</h3>
            <p className="col-start-2 text-[var(--cg-dim)] md:col-start-3">{desc}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
