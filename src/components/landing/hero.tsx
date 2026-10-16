import Image from "next/image";
import { Clock } from "lucide-react";
import { getSiteConfig } from "@/lib/cms";
import { ENDERECO } from "@/lib/site";
import { GoogleCta } from "./google-cta";

export async function Hero() {
  const c = await getSiteConfig();
  return (
    <section id="topo" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 md:grid-cols-[1.1fr_0.9fr] md:pt-20 md:pb-24">
      <div className="cg-rise">
        <p className="cg-label">
          Studio de movimento · {ENDERECO.bairro}, {ENDERECO.cidade}
        </p>
        <h1 className="mt-4 text-[clamp(3rem,9vw,5.25rem)]">
          {c.hero_titulo}
          <br />
          <em className="font-normal text-accent">{c.hero_destaque}</em>
        </h1>
        <p className="mt-5 mb-8 max-w-[44ch] text-lg text-muted-foreground">{c.hero_subtitulo}</p>
        <div className="flex flex-wrap gap-3">
          <GoogleCta local="hero" className="h-12 px-7" />
          <a
            href="#horarios"
            data-track="ver_horarios_click"
            className="inline-flex h-12 items-center rounded-full border border-border px-7 text-[15px] font-semibold hover:border-foreground"
          >
            <Clock aria-hidden className="mr-2 size-4" />
            Ver horários
          </a>
        </div>
      </div>
      <div aria-hidden className="cg-rise cg-rise-2 flex justify-center gap-2">
        <Image src="/brand/pose1.svg" alt="" width={230} height={230} className="w-[48%] max-w-[230px] opacity-90" />
        <Image src="/brand/pose2.svg" alt="" width={230} height={230} className="w-[48%] max-w-[230px] opacity-90" />
      </div>
    </section>
  );
}
