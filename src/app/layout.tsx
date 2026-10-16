import type { Metadata } from "next";
import { Inter, Lobster_Two } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { RastreioCliques } from "@/components/analytics/rastreio-cliques";
import { Toaster } from "@/components/ui/sonner";
import { getSiteConfig } from "@/lib/cms";
import { ENDERECO, SITE_URL } from "@/lib/site";
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
  const title = `CG Studio · Treino funcional no ${ENDERECO.bairro}, ${ENDERECO.cidade}`;
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description: meta_descricao,
    openGraph: { type: "website", locale: "pt_BR", siteName: "CG Studio", url: "/", title, description: meta_descricao },
    // Verificação de propriedade do Google Search Console (método "Tag HTML").
    verification: { google: "1Lu6tj3rYkaAQKaOr7YkMsnUPrSNNRS0kzrb0iaZi18" },
  };
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
