import type { LucideIcon } from "lucide-react";
import { Lightbulb } from "lucide-react";

// Página de ajuda (aluno e admin): índice + seções com tópicos. O conteúdo fica em cada página;
// aqui só a apresentação.

export type Topico = {
  titulo: string;
  texto?: React.ReactNode;
  /** Passo a passo numerado. */
  passos?: React.ReactNode[];
  /** Lista sem ordem (significado de selos, regras etc.). */
  itens?: React.ReactNode[];
  dica?: React.ReactNode;
};

export type Secao = {
  id: string;
  titulo: string;
  icone: LucideIcon;
  resumo: string;
  topicos: Topico[];
};

export function Guia({
  titulo, intro, secoes, rodape,
}: {
  titulo: string;
  intro: React.ReactNode;
  secoes: Secao[];
  rodape?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-2xl flex-col gap-3">
        <p className="cg-label">Ajuda</p>
        <h1 className="text-4xl">{titulo}</h1>
        <div className="text-muted-foreground">{intro}</div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Tópicos da ajuda" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {secoes.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 lg:w-full lg:rounded-lg lg:border-transparent lg:px-3">
                  <s.icone aria-hidden className="size-4 shrink-0" />
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {secoes.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`}
              className="scroll-mt-6 rounded-xl border border-border bg-surface p-4 md:p-6">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
                  <s.icone aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 id={`${s.id}-titulo`} className="text-3xl">{s.titulo}</h2>
                  <p className="text-sm text-muted-foreground">{s.resumo}</p>
                </div>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {s.topicos.map((t) => <TopicoBloco key={t.titulo} t={t} />)}
              </div>
            </section>
          ))}
          {rodape}
        </div>
      </div>
    </div>
  );
}

function TopicoBloco({ t }: { t: Topico }) {
  return (
    <article className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <h3 className="font-display text-xl font-bold">{t.titulo}</h3>
      {t.texto && <div className="text-sm leading-relaxed text-muted-foreground">{t.texto}</div>}
      {t.passos && (
        <ol className="flex flex-col gap-2 text-sm leading-relaxed">
          {t.passos.map((p, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
                {i + 1}
              </span>
              <span className="pt-0.5">{p}</span>
            </li>
          ))}
        </ol>
      )}
      {t.itens && (
        <ul className="flex flex-col gap-1.5 text-sm leading-relaxed">
          {t.itens.map((p, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      {t.dica && (
        <p className="mt-1 flex gap-2.5 rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed">
          <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <span><span className="font-semibold">Dica: </span>{t.dica}</span>
        </p>
      )}
    </article>
  );
}
