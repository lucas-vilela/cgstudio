import type { Metadata } from "next";
import { Inter, Lobster_Two } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { RastreioCliques } from "@/components/analytics/rastreio-cliques";
import { Toaster } from "@/components/ui/sonner";
import { getSiteConfig } from "@/lib/cms";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lobster = Lobster_Two({
  variable: "--font-lobster",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { meta_descricao } = await getSiteConfig();
  return { title: "CG Studio", description: meta_descricao };
}

// Só carrega em produção, para não poluir as métricas com acessos locais.
const gaId =
  process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_GA_ID : undefined;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${lobster.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <RastreioCliques />
        <Toaster position="top-center" richColors closeButton />
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
