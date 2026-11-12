// Tipos de plano e textos dos cartões, usados pela home, pelo admin e pelo backup.
// Mensal e trimestral são planos de aluno (frequência semanal); aula avulsa só aparece na home.

export type PlanoTipo = "mensal" | "trimestral" | "avulsa";

export const tipoDePlano = (v: unknown): PlanoTipo =>
  v === "trimestral" || v === "avulsa" ? v : "mensal";

export const NOME_TIPO: Record<PlanoTipo, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  avulsa: "Aula avulsa",
};

type PlanoTexto = { tipo: PlanoTipo; vezes_semana: number };

export function descricaoPadrao(p: PlanoTexto) {
  if (p.tipo === "avulsa") return "Pague só pela aula que fizer, sem mensalidade";
  return `${p.vezes_semana} ${p.vezes_semana === 1 ? "aula" : "aulas"} por semana`;
}

export const SUFIXO_PRECO: Record<PlanoTipo, string> = {
  mensal: "/mês",
  trimestral: "/trimestre",
  avulsa: "/aula",
};
