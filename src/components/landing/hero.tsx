import { GoogleCta } from "./google-cta";

const ticker = ["Musculação", "Funcional", "Spinning", "Boxe", "Mobilidade", "Treino em grupo"];

export function Hero() {
  return (
    <section id="topo" className="cg-grain relative overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-28 md:pb-28">
        <p className="mb-6 text-sm font-medium tracking-[0.2em] text-[var(--cg-signal)] uppercase">
          Academia · treino de perto
        </p>
        <h1 className="cg-display text-[clamp(3.5rem,13vw,10rem)]">
          Treino com
          <br />
          <span className="text-[var(--cg-signal)]">nome</span> e sobrenome.
        </h1>
        <p className="mt-8 max-w-xl text-lg text-[var(--cg-dim)]">
          No CG Studio ninguém é número de catraca. Turmas pequenas, professores
          que corrigem seu movimento e uma rotina que cabe na sua semana.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <GoogleCta />
          <a href="#planos" className="min-h-12 content-center px-2 text-[var(--cg-bone)] underline underline-offset-4 decoration-[var(--cg-line)] hover:decoration-[var(--cg-signal)]">
            Ver planos
          </a>
        </div>
      </div>
      <div aria-hidden className="overflow-hidden border-y border-[var(--cg-line)] bg-[var(--cg-ink-2)] py-3">
        <div className="cg-marquee cg-display flex w-max gap-10 text-xl whitespace-nowrap text-[var(--cg-dim)]">
          {[...ticker, ...ticker, ...ticker, ...ticker].map((t, i) => (
            <span key={i} className="flex gap-10">
              {t} <span className="text-[var(--cg-signal)]">/</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
