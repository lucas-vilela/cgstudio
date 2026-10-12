// Tipos e validação compartilhados do cadastro de alunos (colunas de public.members).
// Planos vêm da tabela `plans` (ver admin/types.ts), não de constantes.
export const STATUSES = [
  { value: "pendente", label: "Pendente" },
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
] as const;

export type MemberStatus = (typeof STATUSES)[number]["value"];

export type Member = {
  id: string;
  auth_user_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  status: MemberStatus;
  plan_id: number | null;
  valor_acordado: number | null;
  vencimento: string | null;
  created_at: string;
};

export type MemberInput = { nome: string; telefone: string };
export type FieldErrors = Partial<Record<keyof MemberInput, string>>;

export const statusLabel = (v: string) =>
  STATUSES.find((s) => s.value === v)?.label ?? v;

export function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "");
}

export function formatPhone(raw: string | null) {
  const d = normalizePhone(raw ?? "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw ?? "";
}

export function validateMember(
  raw: Record<string, unknown>,
): { data: MemberInput } | { errors: FieldErrors } {
  const errors: FieldErrors = {};
  const nome = String(raw.nome ?? "").trim().replace(/\s+/g, " ");
  const telefone = normalizePhone(String(raw.telefone ?? ""));

  if (nome.length < 2) errors.nome = "Informe o nome completo.";
  else if (nome.length > 100) errors.nome = "Nome muito longo (máx. 100).";

  if (telefone.length < 10 || telefone.length > 11)
    errors.telefone = "Telefone inválido. Use DDD + número.";

  if (Object.keys(errors).length) return { errors };
  return { data: { nome, telefone } };
}
