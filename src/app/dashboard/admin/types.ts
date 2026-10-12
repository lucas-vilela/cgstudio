// Formatos das tabelas/views da migration 0003 usadas pelas telas de admin.
export type Plan = {
  id: number;
  nome: string;
  vezes_semana: number;
  valor_padrao: number;
  descricao: string | null;
  exibir_na_home: boolean;
};

export type Situacao = "sem_vencimento" | "em_atraso" | "vence_em_breve" | "em_dia";

export type AdminMember = {
  member_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  status: "ativo" | "inativo" | "pendente";
  plan_id: number | null;
  plano_nome: string | null;
  vezes_semana: number | null;
  slots_usados: number;
  valor: number | null; // acordado ou padrão do plano
  valor_acordado: number | null;
  vencimento: string | null;
  dias_para_vencer: number | null;
  situacao: Situacao;
  treino_ids: number[];
};

export type Vencimento = {
  member_id: string;
  nome: string | null;
  plano_nome: string | null;
  valor: number | null;
  vencimento: string;
  dias_restantes: number;
};

export type Inadimplente = {
  member_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  status: string;
  plano_nome: string | null;
  valor_devido: number | null;
  vencimento: string;
  dias_atraso: number;
};

export type FinanceiroMes = {
  mes: string;
  total_recebido: number;
  qtd_pagamentos: number;
  total_pix: number;
  total_dinheiro: number;
  total_cartao: number;
};

export type Forma = "pix" | "dinheiro" | "cartao";
export const FORMAS: { value: Forma; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
];
export const formaLabel = (v: string) => FORMAS.find((f) => f.value === v)?.label ?? v;

export type Pagamento = {
  id: number;
  member_id: string;
  nome: string | null;
  valor: number;
  pago_em: string;
  forma: Forma;
  observacao: string | null;
};

export type SlotRow = {
  slot_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  capacidade: number;
  ativo: boolean;
  ocupados: number;
  vagas: number;
  alunos: { member_id: string; nome: string | null; email: string | null }[];
};

export type AdminUser = { user_id: string; nome: string | null; email: string | null };

// ---------------------------------------------------------------- CMS da home (migration 0006)

export type Treino = {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  ordem: number;
  ativo: boolean;
  qtd_alunos: number;
};

export type DepoimentoStatus = "pendente" | "aprovado" | "recusado" | "oculto";

export type DepoimentoAdmin = {
  id: number;
  texto: string;
  status: DepoimentoStatus;
  ajustado_pelo_admin: boolean;
  nome_exibicao: string;
  created_at: string;
  updated_at: string;
  aluno_nome: string | null;
  aluno_status: "ativo" | "inativo" | "pendente" | null;
};

// Linha crua de site_config: null = usa o texto padrão do código.
export type SiteConfigRow = {
  whatsapp: string | null;
  instagram: string | null;
  hero_titulo: string | null;
  hero_destaque: string | null;
  hero_subtitulo: string | null;
  nota_modalidades: string | null;
  nota_planos: string | null;
  nota_horarios: string | null;
  nota_contato: string | null;
  meta_descricao: string | null;
};
