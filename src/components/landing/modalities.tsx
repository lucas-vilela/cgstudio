import { SectionTitle } from "./section-title";

// Modalidades ilustrativas — confirmar com o studio.
const items = [
  ["Funcional", "Circuitos em turma pequena para força, fôlego e coordenação."],
  ["Pilates", "Controle, postura e respiração, com ajuste individual."],
  ["Alongamento e mobilidade", "Mais amplitude de movimento e menos tensão no dia a dia."],
  ["Treino em dupla ou trio", "Atenção próxima do professor, no seu ritmo."],
];

export function Modalities() {
  return (
    <section id="modalidades" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Modalidades" note="Aulas conduzidas de perto, com poucas pessoas por horário.">
          Treinos para todo corpo
        </SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map(([name, desc]) => (
            <li key={name} className="rounded-[20px] border border-border bg-surface p-6">
              <h3 className="text-2xl">{name}</h3>
              <p className="mt-2 text-muted-foreground">{desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
