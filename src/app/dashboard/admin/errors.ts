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
  members_telefone_unique: "Este telefone já está em uso por outro cadastro. Informe outro número.",
  members_email_unique: "Este e-mail já está em uso por outro cadastro.",
  members_telefone_digitos: "Telefone inválido. Use DDD + número.",
  aluno_com_login: "Este aluno já entrou com a conta Google e não pode ser excluído por aqui.",
  aluno_com_pagamentos: "Este aluno tem pagamentos registrados e não pode ser excluído.",
  treino_minimo: "É preciso manter pelo menos um tipo de treino ativo.",
  aluno_nao_ativo: "Só alunos com matrícula ativa podem enviar depoimento.",
  aluno_sem_nome: "Complete seu nome no cadastro antes de enviar um depoimento.",
  texto_invalido: "O depoimento deve ter entre 10 e 500 caracteres.",
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
