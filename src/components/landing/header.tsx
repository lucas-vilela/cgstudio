import Image from "next/image";
import { GoogleCta } from "./google-cta";

const links = [
  ["Modalidades", "#modalidades"],
  ["Planos", "#planos"],
  ["Horários", "#horarios"],
  ["Contato", "#contato"],
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <a href="#topo" aria-label="CG Studio, início" className="shrink-0 rounded-md">
          <Image src="/brand/logo-crop.svg" alt="CG Studio" width={166} height={64} priority className="h-14 w-auto md:h-16" />
        </a>
        <nav aria-label="Principal" className="hidden gap-7 text-sm text-muted-foreground md:flex">
          {links.map(([l, h]) => (
            <a key={h} href={h} className="rounded-md py-2 hover:text-foreground">
              {l}
            </a>
          ))}
        </nav>
        <GoogleCta className="h-11 px-4 text-sm sm:px-6" />
      </div>
    </header>
  );
}
