
// Depoimentos ilustrativos — substituir por depoimentos reais de alunos.
const quotes = [
  ["Em três meses parei de faltar. A turma pequena faz diferença.", "Marina, aluna do Studio"],
  ["O professor corrigiu minha postura no primeiro dia. Acabaram as dores nas costas.", "Rafael, musculação"],
  ["Reservo a aula pelo app e chego sabendo que tenho vaga.", "Camila, spinning"],
];

export function Testimonials() {
  return (
    <section className="bg-[var(--cg-signal)] py-20 text-[var(--cg-ink)] md:py-28" aria-labelledby="depoimentos">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="depoimentos" className="cg-display mb-12 text-5xl md:text-7xl">Quem treina, fala.</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {quotes.map(([q, a]) => (
            <figure key={a} className="border-t-2 border-[var(--cg-ink)] pt-5">
              <blockquote className="text-xl leading-snug font-medium">“{q}”</blockquote>
              <figcaption className="mt-4 text-sm font-semibold">{a}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
