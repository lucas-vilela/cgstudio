import { MapPin, Phone, Mail } from "lucide-react";
import { GoogleCta } from "./google-cta";

// Dados de contato ilustrativos — substituir pelos reais.
export function Footer() {
  return (
    <footer id="contato" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <h2 className="cg-display text-[clamp(3rem,10vw,8rem)]">
        Primeiro treino<br /><span className="text-[var(--cg-signal)]">é com a gente.</span>
      </h2>
      <div className="mt-10"><GoogleCta /></div>
      <address className="mt-16 grid gap-6 border-t border-[var(--cg-line)] pt-8 text-[var(--cg-dim)] not-italic md:grid-cols-3">
        <p className="flex gap-3"><MapPin aria-hidden className="mt-1 size-4 shrink-0 text-[var(--cg-signal)]" />Rua Exemplo, 123 — Centro</p>
        <p className="flex gap-3"><Phone aria-hidden className="mt-1 size-4 shrink-0 text-[var(--cg-signal)]" /><a href="tel:+5500000000000" className="hover:text-[var(--cg-bone)]">(00) 0000-0000</a></p>
        <p className="flex gap-3"><Mail aria-hidden className="mt-1 size-4 shrink-0 text-[var(--cg-signal)]" /><a href="mailto:contato@cgstudio.com.br" className="hover:text-[var(--cg-bone)]">contato@cgstudio.com.br</a></p>
      </address>
      <p className="mt-10 text-sm text-[var(--cg-dim)]">© CG Studio. Todos os direitos reservados.</p>
    </footer>
  );
}
