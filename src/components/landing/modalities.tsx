import { getSiteConfig, getTreinosHome } from "@/lib/cms";
import { TreinoIcon } from "@/lib/treino-icones";
import { SectionTitle } from "./section-title";

export async function Modalities() {
  const [treinos, c] = await Promise.all([getTreinosHome(), getSiteConfig()]);
  return (
    <section id="modalidades" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Modalidades" note={c.nota_modalidades}>
          Treinos para todo corpo
        </SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2">
          {treinos.map((t, i) => (
            <li key={`${i}-${t.nome}`} className="rounded-[20px] border border-border bg-surface p-6">
              <TreinoIcon name={t.icone} aria-hidden className="mb-3 size-7 text-accent" />
              <h3 className="text-2xl">{t.nome}</h3>
              <p className="mt-2 text-muted-foreground">{t.descricao}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
