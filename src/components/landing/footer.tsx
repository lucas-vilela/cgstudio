import { SectionTitle } from "./section-title";
import { GoogleCta } from "./google-cta";

export function Footer() {
  return (
    <footer id="contato" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Contato" note="Fale com a gente para tirar dúvidas ou marcar sua aula experimental.">
          Vamos conversar
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="https://wa.me/5553984573198"
            className="block rounded-[20px] border border-border bg-surface p-6 hover:border-accent"
          >
            <span className="font-display text-3xl font-bold">(53) 98457-3198</span>
            <span className="mt-1 block text-muted-foreground">WhatsApp</span>
          </a>
          <a
            href="https://instagram.com/studioclaricegeiger"
            className="block rounded-[20px] border border-border bg-surface p-6 hover:border-accent"
          >
            <span className="font-display text-3xl font-bold">@studioclaricegeiger</span>
            <span className="mt-1 block text-muted-foreground">Instagram</span>
          </a>
        </div>
        <div className="mt-10"><GoogleCta className="h-12 px-7" /></div>
        <p className="mt-12 text-sm text-muted-foreground">© CG Studio</p>
      </div>
    </footer>
  );
}
