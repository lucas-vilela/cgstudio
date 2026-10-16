import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Modalities } from "@/components/landing/modalities";
import { Plans } from "@/components/landing/plans";
import { Schedule } from "@/components/landing/schedule";
import { Depoimentos } from "@/components/landing/depoimentos";
import { Footer } from "@/components/landing/footer";
import { SecoesVistas } from "@/components/analytics/secoes-vistas";

export default function Home() {
  return (
    <div className="flex-1">
      <Header />
      <main>
        <Hero />
        <Modalities />
        <Plans />
        <Depoimentos />
        <Schedule />
      </main>
      <Footer />
      <SecoesVistas />
    </div>
  );
}
