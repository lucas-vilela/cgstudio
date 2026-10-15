// Datas como o app calcula: "hoje" é o dia em America/Sao_Paulo (ver private.hoje()).

export const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);

export function addDias(iso: string, n: number) {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** `date + interval '1 month'` do Postgres: 31/01 + 1 mês = 28/02 (ou 29). */
export function addMes(iso: string, n = 1) {
  const [y, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

export const diaDaSemana = (iso: string) => utc(iso).getUTCDay();

/** "14/10/2026" */
export const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
/** "14/10" */
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Próximas `n` datas a partir de amanhã que caem em `dow` (igual a proximasDatas do app). */
export function proximasDatas(hoje: string, dow: number, n = 4) {
  let d = addDias(hoje, 1);
  while (diaDaSemana(d) !== dow) d = addDias(d, 1);
  return Array.from({ length: n }, (_, i) => addDias(d, i * 7));
}

const MES = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
/** "outubro de 2026" */
export function mesLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MES.format(new Date(Date.UTC(y, m - 1, 1)))} de ${y}`;
}

export function shiftMes(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** "R$ 80,00" com espaço não separável, como o Intl do app. */
export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/** Regex que aceita o espaço normal ou o não separável do Intl. */
export const reBrl = (n: number) => new RegExp(brl(n).replace(/[\s ]/g, "[\\s\\u00a0]").replace(/\$/g, "\\$"));
