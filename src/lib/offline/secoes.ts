"use client";

import { useSyncExternalStore } from "react";

// Telas do admin que funcionam offline: estas rotas renderizam o mesmo app de cliente (AdminApp)
// e a troca entre elas é só pushState (AdminNav, LinkAluno).
const FICHA = "/dashboard/admin/aluno";
const SECOES = new Set(["/dashboard/admin", "/dashboard/admin/financeiro", "/dashboard/admin/calendario", FICHA]);

export const ehSecaoOffline = (path: string) => SECOES.has(path);
export const ehFicha = (path: string) => path === FICHA;

export const fichaHref = (memberId: string, aba?: "anamnese" | "medidas" | "acompanhamento") =>
  `${FICHA}?id=${encodeURIComponent(memberId)}${aba ? `&aba=${aba}` : ""}`;

// A query muda sem o pathname mudar (de uma ficha para outra, troca de aba): quem navega avisa com
// este evento; voltar/avançar chegam por popstate.
export const EVENTO_NAVEGOU = "cg:navegou";
export const avisarNavegacao = () => window.dispatchEvent(new Event(EVENTO_NAVEGOU));

function assinar(f: () => void) {
  window.addEventListener("popstate", f);
  window.addEventListener(EVENTO_NAVEGOU, f);
  return () => {
    window.removeEventListener("popstate", f);
    window.removeEventListener(EVENTO_NAVEGOU, f);
  };
}

// Query atual do navegador ("" no servidor, onde o app ainda não tem dados para mostrar).
export function useQuery() {
  const search = useSyncExternalStore(assinar, () => window.location.search, () => "");
  return new URLSearchParams(search);
}
