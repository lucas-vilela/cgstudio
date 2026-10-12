import { AtSign, MessageCircle } from "lucide-react";
import { formatPhone } from "@/app/dashboard/members";
import { getSiteConfig } from "@/lib/cms";
import { GoogleCta } from "./google-cta";
import { SectionTitle } from "./section-title";

// 5553984573198 -> (53) 98457-3198 (tira o DDI do Brasil, se houver).
const telefone = (n: string) => formatPhone(n.length >= 12 && n.startsWith("55") ? n.slice(2) : n);

export async function Footer() {
  const c = await getSiteConfig();
  return (
    <footer id="contato" className="border-t border-border py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle label="Contato" note={c.nota_contato}>
          Vamos conversar
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={`https://wa.me/${c.whatsapp}`}
            className="block rounded-[20px] border border-border bg-surface p-6 hover:border-accent"
          >
            <MessageCircle aria-hidden className="mb-3 size-6 text-accent" />
            <span className="font-display text-3xl font-bold">{telefone(c.whatsapp)}</span>
            <span className="mt-1 block text-muted-foreground">WhatsApp</span>
          </a>
          <a
            href={`https://instagram.com/${c.instagram}`}
            className="block rounded-[20px] border border-border bg-surface p-6 hover:border-accent"
          >
            <AtSign aria-hidden className="mb-3 size-6 text-accent" />
            <span className="font-display text-3xl font-bold">@{c.instagram}</span>
            <span className="mt-1 block text-muted-foreground">Instagram</span>
          </a>
        </div>
        <div className="mt-10"><GoogleCta className="h-12 px-7" /></div>
        <p className="mt-12 text-sm text-muted-foreground">© CG Studio</p>
      </div>
    </footer>
  );
}
