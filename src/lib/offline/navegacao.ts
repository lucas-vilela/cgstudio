"use client";

import { toast } from "sonner";
import { avisarNavegacao, ehSecaoOffline } from "./secoes";

// Clique num link do painel. Entre telas do app offline: só pushState, sem ir ao servidor.
// Sem conexão, vindo de uma aba online, carrega a página inteira (o service worker serve a cópia
// salva); aba que precisa de conexão avisa. Com modificadores (nova aba etc.), o navegador decide.
export function navegar(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const pathname = window.location.pathname;
  const destino = href.split("?")[0];
  if (ehSecaoOffline(pathname) && ehSecaoOffline(destino)) {
    e.preventDefault();
    window.history.pushState(null, "", href);
    avisarNavegacao();
    window.scrollTo(0, 0);
  } else if (!navigator.onLine) {
    e.preventDefault();
    if (ehSecaoOffline(destino)) window.location.assign(href);
    else toast.warning("Esta aba precisa de conexão com a internet.");
  }
}
