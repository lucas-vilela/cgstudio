import type { MetadataRoute } from "next";

// App instalável do painel do admin (o modo offline vale só ali). Fora de /dashboard/admin o
// service worker não controla a página, então alunos e visitantes não recebem convite de instalação.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CG Studio — Painel",
    short_name: "CG Studio",
    description: "Painel do admin do CG Studio: alunos, pagamentos e horários, também sem internet.",
    id: "/dashboard/admin",
    start_url: "/dashboard/admin",
    scope: "/dashboard/admin",
    display: "standalone",
    background_color: "#1e1e1e",
    theme_color: "#1e1e1e",
    lang: "pt-BR",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
