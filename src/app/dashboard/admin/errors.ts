// Códigos levantados pelas funções do banco (migration 0003) -> mensagens pt-BR.
const MESSAGES: Record<string, string> = {
  nao_admin: "Apenas administradores podem fazer isso.",
  nao_autenticado: "Sessão expirada. Entre novamente.",
  forma_invalida: "Forma de pagamento inválida.",
  aluno_nao_encontrado: "Aluno não encontrado.",
  valor_invalido: "Valor inválido. Informe um valor maior que zero ou defina um plano.",
  papel_invalido: "Papel inválido.",
  usuario_nao_encontrado: "Usuário não encontrado.",
  nao_pode_rebaixar_a_si_mesmo: "Você não pode rebaixar a si mesmo.",
  ultimo_admin: "Não é possível rebaixar o último admin.",
};

export function friendlyError(
  error: { message?: string; code?: string } | null | undefined,
  fallback = "Não foi possível concluir. Tente novamente.",
) {
  if (!error) return fallback;
  const msg = error.message ?? "";
  for (const [code, text] of Object.entries(MESSAGES)) if (msg.includes(code)) return text;
  if (error.code === "42501") return MESSAGES.nao_admin;
  return fallback;
}
