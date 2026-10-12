import { getDepoimentosHome } from "@/lib/cms";
import { SectionTitle } from "./section-title";

export async function Depoimentos() {
  const itens = await getDepoimentosHome();
  if (itens.length === 0) return null;
  return (
    <section id="depoimentos" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Depoimentos">Quem treina com a gente</SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((d) => (
            <li key={d.id}>
              <figure className="flex h-full flex-col rounded-[20px] border border-border bg-surface p-6">
                <span aria-hidden className="font-serif text-5xl leading-none text-accent">“</span>
                <blockquote className="mt-1 flex-1 whitespace-pre-line text-muted-foreground">{d.texto}</blockquote>
                <figcaption className="mt-5 flex items-center gap-3 text-sm font-semibold">
                  <span aria-hidden className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
                    {d.nome_exibicao.charAt(0).toUpperCase()}
                  </span>
                  {d.nome_exibicao}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
