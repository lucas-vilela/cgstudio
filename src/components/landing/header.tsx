import { GoogleCta } from "./google-cta";

const links = [
  ["Modalidades", "#modalidades"],
  ["Planos", "#planos"],
  ["Horários", "#horarios"],
  ["Contato", "#contato"],
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--cg-line)] bg-[var(--cg-ink)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#topo" className="cg-display text-2xl" aria-label="CG Studio, início">
          CG<span className="text-[var(--cg-signal)]">.</span>Studio
        </a>
        <nav aria-label="Principal" className="hidden gap-8 text-sm text-[var(--cg-dim)] md:flex">
          {links.map(([l, h]) => (
            <a key={h} href={h} className="hover:text-[var(--cg-bone)]">
              {l}
            </a>
          ))}
        </nav>
        <GoogleCta className="h-10 px-5 text-sm max-sm:hidden" />
      </div>
    </header>
  );
}
