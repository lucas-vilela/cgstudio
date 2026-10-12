export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function brl(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

// Datas do banco são `date` (AAAA-MM-DD): formatar sem passar por Date evita erro de fuso.
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export const hhmm = (t: string) => t.slice(0, 5);

export function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// Aceita "AAAA-MM"; qualquer outra coisa cai no mês atual. Devolve "AAAA-MM".
export function parseMonth(raw: string | undefined) {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : todayISO().slice(0, 7);
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return `${nome} de ${y}`;
}

export function diasLabel(n: number) {
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n > 1) return `em ${n} dias`;
  return n === -1 ? "ontem" : `há ${-n} dias`;
}

// "75,00" ou "75.5" -> 75 / 75.5. Vazio -> null. Inválido -> NaN.
export function parseMoney(raw: string) {
  const s = raw.trim().replace(/\s/g, "").replace(/^R\$/, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}

export const moneyInput = (n: number | null | undefined) =>
  n == null ? "" : n.toFixed(2).replace(".", ",");
