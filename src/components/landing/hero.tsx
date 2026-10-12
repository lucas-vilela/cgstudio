import Image from "next/image";
import { GoogleCta } from "./google-cta";

export function Hero() {
  return (
    <section id="topo" className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 md:grid-cols-[1.1fr_0.9fr] md:pt-20 md:pb-24">
      <div className="cg-rise">
        <p className="cg-label">Studio de movimento</p>
        <h1 className="mt-4 text-[clamp(3rem,9vw,5.25rem)]">
          Corpo em ação,
          <br />
          <em className="font-normal text-accent">mente em equilíbrio.</em>
        </h1>
        <p className="mt-5 mb-8 max-w-[44ch] text-lg text-muted-foreground">
          Turmas pequenas, atenção ao seu movimento e horários que cabem na sua semana.
        </p>
        <div className="flex flex-wrap gap-3">
          <GoogleCta className="h-12 px-7" />
          <a
            href="#horarios"
            className="inline-flex h-12 items-center rounded-full border border-border px-7 text-[15px] font-semibold hover:border-foreground"
          >
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
