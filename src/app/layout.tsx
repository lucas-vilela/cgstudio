import type { Metadata } from "next";
import { Inter, Lobster_Two } from "next/font/google";
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

export const metadata: Metadata = {
  title: "CG Studio",
  description:
    "CG Studio: studio de movimento com turmas pequenas e atenção ao seu movimento. Conheça modalidades, planos e horários.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${lobster.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
