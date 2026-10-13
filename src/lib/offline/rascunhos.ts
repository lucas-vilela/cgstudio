"use client";

import type { CamposAnamnese } from "@/lib/anamnese";

// Alterações da anamnese ainda não salvas, por aluno, só em memória: sair da ficha (inclusive pelo
// voltar do navegador) e voltar não perde o que foi digitado. Recarregar ou fechar a aba avisa
// (beforeunload) enquanto houver rascunho.
const rascunhos = new Map<string, CamposAnamnese>();

function avisoAoSair(e: BeforeUnloadEvent) {
  e.preventDefault();
}

function ajustarAviso() {
  if (typeof window === "undefined") return;
  window.removeEventListener("beforeunload", avisoAoSair);
  if (rascunhos.size) window.addEventListener("beforeunload", avisoAoSair);
}

export const lerRascunho = (memberId: string) => rascunhos.get(memberId);

export function guardarRascunho(memberId: string, campos: CamposAnamnese) {
  if (Object.keys(campos).length) rascunhos.set(memberId, campos);
  else rascunhos.delete(memberId);
  ajustarAviso();
}

export function apagarRascunho(memberId: string) {
  rascunhos.delete(memberId);
  ajustarAviso();
}
