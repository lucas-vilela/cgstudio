import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Modalities } from "@/components/landing/modalities";
import { Plans } from "@/components/landing/plans";
import { Schedule } from "@/components/landing/schedule";
import { Testimonials } from "@/components/landing/testimonials";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="cg flex-1">
      <Header />
      <main>
        <Hero />
        <Modalities />
        <Plans />
        <Schedule />
        <Testimonials />
      </main>
      <Footer />
    </div>
  );
}
